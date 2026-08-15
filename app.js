// RegWatch SPA — every page renders from one live payload (/api/live),
// refetched on each load so landing/refresh always shows current data.
const app = document.getElementById('app');
const nav = document.getElementById('nav');

const api = (p) => fetch(p).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const badge = (s) => `<span class="badge b-${s}">${s[0].toUpperCase() + s.slice(1)}</span>`;
const srcLink = (a) => a.url ? `<a class="evidence" href="${esc(a.url)}" target="_blank" rel="noopener">source ↗</a>` : '';

// cache the live payload for the session's navigation; refetch on full reload
let LIVE = null;
async function ensureLive(force) {
  if (LIVE && !force) return LIVE;
  LIVE = await api('/api/live');
  const envtag = document.getElementById('envtag');
  if (envtag) envtag.textContent = /^live/i.test(LIVE.mode) ? 'LIVE' : 'SEED';
  return LIVE;
}

function route() {
  const hash = (location.hash.replace('#/', '') || 'overview').split('/');
  const [screen, param] = hash;
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.route === screen));
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

function loading(msg) { app.innerHTML = `<div class="loading">${msg || 'Researching current regulatory changes… (live web search, first load can take ~10s)'}</div>`; }
function fail(e) { app.innerHTML = `<div class="wrap"><div class="empty">Couldn't load data (${esc(e.message)}).</div></div>`; }

function modeNote(d) {
  const live = /^live/i.test(d.mode);
  return `<div class="modebar ${live ? 'live' : 'seed'}">${live
    ? '● LIVE — researched via Gemini + Google Search'
    : '● SEED — live research unavailable, showing illustrative data'} · updated ${new Date(d.generatedAt).toLocaleTimeString()}</div>`;
}

// ---- Overview -------------------------------------------------------------
async function renderOverview() {
  loading();
  try {
    const d = await ensureLive(true); // full reload refreshes
    const o = d.overview;
    app.innerHTML = `
    <div class="wrap">
      <div class="crumb">Screen 01 / Overview</div>
      ${modeNote(d)}
      <div class="head">
        <div><h1 class="page">Regulatory radar</h1>
          <p>Current developments across FSSAI, FDA, EFSA and Codex — researched live and mapped to R&D focus areas. Each signal links to its source.</p></div>
        <div class="stamp">SIGNALS<b>${o.total}</b>${esc(d.mode)}</div>
      </div>
      <div class="radar"><h2>NEEDS ATTENTION</h2>
        <div class="big"><div class="num">${o.critical}</div>
          <div class="txt">critical developments right now. Click any signal to read the source and generated analysis.</div></div>
        <div class="metaline">
          <div>High priority<b>${o.high}</b></div>
          <div>On watch<b>${o.watch}</b></div>
          <div>Focus areas<b>${o.focusTouched} / 5</b></div>
          <div>Total signals<b>${o.total}</b></div>
        </div>
      </div>
      <div class="stats">
        <div class="stat crit" onclick="location.hash='#/alerts'"><div class="k">Critical</div><div class="v">${o.critical}</div><div class="d">needs review</div></div>
        <div class="stat" onclick="location.hash='#/alerts'"><div class="k">High</div><div class="v">${o.high}</div><div class="d">this period</div></div>
        <div class="stat" onclick="location.hash='#/alerts'"><div class="k">Watch</div><div class="v">${o.watch}</div><div class="d">tracking</div></div>
        <div class="stat" onclick="location.hash='#/portfolio'"><div class="k">Focus areas hit</div><div class="v">${o.focusTouched}</div><div class="d">of 5</div></div>
      </div>
      <div class="cols">
        <div class="panel"><h3>Top signals right now</h3>
          ${o.top.map(a => `
            <div class="mini">
              <span class="sev ${a.sev}"></span>
              <div><div class="mt" onclick="location.hash='#/detail/${a.id}'" style="cursor:pointer">${esc(a.title)}</div>
                <div class="mm">${a.reg} · ${esc(a.when)} · ${esc(a.focus)} ${srcLink(a)}</div></div>
              <span class="go" onclick="location.hash='#/detail/${a.id}'" style="cursor:pointer">›</span></div>`).join('')}
          <a class="cta" onclick="location.hash='#/alerts'">Open full alert feed →</a>
        </div>
        <div class="side">
          <div class="insight-side"><h3>How this works</h3>
            <p>On each load, the backend asks Gemini to research current regulatory changes with Google Search, then maps them to R&D focus areas. Sources are linked for verification.</p></div>
        </div>
      </div>
    </div>`;
  } catch (e) { fail(e); }
}

