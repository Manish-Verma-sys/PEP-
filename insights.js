// ---------------------------------------------------------------------------
// Insight generation layer.
//
// This is the ONE place the API key is used. It is read from the environment
// (process.env.REGWATCH_API_KEY) and NEVER hardcoded or sent to the browser.
//
// It's provider-agnostic: set REGWATCH_PROVIDER to pick how insights are made.
//   - "gemini"    -> calls the Google Gemini API (use this for a Gemini key)
//   - "local"     -> deterministic rule-based insights (no key needed)
//   - "anthropic" -> calls the Anthropic Messages API
//   - "openai"    -> calls the OpenAI Chat Completions API
//
// If a remote call fails for any reason, it falls back to the local generator so
// the app never breaks in front of a user.
// ---------------------------------------------------------------------------

const API_KEY = process.env.REGWATCH_API_KEY || '';
const PROVIDER = (process.env.REGWATCH_PROVIDER || 'local').toLowerCase();

// ---- Local, deterministic insight generator (no external call) -------------
function localInsight(alert, allAlerts) {
  const related = allAlerts.filter(
    a => a.id !== alert.id && a.focus === alert.focus
  );
  const crossReg = related.filter(a => a.reg !== alert.reg);

  const bits = [];
  bits.push(
    `${alert.reg} activity in "${alert.focus}" is at ${alert.sev.toUpperCase()} level, at the "${alert.stage}" stage with an estimated lead time of ${alert.lead}.`
  );

  if (crossReg.length) {
    const regs = [...new Set(crossReg.map(a => a.reg))].join(' + ');
    bits.push(
      `Cross-signal: ${regs} ${crossReg.length > 1 ? 'are' : 'is'} also moving on the same focus area — multiple regulators acting at once is a stronger signal than any one alone. Recommend a portfolio-wide review rather than a single-SKU fix.`
    );
  }

  const opportunity = /opportunity|enabling|GRAS|clear/i.test(alert.impact + alert.enforce);
  if (opportunity) {
    bits.push('This reads as an opportunity signal, not just a risk — worth adding the underlying technology/supplier to the scouting shortlist.');
  } else if (alert.skus && alert.skus.length) {
    const high = alert.skus.filter(s => s.risk === 'high').length;
    bits.push(
      `${alert.skus.length} SKU(s) are potentially exposed${high ? `, ${high} at high risk` : ''}. Regulatory stage often gates commercialisation more than technical readiness — factor that into any response.`
    );
  }

  return {
    text: bits.join(' '),
    source: 'local-rules',
    grounded_in: 1 + related.length
  };
}

// ---- Remote providers ------------------------------------------------------
function buildPrompt(alert, allAlerts) {
  const others = allAlerts
    .filter(a => a.id !== alert.id)
    .map(a => `- [${a.reg}/${a.sev}] ${a.title} (focus: ${a.focus})`)
    .join('\n');
  return (
    `You are a regulatory-intelligence analyst for a food & beverage R&D team. ` +
    `Given ONE regulatory alert and a list of other current alerts, write 2-3 sentences of ` +
    `decision-useful analysis: note any cross-signal with other alerts on the same focus area, ` +
    `whether it's a risk or an opportunity, and a concrete recommended next step. ` +
    `Be concise and specific. Do not invent regulatory facts beyond what's given.\n\n` +
    `ALERT:\n${alert.title}\nRegulator: ${alert.reg}\nFocus: ${alert.focus}\n` +
    `Stage: ${alert.stage}\nImpact: ${alert.impact}\nDetail: ${alert.detail}\n\n` +
    `OTHER CURRENT ALERTS:\n${others}\n`
  );
}

async function anthropicInsight(alert, allAlerts) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: process.env.REGWATCH_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: 400,
      messages: [{ role: 'user', content: buildPrompt(alert, allAlerts) }]
    })
  });
  if (!res.ok) throw new Error('anthropic ' + res.status);
  const data = await res.json();
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  return { text, source: 'anthropic', grounded_in: allAlerts.length };
}

async function geminiInsight(alert, allAlerts) {
  const model = process.env.REGWATCH_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': API_KEY
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildPrompt(alert, allAlerts) }] }],
      generationConfig: { maxOutputTokens: 400, temperature: 0.4 }
    })
  });
  if (!res.ok) throw new Error('gemini ' + res.status);
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || [])
    .map(p => p.text || '').join('').trim();
  if (!text) throw new Error('gemini empty response');
  return { text, source: 'gemini', grounded_in: allAlerts.length };
}

async function openaiInsight(alert, allAlerts) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer ' + API_KEY
    },
    body: JSON.stringify({
      model: process.env.REGWATCH_MODEL || 'gpt-4o-mini',
      max_tokens: 400,
      messages: [{ role: 'user', content: buildPrompt(alert, allAlerts) }]
    })
  });
  if (!res.ok) throw new Error('openai ' + res.status);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim() || '';
  return { text, source: 'openai', grounded_in: allAlerts.length };
}

// ---- Public API ------------------------------------------------------------
export async function generateInsight(alert, allAlerts) {
  // No key or local mode -> deterministic generator.
  if (!API_KEY || PROVIDER === 'local') return localInsight(alert, allAlerts);

  try {
    if (PROVIDER === 'gemini') return await geminiInsight(alert, allAlerts);
    if (PROVIDER === 'anthropic') return await anthropicInsight(alert, allAlerts);
    if (PROVIDER === 'openai') return await openaiInsight(alert, allAlerts);
    // Unknown provider name -> local.
    return localInsight(alert, allAlerts);
  } catch (err) {
    // Never break the UI: log server-side, fall back to local.
    console.error('[insights] remote provider failed, using local fallback:', err.message);
    const local = localInsight(alert, allAlerts);
    local.source = 'local-fallback';
    return local;
  }
}

export function providerStatus() {
  return {
    provider: PROVIDER,
    keyConfigured: Boolean(API_KEY)
  };
}
