import { useEffect, useMemo, useState } from 'react';
import { EXAMPLES, initialParams } from '../lib/store';
import type { Direction, Frame } from '../lib/types';
import { ArtCanvas } from './ArtCanvas';

const SHOW: { d: Direction; f: Frame }[] = [
  { d: 'afterglow', f: '4:5' },
  { d: 'cut', f: '4:5' },
  { d: 'index', f: '4:5' },
];

export function Intro({ onBegin, onCollection }: { onBegin: () => void; onCollection: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % EXAMPLES.length), 5200);
    return () => clearInterval(t);
  }, []);
  const plates = useMemo(
    () => EXAMPLES.map((m, k) => ({ m, p: { ...initialParams(m, SHOW[k].d, SHOW[k].f), accent: k === 1 ? ('lime' as const) : ('vermilion' as const) } })),
    [],
  );

  return (
    <section className="intro">
      <div className="intro-meta mono">
        <span>Exhibition 01</span>
        <span>An instrument for keeping</span>
        <span>3 directions / 1 decision</span>
      </div>

      <h1 className="intro-title">
        <span className="line">The things</span>
        <span className="line indent">
          we keep<i className="dot">.</i>
        </span>
      </h1>

      <figure className="intro-plate">
        {plates.map((pl, k) => (
          <div key={k} className={`intro-slide ${k === i ? 'on' : ''}`} aria-hidden={k !== i}>
            <ArtCanvas memory={pl.m} params={pl.p} />
          </div>
        ))}
        <figcaption className="mono">
          <span>
            Fig. {String(i + 1).padStart(2, '0')} — {plates[i].m.author}, {plates[i].m.year}
          </span>
          <span className="cap">“{plates[i].m.text}”</span>
        </figcaption>
      </figure>

      <div className="intro-q">
        <p className="mono label">The question</p>
        <h2>What ordinary moment would you keep forever?</h2>
        <div className="intro-actions">
          <button className="btn btn-primary" onClick={onBegin}>
            Share a moment <span className="arrow">→</span>
          </button>
          <button className="btn btn-ghost" onClick={onCollection}>
            Visit the collection
          </button>
        </div>
      </div>

      <div className="intro-thesis">
        <p className="mono label">Thesis</p>
        <p>
          When anything can be generated, what matters is what we <em>choose to keep</em>.
        </p>
      </div>

      <div className="ticker" aria-hidden>
        <div className="ticker-track">
          {Array.from({ length: 2 }).map((_, k) => (
            <span key={k}>
              When anything can be generated, what matters is what we choose to keep — Cut here — The things we keep — One
              memory, three directions, your decision — Cut here —&nbsp;
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
