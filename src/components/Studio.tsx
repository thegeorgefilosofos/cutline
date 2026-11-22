import { useRef, useState } from 'react';
import type { Analysis, Light } from '../lib/analyze';
import { keptWords, motifsOf } from '../lib/analyze';
import type { Accent, Frame, Memory, Params, Photograph } from '../lib/types';
import { DIRECTIONS } from '../lib/types';
import { ArtCanvas } from './ArtCanvas';
import { PhotographPanel } from './PhotographPanel';

const FRAMES: Frame[] = ['4:5', '1:1', '16:9', '3:1'];
const LIGHTS: Light[] = ['dawn', 'day', 'dusk', 'night'];
const ACCENTS: Accent[] = ['vermilion', 'lime', 'none'];

export function Studio({
  memory,
  analysis,
  params,
  onChange,
  onKeep,
  onBack,
  composition,
  photo,
  keepPhoto,
  onPhoto,
  onKeepPhoto,
}: {
  memory: Memory;
  analysis: Analysis;
  params: Params;
  onChange: (p: Params) => void;
  onKeep: () => void;
  onBack: () => void;
  /** The chosen direction's composition, when an interpreter provided one. */
  composition?: string;
  photo: Photograph | null;
  keepPhoto: boolean;
  onPhoto: (p: Photograph) => void;
  onKeepPhoto: (keep: boolean) => void;
}) {
  const set = (patch: Partial<Params>) => onChange({ ...params, ...patch });
  const [dragging, setDragging] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const dir = DIRECTIONS.find((d) => d.id === params.direction)!;

  const setFocus = (e: React.PointerEvent) => {
    const r = stage.current?.getBoundingClientRect();
    if (!r) return;
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    set({ focus: { x: +x.toFixed(3), y: +y.toFixed(3) } });
  };

  const toggle = (i: number) => {
    const has = params.kept.includes(i);
    if (has && params.kept.length <= 1) return; // something must be kept
    set({ kept: has ? params.kept.filter((k) => k !== i) : [...params.kept, i] });
  };

  const kept = keptWords(analysis, params.kept);

  return (
    <section className="studio">
      <div className="studio-view">
        <div className="studio-meta mono">
          <span>
            {dir.numeral} — {dir.name}
          </span>
          <span>
            X {params.focus.x.toFixed(2)} &nbsp; Y {params.focus.y.toFixed(2)}
          </span>
          <span>{params.frame}</span>
        </div>
        <div
          ref={stage}
          className={`studio-stage frame-${params.frame.replace(':', 'x')} ${dragging ? 'dragging' : ''}`}
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture?.(e.pointerId);
            setDragging(true);
            setFocus(e);
          }}
          onPointerMove={(e) => dragging && setFocus(e)}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
        >
          <ArtCanvas memory={memory} params={params} />
          <span className="crosshair" style={{ left: `${params.focus.x * 100}%`, top: `${params.focus.y * 100}%` }} />
          <span className="crop-marks" aria-hidden>
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
        <p className="mono dim studio-tip">Drag across the image to move the light and the horizon.</p>
        <p className="studio-cutline">
          <span className="mono label">Cutline</span>
          {kept.join(' / ')}
        </p>
      </div>

      <aside className="studio-panel">
        <div className="panel-head">
          <p className="mono label">04 — The studio</p>
          <h2>You are the creative director.</h2>
        </div>

        <div className="ctl">
          <p className="ctl-label mono">
            <b>01</b> What you keep <span className="dim">{params.kept.length} kept</span>
          </p>
          <p className="keep-text">
            {analysis.tokens.map((t, i) =>
              t.salient ? (
                <button
                  key={i}
                  className={`kw ${params.kept.includes(i) ? 'on' : ''}`}
                  onClick={() => toggle(i)}
                  aria-pressed={params.kept.includes(i)}
                >
                  {t.raw}
                </button>
              ) : (
                <span key={i} className="kw-static">
                  {t.raw}
                </span>
              ),
            )}
          </p>
          <p className="mono dim small">Tap words to keep or cut them. Only what you keep enters the work.</p>
        </div>

        <div className="ctl">
          <p className="ctl-label mono">
            <b>02</b> Direction
          </p>
          <div className="seg">
            {DIRECTIONS.map((d) => (
              <button key={d.id} className={params.direction === d.id ? 'on' : ''} onClick={() => set({ direction: d.id })}>
                <span className="mono">{d.numeral}</span> {d.name}
              </button>
            ))}
          </div>
        </div>

        <div className="ctl">
          <p className="ctl-label mono">
            <b>03</b> Crop
          </p>
          <div className="seg">
            {FRAMES.map((f) => (
              <button key={f} className={params.frame === f ? 'on' : ''} onClick={() => set({ frame: f })}>
                <span className={`frame-glyph g${f.replace(':', 'x')}`} /> {f}
              </button>
            ))}
          </div>
        </div>

        <div className="ctl">
          <p className="ctl-label mono">
            <b>04</b> Light
          </p>
          <div className="seg">
            {LIGHTS.map((l) => (
              <button key={l} className={params.light === l ? 'on' : ''} onClick={() => set({ light: l })}>
                <span className={`swatch sw-${l}`} /> {l}
                {l === analysis.light && <sup className="mono">read</sup>}
              </button>
            ))}
          </div>
        </div>

        <div className="ctl two">
          <div>
            <p className="ctl-label mono">
              <b>05</b> Grain <span className="dim">{Math.round(params.grain * 100)}</span>
            </p>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={params.grain}
              onChange={(e) => set({ grain: +e.target.value })}
              aria-label="Grain"
            />
          </div>
          <div>
            <p className="ctl-label mono">
              <b>06</b> Accent
            </p>
            <div className="seg compact">
              {ACCENTS.map((a) => (
                <button key={a} className={params.accent === a ? 'on' : ''} onClick={() => set({ accent: a })} aria-label={a}>
                  <span className={`swatch ac-${a}`} />
                </button>
              ))}
            </div>
          </div>
        </div>

        <PhotographPanel
          request={{
            frame: params.frame,
            light: params.light,
            motifs: [...new Set([...motifsOf(kept), ...(params.motifs ?? [])])].filter((m) => m !== 'open'),
            words: kept,
            composition,
            seed: params.seed,
          }}
          photo={photo}
          keepPhoto={keepPhoto}
          onPhoto={onPhoto}
          onKeepPhoto={onKeepPhoto}
        />

        <div className="panel-actions">
          <button className="btn btn-ghost" onClick={() => set({ seed: (params.seed * 1664525 + 1013904223) >>> 0 })}>
            Another take
          </button>
          <button className="btn btn-keep" onClick={onKeep}>
            Keep this <span className="arrow">→</span>
          </button>
        </div>
        <button className="link mono" onClick={onBack}>
          ← Back to the three directions
        </button>
      </aside>
    </section>
  );
}
