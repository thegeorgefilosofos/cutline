#!/usr/bin/env node
// Test double for the Hermes Agent CLI. Records its arguments and cwd, writes a usage
// report, and prints a reply chosen by FAKE_HERMES_MODE.
import { writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
if (args[0] === '--version') { console.log('Hermes Agent v0.0-fake'); process.exit(0); }
writeFileSync(process.env.FAKE_HERMES_LOG, JSON.stringify({ args, cwd: process.cwd() }));
const u = args.indexOf('--usage-file');
if (u >= 0) writeFileSync(args[u + 1], JSON.stringify({ model: 'Hermes-4-405B', api_calls: 1 }));
const mode = process.env.FAKE_HERMES_MODE || 'ok';
if (mode === 'fail') { console.error('auth expired'); process.exit(2); }
if (mode === 'garbage') { console.log('I would rather not.'); process.exit(0); }
const d = (mode_, title, light) => ({ mode: mode_, title, emotional_interpretation: 'Quiet warmth, held.', visual_philosophy: 'One frame.', composition: 'Window centred.', light, motifs: ['window'], keep_words: ['kitchen'], preserves: 'Light.', leaves_out: 'Talk.' });
console.log('```json\n' + JSON.stringify({ directions: [d('afterglow', 'First light', 'dawn'), d('index', 'Inventory', 'day'), d('cut', 'In pieces', 'dusk')] }) + '\n```');