// ---- Alert feed -----------------------------------------------------------
let feedState = { reg: 'all', sev: 'all', focus: 'all', q: '' };
async function renderAlerts() {
  loading();
  try {
    await ensureLive();
    app.innerHTML = `
    <div class="wrap">
      <div class="crumb">Screen 02 / Alert feed</div>
      ${modeNote(LIVE)}
      <h1 class="page">Alert feed</h1>
      <input class="search" id="q" placeholder="Search signals…" value="${esc(feedState.q)}">
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
  } catch (e) { fail(e); }
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
    document.getElementById('count').textContent = `${total} signal${total !== 1 ? 's' : ''} shown${filtered ? ' · filtered' : ''}`;
    document.getElementById('list').innerHTML = alerts.length ? alerts.map(a => `
      <article class="alert sev-${a.sev}">
        <div class="row1">${badge(a.sev)}<span class="reg">${a.reg}</span><span class="when">${esc(a.when)}</span></div>
        <h3 onclick="location.hash='#/detail/${a.id}'" style="cursor:pointer">${esc(a.title)}</h3>
        <p class="desc">${esc(a.desc)}</p>
        <div class="tags">${(a.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        <div class="impact"><span class="arrow">→ impact</span><b>${esc(a.impact)}</b><span style="margin-left:auto">${srcLink(a)}</span></div>
      </article>`).join('')
      : '<div class="empty">No signals match these filters.</div>';
  } catch (e) { fail(e); }
}

// ---- Detail (+ insight) ---------------------------------------------------
async function renderDetail(id) {
  loading('Loading signal…');
  try {
    const a = await api('/api/alerts/' + encodeURIComponent(id));
    app.innerHTML = `
    <div class="wrap">
      <a class="back" onclick="location.hash='#/alerts'">‹ back to alert feed</a>
      <div class="row1">${badge(a.sev)}<span class="reg">${a.reg}</span><span class="when">${esc(a.when)}</span></div>
      <h1 class="page" style="font-size:26px;margin-bottom:14px">${esc(a.title)}</h1>
      ${a.url ? `<a class="evidence big" href="${esc(a.url)}" target="_blank" rel="noopener">Read the source ↗</a>` : ''}
      <div class="layout" style="margin-top:20px">
        <div>
          <div class="sec"><h2>Summary</h2><p>${esc(a.detail)}</p></div>
          <div class="sec"><h2>Generated analysis · human-review intended</h2>
            <div class="aiflag"><div class="t">◆ Insight engine</div>
              <p id="insight"><span class="spin"></span>Generating analysis…</p>
              <div class="val" id="insightmeta"></div></div></div>
        </div>
        <aside>
          <div class="card"><h3>Signal details</h3><div class="kv">
            <div><div class="k">Focus area</div><div class="v">${esc(a.focus)}</div></div>
            <div><div class="k">Region</div><div class="v">${esc(a.region)}</div></div>
            <div><div class="k">Stage</div><div class="v">${esc(a.stage)}</div></div>
            <div><div class="k">Source</div><div class="v">${esc(a.source || 'n/a')}</div></div>
          </div></div>
          <div class="card"><h3>Actions</h3>
            <button class="btn" onclick="this.textContent='✓ Routed to R&D lead';this.disabled=true;this.style.opacity=.7">Route to R&D lead</button>
            <button class="btn ghost" onclick="this.textContent='✓ Added to watchlist';this.disabled=true;this.style.opacity=.7">Add to watchlist</button>
            <a class="btn ghost" onclick="location.hash='#/scouting'">Link to scouting →</a>
          </div>
        </aside>
      </div>
    </div>`;
    try {
      const ins = await api(`/api/alerts/${encodeURIComponent(id)}/insight`);
      document.getElementById('insight').textContent = ins.text;
      document.getElementById('insightmeta').innerHTML = `<span class="valdot"></span>engine: ${esc(ins.source)} · grounded in ${ins.grounded_in} signal(s)`;
    } catch { document.getElementById('insight').textContent = 'Insight unavailable right now.'; }
  } catch (e) { fail(e); }
}

// ---- Portfolio ------------------------------------------------------------
async function renderPortfolio() {
  loading();
  try {
    const d = await ensureLive();
    const areas = d.portfolio.areas;
    app.innerHTML = `
    <div class="wrap">
      <div class="crumb">Screen 04 / Portfolio impact</div>
      ${modeNote(d)}
      <div class="head"><div><h1 class="page">Portfolio impact</h1>
        <p>Live signals rolled up by focus area — where regulatory pressure is concentrated right now.</p></div></div>
      <div class="fgrid">
        ${areas.map(f => `
          <div class="fcard"><div class="top"><h3>${esc(f.name)}</h3>
            <span class="expo e-${f.level}">${f.level === 'high' ? 'High' : f.level === 'med' ? 'Medium' : 'Low'} exposure</span></div>
            <div class="meter"><span class="m-${f.level}" style="width:${f.score}%"></span></div>
            <div class="fstats">
              <div><div class="k">Open signals</div><div class="v ${f.level === 'high' ? 'acc' : ''}">${f.openAlerts}</div></div>
              <div><div class="k">Exposure</div><div class="v" style="font-size:16px">${f.score}%</div></div>
            </div>
            ${f.drivers.length ? `<div class="drivers"><b>Drivers:</b> ${f.drivers.map(esc).join('; ')}.</div>` : '<div class="drivers">No current signals in this area.</div>'}
          </div>`).join('')}
      </div>
    </div>`;
  } catch (e) { fail(e); }
}

// ---- Scouting -------------------------------------------------------------
async function renderScouting() {
  loading();
  try {
    const d = await ensureLive();
    const targets = d.scouting;
    const kc = k => k === 'license' ? 'k-license' : k === 'acquire' ? 'k-acquire' : 'k-partner';
    app.innerHTML = `
    <div class="wrap">
      <div class="crumb">Screen 05 / Scouting handoff</div>
      ${modeNote(d)}
      <div class="head"><div><h1 class="page">Scouting handoff</h1>
        <p>Substitute technologies generated from the current live signals — scored on maturity, strategic fit, and accessibility.</p></div></div>
      <div class="flow">
        <div class="step"><div class="n">01 · SIGNAL</div><div class="t">Change detected</div><div class="d">Live regulatory signal</div></div>
        <div class="step"><div class="n">02 · IMPACT</div><div class="t">Exposure assessed</div><div class="d">By focus area</div></div>
        <div class="step active"><div class="n">03 · SCOUT</div><div class="t">Find alternatives</div><div class="d">Generated candidates</div></div>
        <div class="step"><div class="n">04 · QUALIFY</div><div class="t">Score & shortlist</div><div class="d">Maturity · fit · access</div></div>
        <div class="step"><div class="n">05 · HANDOFF</div><div class="t">External Innovation</div><div class="d">Partnership pipeline</div></div>
      </div>
      <div class="cols">
        <div class="panel"><h2>Candidate substitutes</h2>
          <p class="sub2">Generated from the current signal set. Scored on the three scouting criteria.</p>
          ${targets.map(t => `
            <div class="target"><div class="r1"><span class="kind ${kc(t.kind)}">${esc(t.kind)}</span><h3>${esc(t.name)}</h3></div>
              <p class="why">${esc(t.why)}</p>
              <div class="scores">
                <div class="s"><div class="k">Maturity</div><div class="sbar"><span style="width:${t.s[0]}%"></span></div></div>
                <div class="s"><div class="k">Strategic fit</div><div class="sbar"><span style="width:${t.s[1]}%"></span></div></div>
                <div class="s"><div class="k">Accessibility</div><div class="sbar"><span style="width:${t.s[2]}%"></span></div></div>
              </div></div>`).join('')}
        </div>
        <aside class="side">
          <div class="handoff"><h3>Ready for External Innovation</h3>
            <p>Top-scoring candidate can be routed to the partnership team as a qualified lead.</p>
            <button class="btn" onclick="this.textContent='✓ Sent to External Innovation';this.disabled=true;this.style.opacity=.7">Route qualified target →</button></div>
        </aside>
      </div>
    </div>`;
  } catch (e) { fail(e); }
}

route();
