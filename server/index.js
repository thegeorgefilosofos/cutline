// CUTLINE server: the API, plus the built frontend in production (npm start).
import 'dotenv/config';
import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { keyConfigured } from './nous.js';

const app = createApp();
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const prod = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');
if (prod && existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(join(dist, 'index.html')));
}

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => {
  console.log(`CUTLINE API on http://localhost:${port}`);
  console.log(`Nous API key: ${keyConfigured() ? 'configured' : 'NOT configured — local interpreter fallback will be used'}`);
  console.log(`NOUS_MODEL: ${process.env.NOUS_MODEL ? process.env.NOUS_MODEL : '(not set — will auto-select a listed Hermes model)'}`);
});
