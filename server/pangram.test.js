// ORIGIN CHECK: Pangram integration tested against a fake Pangram server (no real key or credits).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { normalizeResult } from './pangram.js';

const KEY = 'pg-test-key-123456789';
const MEMORY = 'Sunday mornings at the kitchen table with my sister, rain on the window, the radio low.';
let upstream, api, url;
let mode = 'ok';
let polls = 0;
const seen = [];

const success = {
  stage: 'STAGE_SUCCESS',
  text: MEMORY,
  version: '4.1',
  headline: 'Fully Human Written',
  prediction: 'We are confident that this document is fully human-written',
  prediction_short: 'Human',
  fraction_ai: 0,
  fraction_ai_assisted: 0.25,
  fraction_human: 0.75,
  num_ai_segments: 0,
  num_ai_assisted_segments: 1,
  num_human_segments: 1,
  windows: [
    { text: 'Sunday mornings at the kitchen table', label: 'Human Written', ai_assistance_score: 0.02, confidence: 'High', start_index: 0, end_index: 36, word_count: 6, token_length: 8 },
    { text: 'rain on the window', label: 'AI-Assisted', ai_assistance_score: 0.4, confidence: 'Banana', start_index: 51, end_index: 69, word_count: 4 },
  ],
};

before(async () => {
  upstream = http
    .createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        seen.push({ method: req.method, url: req.url, key: req.headers['x-api-key'], body: body ? JSON.parse(body) : null });
        res.setHeader('Content-Type', 'application/json');
        if (req.headers['x-api-key'] !== KEY) return res.writeHead(401).end('{"detail":"Missing API key"}');
        if (req.url === '/models') return res.end(JSON.stringify({ models: ['default', 'pangram-4', 'pangram-4.1'] }));
        if (req.method === 'POST' && req.url === '/task') {
          if (mode === 'credits') return res.writeHead(402).end('{"detail":"Insufficient credits"}');
          if (mode === 'rate') return res.writeHead(429).end('{"detail":"rate"}');
          polls = 0;
          return res.end(JSON.stringify({ task_id: 'task-abc_123' }));
        }
        if (req.url === '/task/task-abc_123') {
          polls++;
          if (mode === 'failed') return res.end(JSON.stringify({ stage: 'STAGE_FAILED', headline: 'preprocessing: no valid text' }));
          if (mode === 'never') return res.end(JSON.stringify({ stage: 'STAGE_RUNNING' }));
          if (polls < 2) return res.end(JSON.stringify({ stage: 'STAGE_RUNNING' }));
          return res.end(JSON.stringify(success));
        }
        res.writeHead(404).end('{}');
      });
    })
    .listen(0);
  await new Promise((r) => upstream.once('listening', r));
  process.env.PANGRAM_BASE_URL = `http://localhost:${upstream.address().port}`;
  process.env.PANGRAM_API_KEY = KEY;
  delete process.env.PANGRAM_MODEL;
  delete process.env.INTERPRETER;
  const { createApp } = await import('./app.js');
  api = createApp().listen(0);
  await new Promise((r) => api.once('listening', r));
  url = `http://localhost:${api.address().port}`;
});

after(() => {
  upstream.close();
  api.close();
});

const origin = (text) =>
  fetch(`${url}/api/origin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });

test('analysis: discovers models, submits, polls, returns documented fields only', async () => {
  mode = 'ok';
  const r = await origin(MEMORY);
  const raw = await r.text();
  assert.equal(r.status, 200);
  assert.ok(!raw.includes(KEY), 'key never reaches the browser');
  const j = JSON.parse(raw);
  assert.equal(j.source, 'pangram');
  assert.equal(j.result.prediction_short, 'Human');
  assert.deepEqual(j.result.fractions, { human: 0.75, ai_assisted: 0.25, ai: 0 });
  assert.equal(j.result.version, '4.1');
  assert.equal(j.result.model, 'default', 'uses Pangram\'s listed "default" alias');
  assert.equal(j.result.windows.length, 2);
  assert.equal(j.result.windows[1].confidence, null, 'unknown confidence values are dropped, not guessed');
  assert.equal(j.result.windows[0].token_length, undefined, 'undocumented-for-UI fields are not passed through');
  const post = seen.find((s) => s.method === 'POST' && s.url === '/task');
  assert.deepEqual(post.body, { text: MEMORY, model: 'default', public_dashboard_link: false });
  assert.ok(polls >= 2, 'polls until STAGE_SUCCESS');
});

test('status: verified only after a real successful analysis; no key or text exposed', async () => {
  const r = await fetch(`${url}/api/status`);
  const raw = await r.text();
  assert.ok(!raw.includes(KEY));
  assert.ok(!raw.includes('kitchen table'));
  const s = JSON.parse(raw);
  assert.equal(s.pangram.configured, true);
  assert.deepEqual(s.pangram.models.models, ['default', 'pangram-4', 'pangram-4.1']);
  assert.equal(s.pangram.verified, true);
});

test('insufficient credits -> clear "credits" error', async () => {
  mode = 'credits';
  const r = await origin(MEMORY);
  assert.equal(r.status, 503);
  const j = await r.json();
  assert.equal(j.code, 'credits');
  assert.equal(j.result, undefined);
});

test('rate limit and failed analysis are reported, never turned into a result', async () => {
  mode = 'rate';
  assert.equal((await (await origin(MEMORY)).json()).code, 'rate_limited');
  mode = 'failed';
  const j = await (await origin(MEMORY)).json();
  assert.equal(j.code, 'analysis_failed');
  assert.equal(j.result, undefined);
});

test('PANGRAM_MODEL must be one of the listed models', async () => {
  mode = 'ok';
  process.env.PANGRAM_MODEL = 'pangram-99';
  const j = await (await origin(MEMORY)).json();
  assert.equal(j.code, 'model_not_enabled');
  process.env.PANGRAM_MODEL = 'pangram-4.1';
  const ok = await (await origin(MEMORY)).json();
  assert.equal(ok.result.model, 'pangram-4.1');
  delete process.env.PANGRAM_MODEL;
});

test('input validation: too short / too long', async () => {
  assert.equal((await origin('too short')).status, 400);
  assert.equal((await origin('word '.repeat(500))).status, 400);
});

test('normalizeResult rejects results without any classification', () => {
  assert.throws(() => normalizeResult({ stage: 'STAGE_SUCCESS' }, 'default'));
  const r = normalizeResult({ prediction_short: 'Mixed', fraction_ai: 2, fraction_human: -1 }, 'default');
  assert.deepEqual(r.fractions, { human: 0, ai_assisted: null, ai: 1 });
});
