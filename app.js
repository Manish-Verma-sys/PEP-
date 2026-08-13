// RegWatch SPA — hash-routed, fetches everything from the app's own /api.
const app = document.getElementById('app');
const nav = document.getElementById('nav');

const api = (p) => fetch(p).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const badge = (s) => `<span class="badge b-${s}">${s[0].toUpperCase() + s.slice(1)}</span>`;

// simple router
function route() {
  const hash = (location.hash.replace('#/', '') || 'overview').split('/');
  const [screen, param] = hash;
  document.querySelectorAll('#nav a').forEach(a =>
    a.classList.toggle('on', a.dataset.route === screen));
  if (screen === 'overview') return renderOverview();
  if (screen === 'alerts') return renderAlerts();
  if (screen === 'detail') return renderDetail(param);
  if (screen === 'portfolio') return renderPortfolio();
  if (screen === 'scouting') return renderScouting();
  renderOverview();
}
nav.addEventListener('click', e => {
  const a = e.target.closest('a[data-route]'); if (!a) return;
  location.hash = '#/' + a.dataset.route;
});
window.addEventListener('hashchange', route);

function loading() { app.innerHTML = '<div class="loading">Loading…</div>'; }
function fail(e) { app.innerHTML = `<div class="wrap"><div class="empty">Couldn't load data (${esc(e.message)}). Is the server running?</div></div>`; }

// ---- Screen 1: Overview ---------------------------------------------------
async function renderOverview() {
  loading();
  try {
    const [o, health] = await Promise.all([api('/api/overview'), api('/api/health')]);
    const envtag = document.getElementById('envtag');
    envtag.textContent = health.live ? 'LIVE + SEED' : 'DEMO · SEED';
    app.innerHTML = `
    <div class="wrap">
      <div class="crumb">Screen 01 / Overview</div>
      <div class="head">
        <div><h1 class="page">Good morning, Manish</h1>
          <p>What moved across FSSAI, FDA, EFSA and Codex — mapped to R&D focus areas. Insight engine: <b>${esc(health.provider)}</b>${health.keyConfigured ? '' : ' (no key set — using rule-based insights)'}.</p></div>
        <div class="stamp">DATA SOURCE<b>${o.total} alerts</b>${health.live ? 'live + seed' : 'seed dataset'}</div>
      </div>
      <div class="radar">
        <h2>NEEDS ATTENTION TODAY</h2>
        <div class="big"><div class="num">${o.critical}</div>
          <div class="txt">critical regulatory changes intersect active pipeline work. Click any signal to see the generated analysis.</div></div>
        <div class="metaline">
          <div>Focus areas touched<b>${o.focusTouched} / 5</b></div>
          <div>SKUs exposed<b>${o.skusExposed}</b></div>
          <div>Total signals<b>${o.total}</b></div>
        </div>
      </div>
      <div class="stats">
        <div class="stat crit" onclick="location.hash='#/alerts'"><div class="k">Critical</div><div class="v">${o.critical}</div><div class="d">needs review</div></div>
        <div class="stat" onclick="location.hash='#/alerts'"><div class="k">High priority</div><div class="v">${o.high}</div><div class="d">this period</div></div>
        <div class="stat" onclick="location.hash='#/alerts'"><div class="k">On watchlist</div><div class="v">${o.watch}</div><div class="d">tracking</div></div>
        <div class="stat" onclick="location.hash='#/portfolio'"><div class="k">SKUs exposed</div><div class="v">${o.skusExposed}</div><div class="d">across focus areas</div></div>
      </div>
      <div class="cols">
        <div class="panel"><h3>Top signals right now</h3>
          ${o.top.map(a => `
            <a class="mini" onclick="location.hash='#/detail/${a.id}'">
              <span class="sev ${a.sev}"></span>
              <div><div class="mt">${esc(a.title)}</div><div class="mm">${a.reg} · ${a.when} · ${esc(a.focus)} · ${esc(a.region)}</div></div>
              <span class="go">›</span></a>`).join('')}
          <a class="cta" onclick="location.hash='#/alerts'">Open full alert feed →</a>
        </div>
        <div class="side">
          <div class="insight-side"><h3>How insights are made</h3>
            <p>Each alert's analysis is generated server-side by the insight engine (provider: <b>${esc(health.provider)}</b>), grounded in the current alert set and intended for human review before action.</p></div>
        </div>
      </div>
    </div>`;
  } catch (e) { fail(e); }
}

