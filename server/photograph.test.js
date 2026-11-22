// PHOTOGRAPH: Modal integration tested against a fake Modal endpoint (no GPU, no credits).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPrompt } from './photograph.js';

const KEY = 'test-photograph-key-0123456789';
const DIR = mkdtempSync(join(tmpdir(), 'cutline-photos-'));
// smallest valid-looking JPEG body for the fake: SOI marker + padding
const FAKE_JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(4000, 7), Buffer.from([0xff, 0xd9])]);
let fake, api, url;
let mode = 'ok';
const seen = [];

const body = { frame: '4:5', light: 'night', motifs: ['snow', 'figures', 'dragons'], words: ['brother', 'snow'], composition: 'Two small figures under a street lamp.', seed: 42 };

before(async () => {
  fake = http
    .createServer((req, res) => {
      let b = '';
      req.on('data', (c) => (b += c));
      req.on('end', () => {
        seen.push({ key: req.headers['x-cutline-key'], body: JSON.parse(b || '{}') });
        if (req.headers['x-cutline-key'] !== KEY) return res.writeHead(401).end('{"detail":"unauthorized"}');
        if (mode === 'down') return res.writeHead(500).end('{}');
        if (mode === 'notimage') return res.writeHead(200, { 'content-type': 'text/html' }).end('<html>oops</html>');
        res.writeHead(200, { 'content-type': 'image/jpeg', 'x-model': 'stabilityai/stable-diffusion-xl-base-1.0' }).end(FAKE_JPEG);
      });
    })
    .listen(0);
  await new Promise((r) => fake.once('listening', r));
  process.env.PHOTOGRAPH_ALLOW_LOCAL = '1';
  process.env.MODAL_PHOTOGRAPH_URL = `http://localhost:${fake.address().port}`;
  process.env.MODAL_PHOTOGRAPH_KEY = KEY;
  process.env.PHOTOGRAPH_DIR = DIR;
  delete process.env.INTERPRETER;
  const { createApp } = await import('./app.js');
  api = createApp().listen(0);
  await new Promise((r) => api.once('listening', r));
  url = `http://localhost:${api.address().port}`;
});
after(() => {
  fake.close();
  api.close();
});

const post = (b) => fetch(`${url}/api/photograph`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

test('generates on Modal, stores the JPEG on the server, serves it back; key never exposed', async () => {
  mode = 'ok';
  const r = await post(body);
  const raw = await r.text();
  assert.equal(r.status, 200);
  assert.ok(!raw.includes(KEY));
  const j = JSON.parse(raw);
  assert.equal(j.source, 'modal');
  assert.match(j.id, /^[0-9a-f-]{36}$/);
  assert.equal(j.model, 'stabilityai/stable-diffusion-xl-base-1.0');
  assert.deepEqual(readdirSync(DIR), [`${j.id}.jpg`]);
  const img = await fetch(`${url}${j.url}`);
  assert.equal(img.headers.get('content-type'), 'image/jpeg');
  assert.equal(Buffer.from(await img.arrayBuffer()).length, FAKE_JPEG.length);
  const sent = seen.at(-1).body;
  assert.equal(sent.frame, '4:5');
  assert.equal(sent.seed, 42);
  assert.match(sent.prompt, /Two small figures under a street lamp/);
  assert.match(sent.prompt, /a memory of brother, snow/);
  assert.ok(!/dragons/.test(sent.prompt), 'unknown motifs are ignored');
});

test('status: verified only after a real successful generation; no key exposed', async () => {
  const raw = await (await fetch(`${url}/api/status?check=0`)).text();
  assert.ok(!raw.includes(KEY));
  const s = JSON.parse(raw);
  assert.equal(s.photograph.configured, true);
  assert.equal(s.photograph.verified, true);
});

test('wrong key, Modal down and non-image responses become clear errors; nothing stored', async () => {
  const before = readdirSync(DIR).length;
  process.env.MODAL_PHOTOGRAPH_KEY = 'wrong-key-wrong-key-123';
  assert.equal((await (await post(body)).json()).code, 'auth');
  process.env.MODAL_PHOTOGRAPH_KEY = KEY;
  mode = 'down';
  assert.equal((await (await post(body)).json()).code, 'unavailable');
  mode = 'notimage';
  assert.equal((await (await post(body)).json()).code, 'bad_response');
  assert.equal(readdirSync(DIR).length, before);
});

test('input validation', async () => {
  mode = 'ok';
  assert.equal((await post({ ...body, frame: '9:9' })).status, 400);
  assert.equal((await post({ ...body, light: 'neon' })).status, 400);
  assert.equal((await post({ ...body, words: [] })).status, 400);
});

test('stored photographs: only well-formed ids are served', async () => {
  assert.equal((await fetch(`${url}/api/photographs/..%2F..%2Fpackage.json`)).status, 404);
  assert.equal((await fetch(`${url}/api/photographs/00000000-0000-0000-0000-000000000000`)).status, 404);
});

test('prompt uses only the direction and kept words', () => {
  const p = buildPrompt({ composition: 'A window\nat dawn', light: 'dawn', motifs: ['window'], words: ['kitchen', 'radio'] });
  assert.match(p, /^A window at dawn\. a memory of kitchen, radio\. early dawn/);
  assert.ok(!p.includes('\n'));
});
