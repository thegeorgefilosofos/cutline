// PHOTOGRAPH client: asks our own server to develop the chosen direction on Modal.
// The browser never talks to Modal and never sees its key. Images are stored by the server;
// the collection only keeps the photograph's id.
import type { Light, Motif } from './analyze';
import type { Frame, Photograph } from './types';

export const photographUrl = (id: string) => `/api/photographs/${encodeURIComponent(id)}`;

export type PhotographOutcome = { ok: true; photo: Photograph; ms: number } | { ok: false; code: string; error: string };

const MESSAGES: Record<string, string> = {
  not_configured: 'Photographs are not set up on this server. The canvas artwork is unaffected.',
  timeout: 'Modal did not finish in time. The GPU may still be waking up; try again.',
  unreachable: 'Modal could not be reached.',
  auth: 'The server could not authenticate with Modal.',
  unavailable: 'Modal is temporarily unavailable.',
  bad_response: 'Modal did not return a usable image.',
  busy: 'A photograph is already being developed.',
  invalid_input: 'Keep at least one word before developing.',
};

export async function developPhotograph(input: {
  frame: Frame;
  light: Light;
  motifs: Motif[];
  words: string[];
  composition?: string;
  seed: number;
}): Promise<PhotographOutcome> {
  try {
    const res = await fetch('/api/photograph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(200_000),
    });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.ok && typeof body.id === 'string') {
      return {
        ok: true,
        photo: { id: body.id, model: String(body.model || 'unknown'), frame: input.frame, developedAt: Date.now() },
        ms: Number(body.ms) || 0,
      };
    }
    const code = typeof body?.code === 'string' ? body.code : 'unavailable';
    return { ok: false, code, error: MESSAGES[code] || 'Developing failed.' };
  } catch (e) {
    const timeout = e instanceof DOMException && e.name === 'TimeoutError';
    return { ok: false, code: timeout ? 'timeout' : 'unreachable', error: MESSAGES[timeout ? 'timeout' : 'unreachable'] };
  }
}
