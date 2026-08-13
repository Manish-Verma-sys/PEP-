import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALERTS, FOCUS_AREAS, REGULATORS } from '../alerts.js';
import { generateInsight, providerStatus } from './insights.js';
import { fetchLiveAlerts, liveEnabled } from './sources.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// In-memory cache of merged alerts (seed + optional live).
let ALERT_CACHE = [...ALERTS];
async function refreshAlerts() {
  if (liveEnabled()) {
    try {
      const live = await fetchLiveAlerts();
      ALERT_CACHE = [...live, ...ALERTS];
    } catch {
      ALERT_CACHE = [...ALERTS];
    }
  } else {
    ALERT_CACHE = [...ALERTS];
  }
  return ALERT_CACHE;
}

// ---- API ------------------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({ ok: true, live: liveEnabled(), ...providerStatus(), count: ALERT_CACHE.length });
});

app.get('/api/alerts', async (req, res) => {
  const list = await refreshAlerts();
  const { reg, sev, focus, q } = req.query;
  let out = list;
  if (reg && reg !== 'all') out = out.filter(a => a.reg === reg);
  if (sev && sev !== 'all') out = out.filter(a => a.sev === sev);
  if (focus && focus !== 'all') out = out.filter(a => a.focus === focus);
  if (q) {
    const s = String(q).toLowerCase();
    out = out.filter(a =>
      (a.title + a.desc + (a.tags || []).join(' ')).toLowerCase().includes(s)
    );
  }
  res.json({ alerts: out, total: out.length });
});

app.get('/api/alerts/:id', async (req, res) => {
  const list = await refreshAlerts();
  const alert = list.find(a => a.id === req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  res.json(alert);
});

// AI / rule-based insight for a single alert.
app.get('/api/alerts/:id/insight', async (req, res) => {
  const list = await refreshAlerts();
  const alert = list.find(a => a.id === req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  const insight = await generateInsight(alert, list);
  res.json(insight);
});

// Overview stats.
app.get('/api/overview', async (req, res) => {
  const list = await refreshAlerts();
  const by = s => list.filter(a => a.sev === s).length;
  const skusExposed = list.reduce((n, a) => n + (a.skus ? a.skus.length : 0), 0);
  res.json({
    critical: by('critical'),
    high: by('high'),
    watch: by('watch'),
    skusExposed,
    focusTouched: new Set(list.map(a => a.focus)).size,
    total: list.length,
    top: list.slice(0, 5).map(({ id, sev, reg, when, title, focus, region }) =>
      ({ id, sev, reg, when, title, focus, region }))
  });
});

// Portfolio impact aggregation.
app.get('/api/portfolio', async (req, res) => {
  const list = await refreshAlerts();
  const areas = FOCUS_AREAS.map(name => {
    const items = list.filter(a => a.focus === name);
    const skus = items.reduce((n, a) => n + (a.skus ? a.skus.length : 0), 0);
    const score = Math.min(100, items.length * 22 + skus * 8);
    let level = 'low';
    if (score >= 66) level = 'high'; else if (score >= 40) level = 'med';
    return {
      name, level, score,
      openAlerts: items.length,
      skusExposed: skus,
      drivers: items.slice(0, 3).map(a => a.title)
    };
  });
  res.json({ areas, regulators: REGULATORS });
});

// SPA fallback -> index.html for any non-API route.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  const st = providerStatus();
  console.log(`RegWatch running on :${PORT}`);
  console.log(`  provider=${st.provider}  key=${st.keyConfigured ? 'set' : 'not set'}  live=${liveEnabled()}`);
});
