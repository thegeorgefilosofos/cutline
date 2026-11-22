import { useMemo } from 'react';
import { analyze, LIGHT_LABEL } from '../lib/analyze';
import { renderPrint } from '../lib/render';
import { sourceLabel } from '../lib/interpret';
import type { Work } from '../lib/types';
import { DIRECTIONS } from '../lib/types';
import { ArtCanvas } from './ArtCanvas';

export function Kept({ work, onAnother, onCollection }: { work: Work; onAnother: () => void; onCollection: () => void }) {
  const a = useMemo(() => analyze(work.memory.text), [work.memory.text]);
  const p = work.params;
  const dir = DIRECTIONS.find((d) => d.id === p.direction)!;
  const keptSet = new Set(p.kept);
  const wide = p.frame === '16:9' || p.frame === '3:1';
  const src = work.interpretation;
  const title = src?.direction?.title ?? a.title;

  const download = () => {
    const c = renderPrint(work.memory, a, p, title, work.no);
    c.toBlob((b) => {
      if (!b) return;
      const url = URL.createObjectURL(b);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cutline-no-${String(work.no).padStart(3, '0')}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, 'image/png');
  };

  return (
    <section className={`kept ${wide ? 'wide' : ''}`}>
      <div className="kept-art">
        <ArtCanvas memory={work.memory} params={p} />
      </div>

      <div className="kept-label">
        <p className="mono label">
          {work.example ? 'From the collection' : '05 — Kept'} · No. {String(work.no).padStart(3, '0')}
        </p>
        <h2>{title}</h2>
        <dl className="mono">
          <div>
            <dt>Directed by</dt>
            <dd>{work.memory.author || 'The one who remembers'}</dd>
          </div>
          <div>
            <dt>Remembered</dt>
            <dd>{work.memory.year || 'Undated'}</dd>
          </div>
          <div>
            <dt>Direction</dt>
            <dd>
              {dir.numeral} — {dir.name}
            </dd>
          </div>
          <div>
            <dt>Interpreted by</dt>
            <dd>{sourceLabel(src?.source, src?.model)}</dd>
          </div>
          <div>
            <dt>Medium</dt>
            <dd>
              Memory, {LIGHT_LABEL[p.light].toLowerCase()} light, {p.kept.length} kept words, one decision
            </dd>
          </div>
        </dl>

        {src?.direction && <p className="kept-interp">{src.direction.emotional_interpretation}</p>}

        <p className="mono label">What was kept</p>
        <p className="kept-memory">
          {a.tokens.map((t, i) => (
            <span key={i}>
              <span className={keptSet.has(i) ? 'k' : t.salient ? 'cut' : ''}>{t.raw}</span>{' '}
            </span>
          ))}
        </p>

        <div className="kept-actions">
          <button className="btn btn-primary" onClick={download}>
            Download the print <span className="arrow">↓</span>
          </button>
          <button className="btn btn-ghost" onClick={onCollection}>
            See it in the collection
          </button>
        </div>
        <button className="link mono" onClick={onAnother}>
          Keep another moment →
        </button>
      </div>
    </section>
  );
}
