// CUTLINE — the darkroom.
// Three generative directions rendered to canvas from a memory analysis and
// the director's choices. Everything is deterministic for a given seed.

import type { Analysis, Light } from './analyze';
import { keptWords, motifsOf } from './analyze';
import type { Accent, Memory, Params } from './types';
import { FRAME_RATIO } from './types';

const C = {
  ivory: '#F4F1EA',
  charcoal: '#171717',
  white: '#FFFFFF',
  grey: '#858585',
  vermilion: '#FF674D',
  lime: '#D8FF42',
};

const SKY: Record<Light, string[]> = {
  dawn: ['#262c47', '#6f6a8c', '#d9a39a', '#f6d9bd'],
  day: ['#8fa7b3', '#bccbcc', '#e3e4dc', '#f4f1ea'],
  dusk: ['#16142a', '#5a2f52', '#e8604a', '#f7c48a'],
  night: ['#040508', '#0a0f1a', '#141c2b', '#26303f'],
};
const GROUND: Record<Light, [string, string]> = {
  dawn: ['#3b3444', '#17151c'],
  day: ['#7b7c70', '#2e302b'],
  dusk: ['#3a1e26', '#0e0a0d'],
  night: ['#0b0d12', '#020203'],
};
const GLOW: Record<Light, string> = {
  dawn: '255,226,196',
  day: '255,255,250',
  dusk: '255,170,110',
  night: '255,204,138',
};

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function accentColor(a: Accent, fallback = C.vermilion) {
  return a === 'vermilion' ? C.vermilion : a === 'lime' ? C.lime : fallback;
}

let noiseTile: HTMLCanvasElement | null = null;
function getNoise(): HTMLCanvasElement {
  if (noiseTile) return noiseTile;
  const n = document.createElement('canvas');
  n.width = n.height = 256;
  const x = n.getContext('2d')!;
  const img = x.createImageData(256, 256);
  const r = rng(7);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(128 + (r() + r() + r() - 1.5) * 70);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  noiseTile = n;
  return n;
}

