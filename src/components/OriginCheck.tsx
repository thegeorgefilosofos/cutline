import { useEffect, useRef, useState } from 'react';
import type { OriginLabel, OriginResult } from '../lib/origin';
import { analyzeOrigin } from '../lib/origin';

type State =
  | { kind: 'idle' }
  | { kind: 'loading'; started: number }
  | { kind: 'error'; message: string }
  | { kind: 'done'; result: OriginResult; text: string };

const READS: Record<'AI' | 'Human' | 'Mixed', string> = {
  Human: 'Reads as human-written.',
  Mixed: 'Reads as a mix.',
  AI: 'Reads as AI-generated.',
};

const LABEL_CLASS: Record<OriginLabel, string> = {
  'Human Written': 'o-human',
  'AI-Assisted': 'o-assisted',
  'AI-Generated': 'o-ai',
};

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

/** ORIGIN CHECK: optional, user-initiated Pangram analysis of the memory text. Never alters the memory. */
export function OriginCheck({ text, words }: { text: string; words: number }) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [elapsed, setElapsed] = useState(0);
  const run = useRef(0);

  useEffect(() => {
    if (state.kind !== 'loading') return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - state.started) / 1000)), 250);
    return () => clearInterval(t);
  }, [state]);

  const analyze = async () => {
    const id = ++run.current;
    const snapshot = text.trim();
    setElapsed(0);
    setState({ kind: 'loading', started: Date.now() });
    const out = await analyzeOrigin(snapshot);
    if (id !== run.current) return;
    setState(out.ok ? { kind: 'done', result: out.result, text: snapshot } : { kind: 'error', message: out.error });
  };

  const ready = words >= 5;
  const stale = state.kind === 'done' && state.text !== text.trim();

  return (
    <section className="origin" aria-labelledby="origin-title">
      <div className="origin-head">
        <p className="mono label" id="origin-title">
          Origin check — optional
        </p>
        <p className="origin-lede">
          Curious how your words read to an AI-text detector? You can send this memory to{' '}
          <a href="https://www.pangram.com" target="_blank" rel="noreferrer">
            Pangram
          </a>
          , an independent service that estimates which passages read as human-written, AI-assisted or AI-generated.
        </p>
        <p className="mono origin-fine">
          It does not judge whether a memory is true, and it is not proof of who wrote it. Your memory stays exactly as
          you wrote it, whatever the result.
        </p>
      </div>

      <div className="origin-action">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={analyze}
          disabled={!ready || state.kind === 'loading'}
        >
          {state.kind === 'done' && !stale ? 'Analyze again' : 'Analyze with Pangram'}
        </button>
        <p className="mono origin-consent">
          {ready
            ? 'Sends this text to Pangram for analysis. CUTLINE does not store or log it.'
            : 'Write at least five words first.'}
        </p>
      </div>

      {state.kind === 'loading' && (
        <div className="origin-loading mono" role="status">
          <span>Pangram is reading</span>
          <span>{String(elapsed).padStart(2, '0')} s</span>
          <i />
        </div>
      )}

      {state.kind === 'error' && (
        <p className="origin-error mono" role="alert">
          {state.message}
        </p>
      )}

      {state.kind === 'done' && (
        <div className={`origin-result ${stale ? 'is-stale' : ''}`} aria-live="polite">
          {stale && <p className="mono origin-stale">The text has changed since this analysis.</p>}

          <div className="origin-verdict">
            <h3>{state.result.prediction_short ? READS[state.result.prediction_short] : 'No overall reading returned.'}</h3>
            {state.result.headline && (
              <p className="mono">
                Pangram: “{state.result.headline}”
              </p>
            )}
          </div>

          <div className="origin-bar" aria-hidden>
            <i className="o-human" style={{ flexGrow: state.result.fractions.human ?? 0 }} />
            <i className="o-assisted" style={{ flexGrow: state.result.fractions.ai_assisted ?? 0 }} />
            <i className="o-ai" style={{ flexGrow: state.result.fractions.ai ?? 0 }} />
          </div>
          <dl className="origin-fractions mono">
            <div>
              <dt>
                <span className="sw o-human" /> Human-written
              </dt>
              <dd>{pct(state.result.fractions.human)}</dd>
            </div>
            <div>
              <dt>
                <span className="sw o-assisted" /> AI-assisted
              </dt>
              <dd>{pct(state.result.fractions.ai_assisted)}</dd>
            </div>
            <div>
              <dt>
                <span className="sw o-ai" /> AI-generated
              </dt>
              <dd>{pct(state.result.fractions.ai)}</dd>
            </div>
          </dl>
          <p className="origin-note">
            AI-assisted means human writing that was edited or polished with AI help. It is not the same as fully
            AI-generated text.
          </p>

          {state.result.windows.length > 0 && (
            <ol className="origin-windows">
              {state.result.windows.map((w, i) => (
                <li key={i} className={w.label ? LABEL_CLASS[w.label] : ''}>
                  <p className="mono">
                    {String(i + 1).padStart(2, '0')} · {w.label ?? 'Unlabelled'}
                    {w.confidence ? ` · ${w.confidence} confidence` : ''}
                  </p>
                  <p className="origin-window-text">{w.text}</p>
                </li>
              ))}
            </ol>
          )}

          <p className="mono origin-meta">
            Pangram · model {state.result.model}
            {state.result.version ? ` · version ${state.result.version}` : ''} · {(state.result.ms / 1000).toFixed(1)} s
          </p>
          <p className="mono origin-fine">
            Detection is probabilistic. Read it as one perspective on the writing, not a verdict.
          </p>
        </div>
      )}
    </section>
  );
}
