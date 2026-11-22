import { useEffect, useState } from 'react';
import type { Analysis } from '../lib/analyze';
import { LIGHT_LABEL } from '../lib/analyze';

export function Reading({ analysis, onDone }: { analysis: Analysis; onDone: () => void }) {
  const [n, setN] = useState(0);
  const total = analysis.tokens.length;
  const lines = [
    `Reading light ........ ${LIGHT_LABEL[analysis.light]}`,
    `Locating ............. ${analysis.hero}`,
    `Motifs ............... ${analysis.motifs.join(', ')}`,
    `Words that stayed .... ${analysis.keywords.length}`,
    `Directions ........... I · II · III`,
  ];

  useEffect(() => {
    const step = Math.max(28, Math.min(90, 1700 / total));
    const t = setInterval(() => setN((x) => x + 1), step);
    return () => clearInterval(t);
  }, [total]);

  const lineCount = Math.min(lines.length, Math.floor((n / Math.max(1, total)) * lines.length));
  const done = n >= total + 14;

  useEffect(() => {
    if (done) onDone();
  }, [done, onDone]);

  return (
    <section className="reading" onClick={onDone}>
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
      </div>
      <div className="reading-bar">
        <i style={{ transform: `scaleX(${Math.min(1, n / (total + 14))})` }} />
      </div>
      <p className="mono reading-skip">Click to skip</p>
    </section>
  );
}
