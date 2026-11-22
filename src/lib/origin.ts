// ORIGIN CHECK client: user-initiated Pangram analysis through our own server.
// The browser never sees the Pangram key. Nothing here stores the memory text.

export type OriginLabel = 'AI-Generated' | 'AI-Assisted' | 'Human Written';

export interface OriginWindow {
  text: string;
  label: OriginLabel | null;
  confidence: 'High' | 'Medium' | 'Low' | null;
  ai_assistance_score: number | null;
  start_index: number | null;
  end_index: number | null;
  word_count: number | null;
}

/** Only fields Pangram documents and actually returned; null when absent or malformed. */
export interface OriginResult {
  prediction_short: 'AI' | 'Human' | 'Mixed' | null;
  prediction: string | null;
  headline: string | null;
  fractions: { human: number | null; ai_assisted: number | null; ai: number | null };
  segments: { human: number | null; ai_assisted: number | null; ai: number | null };
  windows: OriginWindow[];
  version: string | null;
  model: string;
  ms: number;
}

export type OriginOutcome = { ok: true; result: OriginResult } | { ok: false; code: string; error: string };

const MESSAGES: Record<string, string> = {
  credits: 'The Pangram account behind this exhibition has run out of credits. Your memory is unaffected.',
  not_configured: 'Origin check is not set up on this server.',
  auth: 'The server could not authenticate with Pangram.',
  model_not_enabled: 'The configured Pangram model is not available for this account.',
  rate_limited: 'Pangram is busy. Try again in a moment.',
  busy: 'Several analyses are running. Try again in a moment.',
  timeout: 'Pangram did not answer in time. Try again.',
  unreachable: 'Pangram could not be reached.',
  unavailable: 'Pangram is temporarily unavailable.',
  invalid_text: 'Pangram could not analyze this text.',
  analysis_failed: 'Pangram could not analyze this text.',
  invalid_input: 'Write at least five words first.',
};

export async function analyzeOrigin(text: string): Promise<OriginOutcome> {
  try {
    const res = await fetch('/api/origin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(75_000),
    });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.ok && body.result) return { ok: true, result: body.result as OriginResult };
    const code = typeof body?.code === 'string' ? body.code : 'unavailable';
    return { ok: false, code, error: MESSAGES[code] || body?.error || 'Origin check failed.' };
  } catch (e) {
    const timeout = e instanceof DOMException && e.name === 'TimeoutError';
    return { ok: false, code: timeout ? 'timeout' : 'unreachable', error: MESSAGES[timeout ? 'timeout' : 'unreachable'] };
  }
}
