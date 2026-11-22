import type { Analysis } from '../lib/analyze';
import { LIGHT_LABEL } from '../lib/analyze';
import type { Direction, Interpretation, Memory, Params } from '../lib/types';
import { applyDirection, directionFor } from '../lib/interpret';
import { DIRECTIONS } from '../lib/types';
import { ArtCanvas } from './ArtCanvas';

export function Directions({
  memory,
  analysis,
  params,
  interp,
  onChoose,
  onBack,
}: {
  memory: Memory;
  analysis: Analysis;
  params: Params;
  interp: Interpretation | null;
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
          <p className="dirs-title">{directionFor(interp, 'afterglow')?.title ?? analysis.title}</p>
          <p className={`mono source ${interp?.source === 'hermes' ? 'source-ai' : ''}`}>
            {interp?.source === 'hermes' ? (
              <>Interpreted by Hermes · {interp.model}</>
            ) : (
              <>Local interpreter · Hermes unavailable{interp?.fallbackReason ? ` (${interp.fallbackReason})` : ''}</>
            )}
          </p>
          {interp?.source !== 'hermes' && (
            <p className="mono dim">
              {LIGHT_LABEL[analysis.light]} light · {analysis.hero} · {memory.year || 'undated'}
            </p>
          )}
          <button className="link mono" onClick={onBack}>
            ← Rewrite the memory
          </button>
        </div>
      </div>

      <div className="dirs-grid">
        {DIRECTIONS.map((d, i) => {
          const h = directionFor(interp, d.id);
          return (
          <article key={d.id} className={`plate plate-${i + 1}`} style={{ animationDelay: `${120 + i * 140}ms` }}>
            <button className="plate-img" onClick={() => onChoose(d.id)} aria-label={`Choose direction ${d.name}`}>
              <ArtCanvas memory={memory} params={{ ...applyDirection(params, interp, d.id, analysis), frame: '4:5' }} />
              <span className="plate-cta mono">Direct this →</span>
            </button>
            <div className="plate-text">
              <span className="plate-num">{d.numeral}</span>
              <div>
                <h3>{d.name}</h3>
                <p className="mono dim">{d.medium}</p>
                {h ? (
                  <>
                    <p className="plate-title">{h.title}</p>
                    <p className="plate-line">{h.emotional_interpretation}</p>
                    <details className="plate-notes">
                      <summary className="mono">Curatorial notes</summary>
                      <dl className="mono">
                        <dt>Philosophy</dt>
                        <dd>{h.visual_philosophy}</dd>
                        <dt>Composition</dt>
                        <dd>{h.composition}</dd>
                        <dt>Light · motifs</dt>
                        <dd>
                          {LIGHT_LABEL[h.light]} · {h.motifs.join(', ')}
                        </dd>
                        <dt>Keeps</dt>
                        <dd>{h.preserves}</dd>
                        <dt>Leaves out</dt>
                        <dd>{h.leaves_out}</dd>
                      </dl>
                    </details>
                  </>
                ) : (
                  <p className="plate-line">{d.line(analysis.hero, LIGHT_LABEL[analysis.light])}</p>
                )}
              </div>
            </div>
          </article>
          );
        })}
      </div>
    </section>
  );
}
