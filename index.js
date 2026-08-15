import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALERTS, FOCUS_AREAS, REGULATORS } from './alerts.js';
import { generateInsight, providerStatus } from './insights.js';
import { getLiveResearch, liveEnabled, cacheAgeMs } from './live.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// Default scouting (used if live research doesn't supply its own).
const SEED_SCOUTING = [
  { kind: 'license', name: 'Plant-based sweetener (GRAS-filed)', why: 'High regulatory readiness; direct substitute for a sweetener under pressure.', s: [85, 90, 70] },
  { kind: 'partner', name: 'Enzymatic sugar-conversion startup', why: 'Strong IP in enzymatic sweetness; better as a co-development partner.', s: [45, 75, 80] },
  { kind: 'acquire', name: 'Rare-sugar production platform', why: 'Foundational process IP; gives owned freedom-to-operate.', s: [60, 82, 40] }
];

// Resolve the working dataset: live research -> else seed. Cached by live.js.
let LAST_MODE = 'seed';
async function resolveData() {
  if (liveEnabled()) {
    const live = await getLiveResearch();
    if (live && live.alerts.length) {
      LAST_MODE = 'live (Gemini + Google Search)';
      return { alerts: live.alerts, scouting: live.scouting.length ? live.scouting : SEED_SCOUTING };
    }
    LAST_MODE = 'seed (live unavailable)';
    return { alerts: [...ALERTS], scouting: SEED_SCOUTING };
  }
  LAST_MODE = 'seed (live disabled)';
  return { alerts: [...ALERTS], scouting: SEED_SCOUTING };
}

// ---- API ------------------------------------------------------------------

app.get('/api/health', async (req, res) => {
  const { alerts } = await resolveData();
  res.json({
    ok: true, live: liveEnabled(), mode: LAST_MODE,
    ...providerStatus(), count: alerts.length,
    cacheAgeSec: cacheAgeMs() != null ? Math.round(cacheAgeMs() / 1000) : null
  });
});

// One-shot payload that powers all four pages from a single live fetch.
app.get('/api/live', async (req, res) => {
  const { alerts, scouting } = await resolveData();
  const by = s => alerts.filter(a => a.sev === s).length;
  const skusExposed = alerts.reduce((n, a) => n + (a.skus ? a.skus.length : 0), 0);

  const areas = FOCUS_AREAS.map(name => {
    const items = alerts.filter(a => a.focus === name);
    const score = Math.min(100, items.length * 20 + (items.filter(a => a.sev === 'critical').length) * 15);
    let level = 'low'; if (score >= 60) level = 'high'; else if (score >= 35) level = 'med';
    return { name, level, score, openAlerts: items.length,
      skusExposed: items.reduce((n, a) => n + (a.skus ? a.skus.length : 0), 0),
      drivers: items.slice(0, 3).map(a => a.title) };
  });

  res.json({
    mode: LAST_MODE,
    generatedAt: new Date().toISOString(),
    overview: {
      critical: by('critical'), high: by('high'), watch: by('watch'),
      skusExposed, focusTouched: new Set(alerts.map(a => a.focus)).size, total: alerts.length,
      top: alerts.slice(0, 6)
    },
    alerts,
    portfolio: { areas, regulators: REGULATORS },
    scouting
  });
});

app.get('/api/alerts', async (req, res) => {
  const { alerts } = await resolveData();
  const { reg, sev, focus, q } = req.query;
  let out = alerts;
  if (reg && reg !== 'all') out = out.filter(a => a.reg === reg);
  if (sev && sev !== 'all') out = out.filter(a => a.sev === sev);
  if (focus && focus !== 'all') out = out.filter(a => a.focus === focus);
  if (q) { const s = String(q).toLowerCase();
    out = out.filter(a => (a.title + a.desc + (a.tags || []).join(' ')).toLowerCase().includes(s)); }
  res.json({ alerts: out, total: out.length });
});

app.get('/api/alerts/:id', async (req, res) => {
  const { alerts } = await resolveData();
  const alert = alerts.find(a => a.id === req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  res.json(alert);
});

app.get('/api/alerts/:id/insight', async (req, res) => {
  const { alerts } = await resolveData();
  const alert = alerts.find(a => a.id === req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  const insight = await generateInsight(alert, alerts);
  res.json(insight);
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.listen(PORT, () => {
  const st = providerStatus();
  console.log(`RegWatch running on :${PORT}`);
  console.log(`  provider=${st.provider}  key=${st.keyConfigured ? 'set' : 'not set'}  live=${liveEnabled()}`);
});
