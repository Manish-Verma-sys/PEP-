// ---------------------------------------------------------------------------
// Live regulatory source layer (OPTIONAL / OFF BY DEFAULT).
//
// There is no single official API returning clean Codex/FDA/EFSA/FSSAI change
// feeds, so real deployments stitch together several sources. This module is the
// place to add them. When REGWATCH_LIVE=true, server/index.js will call
// fetchLiveAlerts() and merge results with the seed data.
//
// Left as a clearly-marked integration point so the app runs today with seed
// data and you can switch on live fetching once sources/keys are confirmed.
// ---------------------------------------------------------------------------

const LIVE = String(process.env.REGWATCH_LIVE || 'false').toLowerCase() === 'true';

// Example wiring for openFDA (no key required for basic use). Extend with EFSA/
// FSSAI/Codex RSS or scraped feeds as needed, then normalise to the alert shape
// used in data/alerts.js (id, sev, reg, title, desc, focus, tags, ...).
async function fetchOpenFDA() {
  try {
    const url = 'https://api.fda.gov/food/enforcement.json?limit=5';
    const res = await fetch(url);
    if (!res.ok) throw new Error('openFDA ' + res.status);
    const data = await res.json();
    return (data.results || []).map((r, i) => ({
      id: 'openfda-' + (r.recall_number || i),
      sev: 'watch',
      reg: 'FDA',
      when: r.report_date || 'recent',
      focus: 'Labelling / reformulation',
      title: (r.product_description || 'FDA enforcement notice').slice(0, 120),
      desc: (r.reason_for_recall || '').slice(0, 200),
      tags: ['FDA', r.state || 'US'].filter(Boolean),
      impact: 'Live FDA enforcement signal',
      region: 'United States',
      stage: r.status || 'Reported',
      enforce: r.recall_initiation_date || 'n/a',
      lead: 'n/a',
      detail: (r.reason_for_recall || '') + ' (Live openFDA enforcement record.)',
      skus: []
    }));
  } catch (err) {
    console.error('[sources] openFDA fetch failed:', err.message);
    return [];
  }
}

export function liveEnabled() {
  return LIVE;
}

export async function fetchLiveAlerts() {
  if (!LIVE) return [];
  // Add more source fetchers here and concat them.
  const [fda] = await Promise.all([fetchOpenFDA()]);
  return [...fda];
}
