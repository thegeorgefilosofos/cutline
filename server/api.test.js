// node --test server/
// Exercises validation and the full API against a fake Nous server (no real key needed).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { extractJson, validateInterpretation } from './validate.js';

const MEMORY = 'Sunday mornings at the kitchen table with my sister, rain on the window, the radio low.';

const good = () => ({
  directions: [
    { mode: 'cut', title: 'Pieces of Sunday', emotional_interpretation: 'The morning returns in fragments.', visual_philosophy: 'Memory is not linear.', composition: 'Horizontal strips, two swapped.', light: 'dawn', motifs: ['window', 'rain', 'dragons'], keep_words: ['radio', 'Sister', 'unicorn'], preserves: 'The sounds.', leaves_out: 'The order of events.' },
    { mode: 'afterglow', title: 'Window light', emotional_interpretation: 'A quiet, held warmth.', visual_philosophy: 'One frame, overexposed.', composition: 'Window centred, figure small.', light: 'dawn', motifs: ['window', 'figures'], keep_words: ['kitchen', 'window'], preserves: 'The light.', leaves_out: 'The conversation.' },
    { mode: 'index', title: 'Inventory of a table', emotional_interpretation: 'Ordinary things, counted.', visual_philosophy: 'Words as objects.', composition: 'Grid with headline KITCHEN.', light: 'day', motifs: [], keep_words: ['table', 'kitchen', 'rain'], preserves: 'The nouns.', leaves_out: 'The weather mood.' },
  ],
});

test('valid interpretation is normalised and ordered I/II/III', () => {
  const v = validateInterpretation(good(), MEMORY);
  assert.equal(v.ok, true);
  assert.deepEqual(v.value.directions.map((d) => d.mode), ['afterglow', 'index', 'cut']);
  const cut = v.value.directions[2];
  assert.deepEqual(cut.motifs, ['window', 'rain'], 'unknown motifs are dropped');
  assert.deepEqual(cut.keep_words, ['radio', 'sister'], 'words not in the memory are dropped');
  assert.deepEqual(v.value.directions[1].motifs, ['open'], 'empty motifs default to open');
});

test('rejects wrong count, duplicate modes, bad light, missing fields', () => {
  assert.equal(validateInterpretation({ directions: good().directions.slice(0, 2) }, MEMORY).ok, false);
  const dup = good(); dup.directions[0].mode = 'index';
  assert.equal(validateInterpretation(dup, MEMORY).ok, false);
  const badLight = good(); badLight.directions[1].light = 'twilight';
  assert.equal(validateInterpretation(badLight, MEMORY).ok, false);
  const missing = good(); delete missing.directions[2].composition;
  assert.equal(validateInterpretation(missing, MEMORY).ok, false);
  assert.equal(validateInterpretation(null, MEMORY).ok, false);
});

test('extractJson tolerates code fences and preambles', () => {
  assert.deepEqual(extractJson('Sure!\n```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('here: {"a":{"b":2}} done'), { a: { b: 2 } });
  assert.throws(() => extractJson('no json'));
});

// ——— API against a fake Nous upstream

let upstream, api, apiUrl, mode = 'ok';
const FAKE_KEY = 'test-key-1234567890';
const seen = [];

before(async () => {
  upstream = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      seen.push({ url: req.url, auth: req.headers.authorization, body: body ? JSON.parse(body) : null });
      res.setHeader('Content-Type', 'application/json');
      if (req.headers.authorization !== `Bearer ${FAKE_KEY}`) return res.writeHead(401).end('{"error":"unauthorized"}');
      if (req.url === '/v1/models') return res.end(JSON.stringify({ data: [{ id: 'other/model' }, { id: 'NousResearch/Hermes-Test-8B' }] }));
      if (mode === 'garbage') return res.end(JSON.stringify({ model: 'NousResearch/Hermes-Test-8B', choices: [{ message: { content: 'I cannot do JSON today' } }] }));
      if (mode === 'error') return res.writeHead(500).end(`{"error":"boom ${FAKE_KEY}"}`);
      res.end(JSON.stringify({ model: 'NousResearch/Hermes-Test-8B', choices: [{ message: { content: JSON.stringify(good()) } }] }));
    });
  }).listen(0);
  await new Promise((r) => upstream.once('listening', r));
  process.env.NOUS_BASE_URL = `http://localhost:${upstream.address().port}/v1`;
  process.env.NOUS_API_KEY = FAKE_KEY;
  delete process.env.NOUS_MODEL;
  const { createApp } = await import('./app.js');
  api = createApp().listen(0);
  await new Promise((r) => api.once('listening', r));
  apiUrl = `http://localhost:${api.address().port}`;
});

after(() => {
  upstream.close();
  api.close();
});

const post = (body) =>
  fetch(`${apiUrl}/api/interpret`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('status reports configuration without exposing the key', async () => {
  const r = await fetch(`${apiUrl}/api/status`);
  const text = await r.text();
  assert.ok(!text.includes(FAKE_KEY), 'key must never appear in status');
  const s = JSON.parse(text);
  assert.equal(s.nous.keyConfigured, true);
  assert.equal(s.nous.model, 'NousResearch/Hermes-Test-8B', 'auto-selects a listed Hermes model');
  assert.equal(s.nous.modelSource, 'discovered');
  assert.equal(s.nous.connected, false, 'not connected before a successful chat call');
});

test('interpret returns validated Hermes directions', async () => {
  mode = 'ok';
  const r = await post({ text: MEMORY, year: '2009' });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.source, 'nous');
  assert.equal(j.hermes, true);
  assert.equal(j.model, 'NousResearch/Hermes-Test-8B');
  assert.equal(j.directions.length, 3);
  const call = seen.find((s) => s.url === '/v1/chat/completions');
  assert.equal(call.body.model, 'NousResearch/Hermes-Test-8B');
  assert.match(call.body.messages[1].content, /Sunday mornings/);
  const s = await (await fetch(`${apiUrl}/api/status?check=0`)).json();
  assert.equal(s.nous.connected, true);
  assert.equal(s.nous.hermesVerified, true);
});

test('invalid model output -> 502, never passed through', async () => {
  mode = 'garbage';
  const r = await post({ text: MEMORY });
  assert.equal(r.status, 502);
  const j = await r.json();
  assert.equal(j.ok, false);
  assert.equal(j.directions, undefined);
});

test('upstream errors are redacted', async () => {
  mode = 'error';
  const r = await post({ text: MEMORY });
  const text = await r.text();
  assert.equal(r.status, 502);
  assert.ok(!text.includes(FAKE_KEY), 'key must be redacted from errors');
});

test('rejects too-short memories', async () => {
  const r = await post({ text: 'too short' });
  assert.equal(r.status, 400);
});
