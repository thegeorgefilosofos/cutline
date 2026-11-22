// Client for the server-side Hermes interpreter, with an honest local fallback.
// No secrets here: the browser only talks to our own /api endpoints.

import type { Analysis } from './analyze';
import type { CreativeDirection, Direction, Interpretation, Memory, Params } from './types';


const TIMEOUT_MS = 200_000; // covers two server-side agent runs (90 s each) when the first reply is unusable

export const isHermesModel = (model?: string) => /hermes/i.test(model || '');

/** Honest label for where an interpretation came from. Says "Hermes" only for a Hermes model. */
export function sourceLabel(source: string | undefined, model?: string): string {
  if (source === 'hermes-agent') {
    return isHermesModel(model) ? `Hermes Agent · ${model}` : `Hermes Agent · ${model} (not a Hermes model)`;
  }
  if (source === 'nous' || source === 'hermes') {
    return isHermesModel(model) ? `Hermes · ${model}` : `Nous API · ${model} (not a Hermes model)`;
  }
  return 'Local interpreter (no AI)';
}

export async function interpretMemory(m: Memory): Promise<Interpretation> {
  try {
    const res = await fetch('/api/interpret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: m.text, year: m.year }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.ok && (body.source === 'nous' || body.source === 'hermes-agent') && Array.isArray(body.directions) && body.directions.length === 3) {
      return { source: body.source, model: body.model, ms: body.ms, directions: body.directions };
    }
    return { source: 'local', fallbackReason: body?.error || `server responded ${res.status}` };
  } catch (e) {
    const reason =
      e instanceof DOMException && e.name === 'TimeoutError' ? 'Hermes did not answer in time' : 'interpretation server unreachable';
    return { source: 'local', fallbackReason: reason };
  }
}


export function directionFor(interp: Interpretation | null, mode: Direction): CreativeDirection | undefined {
  return interp && interp.source !== 'local' ? interp.directions?.find((d) => d.mode === mode) : undefined;
}

/**
 * Apply a Hermes direction's suggestions (light, motifs, kept words) to studio params.
 * With a local interpretation, params are returned unchanged apart from the direction.
 */
export function applyDirection(p: Params, interp: Interpretation | null, mode: Direction, a: Analysis, withLight = true): Params {
  const d = directionFor(interp, mode);
  if (!d) return { ...p, direction: mode, motifs: undefined };
  const kept: number[] = [];
  d.keep_words.forEach((w) => {
    // only meaningful words the studio can toggle; never filler like 'the' or 'on'
    const i = a.tokens.findIndex((t) => t.salient && t.clean === w);
    if (i >= 0 && !kept.includes(i)) kept.push(i);
  });
  return {
    ...p,
    direction: mode,
    light: withLight ? d.light : p.light,
    motifs: d.motifs,
    kept: withLight && kept.length ? kept : p.kept,
  };
}
