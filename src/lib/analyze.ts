// CUTLINE — memory interpreter.
// Reads an ordinary moment and extracts the light, the place, the motifs and
// the words worth keeping. Deterministic: the same memory always reads the same.

export type Light = 'dawn' | 'day' | 'dusk' | 'night';
export type Motif = 'window' | 'water' | 'motion' | 'rain' | 'snow' | 'figures' | 'open';

export interface Token {
  raw: string; // as written, with punctuation
  clean: string; // lowercased, letters only
  salient: boolean; // a candidate for keeping
}

export interface Analysis {
  tokens: Token[];
  keywords: string[];
  light: Light;
  hero: string; // the single word the moment turns on
  motifs: Motif[];
  title: string;
  seed: number;
}

const STOP = new Set(
  `a an the and or but if then so of to in on at by for with from up down out over under into onto about as is was were be been being am are it its it's this that these those there here i me my mine we us our you your he him his she her they them their what which who whom when where why how all any both each few more most other some such no nor not only own same than too very can will just don should now one would could did do does had has have having while still always never ever every again once like even also because just really felt feel something someone nothing anything everything thing things time day before after until through during around without within back away off whole little last first went came got get made make let used use being said say`.split(
    /\s+/,
  ),
);

const LIGHT_WORDS: Record<Light, string[]> = {
  dawn: ['morning', 'dawn', 'sunrise', 'early', 'breakfast', 'coffee', 'woke', 'waking', 'mist', 'fog', 'school'],
  day: ['noon', 'afternoon', 'lunch', 'summer', 'beach', 'park', 'bright', 'sunny', 'sun', 'picnic', 'heat'],
  dusk: ['evening', 'sunset', 'dusk', 'dinner', 'golden', 'late', 'autumn', 'last', 'orange', 'supper'],
  night: ['night', 'midnight', 'dark', 'stars', 'moon', 'lamp', 'candle', 'sleep', 'asleep', 'bed', 'lights', 'neon'],
};

const PLACES = [
  'kitchen', 'window', 'sea', 'beach', 'car', 'train', 'balcony', 'garden', 'street', 'room', 'bed', 'table',
  'field', 'roof', 'rooftop', 'station', 'porch', 'lake', 'river', 'bus', 'bridge', 'city', 'house', 'home',
  'school', 'park', 'shore', 'harbour', 'harbor', 'forest', 'hill', 'mountain', 'road', 'airport', 'stairs',
  'pool', 'cafe', 'market', 'church', 'island', 'village', 'apartment', 'hospital', 'library', 'water',
];

const MOTIF_WORDS: Record<Exclude<Motif, 'open'>, string[]> = {
  window: ['kitchen', 'window', 'room', 'table', 'bed', 'house', 'home', 'apartment', 'cafe', 'library', 'curtain', 'lamp', 'radio'],
  water: ['sea', 'beach', 'lake', 'river', 'swim', 'swimming', 'shore', 'harbour', 'harbor', 'pool', 'water', 'waves', 'island', 'boat'],
  motion: ['car', 'train', 'bus', 'driving', 'drive', 'road', 'highway', 'bike', 'cycling', 'running', 'airport', 'plane', 'ferry'],
  rain: ['rain', 'raining', 'storm', 'umbrella', 'wet', 'puddle'],
  snow: ['snow', 'snowing', 'winter', 'frost', 'ice', 'cold'],
  figures: ['mother', 'father', 'mum', 'mom', 'dad', 'grandmother', 'grandfather', 'grandma', 'grandpa', 'sister', 'brother', 'friend', 'friends', 'we', 'us', 'together', 'family', 'son', 'daughter', 'child', 'children', 'wife', 'husband', 'love', 'partner', 'dog'],
};

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function singular(w: string) {
  return w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;
}

export function motifsOf(words: string[]): Motif[] {
  const ws = words.flatMap((w) => [w, singular(w)]);
  const motifs: Motif[] = (Object.keys(MOTIF_WORDS) as Exclude<Motif, 'open'>[]).filter((m) =>
    ws.some((c) => MOTIF_WORDS[m].includes(c)),
  );
  if (!motifs.includes('window') && !motifs.includes('water') && !motifs.includes('motion')) motifs.push('open');
  return motifs;
}

export function tokenize(text: string): Token[] {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => {
      const clean = raw.toLowerCase().replace(/[^\p{L}\p{N}'’]/gu, '').replace(/['’]s$/, '');
      const salient = clean.length > 2 && !STOP.has(clean) && !/^\d+$/.test(clean);
      return { raw, clean, salient };
    });
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function analyze(text: string): Analysis {
  const tokens = tokenize(text);
  const cleans = tokens.flatMap((t) => [t.clean, singular(t.clean)]);
  const seed = hash(text.trim().toLowerCase());

  // Light: count cues, ties broken by order of appearance.
  let light: Light = (['dusk', 'dawn', 'night', 'day'] as Light[])[seed % 4];
  let best = 0;
  (Object.keys(LIGHT_WORDS) as Light[]).forEach((l) => {
    const score = cleans.filter((c) => LIGHT_WORDS[l].includes(c)).length;
    if (score > best) {
      best = score;
      light = l;
    }
  });

  const motifs = motifsOf(cleans);

  // Keywords: salient, de-duplicated, weighted by length and rarity of position.
  const seen = new Set<string>();
  const scored: { w: string; s: number }[] = [];
  tokens.forEach((t, i) => {
    if (!t.salient || seen.has(t.clean)) return;
    seen.add(t.clean);
    let s = t.clean.length + (PLACES.includes(t.clean) ? 6 : 0) + (i < 4 ? 1 : 0);
    if (Object.values(MOTIF_WORDS).some((l) => l.includes(t.clean))) s += 3;
    scored.push({ w: t.clean, s });
  });
  scored.sort((a, b) => b.s - a.s);
  const keywords = scored.slice(0, 7).map((x) => x.w);

  const place = tokens.map((t) => t.clean).find((c) => PLACES.includes(c) || PLACES.includes(singular(c)));
  const hero = place || keywords[0] || 'moment';

  const titles: Record<Light, string[]> = {
    dawn: [`The ${hero}, before anyone woke`, `${cap(hero)} in first light`, `Early, the ${hero}`],
    day: [`The ${hero} at the height of the day`, `${cap(hero)}, unhurried`, `A whole afternoon of ${hero}`],
    dusk: [`The ${hero}, the last light`, `${cap(hero)} at the turning hour`, `Until the ${hero} went gold`],
    night: [`The ${hero}, after the lights went out`, `${cap(hero)}, after midnight`, `Night held the ${hero}`],
  };
  const title = titles[light][seed % 3];

  return { tokens, keywords, light, hero, motifs, title, seed };
}

/** Indices of tokens that are kept by default: the first occurrence of each keyword. */
export function defaultKept(a: Analysis): number[] {
  const out: number[] = [];
  const done = new Set<string>();
  a.tokens.forEach((t, i) => {
    if (a.keywords.includes(t.clean) && !done.has(t.clean)) {
      done.add(t.clean);
      out.push(i);
    }
  });
  return out;
}

export function keptWords(a: Analysis, kept: number[]): string[] {
  return [...kept].sort((x, y) => x - y).map((i) => a.tokens[i]?.clean).filter(Boolean) as string[];
}

export const LIGHT_LABEL: Record<Light, string> = {
  dawn: 'Dawn',
  day: 'Day',
  dusk: 'Dusk',
  night: 'Night',
};