// ---- Screen 2: Alert feed -------------------------------------------------
let feedState = { reg: 'all', sev: 'all', focus: 'all', q: '' };
async function renderAlerts() {
  loading();
  app.innerHTML = `
  <div class="wrap">
    <div class="crumb">Screen 02 / Alert feed</div>
    <h1 class="page">Alert feed</h1>
    <input class="search" id="q" placeholder="Search alerts — try 'sweetener', 'packaging', 'labelling'…" value="${esc(feedState.q)}">
    <div class="filterbar">
      <div class="fgroup"><span class="lbl">Regulator</span>${chips('reg', ['all', 'FSSAI', 'FDA', 'EFSA', 'Codex'])}</div>
      <div class="fgroup"><span class="lbl">Severity</span>${chips('sev', ['all', 'critical', 'high', 'watch'])}</div>
      <div class="fgroup"><span class="lbl">Focus</span>${chips('focus', ['all', 'Sugar reduction', 'Functional ingredients', 'Sustainable packaging', 'Labelling / reformulation'])}</div>
    </div>
    <div class="count" id="count"></div>
    <div id="list"></div>
  </div>`;
  document.getElementById('q').addEventListener('input', e => { feedState.q = e.target.value; loadFeed(); });
  app.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => {
    const g = c.dataset.group; feedState[g] = c.dataset.val;
    app.querySelectorAll(`.chip[data-group="${g}"]`).forEach(x => x.classList.toggle('on', x === c));
    loadFeed();
  }));
  loadFeed();
}
function chips(group, vals) {
  return vals.map(v => {
    const on = feedState[group] === v ? ' on' : '';
    const sc = (group === 'sev' && v === 'critical') ? ' sc' : '';
    const label = v === 'all' ? 'All' : (v.length > 14 ? v.split(' ')[0] : v[0].toUpperCase() + v.slice(1));
    return `<span class="chip${sc}${on}" data-group="${group}" data-val="${esc(v)}">${esc(label)}</span>`;
  }).join('');
}
async function loadFeed() {
  const qs = new URLSearchParams(feedState).toString();
  try {
    const { alerts, total } = await api('/api/alerts?' + qs);
    const filtered = feedState.reg !== 'all' || feedState.sev !== 'all' || feedState.focus !== 'all' || feedState.q;
    document.getElementById('count').textContent = `${total} alert${total !== 1 ? 's' : ''} shown${filtered ? ' · filtered' : ''}`;
    document.getElementById('list').innerHTML = alerts.length ? alerts.map(a => `
      <article class="alert sev-${a.sev}" onclick="location.hash='#/detail/${a.id}'">
        <div class="row1">${badge(a.sev)}<span class="reg">${a.reg}</span><span class="when">${a.when}</span></div>
        <h3>${esc(a.title)}</h3><p class="desc">${esc(a.desc)}</p>
        <div class="tags">${(a.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        <div class="impact"><span class="arrow">→ impact</span><b>${esc(a.impact)}</b></div>
      </article>`).join('')
      : '<div class="empty">No alerts match these filters.</div>';
  } catch (e) { fail(e); }
}

