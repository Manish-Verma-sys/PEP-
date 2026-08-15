// ---------------------------------------------------------------------------
// Live research layer powered by Gemini + Google Search grounding.
//
// On demand (cached ~15 min), asks Gemini to research CURRENT regulatory
// changes across FDA / EFSA / FSSAI / Codex relevant to food & beverage R&D,
// and to return structured JSON that drives all four pages:
//   - alerts (overview + feed)
//   - portfolio roll-up (focus-area exposure)
//   - scouting candidates (substitute technologies)
//
// Every alert includes a source URL (evidence) taken from Gemini's grounding
// metadata where possible. Falls back to seed data if Gemini is unavailable.
// ---------------------------------------------------------------------------

const API_KEY = process.env.REGWATCH_API_KEY || '';
const MODEL = process.env.REGWATCH_MODEL || 'gemini-2.0-flash';
const LIVE = String(process.env.REGWATCH_LIVE ?? 'true').toLowerCase() === 'true';

let CACHE = { at: 0, data: null };
const TTL_MS = 15 * 60 * 1000;

// ---- prompt ---------------------------------------------------------------
function buildResearchPrompt() {
  const today = new Date().toISOString().slice(0, 10);
  return `You are a regulatory-intelligence analyst for a global food & beverage R&D
organisation (think PepsiCo-scale: snacks and beverages). Today is ${today}.

Use Google Search to find the MOST RECENT, REAL regulatory developments (ideally
within the last 60 days) from these bodies relevant to food & beverage R&D:
- FDA (US) - food additives, GRAS, labeling, enforcement
- EFSA (EU) - novel foods, additives, health claims, re-evaluations
- FSSAI (India) - standards, labelling, packaging rules
- Codex Alimentarius - international standard revisions

Focus on topics that matter to R&D: sugar reduction / sweeteners, sodium reduction,
functional ingredients, sustainable & food-contact packaging, and labelling/health-claim rules.

Return ONLY a JSON object (no markdown, no backticks, no prose) with this exact shape:
{
  "alerts": [
    {
      "reg": "FDA|EFSA|FSSAI|Codex",
      "title": "concise headline of the actual development",
      "desc": "1-2 sentence factual summary",
      "sev": "critical|high|watch",
      "focus": "Sugar reduction|Sodium reduction|Functional ingredients|Sustainable packaging|Labelling / reformulation",
      "region": "United States|European Union|India|Global reference",
      "stage": "e.g. Proposed rule, Consultation open, Opinion published, Enforced",
      "impact": "one line on why an F&B R&D team should care",
      "url": "a REAL source URL you found via search",
      "when": "approximate recency e.g. '3d ago', 'this week', 'this month'"
    }
  ],
  "scouting": [
    {
      "kind": "license|partner|acquire",
      "name": "a real or realistic substitute technology / company category",
      "why": "one line tying it to a regulatory signal above",
      "maturity": 0-100, "fit": 0-100, "accessibility": 0-100
    }
  ]
}

Rules:
- 8 to 12 alerts, spread across all four regulators.
- Set sev by real impact: bans/recalls/mandatory=critical; proposals/consultations/reviews=high; early/press=watch.
- Every alert MUST have a real url found via search. Omit any alert you cannot source.
- 3 to 4 scouting candidates tied to the sweetener/packaging/sodium signals.
- Output the raw JSON object only.`;
}

// ---- Gemini call with Google Search ---------------------------------------
async function callGemini() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': API_KEY },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildResearchPrompt() }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096 }
    })
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error('gemini ' + res.status + ' ' + t.slice(0, 200));
  }
  const data = await res.json();
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts || []).map(p => p.text || '').join('').trim();

  // Collect grounding source links as a fallback pool of evidence URLs.
  const chunks = cand?.groundingMetadata?.groundingChunks || [];
  const groundUrls = chunks.map(c => c?.web?.uri).filter(Boolean);

  return { text, groundUrls };
}

// Robustly extract the JSON object from model text.
function extractJson(text) {
  if (!text) return null;
  let t = text.trim();
  // strip code fences if present
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  const slice = t.slice(start, end + 1);
  try { return JSON.parse(slice); } catch { return null; }
}

// ---- normalise into the app's alert shape ---------------------------------
const FOCUS = ['Sugar reduction', 'Sodium reduction', 'Functional ingredients', 'Sustainable packaging', 'Labelling / reformulation'];

function normalise(parsed, groundUrls) {
  if (!parsed || !Array.isArray(parsed.alerts)) return null;
  let urlPool = [...(groundUrls || [])];

  const alerts = parsed.alerts
    .map((a, i) => {
      let url = (a.url && /^https?:\/\//.test(a.url)) ? a.url : (urlPool.shift() || '');
      if (!url) return null; // evidence required
      const sev = ['critical', 'high', 'watch'].includes(a.sev) ? a.sev : 'watch';
      const focus = FOCUS.includes(a.focus) ? a.focus : 'Labelling / reformulation';
      const reg = ['FDA', 'EFSA', 'FSSAI', 'Codex'].includes(a.reg) ? a.reg : 'FDA';
      return {
        id: 'live-' + reg.toLowerCase() + '-' + i,
        sev, reg, focus,
        when: a.when || 'recent',
        title: String(a.title || (reg + ' regulatory update')).slice(0, 160),
        desc: String(a.desc || '').slice(0, 300),
        tags: [reg, focus.split(' ')[0]],
        impact: String(a.impact || 'Monitor regulatory signal').slice(0, 160),
        region: a.region || (reg === 'FSSAI' ? 'India' : reg === 'EFSA' ? 'European Union' : reg === 'Codex' ? 'Global reference' : 'United States'),
        stage: a.stage || 'Reported',
        enforce: a.stage || 'See source',
        lead: 'live',
        detail: String(a.desc || '') + ' (Sourced live via Gemini + Google Search.)',
        url,
        source: 'Gemini + Google Search',
        skus: []
      };
    })
    .filter(Boolean);

  const scouting = Array.isArray(parsed.scouting) ? parsed.scouting.slice(0, 4).map(s => ({
    kind: ['license', 'partner', 'acquire'].includes(s.kind) ? s.kind : 'partner',
    name: String(s.name || 'Substitute technology').slice(0, 100),
    why: String(s.why || '').slice(0, 200),
    s: [clamp(s.maturity), clamp(s.fit), clamp(s.accessibility)]
  })) : [];

  return { alerts, scouting };
}
function clamp(n) { n = Number(n); if (isNaN(n)) return 60; return Math.max(0, Math.min(100, Math.round(n))); }

// ---- public API -----------------------------------------------------------
export function liveEnabled() { return LIVE && Boolean(API_KEY); }

export async function getLiveResearch() {
  if (!liveEnabled()) return null;
  if (CACHE.data && Date.now() - CACHE.at < TTL_MS) return CACHE.data;
  try {
    const { text, groundUrls } = await callGemini();
    const parsed = extractJson(text);
    const norm = normalise(parsed, groundUrls);
    if (norm && norm.alerts.length) {
      CACHE = { at: Date.now(), data: norm };
      return norm;
    }
    console.error('[live] Gemini returned no usable alerts');
    return null;
  } catch (err) {
    console.error('[live] research failed:', err.message);
    return null;
  }
}

export function cacheAgeMs() { return CACHE.data ? Date.now() - CACHE.at : null; }
