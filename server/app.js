// CUTLINE API. Mounted by server/index.js (production + dev).
import express from 'express';
import { health, interpret, isHermesModel, keyConfigured, listModels, redact } from './nous.js';
import { agentEnabled, agentHealth, agentVersion, interpretWithAgent } from './hermesAgent.js';
import { photograph, photographConfigured, photographHealth, PhotographError, readPhotograph } from './photograph.js';
import { analyze as pangramAnalyze, listModels as pangramModels, pangramConfigured, pangramHealth, PangramError } from './pangram.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  // Reports configuration and the last real outcomes. Never returns secret values.
  app.get('/api/status', async (req, res) => {
    const configured = keyConfigured();
    const envModel = (process.env.NOUS_MODEL || '').trim() || null;
    const out = {
      nous: {
        keyConfigured: configured,
        model: envModel,
        modelSource: envModel ? 'env' : null,
        modelListed: null,
        hermesModels: [],
        modelsEndpoint: health.models,
        lastInterpretation: health.chat,
        // "connected" only after a real authenticated chat completion succeeded.
        connected: Boolean(health.chat?.ok),
        // "hermesVerified" only if that successful call was served by a Hermes model.
        hermesVerified: Boolean(health.chat?.ok && isHermesModel(health.chat.model)),
      },
    };
    out.interpreter = agentEnabled() ? 'hermes-agent' : 'nous';
    out.hermesAgent = {
      enabled: agentEnabled(),
      bin: (process.env.HERMES_BIN || '').trim() ? 'HERMES_BIN' : 'default install location',
      model: (process.env.HERMES_AGENT_MODEL || '').trim() || null,
      toolsets: (process.env.HERMES_AGENT_TOOLSETS ?? 'todo').trim() || null,
      installed: agentHealth.version,
      lastRun: agentHealth.run,
      // true only after a real Hermes Agent run returned valid directions
      verified: Boolean(agentHealth.run?.ok),
      hermesModelVerified: Boolean(agentHealth.run?.ok && isHermesModel(agentHealth.run.model)),
    };
    if (agentEnabled() && req.query.check !== '0') out.hermesAgent.installed = await agentVersion();
    if (configured && req.query.check !== '0') {
      try {
        const ids = await listModels({ force: req.query.refresh === '1' });
        out.nous.hermesModels = ids.filter((id) => /hermes/i.test(id));
        out.nous.modelCount = ids.length;
        if (envModel) out.nous.modelListed = ids.includes(envModel);
        else if (out.nous.hermesModels.length) {
          out.nous.model = [...out.nous.hermesModels].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
          out.nous.modelSource = 'discovered';
          out.nous.modelListed = true;
        }
      } catch (e) {
        out.nous.modelsError = redact(e.message);
      }
      out.nous.modelsEndpoint = health.models;
    }
    // ORIGIN CHECK (Pangram). "verified" only after a real successful analysis in this process.
    out.pangram = {
      configured: pangramConfigured(),
      model: (process.env.PANGRAM_MODEL || '').trim() || null,
      models: pangramHealth.models,
      lastAnalysis: pangramHealth.analysis,
      verified: Boolean(pangramHealth.analysis?.ok),
    };
    if (pangramConfigured() && req.query.check !== '0') {
      try {
        await pangramModels({ force: req.query.refresh === '1' });
      } catch {
        /* reported through pangramHealth.models */
      }
      out.pangram.models = pangramHealth.models;
    }
    // PHOTOGRAPH (Modal). "verified" only after a real successful generation in this process.
    out.photograph = {
      configured: photographConfigured(),
      last: photographHealth.last,
      verified: Boolean(photographHealth.last?.ok),
    };
    res.set('Cache-Control', 'no-store').json(out);
  });

  app.post('/api/interpret', async (req, res) => {
    const { text, year, preferences } = req.body || {};
    if (typeof text !== 'string' || text.trim().split(/\s+/).length < 5 || text.length > 600) {
      return res.status(400).json({ ok: false, error: 'text must be 5+ words and at most 600 characters' });
    }
    const input = {
      text: text.trim(),
      year: typeof year === 'string' ? year.trim().slice(0, 12) : '',
      preferences,
    };
    if (agentEnabled()) {
      try {
        const result = await interpretWithAgent(input);
        return res.json({ ok: true, source: 'hermes-agent', hermes: isHermesModel(result.model), ...result });
      } catch (e) {
        return res.status(502).json({ ok: false, source: 'unavailable', error: `Hermes Agent: ${redact(e.message)}` });
      }
    }
    if (!keyConfigured()) {
      return res.status(503).json({ ok: false, source: 'unavailable', error: 'NOUS_API_KEY is not configured on the server' });
    }
    try {
      const result = await interpret(input);
      res.json({ ok: true, source: 'nous', hermes: isHermesModel(result.model), ...result });
    } catch (e) {
      res.status(502).json({ ok: false, source: 'unavailable', error: redact(e.message) });
    }
  });

  // ORIGIN CHECK: user-initiated Pangram analysis of the memory text. Separate from interpretation.
  let originInFlight = 0;
  app.post('/api/origin', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const { text } = req.body || {};
    if (typeof text !== 'string' || text.trim().split(/\s+/).length < 5 || text.length > 2000) {
      return res.status(400).json({ ok: false, code: 'invalid_input', error: 'Text must be at least 5 words and at most 2000 characters.' });
    }
    if (!pangramConfigured()) {
      return res.status(503).json({ ok: false, code: 'not_configured', error: 'Pangram is not configured on the server.' });
    }
    if (originInFlight >= 3) {
      return res.status(429).json({ ok: false, code: 'busy', error: 'Too many analyses at once. Try again in a moment.' });
    }
    originInFlight++;
    try {
      const result = await pangramAnalyze(text.trim());
      res.json({ ok: true, source: 'pangram', result });
    } catch (e) {
      const err = e instanceof PangramError ? e : new PangramError('error', 'Unexpected error.', 502);
      res.status(err.status).json({ ok: false, code: err.code, error: err.message });
    } finally {
      originInFlight--;
    }
  });

  // PHOTOGRAPH: user-initiated generation on Modal from the chosen direction.
  let photographInFlight = 0;
  app.post('/api/photograph', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (photographInFlight >= 2) {
      return res.status(429).json({ ok: false, code: 'busy', error: 'A photograph is already being developed.' });
    }
    photographInFlight++;
    try {
      const result = await photograph(req.body);
      res.json({ ok: true, source: 'modal', ...result, url: `/api/photographs/${result.id}` });
    } catch (e) {
      const err = e instanceof PhotographError ? e : new PhotographError('error', 'Unexpected error.', 502);
      res.status(err.status).json({ ok: false, code: err.code, error: err.message });
    } finally {
      photographInFlight--;
    }
  });

  app.get('/api/photographs/:id', async (req, res) => {
    const jpg = await readPhotograph(req.params.id);
    if (!jpg) return res.status(404).json({ ok: false, error: 'not found' });
    res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=31536000, immutable' }).send(jpg);
  });

  app.use('/api', (_req, res) => res.status(404).json({ ok: false, error: 'not found' }));
  return app;
}
