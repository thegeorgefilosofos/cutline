// CUTLINE API. Mounted by server/index.js (production + dev).
import express from 'express';
import { health, interpret, isHermesModel, keyConfigured, listModels, redact } from './nous.js';
import { agentEnabled, agentHealth, agentVersion, interpretWithAgent } from './hermesAgent.js';

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
      toolsets: (process.env.HERMES_AGENT_TOOLSETS ?? 'none').trim() || null,
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

  app.use('/api', (_req, res) => res.status(404).json({ ok: false, error: 'not found' }));
  return app;
}