function grain(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  if (amount <= 0) return;
  const pat = ctx.createPattern(getNoise(), 'repeat');
  if (!pat) return;
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.05 + amount * 0.5;
  const s = Math.max(1, w / 1100);
  pat.setTransform(new DOMMatrix().scale(s, s));
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function blur(ctx: CanvasRenderingContext2D, px: number) {
  ctx.filter = px > 0 ? `blur(${px.toFixed(1)}px)` : 'none';
}

// ————————————————————————————————————————————— I. AFTERGLOW (photograph)

export function drawPhoto(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  a: Analysis,
  p: Params,
  opts: { stamp?: boolean; memory?: Memory } = {},
) {
  const r = rng(p.seed);
  const L = p.light;
  const u = Math.min(w, h) / 1000; // unit
  const sky = SKY[L];
  const fx = p.focus.x;
  const horizon = h * (0.38 + 0.36 * p.focus.y);
  // What you keep shapes what is shown: motifs come from the kept words only.
  const kept = keptWords(a, p.kept);
  const fromWords = kept.length ? motifsOf(kept) : a.motifs;
  const motifs = p.motifs?.length ? [...new Set([...fromWords.filter((m) => m !== 'open'), ...p.motifs])] : fromWords;
  const interior = motifs.includes('window');

  // Sky
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, sky[0]);
  g.addColorStop(0.45, sky[1]);
  g.addColorStop(0.8, sky[2]);
  g.addColorStop(1, sky[3]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Stars at night
  if (L === 'night') {
    for (let i = 0; i < 140; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.6})`;
      const s = r() * 1.6 * u + 0.4;
      ctx.fillRect(r() * w, r() * horizon * 0.85, s, s);
    }
  }

  // Light source
  const sx = w * fx;
  const sy = horizon - h * (L === 'day' ? 0.32 : L === 'night' ? 0.22 : 0.05);
  const sr = Math.max(w, h) * (L === 'night' ? 0.35 : 0.62);
  const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
  sg.addColorStop(0, `rgba(${GLOW[L]},${L === 'night' ? 0.55 : 0.95})`);
  sg.addColorStop(0.12, `rgba(${GLOW[L]},0.55)`);
  sg.addColorStop(0.45, `rgba(${GLOW[L]},0.14)`);
  sg.addColorStop(1, `rgba(${GLOW[L]},0)`);
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, w, h);
  if (L !== 'day') {
    ctx.save();
    blur(ctx, 6 * u);
    ctx.fillStyle = `rgba(${GLOW[L]},0.95)`;
    ctx.beginPath();
    ctx.arc(sx, sy, (L === 'night' ? 22 : 46) * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Distant land / skyline silhouette
  ctx.save();
  blur(ctx, 2.5 * u);
  ctx.fillStyle = L === 'day' ? 'rgba(80,88,86,0.55)' : 'rgba(10,8,14,0.55)';
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  const city = motifs.includes('motion') || kept.some((w) => w === 'city' || w === 'street');
  let x = 0;
  while (x < w) {
    const bw = (city ? 20 + r() * 60 : 60 + r() * 180) * u;
    const bh = (city ? 20 + r() * 120 : 8 + r() * 40) * u;
    if (city) {
      ctx.lineTo(x, horizon - bh);
      ctx.lineTo(x + bw, horizon - bh);
    } else {
      ctx.quadraticCurveTo(x + bw / 2, horizon - bh, x + bw, horizon - bh * 0.3);
    }
    x += bw;
  }
  ctx.lineTo(w, horizon);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Ground or water
  const gg = ctx.createLinearGradient(0, horizon, 0, h);
  gg.addColorStop(0, GROUND[L][0]);
  gg.addColorStop(1, GROUND[L][1]);
  ctx.fillStyle = gg;
  ctx.fillRect(0, horizon, w, h - horizon);

  if (motifs.includes('water')) {
    // reflected sky
    ctx.save();
    ctx.globalAlpha = 0.55;
    const rg = ctx.createLinearGradient(0, horizon, 0, h);
    rg.addColorStop(0, sky[3]);
    rg.addColorStop(0.35, sky[2]);
    rg.addColorStop(1, sky[0]);
    ctx.fillStyle = rg;
    ctx.fillRect(0, horizon, w, h - horizon);
    ctx.restore();
    // glitter path
    for (let i = 0; i < 260; i++) {
      const t = r();
      const yy = horizon + Math.pow(t, 1.6) * (h - horizon);
      const spread = (20 + t * 340) * u;
      const xx = sx + (r() - 0.5) * 2 * spread;
      ctx.fillStyle = `rgba(${GLOW[L]},${0.25 + (1 - t) * 0.6})`;
      ctx.fillRect(xx, yy, (6 + r() * 40) * u * (0.4 + t), Math.max(1, 1.6 * u));
    }
  } else {
    // light spilling across ground
    const lg = ctx.createRadialGradient(sx, horizon, 0, sx, horizon, w * 0.6);
    lg.addColorStop(0, `rgba(${GLOW[L]},0.35)`);
    lg.addColorStop(1, `rgba(${GLOW[L]},0)`);
    ctx.fillStyle = lg;
    ctx.fillRect(0, horizon, w, h - horizon);
  }

  // Motion streaks
  if (motifs.includes('motion')) {
    ctx.save();
    blur(ctx, 3 * u);
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 26; i++) {
      const yy = horizon + (r() * 0.5 + 0.02) * (h - horizon) * (r() > 0.5 ? 1 : -0.4);
      const col = r() > 0.6 ? '255,103,77' : GLOW[L];
      ctx.fillStyle = `rgba(${col},${0.2 + r() * 0.5})`;
      ctx.fillRect(r() * w * 0.6 - w * 0.2, yy, w * (0.3 + r() * 0.8), (1 + r() * 3) * u);
    }
    ctx.restore();
  }

  // Figures on the horizon
  if (motifs.includes('figures') || r() > 0.55) {
    const n = motifs.includes('figures') ? 1 + Math.floor(r() * 3) : 1;
    ctx.save();
    blur(ctx, 1.6 * u);
    ctx.fillStyle = L === 'day' ? 'rgba(30,30,30,0.82)' : 'rgba(6,5,8,0.92)';
    const base = w * (fx > 0.5 ? 0.18 + r() * 0.2 : 0.62 + r() * 0.2);
    for (let i = 0; i < n; i++) {
      const fh = (90 + r() * 60) * u * (i === 0 ? 1 : 0.82);
      const fw = fh * 0.24;
      const xx = base + i * fw * 1.5;
      const yy = horizon + 6 * u;
      ctx.beginPath();
      ctx.roundRect(xx - fw / 2, yy - fh * 0.82, fw, fh * 0.82, fw * 0.45);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(xx, yy - fh * 0.92, fw * 0.36, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Weather
  if (motifs.includes('rain')) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = Math.max(1, u);
    for (let i = 0; i < 380; i++) {
      const xx = r() * w;
      const yy = r() * h;
      ctx.beginPath();
      ctx.moveTo(xx, yy);
      ctx.lineTo(xx - 8 * u, yy + 38 * u);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (motifs.includes('snow')) {
    ctx.save();
    blur(ctx, 1.2 * u);
    for (let i = 0; i < 320; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`;
      ctx.beginPath();
      ctx.arc(r() * w, r() * h, (1 + r() * 4) * u, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Interior: we look out through a window
  if (interior) {
    const ww = w * 0.5;
    const wh = h * 0.56;
    const wx = Math.min(Math.max(sx - ww / 2, w * 0.06), w * 0.94 - ww);
    const wy = Math.max(h * 0.08, horizon - wh * 0.62);
    ctx.save();
    // wall
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.rect(wx, wy, ww, wh);
    const wallTone = L === 'day' ? '#5a5248' : L === 'night' ? '#07080b' : L === 'dawn' ? '#2a2430' : '#24171a';
    const wg = ctx.createRadialGradient(wx + ww / 2, wy + wh / 2, ww * 0.3, wx + ww / 2, wy + wh / 2, Math.max(w, h) * 0.8);
    wg.addColorStop(0, L === 'night' ? '#1a1712' : L === 'day' ? '#8a7f70' : L === 'dawn' ? '#5a4a52' : '#5a3226');
    wg.addColorStop(1, wallTone);
    ctx.fillStyle = wg;
    ctx.fill('evenodd');
    // mullions
    ctx.fillStyle = wallTone;
    ctx.fillRect(wx + ww / 2 - 5 * u, wy, 10 * u, wh);
    ctx.fillRect(wx, wy + wh * 0.42 - 5 * u, ww, 10 * u);
    // light spill on the floor
    ctx.globalCompositeOperation = 'screen';
    blur(ctx, 26 * u);
    ctx.fillStyle = `rgba(${GLOW[L]},0.32)`;
    ctx.beginPath();
    ctx.moveTo(wx, wy + wh);
    ctx.lineTo(wx + ww, wy + wh);
    ctx.lineTo(wx + ww * 1.5, h);
    ctx.lineTo(wx - ww * 0.2, h);
    ctx.closePath();
    ctx.fill();
    // a sill line
    ctx.globalCompositeOperation = 'source-over';
    blur(ctx, 0);
    ctx.fillStyle = `rgba(${GLOW[L]},0.35)`;
    ctx.fillRect(wx - 8 * u, wy + wh, ww + 16 * u, 3 * u);
    ctx.restore();
  }

  // Bloom
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  blur(ctx, 40 * u);
  ctx.fillStyle = `rgba(${GLOW[L]},${L === 'night' ? 0.08 : 0.16})`;
  ctx.beginPath();
  ctx.arc(sx, sy, sr * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.filter = 'none';

  // Vignette
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, `rgba(0,0,0,${0.25 + p.grain * 0.35})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  grain(ctx, w, h, p.grain);

  // Film date stamp
  if (opts.stamp) {
    const yy = (opts.memory?.year || '').slice(-2) || String(90 + (p.seed % 10));
    const mm = 1 + (p.seed % 12);
    const dd = 1 + ((p.seed >> 4) % 28);
    const fs = Math.round(Math.min(w, h) * 0.034);
    ctx.save();
    ctx.font = `500 ${fs}px "DM Mono", monospace`;
    ctx.textAlign = 'right';
    ctx.shadowColor = 'rgba(255,120,60,0.9)';
    ctx.shadowBlur = fs * 0.5;
    ctx.fillStyle = p.accent === 'lime' ? C.lime : '#ff8a4c';
    ctx.fillText(`'${yy}  ${mm} ${dd}`, w - fs * 1.4, h - fs * 1.3);
    ctx.restore();
  }
}

// ————————————————————————————————————————————— II. INDEX (Swiss grid)

function fitText(ctx: CanvasRenderingContext2D, text: string, weight: number, targetW: number, maxSize: number) {
  let size = maxSize;
  ctx.font = `${weight} ${size}px "Space Grotesk", sans-serif`;
  const m = ctx.measureText(text).width;
  if (m > 0) size = Math.min(maxSize * 4, (size * targetW) / m);
  ctx.font = `${weight} ${size}px "Space Grotesk", sans-serif`;
  return size;
}

function drawIndex(ctx: CanvasRenderingContext2D, w: number, h: number, a: Analysis, p: Params, m: Memory) {
  const r = rng(p.seed + 11);
  const landscape = w / h > 1.2;
  const pad = Math.min(w, h) * 0.06;
  const u = Math.min(w, h) / 1000;
  const acc = accentColor(p.accent, C.charcoal);
  const words = keptWords(a, p.kept);
  const hero = (words.find((x) => x === a.hero) || words[0] || a.hero).toUpperCase();

  ctx.fillStyle = C.ivory;
  ctx.fillRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = 'rgba(23,23,23,0.07)';
  ctx.lineWidth = 1;
  const cols = 12;
  const colW = (w - pad * 2) / cols;
  for (let i = 0; i <= cols; i++) {
    ctx.beginPath();
    ctx.moveTo(pad + i * colW, 0);
    ctx.lineTo(pad + i * colW, h);
    ctx.stroke();
  }

  // Header rule
  const fsMono = Math.max(9, Math.round(Math.min(w, h) * 0.022));
  ctx.fillStyle = C.charcoal;
  ctx.font = `400 ${fsMono}px "DM Mono", monospace`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText(`CUTLINE — INDEX NO. ${String(p.seed % 1000).padStart(3, '0')}`, pad, pad);
  ctx.textAlign = 'right';
  ctx.fillText(`${(m.year || '—').toUpperCase()} / ${p.light.toUpperCase()}`, w - pad, pad);
  ctx.fillRect(pad, pad + fsMono * 0.7, w - pad * 2, Math.max(1, 1.5 * u));

  // Photograph inset
  let px: number, py: number, pw: number, ph: number;
  if (landscape) {
    pw = colW * (5 + Math.round(p.focus.x * 2));
    ph = h - pad * 2 - fsMono * 3;
    px = w - pad - pw - colW * Math.round((1 - p.focus.x) * 2);
    py = pad + fsMono * 2;
  } else {
    pw = colW * 8;
    ph = Math.min(pw * 0.95, h * 0.5);
    px = pad + colW * Math.round(p.focus.x * 4);
    py = pad + fsMono * 2.2 + p.focus.y * h * 0.08;
  }
  const off = document.createElement('canvas');
  off.width = Math.max(2, Math.round(pw));
  off.height = Math.max(2, Math.round(ph));
  drawPhoto(off.getContext('2d')!, off.width, off.height, a, { ...p, grain: p.grain * 0.8 });
  ctx.drawImage(off, px, py, pw, ph);

  // Accent disc
  if (p.accent !== 'none') {
    const d = Math.min(w, h) * (0.16 + r() * 0.05);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = acc;
    ctx.beginPath();
    ctx.arc(px + (p.focus.x > 0.5 ? 0 : pw), py + ph, d / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Numbered inventory
  const listX = landscape ? pad : px + pw + colW * 0.4 > w - pad - colW * 3 ? pad : px + pw + colW * 0.4;
  const listTop = landscape ? pad + fsMono * 4 : py + fsMono;
  ctx.textAlign = 'left';
  ctx.font = `400 ${fsMono}px "DM Mono", monospace`;
  const listWords = words.slice(0, landscape ? 8 : 9);
  const lineH = fsMono * 1.9;
  const listVisible = !(listX === pad && !landscape && px < pad + colW * 3);
  if (listVisible) {
    listWords.forEach((wd, i) => {
      const y = listTop + i * lineH;
      ctx.fillStyle = C.grey;
      ctx.fillText(String(i + 1).padStart(2, '0'), listX, y);
      ctx.fillStyle = C.charcoal;
      ctx.fillText(wd, listX + fsMono * 2.4, y);
    });
  }

  // Headline word, deliberately cropped by the edge
  ctx.fillStyle = C.charcoal;
  const target = landscape ? w * 0.62 : w * 1.08;
  const size = fitText(ctx, hero, 700, target, h * 0.6);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const hx = landscape ? pad - size * 0.04 : pad - size * 0.05 - w * 0.04 * p.focus.x;
  const hy = landscape ? h - pad - fsMono * 1.5 : h - pad * 0.2 + size * 0.06;
  ctx.fillText(hero, hx, hy);

  // Cutline caption
  ctx.font = `400 ${fsMono}px "DM Mono", monospace`;
  ctx.fillStyle = C.charcoal;
  ctx.textAlign = 'right';
  const cap = words.slice(0, 5).join(' / ');
  if (landscape) ctx.fillText(cap, w - pad, h - pad * 0.5);
  else ctx.fillText(cap, w - pad, py + ph + fsMono * 2);

  if (p.accent === 'lime') {
    ctx.fillStyle = C.lime;
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillRect(pad, hy - size * 0.36, colW * 2, size * 0.1);
    ctx.globalCompositeOperation = 'source-over';
  }

  grain(ctx, w, h, p.grain * 0.35);
}

// ————————————————————————————————————————————— III. CUT (fragments)

function drawCut(ctx: CanvasRenderingContext2D, w: number, h: number, a: Analysis, p: Params) {
  const r = rng(p.seed + 23);
  const u = Math.min(w, h) / 1000;
  const vertical = w / h > 1.2;
  const acc = accentColor(p.accent, C.white);
  ctx.fillStyle = C.charcoal;
  ctx.fillRect(0, 0, w, h);

  const mX = w * 0.07;
  const mY = h * 0.07;
  const iw = w - mX * 2;
  const ih = h - mY * 2;
  const off = document.createElement('canvas');
  off.width = Math.max(2, Math.round(iw));
  off.height = Math.max(2, Math.round(ih));
  drawPhoto(off.getContext('2d')!, off.width, off.height, a, { ...p, grain: p.grain * 0.7 });

  const n = 6 + Math.floor(r() * 5);
  const len = vertical ? iw : ih;
  // uneven strip sizes
  const sizes = Array.from({ length: n }, () => 0.5 + r());
  const total = sizes.reduce((s, x) => s + x, 0);
  const strips = sizes.map((s) => (s / total) * len);
  const order = strips.map((_, i) => i);
  // swap a couple of strips: out of order, as memory is
  for (let k = 0; k < 2; k++) {
    const i = Math.floor(r() * n);
    const j = Math.min(n - 1, i + 1 + Math.floor(r() * 2));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const starts: number[] = [];
  strips.reduce((acc2, s, i) => ((starts[i] = acc2), acc2 + s), 0);

  const gap = 6 * u;
  const tinted = Math.floor(r() * n);
  let pos = 0;
  order.forEach((src, i) => {
    const s = strips[src];
    const drift = (r() - 0.5) * (vertical ? ih : iw) * 0.06 * (0.5 + p.focus.x);
    ctx.save();
    if (vertical) {
      const dx = mX + pos + i * gap - (gap * n) / 2;
      ctx.drawImage(off, starts[src], 0, s, ih, dx, mY + drift, s, ih);
      if (i === tinted && p.accent !== 'none') {
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = acc;
        ctx.fillRect(dx, mY + drift, s, ih);
      }
    } else {
      const dy = mY + pos + i * gap - (gap * n) / 2;
      ctx.drawImage(off, 0, starts[src], iw, s, mX + drift, dy, iw, s);
      if (i === tinted && p.accent !== 'none') {
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = acc;
        ctx.fillRect(mX + drift, dy, iw, s);
      }
    }
    ctx.restore();
    pos += s;
  });

  // Cut marks
  const fsMono = Math.max(8, Math.round(Math.min(w, h) * 0.019));
  ctx.save();
  ctx.strokeStyle = 'rgba(244,241,234,0.55)';
  ctx.lineWidth = Math.max(1, 1.2 * u);
  ctx.setLineDash([8 * u, 6 * u]);
  ctx.font = `400 ${fsMono}px "DM Mono", monospace`;
  ctx.fillStyle = 'rgba(244,241,234,0.7)';
  pos = 0;
  order.forEach((src, i) => {
    pos += strips[src];
    if (i === n - 1) return;
    const at = (vertical ? mX : mY) + pos + i * gap - (gap * n) / 2 + gap / 2;
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(at, mY * 0.35);
      ctx.lineTo(at, h - mY * 0.35);
    } else {
      ctx.moveTo(mX * 0.35, at);
      ctx.lineTo(w - mX * 0.35, at);
    }
    ctx.stroke();
    if (i % 2 === 0) {
      if (vertical) ctx.fillText(String(i + 1).padStart(2, '0'), at + 4 * u, mY * 0.3);
      else ctx.fillText(String(i + 1).padStart(2, '0'), mX * 0.1, at - 4 * u);
    }
  });
  ctx.restore();

  // Paper labels with the kept words
  const words = keptWords(a, p.kept).slice(0, 7);
  const fs = Math.max(9, Math.round(Math.min(w, h) * 0.026));
  ctx.font = `500 ${fs}px "DM Mono", monospace`;
  words.forEach((wd, i) => {
    const tw = ctx.measureText(wd).width;
    const lw = tw + fs * 1.4;
    const lh = fs * 2;
    const x = mX + r() * (iw - lw);
    const y = mY + ((i + 0.5 + (r() - 0.5) * 0.5) / words.length) * (ih - lh);
    ctx.save();
    ctx.translate(x + lw / 2, y + lh / 2);
    ctx.rotate((r() - 0.5) * 0.12);
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 10 * u;
    ctx.shadowOffsetY = 3 * u;
    ctx.fillStyle = C.white;
    ctx.fillRect(-lw / 2, -lh / 2, lw, lh);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = C.charcoal;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(wd, 0, fs * 0.05);
    // tape
    if (p.accent !== 'none') {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = p.accent === 'lime' ? C.lime : C.vermilion;
      ctx.rotate(0.5);
      ctx.fillRect(-lw / 2 - fs * 0.2, -lh / 2 - fs * 0.8, fs * 1.6, fs * 0.7);
    }
    ctx.restore();
  });

  grain(ctx, w, h, p.grain * 0.5);
}

// ————————————————————————————————————————————— entry points

export async function fontsReady() {
  try {
    await Promise.all([
      document.fonts.load('700 100px "Space Grotesk"'),
      document.fonts.load('400 20px "DM Mono"'),
      document.fonts.load('500 20px "DM Mono"'),
    ]);
  } catch {
    /* fall back to system fonts */
  }
}

export function renderArtwork(canvas: HTMLCanvasElement, cssWidth: number, m: Memory, a: Analysis, p: Params, dpr = 1) {
  const ratio = FRAME_RATIO[p.frame];
  const w = Math.max(2, Math.round(cssWidth * dpr));
  const h = Math.max(2, Math.round((cssWidth / ratio) * dpr));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  if (p.direction === 'afterglow') drawPhoto(ctx, w, h, a, p, { stamp: true, memory: m });
  else if (p.direction === 'index') drawIndex(ctx, w, h, a, p, m);
  else drawCut(ctx, w, h, a, p);
  ctx.restore();
}

/** A museum print: artwork on ivory with its cutline beneath. */
export function renderPrint(m: Memory, a: Analysis, p: Params, title: string, no: number): HTMLCanvasElement {
  const ratio = FRAME_RATIO[p.frame];
  const artW = ratio >= 1.5 ? 3000 : 2000;
  const artH = artW / ratio;
  const margin = artW * 0.08;
  const capH = artW * 0.2;
  const c = document.createElement('canvas');
  c.width = artW + margin * 2;
  c.height = artH + margin * 2 + capH;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = C.ivory;
  ctx.fillRect(0, 0, c.width, c.height);
  const art = document.createElement('canvas');
  renderArtwork(art, artW, m, a, p, 1);
  ctx.drawImage(art, margin, margin);

  const y0 = margin + artH + margin * 0.6;
  const mono = artW * 0.014;
  ctx.fillStyle = C.charcoal;
  ctx.fillRect(margin, y0, artW, Math.max(2, artW * 0.0008));
  ctx.font = `400 ${mono}px "DM Mono", monospace`;
  ctx.textBaseline = 'top';
  ctx.fillText(`NO. ${String(no).padStart(3, '0')}`, margin, y0 + mono * 1.5);
  ctx.textAlign = 'right';
  ctx.fillText('CUTLINE — THE THINGS WE KEEP.', margin + artW, y0 + mono * 1.5);
  ctx.textAlign = 'left';
  ctx.font = `600 ${artW * 0.04}px "Space Grotesk", sans-serif`;
  ctx.fillText(title, margin, y0 + mono * 4);
  ctx.font = `400 ${mono}px "DM Mono", monospace`;
  ctx.fillStyle = C.grey;
  const meta = [m.author ? `Directed by ${m.author}` : 'Directed by the one who remembers', m.year, `${p.light} light`, `${p.kept.length} words kept`]
    .filter(Boolean)
    .join('   ·   ');
  ctx.fillText(meta.toUpperCase(), margin, y0 + mono * 4 + artW * 0.06);
  ctx.fillStyle = C.charcoal;
  ctx.fillText(keptWords(a, p.kept).join(' / '), margin, y0 + mono * 6.5 + artW * 0.06);
  return c;
}
