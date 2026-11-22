import type { Analysis } from '../lib/analyze';
import { LIGHT_LABEL } from '../lib/analyze';
import type { Direction, Memory, Params } from '../lib/types';
import { DIRECTIONS } from '../lib/types';
import { ArtCanvas } from './ArtCanvas';

export function Directions({
  memory,
  analysis,
  params,
  onChoose,
  onBack,
}: {
  memory: Memory;
  analysis: Analysis;
  params: Params;
  onChoose: (d: Direction) => void;
  onBack: () => void;
}) {
  return (
    <section className="dirs">
      <div className="dirs-head">
        <p className="mono label">03 — Three directions</p>
        <h2>
          Three ways
          <br />
          to remember it.
        </h2>
        <div className="dirs-brief">
          <p className="mono label">Working title</p>
          <p className="dirs-title">{analysis.title}</p>
          <p className="mono dim">
            {LIGHT_LABEL[analysis.light]} light · {analysis.hero} · {memory.year || 'undated'}
          </p>
          <button className="link mono" onClick={onBack}>
            ← Rewrite the memory
          </button>
        </div>
      </div>

      <div className="dirs-grid">
        {DIRECTIONS.map((d, i) => (
          <article key={d.id} className={`plate plate-${i + 1}`} style={{ animationDelay: `${120 + i * 140}ms` }}>
            <button className="plate-img" onClick={() => onChoose(d.id)} aria-label={`Choose direction ${d.name}`}>
              <ArtCanvas memory={memory} params={{ ...params, direction: d.id, frame: '4:5' }} />
              <span className="plate-cta mono">Direct this →</span>
            </button>
            <div className="plate-text">
              <span className="plate-num">{d.numeral}</span>
              <div>
                <h3>{d.name}</h3>
                <p className="mono dim">{d.medium}</p>
                <p className="plate-line">{d.line(analysis.hero, LIGHT_LABEL[analysis.light])}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
