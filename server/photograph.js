// PHOTOGRAPH: generate a photograph of the chosen direction on Modal, store it on this server.
// Browser → POST /api/photograph → Modal HTTPS endpoint (SDXL base 1.0 on a GPU) → JPEG saved to
// data/photographs/<id>.jpg → GET /api/photographs/<id>.
// The Modal URL and key stay server-side. Memory text and prompts are never logged.

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const url = () => (process.env.MODAL_PHOTOGRAPH_URL || '').trim();
const key = () => (process.env.MODAL_PHOTOGRAPH_KEY || '').trim();
export const storeDir = () =>
  process.env.PHOTOGRAPH_DIR || join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'photographs');

const validUrl = (u) =>
  /^https:\/\/[\w.-]+\.modal\.run\/?$/.test(u) ||
  // tests only: a local fake Modal endpoint
  (process.env.PHOTOGRAPH_ALLOW_LOCAL === '1' && /^http:\/\/(localhost|127\.0\.0\.1):\d+\/?$/.test(u));

export const photographConfigured = () => validUrl(url()) && key().length >= 16;

/** Last real outcome, for honest status reporting. Never contains prompts or images. */
export const photographHealth = { last: null };

export class PhotographError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const FRAMES = ['4:5', '1:1', '16:9', '3:1'];
const LIGHTS = {
  dawn: 'early dawn, pale cold sky turning warm',
  day: 'soft overcast daylight',
  dusk: 'low golden dusk light, long shadows',
  night: 'night, a few warm artificial lights in deep darkness',
};
const MOTIFS = {
  window: 'seen from inside a quiet room through a window',
  water: 'water reflecting the light',
  motion: 'gentle motion blur, streaks of passing light',
  rain: 'rain on glass',
  snow: 'falling snow',
  figures: 'small distant human figures seen from behind, faces not visible',
};
export const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const clean = (s, max) =>
  String(s ?? '')
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

/**
 * The prompt is built only from the chosen direction (composition, light, motifs) and the words the
 * person kept. Nothing is invented about the person's life.
 */
export function buildPrompt({ composition, light, motifs, words }) {
  const parts = [];
  const comp = clean(composition, 320);
  if (comp) parts.push(comp);
  const kept = (Array.isArray(words) ? words : []).map((w) => clean(w, 30)).filter(Boolean).slice(0, 9);
  if (kept.length) parts.push(`a memory of ${kept.join(', ')}`);
  if (LIGHTS[light]) parts.push(LIGHTS[light]);
  (Array.isArray(motifs) ? motifs : []).forEach((m) => MOTIFS[m] && parts.push(MOTIFS[m]));
  parts.push('quiet analogue film photograph, 35mm, soft grain, muted natural colours, intimate, understated, documentary');
  return clean(parts.join('. '), 900);
}

export function validateInput(body) {
  const b = body && typeof body === 'object' ? body : {};
  if (!FRAMES.includes(b.frame)) throw new PhotographError('invalid_input', 'Unsupported frame.', 400);
  if (!Object.hasOwn(LIGHTS, b.light)) throw new PhotographError('invalid_input', 'Unsupported light.', 400);
  if (b.motifs !== undefined && !Array.isArray(b.motifs)) throw new PhotographError('invalid_input', 'Motifs must be a list.', 400);
  if (!Array.isArray(b.words) || b.words.length === 0) throw new PhotographError('invalid_input', 'Keep at least one word.', 400);
  if (b.composition !== undefined && typeof b.composition !== 'string') throw new PhotographError('invalid_input', 'Invalid composition.', 400);
  const seed = Number.isInteger(b.seed) ? Math.abs(b.seed) % 2147483647 : 0;
  return { frame: b.frame, light: b.light, motifs: b.motifs || [], words: b.words, composition: b.composition || '', seed };
}

/** Generate on Modal and store the JPEG. Returns { id, model, ms }. */
export async function photograph(body, { timeoutMs = 180_000 } = {}) {
  if (!photographConfigured()) throw new PhotographError('not_configured', 'Modal is not configured on this server.', 503);
  const input = validateInput(body);
  const t0 = Date.now();
  try {
    let res;
    try {
      res = await fetch(url(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cutline-key': key() },
        body: JSON.stringify({ prompt: buildPrompt(input), frame: input.frame, seed: input.seed }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      if (e?.name === 'TimeoutError') throw new PhotographError('timeout', 'Modal did not finish in time. The GPU may still be starting; try again.', 504);
      throw new PhotographError('unreachable', 'Modal could not be reached.', 503);
    }
    if (res.status === 401 || res.status === 403) throw new PhotographError('auth', 'Modal rejected the server key.', 503);
    if (res.status === 422) throw new PhotographError('invalid_input', 'Modal rejected the request.', 400);
    if (!res.ok) throw new PhotographError('unavailable', 'Modal is temporarily unavailable.', 502);
    const jpg = Buffer.from(await res.arrayBuffer());
    if (jpg.length < 2000 || jpg.length > 8_000_000 || jpg[0] !== 0xff || jpg[1] !== 0xd8) {
      throw new PhotographError('bad_response', 'Modal did not return a usable image.', 502);
    }
    const id = randomUUID();
    await mkdir(storeDir(), { recursive: true });
    await writeFile(join(storeDir(), `${id}.jpg`), jpg);
    const model = (res.headers.get('x-model') || 'unknown').slice(0, 80);
    const ms = Date.now() - t0;
    photographHealth.last = { ok: true, at: Date.now(), ms, model };
    return { id, model, ms, frame: input.frame };
  } catch (e) {
    const err = e instanceof PhotographError ? e : new PhotographError('error', 'Unexpected error while developing.', 502);
    photographHealth.last = { ok: false, at: Date.now(), ms: Date.now() - t0, error: err.code };
    throw err;
  }
}

export async function readPhotograph(id) {
  if (!ID_RE.test(id)) return null;
  try {
    return await readFile(join(storeDir(), `${id}.jpg`));
  } catch {
    return null;
  }
}
