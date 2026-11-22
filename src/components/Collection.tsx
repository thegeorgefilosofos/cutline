import { analyze, keptWords } from '../lib/analyze';
import type { Work } from '../lib/types';
import { DIRECTIONS } from '../lib/types';
import { ArtCanvas } from './ArtCanvas';

export function Collection({
  works,
  onOpen,
  onRemove,
  onBegin,
}: {
  works: Work[];
  onOpen: (w: Work) => void;
  onRemove: (id: string) => void;
  onBegin: () => void;
}) {
  return (
    <section className="coll">
      <div className="coll-head">
        <p className="mono label">The collection — {String(works.length).padStart(3, '0')} works</p>
        <h2>
          The things
          <br />
          we kept.
        </h2>
        <p className="coll-lede">
          Every work here began as an ordinary moment. Each one was cut down to what its director chose to keep.
        </p>
        <button className="btn btn-primary" onClick={onBegin}>
          Add your moment <span className="arrow">→</span>
        </button>
      </div>

      <div className="coll-grid">
        {works.map((w, i) => {
          const a = analyze(w.memory.text);
          const d = DIRECTIONS.find((x) => x.id === w.params.direction)!;
          return (
            <article key={w.id} className={`work work-${w.params.frame.replace(':', 'x')}`} style={{ animationDelay: `${i * 70}ms` }}>
              <button className="work-img" onClick={() => onOpen(w)} aria-label={`Open ${a.title}`}>
                <ArtCanvas memory={w.memory} params={w.params} quality={0.75} />
              </button>
              <div className="work-cap">
                <span className="mono dim">
                  No. {String(w.no).padStart(3, '0')} · {d.name} · {w.memory.year || 'Undated'}
                </span>
                <h3>{a.title}</h3>
                <span className="mono">{keptWords(a, w.params.kept).slice(0, 5).join(' / ')}</span>
                {!w.example && (
                  <button className="link mono remove" onClick={() => onRemove(w.id)}>
                    Let go
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
