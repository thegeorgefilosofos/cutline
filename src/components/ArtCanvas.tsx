import { useEffect, useMemo, useRef, useState } from 'react';
import { analyze } from '../lib/analyze';
import { fontsReady, renderArtwork } from '../lib/render';
import type { Memory, Params } from '../lib/types';
import { FRAME_RATIO } from '../lib/types';

let fontsLoaded = false;
const fontPromise = fontsReady().then(() => {
  fontsLoaded = true;
});

interface Props {
  memory: Memory;
  params: Params;
  className?: string;
  /** Lower resolution for thumbnails. */
  quality?: number;
}

export function ArtCanvas({ memory, params, className, quality = 1 }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [ready, setReady] = useState(fontsLoaded);
  const analysis = useMemo(() => analyze(memory.text), [memory.text]);

  useEffect(() => {
    if (!ready) fontPromise.then(() => setReady(true));
  }, [ready]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!width || !canvas.current) return;
    const id = requestAnimationFrame(() => {
      const dpr = Math.min(2, window.devicePixelRatio || 1) * quality;
      renderArtwork(canvas.current!, width, memory, analysis, params, dpr);
    });
    return () => cancelAnimationFrame(id);
  }, [width, memory, analysis, params, ready, quality]);

  return (
    <div
      ref={wrap}
      className={`art ${className ?? ''}`}
      style={{ aspectRatio: String(FRAME_RATIO[params.frame]) }}
    >
      <canvas ref={canvas} aria-label={`Artwork: ${memory.text}`} role="img" />
    </div>
  );
}
