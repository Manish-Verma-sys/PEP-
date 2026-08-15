// ---------------------------------------------------------------------------
// Live regulatory source layer.
//
// Real, no-API-key sources that each return a clickable evidence link:
//   1. openFDA food enforcement API (structured JSON, official FDA data)
//   2. Google News RSS, one targeted query per regulator (EFSA, FSSAI, Codex,
//      plus a general FDA/food-regulation feed)
//
// Every produced alert carries a `url` (source link) so the UI shows evidence.
// Results are cached in-memory to keep the app fast. If everything fails, the
// caller falls back to seed data.
//
// Toggle with REGWATCH_LIVE (default true so the hosted app is live).
// ---------------------------------------------------------------------------

const LIVE = String(process.env.REGWATCH_LIVE ?? 'true').toLowerCase() === 'true';

let CACHE = { at: 0, data: [] };
const TTL_MS = 15 * 60 * 1000;

function classifyFocus(text) {
  const t = (text || '').toLowerCase();
  if (/sugar|sweeten|hfcs|glucose|fructose|aspartame|stevia/.test(t)) return 'Sugar reduction';
  if (/sodium|salt/.test(t)) return 'Sodium reduction';
  if (/packag|plastic|recycl|food-contact|food contact|migration|bpa/.test(t)) return 'Sustainable packaging';
  if (/protein|fibre|fiber|probiotic|functional|fortif|vitamin|nutrient/.test(t)) return 'Functional ingredients';
  if (/label|claim|front-of-pack|fop|nutrition facts|warning/.test(t)) return 'Labelling / reformulation';
  return 'Labelling / reformulation';
}
function classifySeverity(text) {
  const t = (text || '').toLowerCase();
  if (/ban|recall|phase-out|phase out|prohibit|mandatory|enforce|withdraw|alert|contaminat/.test(t)) return 'critical';
  if (/propose|draft|consult|review|re-evaluat|reevaluat|amend|guidance|opinion/.test(t)) return 'high';
  return 'watch';
}
function timeAgo(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return 'recent';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return Math.max(mins, 1) + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
}
function stripTags(s) {
  return (s || '').replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}
function parseRssItems(xml, max) {
  const items = [];
  const blocks = xml.split('<item>').slice(1);
  for (const b of blocks.slice(0, max)) {
    const pick = (tag) => {
      const m = b.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i'));
      if (!m) return '';
      return m[1].replace('<![CDATA[', '').replace(']]>', '').trim();
    };
    items.push({
      title: stripTags(pick('title')),
      link: pick('link'),
      pubDate: pick('pubDate'),
      description: stripTags(pick('description')).slice(0, 220)
    });
  }
  return items;
}
async function fetchWithTimeout(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || 8000);
  try { return await fetch(url, { ...(opts || {}), signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}
function fmtFdaDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return '';
  return yyyymmdd.slice(0,4) + '-' + yyyymmdd.slice(4,6) + '-' + yyyymmdd.slice(6,8);
}

async function fetchOpenFDA() {
  try {
    const url = 'https://api.fda.gov/food/enforcement.json?sort=report_date:desc&limit=5';
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error('openFDA ' + res.status);
    const data = await res.json();
    return (data.results || []).map((r, i) => {
      const desc = r.reason_for_recall || r.product_description || '';
      return {
        id: 'openfda-' + (r.recall_number || i),
        sev: /class i\b/i.test(r.classification || '') ? 'critical' : 'high',
        reg: 'FDA',
        when: timeAgo(fmtFdaDate(r.report_date)),
        focus: classifyFocus((r.product_description || '') + ' ' + desc),
        title: 'FDA enforcement: ' + (r.product_description || 'food recall').slice(0, 90),
        desc: desc.slice(0, 200),
        tags: ['FDA', r.state || 'US', r.classification || 'Enforcement'].filter(Boolean),
        impact: 'Live FDA enforcement action - ' + (r.status || 'ongoing'),
        region: 'United States',
        stage: r.status || 'Reported',
        enforce: fmtFdaDate(r.recall_initiation_date) || 'n/a',
        lead: 'active',
        detail: desc + ' (Firm: ' + (r.recalling_firm || 'n/a') + '. Distribution: ' + (r.distribution_pattern || 'n/a') + '.)',
        url: 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts',
        source: 'openFDA',
        skus: []
      };
    });
  } catch (err) {
    console.error('[sources] openFDA failed:', err.message);
    return [];
  }
}

const NEWS_FEEDS = [
  { reg: 'EFSA',  q: 'EFSA food safety OR novel food OR additive' },
  { reg: 'FSSAI', q: 'FSSAI food regulation OR labelling OR standard' },
  { reg: 'Codex', q: 'Codex Alimentarius food standard' },
  { reg: 'FDA',   q: 'FDA food additive OR GRAS OR food labeling' }
];

async function fetchNewsFeed(feed) {
  const { reg, q } = feed;
  try {
    const url = 'https://news.google.com/rss/search?q=' +
      encodeURIComponent(q + ' when:30d') + '&hl=en-US&gl=US&ceid=US:en';
    const res = await fetchWithTimeout(url, { headers: { 'user-agent': 'Mozilla/5.0 RegWatch/1.0' } });
    if (!res.ok) throw new Error(reg + ' news ' + res.status);
    const xml = await res.text();
    return parseRssItems(xml, 5).map((it, i) => {
      const text = it.title + ' ' + it.description;
      return {
        id: 'news-' + reg.toLowerCase() + '-' + i,
        sev: classifySeverity(text),
        reg,
        when: timeAgo(it.pubDate),
        focus: classifyFocus(text),
        title: it.title || (reg + ' update'),
        desc: it.description || 'Regulatory news item.',
        tags: [reg, 'News'],
        impact: 'Monitor - regulatory news signal',
        region: reg === 'FSSAI' ? 'India' : reg === 'EFSA' ? 'European Union' : reg === 'Codex' ? 'Global reference' : 'United States',
        stage: 'Reported in press',
        enforce: 'See source',
        lead: 'varies',
        detail: (it.description || '') + ' (Source article via Google News aggregation.)',
        url: it.link || '',
        source: 'Google News (' + reg + ')',
        skus: []
      };
    });
  } catch (err) {
    console.error('[sources] news feed failed for', reg, ':', err.message);
    return [];
  }
}

export function liveEnabled() { return LIVE; }

export async function fetchLiveAlerts() {
  if (!LIVE) return [];
  if (Date.now() - CACHE.at < TTL_MS && CACHE.data.length) return CACHE.data;

  const results = await Promise.allSettled([
    fetchOpenFDA(),
    ...NEWS_FEEDS.map(fetchNewsFeed)
  ]);

  let merged = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) merged = merged.concat(r.value);
  }
  merged = merged.filter(a => a.url && /^https?:\/\//.test(a.url));

  if (merged.length) CACHE = { at: Date.now(), data: merged };
  return merged;
}
