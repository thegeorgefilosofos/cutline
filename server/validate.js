// Strict validation of the model's JSON before anything reaches the frontend.
// If this fails, the frontend falls back to the local interpreter.

export const MODES = ['afterglow', 'index', 'cut'];
export const LIGHTS = ['dawn', 'day', 'dusk', 'night'];
export const MOTIFS = ['window', 'water', 'motion', 'rain', 'snow', 'figures', 'open'];

const LIMITS = {
  title: [2, 80],
  emotional_interpretation: [10, 420],
  visual_philosophy: [10, 420],
  composition: [10, 420],
  preserves: [3, 300],
  leaves_out: [3, 300],
};

function str(v, [min, max], path, errors) {
  if (typeof v !== 'string') {
    errors.push(`${path} must be a string`);
    return '';
  }
  const s = v.replace(/\s+/g, ' ').trim();
  if (s.length < min) errors.push(`${path} is too short`);
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

/**
 * Escape double quotes that sit *inside* a string value, e.g. "the "radio" low".
 * A quote closes a string only if the next non-space character is , : ] } or the end.
 */
function escapeInnerQuotes(src) {
  let out = '';
  let inStr = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (!inStr) {
      if (c === '"') inStr = true;
      out += c;
      continue;
    }
    if (c === '\\') {
      out += c + (src[i + 1] ?? '');
      i++;
      continue;
    }
    if (c === '"') {
      const next = src.slice(i + 1).match(/^\s*(\S)?/)?.[1] ?? '';
      if (next === '' || ',:]}'.includes(next)) {
        inStr = false;
        out += c;
      } else {
        out += '\\"';
      }
      continue;
    }
    if (c === '\n') out += '\\n';
    else if (c === '\r') out += '';
    else if (c === '\t') out += ' ';
    else out += c;
  }
  return out;
}

/** Best-effort repair of common model JSON mistakes. Never invents content. */
export function repairJson(src) {
  let s = src.replace(/[\u201C\u201D]/g, '"');
  s = s.replace(/"\s+(?=")/g, '", '); // missing comma between strings
  s = s.replace(/([}\]])\s+(?=["{[])/g, '$1, '); // missing comma after } or ]
  s = escapeInnerQuotes(s);
  s = s.replace(/,\s*([}\]])/g, '$1'); // trailing commas
  return s;
}

/** Pull the first JSON object out of a model reply (tolerates code fences, preambles, small JSON mistakes). */
export function extractJson(text) {
  if (typeof text !== 'string') throw new Error('empty model reply');
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in model reply');
  const raw = body.slice(start, end + 1);
  try {
    return JSON.parse(raw);
  } catch (first) {
    try {
      return JSON.parse(repairJson(raw));
    } catch {
      throw first;
    }
  }
}

/**
 * Validate and normalise an interpretation.
 * Returns { ok: true, value } or { ok: false, errors }.
 */
export function validateInterpretation(raw, memoryText = '') {
  const errors = [];
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['root must be an object'] };
  const list = Array.isArray(raw.directions) ? raw.directions : null;
  if (!list || list.length !== 3) return { ok: false, errors: ['directions must be an array of exactly 3'] };

  const words = new Set(
    memoryText
      .toLowerCase()
      .split(/[^\p{L}\p{N}'’]+/u)
      .filter(Boolean),
  );

  const directions = list.map((d, i) => {
    const p = `directions[${i}]`;
    if (!d || typeof d !== 'object') {
      errors.push(`${p} must be an object`);
      return null;
    }
    const mode = typeof d.mode === 'string' ? d.mode.toLowerCase().trim() : '';
    if (!MODES.includes(mode)) errors.push(`${p}.mode must be one of ${MODES.join(', ')}`);
    const light = typeof d.light === 'string' ? d.light.toLowerCase().trim() : '';
    if (!LIGHTS.includes(light)) errors.push(`${p}.light must be one of ${LIGHTS.join(', ')}`);
    const motifs = Array.isArray(d.motifs)
      ? [...new Set(d.motifs.map((m) => String(m).toLowerCase().trim()).filter((m) => MOTIFS.includes(m)))]
      : [];
    if (!Array.isArray(d.motifs)) errors.push(`${p}.motifs must be an array`);
    // Keywords must come from the memory itself: the model may not add words the person never wrote.
    const keywords = Array.isArray(d.keep_words)
      ? [...new Set(d.keep_words.map((w) => String(w).toLowerCase().replace(/[^\p{L}\p{N}'’]/gu, '')).filter((w) => w && words.has(w)))].slice(0, 9)
      : [];
    return {
      mode,
      title: str(d.title, LIMITS.title, `${p}.title`, errors),
      emotional_interpretation: str(d.emotional_interpretation, LIMITS.emotional_interpretation, `${p}.emotional_interpretation`, errors),
      visual_philosophy: str(d.visual_philosophy, LIMITS.visual_philosophy, `${p}.visual_philosophy`, errors),
      composition: str(d.composition, LIMITS.composition, `${p}.composition`, errors),
      light,
      motifs: motifs.length ? motifs : ['open'],
      preserves: str(d.preserves, LIMITS.preserves, `${p}.preserves`, errors),
      leaves_out: str(d.leaves_out, LIMITS.leaves_out, `${p}.leaves_out`, errors),
      keep_words: keywords,
    };
  });

  if (!errors.length) {
    const modes = directions.map((d) => d.mode);
    if (new Set(modes).size !== 3) errors.push('the three directions must use three different modes');
    const titles = directions.map((d) => d.title.toLowerCase());
    if (new Set(titles).size !== 3) errors.push('the three directions must have distinct titles');
  }
  if (errors.length) return { ok: false, errors };

  // Always return in the renderer's order: I afterglow, II index, III cut.
  directions.sort((a, b) => MODES.indexOf(a.mode) - MODES.indexOf(b.mode));
  return { ok: true, value: { directions } };
}
