// Nous Research (Hermes) client. Server-side only: the API key never leaves this process
// and is never logged or returned to the browser.

import { extractJson, LIGHTS, MOTIFS, validateInterpretation } from './validate.js';

const BASE = () => (process.env.NOUS_BASE_URL || 'https://inference-api.nousresearch.com/v1').replace(/\/+$/, '');
const key = () => (process.env.NOUS_API_KEY || '').trim();

export const isHermesModel = (id) => /hermes/i.test(String(id || ''));

export const keyConfigured = () => key().length > 0 && !/^your-.*-here$/.test(key());

/** Remove any accidental echo of the key from text we might show or log. */
export function redact(text) {
  const k = key();
  let s = String(text ?? '');
  if (k && k.length > 6) s = s.split(k).join('[redacted]');
  return s.replace(/Bearer\s+[A-Za-z0-9._\-]+/g, 'Bearer [redacted]').slice(0, 300);
}

// Last real outcome of each kind of request, for honest status reporting.
export const health = {
  models: null, // { ok, at, count, error }
  chat: null, // { ok, at, ms, model, error }
};

let modelCache = { at: 0, ids: [] };

/** List model IDs from the authenticated /models endpoint (cached for 5 minutes). */
export async function listModels({ force = false } = {}) {
  if (!keyConfigured()) throw new Error('NOUS_API_KEY is not configured');
  if (!force && Date.now() - modelCache.at < 5 * 60_000 && modelCache.ids.length) return modelCache.ids;
  const res = await fetch(`${BASE()}/models`, {
    headers: { Authorization: `Bearer ${key()}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const err = `models ${res.status}: ${redact(await res.text())}`;
    health.models = { ok: false, at: Date.now(), error: err };
    throw new Error(err);
  }
  const body = await res.json();
  const ids = (Array.isArray(body?.data) ? body.data : []).map((m) => m?.id).filter((x) => typeof x === 'string');
  modelCache = { at: Date.now(), ids };
  health.models = { ok: true, at: Date.now(), count: ids.length };
  return ids;
}

/**
 * Resolve the model to use. NOUS_MODEL wins if set. Otherwise pick a Hermes model
 * that the authenticated models endpoint actually lists. Never invents an ID.
 */
export async function resolveModel() {
  const configured = (process.env.NOUS_MODEL || '').trim();
  let ids = [];
  try {
    ids = await listModels();
  } catch (e) {
    if (configured) return { model: configured, source: 'env', listed: null };
    throw e;
  }
  if (configured) return { model: configured, source: 'env', listed: ids.includes(configured) };
  const hermes = ids.filter((id) => /hermes/i.test(id));
  // Prefer the largest / newest-looking Hermes ID by a simple, transparent ordering.
  hermes.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  if (!hermes.length) {
    throw new Error('No Hermes model is listed by the Nous models endpoint. Set NOUS_MODEL to an available model ID.');
  }
  return { model: hermes[0], source: 'discovered', listed: true };
}

export const SYSTEM = `You are the curator of CUTLINE, an art exhibition called "The Things We Keep."
A visitor shares one ordinary memory. You propose three genuinely different artistic directions for it.

Strict rules:
- Use ONLY what the visitor wrote. Never invent names, places, dates, people, objects or events that are not in the memory.
  You may interpret mood, light and meaning, but present interpretation as interpretation, not as fact.
- The three directions must differ in concept, not just wording. Each is bound to one rendering mode:
  "afterglow" = an imagined photograph (light, atmosphere, a single frame);
  "index" = a Swiss typographic inventory (words, grid, numbering, one headline word);
  "cut" = a fragment collage (strips reassembled out of order, the way memory returns).
  Use each mode exactly once.
- "light" must be one of: ${LIGHTS.join(', ')}.
- "motifs" must be chosen only from: ${MOTIFS.join(', ')}. Choose only motifs supported by the memory text.
- "keep_words" are 3 to 7 words copied exactly from the memory that this direction keeps.
- "preserves" says what this direction keeps of the memory; "leaves_out" says what it deliberately cuts.
- Be concise and specific. Titles under 8 words. Other fields 1–2 sentences each.
- Reply with JSON only, no prose, matching exactly:
{"directions":[{"mode":"afterglow|index|cut","title":"","emotional_interpretation":"","visual_philosophy":"","composition":"","light":"","motifs":[],"keep_words":[],"preserves":"","leaves_out":""}]}`;

export function userPrompt({ text, year, preferences }) {
  const lines = [`Memory: """${text}"""`];
  if (year) lines.push(`Year given by the visitor: ${year}`);
  if (preferences && typeof preferences === 'object') {
    const pref = Object.entries(preferences)
      .filter(([, v]) => typeof v === 'string' && v.trim())
      .map(([k, v]) => `${k}: ${v.trim().slice(0, 80)}`);
    if (pref.length) lines.push(`Creative preferences: ${pref.join('; ')}`);
  }
  lines.push('Return the three directions as JSON.');
  return lines.join('\n');
}

async function chat(model, messages, jsonMode) {
  const res = await fetch(`${BASE()}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.8,
      max_tokens: 4000,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal: AbortSignal.timeout(45_000),
  });
  const raw = await res.text();
  if (!res.ok) {
    const e = new Error(`chat ${res.status}: ${redact(raw)}`);
    e.status = res.status;
    throw e;
  }
  const body = JSON.parse(raw);
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    const e = new Error(`model returned an empty message (finish_reason: ${body?.choices?.[0]?.finish_reason ?? 'unknown'})`);
    e.retryable = true;
    throw e;
  }
  return { content, servedModel: body?.model || model, usage: body?.usage || null };
}

/** Call Hermes and return a validated interpretation. Throws on any failure. */
export async function interpret(input) {
  if (!keyConfigured()) throw new Error('NOUS_API_KEY is not configured');
  const t0 = Date.now();
  const { model } = await resolveModel();
  const messages = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: userPrompt(input) },
  ];
  let lastError = null;
  // Attempt 1: JSON mode. Attempt 2: plain mode (some models reject response_format),
  // or a repair pass if the first reply did not validate.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { content, servedModel, usage } = await chat(model, messages, attempt === 0);
      const parsed = extractJson(content);
      const v = validateInterpretation(parsed, input.text);
      if (!v.ok) {
        lastError = new Error(`invalid structure: ${v.errors.slice(0, 4).join('; ')}`);
        messages.push({ role: 'assistant', content: content.slice(0, 4000) });
        messages.push({ role: 'user', content: `That JSON is invalid: ${v.errors.slice(0, 6).join('; ')}. Reply again with corrected JSON only.` });
        continue;
      }
      const ms = Date.now() - t0;
      health.chat = { ok: true, at: Date.now(), ms, model: servedModel };
      return { ...v.value, model: servedModel, ms, usage };
    } catch (e) {
      lastError = e;
      // Retry without JSON mode only when the request itself was rejected as invalid.
      if (!(attempt === 0 && (e.retryable || e.status === 400 || e.status === 422 || e instanceof SyntaxError || /JSON/.test(e.message)))) break;
    }
  }
  const error = redact(lastError?.message || 'unknown error');
  health.chat = { ok: false, at: Date.now(), model, error };
  throw new Error(error);
}
