import { useEffect, useState } from 'react';
import type { Analysis } from '../lib/analyze';
import { LIGHT_LABEL } from '../lib/analyze';
import type { Interpretation } from '../lib/types';

export function Reading({
  analysis,
  interp,
  onDone,
}: {
  analysis: Analysis;
  /** null while the server is still interpreting. */
  interp: Interpretation | null;
  onDone: () => void;
}) {
  const [n, setN] = useState(0);
  const [dots, setDots] = useState(0);
  const total = analysis.tokens.length;
  const end = total + 14;
  const lines = [
    `Reading light ........ ${LIGHT_LABEL[analysis.light]}`,
    `Locating ............. ${analysis.hero}`,
    `Motifs ............... ${analysis.motifs.join(', ')}`,
    `Words that stayed .... ${analysis.keywords.length}`,
  ];

  useEffect(() => {
    const step = Math.max(28, Math.min(90, 1700 / total));
    const t = setInterval(() => setN((x) => Math.min(end, x + 1)), step);
    return () => clearInterval(t);
  }, [total, end]);

  useEffect(() => {
    if (interp) return;
    const t = setInterval(() => setDots((d) => (d + 1) % 4), 400);
    return () => clearInterval(t);
  }, [interp]);

  const lineCount = Math.min(lines.length, Math.floor((n / Math.max(1, total)) * lines.length));
  const animDone = n >= end;

  // Advance only when the animation has played AND the interpretation (Hermes or fallback) is in.
  useEffect(() => {
    if (animDone && interp) {
      const t = setTimeout(onDone, 700);
      return () => clearTimeout(t);
    }
  }, [animDone, interp, onDone]);

  const sourceLine = !interp
    ? `Asking Hermes ${'.'.repeat(dots).padEnd(3, ' ')}`
    : interp.source === 'hermes'
      ? `Interpreted by ....... Hermes · ${interp.model}`
      : `Interpreted by ....... local interpreter (Hermes unavailable)`;

  return (
    <section className="reading" onClick={() => setN(end)}>
      <p className="mono label">02 — Reading the moment</p>
      <p className="reading-text">
        {analysis.tokens.map((t, i) => (
          <span key={i} className={`rw ${i < n ? 'in' : ''} ${analysis.keywords.includes(t.clean) ? 'key' : ''}`}>
            {t.raw}{' '}
          </span>
        ))}
      </p>
      <div className="reading-log mono">
        {lines.slice(0, lineCount).map((l) => (
          <div key={l} className="log-line">
            {l}
          </div>
        ))}
        {lineCount >= lines.length && (
          <div key={interp ? interp.source : 'wait'} className={`log-line ${interp?.source === 'hermes' ? 'log-ok' : ''}`}>
            {sourceLine}
          </div>
        )}
        {interp && lineCount >= lines.length && <div className="log-line">Directions ........... I · II · III</div>}
      </div>
      <div className="reading-bar">
        <i style={{ transform: `scaleX(${interp ? Math.min(1, n / end) : Math.min(0.92, n / end)})` }} />
      </div>
      <p className="mono reading-skip">{interp ? 'Click to skip' : 'Waiting for the interpretation'}</p>
    </section>
  );
}
