# CUTLINE — The Things We Keep.

> *What ordinary moment would you keep forever?*
> When anything can be generated, what matters is what we choose to keep.

CUTLINE is an interactive exhibition piece. You share an ordinary memory; the system reads it
(light, place, motifs, the words that matter) and interprets it through three artistic directions.
You then direct the final work and keep it in the collection.

## The flow

1. **Memory** — write the moment, optionally a year and your name.
2. **Reading** — the moment is read: light, place, motifs, keywords.
3. **Directions** — three interpretations, rendered live:
   - **I. Afterglow** — an imagined photograph, film grain and date stamp.
   - **II. Index** — a Swiss typographic inventory around a photographic inset.
   - **III. Cut** — the image cut into strips, reassembled out of order, labelled with kept words.
4. **Studio** — you are the creative director: keep or cut words (what you keep changes what the
   image shows), switch direction, crop (4:5 / 1:1 / 16:9 / 3:1), light, grain, accent, and drag
   on the image to move the light and horizon. "Another take" reseeds.
5. **Kept** — a museum wall label with the struck-through memory and a downloadable print (PNG).
6. **Collection** — every kept work, stored locally in the browser.

All artwork is generated on canvas, deterministically, in the browser. No server or API keys.

## Run

```bash
npm install
npm run dev
```

`npm run build` type-checks and produces a static site in `dist/`.

## Structure

- `src/lib/analyze.ts` — the memory interpreter (light, place, motifs, keywords, title)
- `src/lib/render.ts` — the three generative directions and the print renderer
- `src/components/*` — one component per stage
- `src/styles.css` — the design system (Space Grotesk / DM Mono, ivory, charcoal, vermilion, lime)
