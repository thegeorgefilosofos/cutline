import { analyze, defaultKept } from './analyze';
import type { Direction, Frame, Memory, Params, Work } from './types';

const KEY = 'cutline.collection.v1';

export function initialParams(m: Memory, direction: Direction = 'afterglow', frame: Frame = '4:5'): Params {
  const a = analyze(m.text);
  return {
    direction,
    frame,
    focus: { x: 0.35 + ((a.seed >> 3) % 30) / 100, y: 0.5 },
    light: a.light,
    grain: 0.55,
    accent: 'vermilion',
    kept: defaultKept(a),
    seed: a.seed,
  };
}

export const EXAMPLES: Memory[] = [
  {
    text: 'My grandmother peeling oranges by the kitchen window early in the morning, the radio playing a song she pretended not to know.',
    year: '1998',
    author: 'Eleni',
  },
  {
    text: 'Driving home after midnight with the windows down, nobody talking, the whole city asleep and the road all ours.',
    year: '2014',
    author: 'Marco',
  },
  {
    text: 'The last swim of the summer, the sea already cold at sunset, my father counting us out of the water one by one.',
    year: '2003',
    author: 'Ana',
  },
];

function exampleWorks(): Work[] {
  const dirs: Direction[] = ['afterglow', 'cut', 'index'];
  const frames: Frame[] = ['4:5', '16:9', '4:5'];
  return EXAMPLES.map((m, i) => ({
    id: `example-${i}`,
    no: i + 1,
    memory: m,
    params: { ...initialParams(m, dirs[i], frames[i]), accent: i === 1 ? 'lime' : 'vermilion' },
    keptAt: Date.UTC(2026, 10, 20 + i),
    example: true,
  }));
}

export function loadCollection(): Work[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const list = JSON.parse(raw) as Work[];
      if (Array.isArray(list) && list.length) return list;
    }
  } catch {
    /* storage unavailable */
  }
  return exampleWorks();
}

export function saveCollection(list: Work[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable — the collection lives for this visit only */
  }
}
