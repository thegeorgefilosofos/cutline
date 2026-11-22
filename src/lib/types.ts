import type { Light } from './analyze';

export type Direction = 'afterglow' | 'index' | 'cut';
export type Frame = '4:5' | '1:1' | '16:9' | '3:1';
export type Accent = 'vermilion' | 'lime' | 'none';

export interface Memory {
  text: string;
  year: string;
  author: string;
}

export interface Params {
  direction: Direction;
  frame: Frame;
  focus: { x: number; y: number };
  light: Light;
  grain: number; // 0..1
  accent: Accent;
  kept: number[];
  seed: number;
}

export interface Work {
  id: string;
  no: number;
  memory: Memory;
  params: Params;
  keptAt: number;
  example?: boolean;
}

export const FRAME_RATIO: Record<Frame, number> = {
  '4:5': 4 / 5,
  '1:1': 1,
  '16:9': 16 / 9,
  '3:1': 3,
};

export const DIRECTIONS: {
  id: Direction;
  numeral: string;
  name: string;
  medium: string;
  line: (hero: string, light: string) => string;
}[] = [
  {
    id: 'afterglow',
    numeral: 'I',
    name: 'Afterglow',
    medium: 'Imagined photograph',
    line: (hero, light) =>
      `A photograph that was never taken. The ${hero}, held in ${light.toLowerCase()} light — overexposed the way memory overexposes what mattered.`,
  },
  {
    id: 'index',
    numeral: 'II',
    name: 'Index',
    medium: 'Typographic inventory',
    line: (hero) =>
      `An inventory of the moment. Every word you keep is numbered, weighed and given a place on the grid. The ${hero} becomes the headline.`,
  },
  {
    id: 'cut',
    numeral: 'III',
    name: 'Cut',
    medium: 'Fragment collage',
    line: () =>
      `The moment, cut into strips and reassembled slightly out of order — the way it actually returns to you, in pieces.`,
  },
];
