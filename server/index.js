// CUTLINE server: the API, plus the built frontend in production (npm start).
import 'dotenv/config';
import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { keyConfigured } from './nous.js';
import { agentEnabled } from './hermesAgent.js';
import { pangramConfigured } from './pangram.js';
import { photographConfigured } from './photograph.js';

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
  if (agentEnabled()) {
    console.log('Interpreter: Hermes Agent (local CLI, hermes -z)');
    console.log(`HERMES_AGENT_MODEL: ${process.env.HERMES_AGENT_MODEL || '(not set: Hermes Agent default model)'}`);
    console.log(`HERMES_AGENT_TOOLSETS: ${(process.env.HERMES_AGENT_TOOLSETS ?? 'todo') || '(none passed)'}`);
  } else {
    console.log('Interpreter: Nous API');
    console.log(`Nous API key: ${keyConfigured() ? 'configured' : 'NOT configured, local interpreter fallback will be used'}`);
    console.log(`NOUS_MODEL: ${process.env.NOUS_MODEL ? process.env.NOUS_MODEL : '(not set: will auto-select a listed Hermes model)'}`);
  }
  // Configuration only, never values.
  console.log(`Origin check (Pangram): ${pangramConfigured() ? 'configured' : 'not configured (PANGRAM_API_KEY)'}`);
  console.log(`Photograph (Modal): ${photographConfigured() ? 'configured' : 'not configured (MODAL_PHOTOGRAPH_URL, MODAL_PHOTOGRAPH_KEY)'}`);
  if (prod) console.log(`Serving the built app at http://localhost:${port}`);
});