// ---- Screen 3: Detail (+ live insight fetch) ------------------------------
async function renderDetail(id) {
  loading();
  try {
    const a = await api('/api/alerts/' + encodeURIComponent(id));
    const skuRows = (a.skus && a.skus.length) ? `
      <div class="sec"><h2>Potentially exposed SKUs</h2>
        <table class="sku"><tr><th>Product line</th><th>Market</th><th>Dependency</th><th>Risk</th></tr>
        ${a.skus.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(s.market)}</td><td>${esc(s.dep)}</td><td><span class="risk r-${s.risk}">${s.risk[0].toUpperCase() + s.risk.slice(1)}</span></td></tr>`).join('')}
        </table></div>` : '';
    app.innerHTML = `
    <div class="wrap">
      <a class="back" onclick="location.hash='#/alerts'">‹ back to alert feed</a>
      <div class="row1">${badge(a.sev)}<span class="reg">${a.reg}</span><span class="when">${a.when}</span></div>
      <h1 class="page" style="font-size:26px;margin-bottom:22px">${esc(a.title)}</h1>
      <div class="layout">
        <div>
          <div class="sec"><h2>What changed</h2><p>${esc(a.detail)}</p></div>
          <div class="sec"><h2>Generated analysis · human-review intended</h2>
            <div class="aiflag"><div class="t">◆ Insight engine</div>
              <p id="insight"><span class="spin"></span>Generating analysis…</p>
              <div class="val" id="insightmeta"></div>
            </div>
          </div>
          ${skuRows}
        </div>
        <aside>
          <div class="card"><h3>Signal details</h3><div class="kv">
            <div><div class="k">Focus area</div><div class="v">${esc(a.focus)}</div></div>
            <div><div class="k">Region</div><div class="v">${esc(a.region)}</div></div>
            <div><div class="k">Stage</div><div class="v">${esc(a.stage)}</div></div>
            <div><div class="k">Enforcement</div><div class="v">${esc(a.enforce)}</div></div>
            <div><div class="k">Lead time</div><div class="v">${esc(a.lead)}</div></div>
          </div></div>
          <div class="card"><h3>Actions</h3>
            <button class="btn" onclick="this.textContent='✓ Routed to R&D lead';this.disabled=true;this.style.opacity=.7">Route to R&D lead</button>
            <button class="btn ghost" onclick="this.textContent='✓ Added to watchlist';this.disabled=true;this.style.opacity=.7">Add to watchlist</button>
            <a class="btn ghost" onclick="location.hash='#/scouting'">Link to scouting →</a>
          </div>
        </aside>
      </div>
    </div>`;
    // fetch the generated insight
    try {
      const ins = await api(`/api/alerts/${encodeURIComponent(id)}/insight`);
      document.getElementById('insight').textContent = ins.text;
      document.getElementById('insightmeta').innerHTML =
        `<span class="valdot"></span>engine: ${esc(ins.source)} · grounded in ${ins.grounded_in} signal(s)`;
    } catch {
      document.getElementById('insight').textContent = 'Insight unavailable right now.';
    }
  } catch (e) { fail(e); }
}

// ---- Screen 4: Portfolio --------------------------------------------------
async function renderPortfolio() {
  loading();
  try {
    const { areas } = await api('/api/portfolio');
    app.innerHTML = `
    <div class="wrap">
      <div class="crumb">Screen 04 / Portfolio impact</div>
      <div class="head"><div><h1 class="page">Portfolio impact</h1>
        <p>The same signals, flipped: which focus areas are exposed right now, aggregated live from the alert set.</p></div></div>
      <div class="fgrid">
        ${areas.map(f => `
          <div class="fcard"><div class="top"><h3>${esc(f.name)}</h3>
            <span class="expo e-${f.level}">${f.level === 'high' ? 'High' : f.level === 'med' ? 'Medium' : 'Low'} exposure</span></div>
            <div class="meter"><span class="m-${f.level}" style="width:${f.score}%"></span></div>
            <div class="fstats">
              <div><div class="k">Open alerts</div><div class="v ${f.level === 'high' ? 'acc' : ''}">${f.openAlerts}</div></div>
              <div><div class="k">SKUs exposed</div><div class="v">${f.skusExposed}</div></div>
              <div><div class="k">Exposure</div><div class="v" style="font-size:16px">${f.score}%</div></div>
            </div>
            ${f.drivers.length ? `<div class="drivers"><b>Drivers:</b> ${f.drivers.map(esc).join('; ')}.</div>` : ''}
          </div>`).join('')}
      </div>
    </div>`;
  } catch (e) { fail(e); }
}

// ---- Screen 5: Scouting ---------------------------------------------------
function renderScouting() {
  const targets = [
    { kind: 'license', k: 'k-license', name: 'Plant-based sweetener (FDA GRAS-filed)', from: '← from FDA GRAS signal', why: 'Already in the US GRAS pipeline, so regulatory readiness is high. Direct substitution candidate for the sweetener under EU pressure.', s: [85, 90, 70] },
    { kind: 'partner', k: 'k-partner', name: 'Enzymatic sugar-conversion startup', from: '← whitespace scan', why: 'Early-stage but strong IP position in enzymatic sweetness. Better as a co-development partner than a near-term drop-in.', s: [45, 75, 80] },
    { kind: 'acquire', k: 'k-acquire', name: 'Rare-sugar production platform', from: '← patent landscape', why: 'Holds foundational process IP with broad claims. Would give owned freedom-to-operate rather than supplier dependence.', s: [60, 82, 40] }
  ];
  app.innerHTML = `
  <div class="wrap">
    <div class="crumb">Screen 05 / Scouting handoff</div>
    <div class="head"><div><h1 class="page">Scouting handoff</h1>
      <p>A regulatory signal is the start of a scouting question: turn "an ingredient is under pressure" into "here are the alternatives worth evaluating," then hand qualified targets to External Innovation.</p></div></div>
    <div class="flow">
      <div class="step"><div class="n">01 · SIGNAL</div><div class="t">Change detected</div><div class="d">EFSA sweetener re-evaluation</div></div>
      <div class="step"><div class="n">02 · IMPACT</div><div class="t">Exposure assessed</div><div class="d">SKUs, sugar-reduction focus</div></div>
      <div class="step active"><div class="n">03 · SCOUT</div><div class="t">Find alternatives</div><div class="d">Screen substitutes</div></div>
      <div class="step"><div class="n">04 · QUALIFY</div><div class="t">Score & shortlist</div><div class="d">Maturity · fit · access</div></div>
      <div class="step"><div class="n">05 · HANDOFF</div><div class="t">External Innovation</div><div class="d">Partnership pipeline</div></div>
    </div>
    <div class="cols">
      <div class="panel"><h2>Candidate substitutes — triggered by the EFSA signal</h2>
        <p class="sub2">Scored on the three criteria used for all scouting: maturity, strategic fit, accessibility.</p>
        ${targets.map(t => `
          <div class="target"><div class="r1"><span class="kind ${t.k}">${t.kind}</span><h3>${esc(t.name)}</h3><span class="fromreg">${esc(t.from)}</span></div>
            <p class="why">${esc(t.why)}</p>
            <div class="scores">
              <div class="s"><div class="k">Maturity</div><div class="sbar"><span style="width:${t.s[0]}%"></span></div></div>
              <div class="s"><div class="k">Strategic fit</div><div class="sbar"><span style="width:${t.s[1]}%"></span></div></div>
              <div class="s"><div class="k">Accessibility</div><div class="sbar"><span style="width:${t.s[2]}%"></span></div></div>
            </div></div>`).join('')}
      </div>
      <aside class="side">
        <div class="handoff"><h3>Ready for External Innovation</h3>
          <p>The GRAS-filed sweetener scores high on all three criteria and directly answers the EFSA signal.</p>
          <button class="btn" onclick="this.textContent='✓ Sent to External Innovation';this.disabled=true;this.style.opacity=.7">Route qualified target →</button></div>
        <div class="card"><h3>Watchlist — regulatory-triggered</h3>
          <div class="wl"><span class="dot2"></span><div>Sweetener alternatives</div><span class="go">3 targets</span></div>
          <div class="wl"><span class="dot2"></span><div>Recyclable film materials</div><span class="go">5 targets</span></div>
          <div class="wl"><span class="dot2"></span><div>Sodium-reduction tech</div><span class="go">2 targets</span></div>
        </div>
      </aside>
    </div>
  </div>`;
}

// boot
route();
