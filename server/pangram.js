// ORIGIN CHECK: Pangram AI-text analysis, server-side only.
// Official REST API (docs.pangram.com): x-api-key header, GET /models, POST /task, GET /task/{id}.
// The key never reaches the browser. Memory text is never logged.
// Entirely separate from the Hermes creative workflow.

const BASE = () => (process.env.PANGRAM_BASE_URL || 'https://text.external-api.pangram.com').replace(/\/+$/, '');
const key = () => (process.env.PANGRAM_API_KEY || '').trim();

export const pangramConfigured = () => key().length > 0 && !/^your-.*-here$/.test(key());

const PREDICTIONS = ['AI', 'Human', 'Mixed'];
const LABELS = ['AI-Generated', 'AI-Assisted', 'Human Written'];
const CONFIDENCE = ['High', 'Medium', 'Low'];

/** Last real outcomes, for honest status reporting. Never contains memory text. */
export const pangramHealth = { models: null, analysis: null };

export class PangramError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code; // stable code the frontend maps to a human message
    this.status = status; // HTTP status we return to the browser
  }
}

const UPSTREAM_ERRORS = {
  400: ['bad_request', 'Pangram rejected the request.', 502],
  401: ['auth', 'The Pangram API key is missing or invalid on the server.', 503],
  402: ['credits', 'The Pangram account has insufficient credits.', 503],
  403: ['model_not_enabled', 'This Pangram model is not enabled for the account.', 503],
  413: ['too_long', 'The text is too long for Pangram.', 422],
  422: ['invalid_text', 'Pangram could not analyze this text.', 422],
  429: ['rate_limited', 'Pangram is receiving too many requests. Try again in a moment.', 429],
  500: ['unavailable', 'Pangram is temporarily unavailable.', 503],
  503: ['unavailable', 'Pangram is temporarily unavailable.', 503],
};

async function call(path, init = {}, timeoutMs = 15_000) {
  let res;
  try {
    res = await fetch(`${BASE()}${path}`, {
      ...init,
      headers: { 'x-api-key': key(), 'Content-Type': 'application/json', ...(init.headers || {}) },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (e?.name === 'TimeoutError') throw new PangramError('timeout', 'Pangram did not answer in time.', 504);
    throw new PangramError('unreachable', 'Pangram could not be reached.', 503);
  }
  if (!res.ok) {
    const [code, message, status] = UPSTREAM_ERRORS[res.status] || ['unavailable', `Pangram responded ${res.status}.`, 502];
    throw new PangramError(code, message, status);
  }
  try {
    return await res.json();
  } catch {
    throw new PangramError('bad_response', 'Pangram returned an unreadable response.', 502);
  }
}

let modelCache = { at: 0, models: [] };

/** Models the account is entitled to, from GET /models (cached 5 minutes). */
export async function listModels({ force = false } = {}) {
  if (!pangramConfigured()) throw new PangramError('not_configured', 'Pangram is not configured on the server.', 503);
  if (!force && Date.now() - modelCache.at < 5 * 60_000 && modelCache.models.length) return modelCache.models;
  try {
    const body = await call('/models');
    const models = (Array.isArray(body?.models) ? body.models : []).filter((m) => typeof m === 'string');
    modelCache = { at: Date.now(), models };
    pangramHealth.models = { ok: true, at: Date.now(), models };
    return models;
  } catch (e) {
    pangramHealth.models = { ok: false, at: Date.now(), error: e.code || 'error' };
    throw e;
  }
}

/** PANGRAM_MODEL if set and listed; otherwise Pangram's own "default" alias if listed. Never invented. */
export async function resolveModel() {
  const models = await listModels();
  const configured = (process.env.PANGRAM_MODEL || '').trim();
  if (configured) {
    if (!models.includes(configured)) {
      throw new PangramError('model_not_enabled', `Model "${configured}" is not listed for this account.`, 503);
    }
    return configured;
  }
  if (models.includes('default')) return 'default';
  if (models.length) return models[0];
  throw new PangramError('no_models', 'No Pangram models are available for this account.', 503);
}

const num01 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null);
const int = (v) => (Number.isInteger(v) && v >= 0 ? v : null);
const str = (v, max = 400) => (typeof v === 'string' ? v.slice(0, max) : null);

/** Keep only documented fields, with checked types. Unknown or malformed values become null, never guessed. */
export function normalizeResult(raw, model) {
  if (!raw || typeof raw !== 'object') throw new PangramError('bad_response', 'Pangram returned an empty result.', 502);
  const prediction_short = PREDICTIONS.includes(raw.prediction_short) ? raw.prediction_short : null;
  const fractions = {
    human: num01(raw.fraction_human),
    ai_assisted: num01(raw.fraction_ai_assisted),
    ai: num01(raw.fraction_ai),
  };
  if (!prediction_short && fractions.human === null && fractions.ai === null) {
    throw new PangramError('bad_response', 'Pangram returned a result without a classification.', 502);
  }
  const windows = (Array.isArray(raw.windows) ? raw.windows : []).slice(0, 50).map((w) => ({
    text: str(w?.text, 2000) ?? '',
    label: LABELS.includes(w?.label) ? w.label : null,
    confidence: CONFIDENCE.includes(w?.confidence) ? w.confidence : null,
    ai_assistance_score: num01(w?.ai_assistance_score),
    start_index: int(w?.start_index),
    end_index: int(w?.end_index),
    word_count: int(w?.word_count),
  }));
  return {
    prediction_short,
    prediction: str(raw.prediction),
    headline: str(raw.headline, 200),
    fractions,
    segments: {
      human: int(raw.num_human_segments),
      ai_assisted: int(raw.num_ai_assisted_segments),
      ai: int(raw.num_ai_segments),
    },
    windows,
    version: str(raw.version, 40),
    model,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Submit the text, poll until done, return a normalized result. Throws PangramError. */
export async function analyze(text, { pollMs = 700, timeoutMs = 60_000 } = {}) {
  const t0 = Date.now();
  try {
    const model = await resolveModel();
    const created = await call('/task', {
      method: 'POST',
      body: JSON.stringify({ text, model, public_dashboard_link: false }),
    });
    const taskId = typeof created?.task_id === 'string' ? created.task_id : null;
    if (!taskId || !/^[\w-]{1,128}$/.test(taskId)) throw new PangramError('bad_response', 'Pangram did not return a task id.', 502);

    while (Date.now() - t0 < timeoutMs) {
      const body = await call(`/task/${encodeURIComponent(taskId)}`);
      if (body?.stage === 'STAGE_SUCCESS') {
        const result = normalizeResult(body, model);
        pangramHealth.analysis = { ok: true, at: Date.now(), ms: Date.now() - t0, model, version: result.version };
        return { ...result, ms: Date.now() - t0 };
      }
      if (body?.stage === 'STAGE_FAILED') {
        throw new PangramError('analysis_failed', `Pangram could not analyze this text${body?.headline ? `: ${str(body.headline, 160)}` : '.'}`, 422);
      }
      await sleep(pollMs);
    }
    throw new PangramError('timeout', 'Pangram did not finish in time.', 504);
  } catch (e) {
    const err = e instanceof PangramError ? e : new PangramError('error', 'Unexpected error while contacting Pangram.', 502);
    pangramHealth.analysis = { ok: false, at: Date.now(), ms: Date.now() - t0, error: err.code };
    throw err;
  }
}
