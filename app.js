/* ====== Config ====== */
const DATA_URL = './data.json';

/* ====== State ====== */
let rawData = null;
let sessions = [];
let sortState = { key: 'timestampISO', dir: 'desc' };

/* ====== Utils ====== */
function safeText(v) {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

function fmtNumber(v, decimals = 0) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  return Number(v).toFixed(decimals);
}

function fmtPoints(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n} pt`;
}

function parseISO(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDateTime(iso, tzLabel) {
  const d = parseISO(iso);
  if (!d) return '—';
  // Format locale in IT, keep it simple + append tz label
  const s = d.toLocaleString('it-IT', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  return `${s} ${tzLabel || ''}`.trim();
}

function qsClass(qs) {
  const n = Number(qs);
  if (Number.isNaN(n)) return '';
  if (n >= 70) return 'good';
  if (n >= 40) return 'warn';
  return 'bad';
}

function dirBadge(direction) {
  const dir = (direction || '').toUpperCase();
  const cls = dir === 'SHORT' ? 'short' : 'long';
  return `<span class="badge ${cls}">${safeText(dir)}</span>`;
}

function pnlClass(pnl) {
  const n = Number(pnl);
  if (Number.isNaN(n)) return '';
  if (n > 0) return 'good';
  if (n < 0) return 'bad';
  return '';
}

/* ====== Compute KPIs ====== */
function computeKPIs(list) {
  const total = list.length;

  const pnlVals = list.map(s => Number(s.pnlPoints)).filter(n => !Number.isNaN(n));
  const pnlTotal = pnlVals.reduce((a,b)=>a+b, 0);

  const positives = pnlVals.filter(n => n > 0).length;
  const winRate = pnlVals.length ? (positives / pnlVals.length) * 100 : 0;

  const stopHits = list.filter(s => s.stopHit === true).length;
  const stopHitPct = total ? (stopHits / total) * 100 : 0;

  return { total, pnlTotal, winRate, stopHitPct };
}

/* ====== Render ====== */
function renderMeta(meta) {
  const el = document.getElementById('metaBar');
  const pills = [
    `Model: ${safeText(meta?.modelVersion)}`,
    `TZ: ${safeText(meta?.timezone)}`,
    `LastUpdated: ${safeText(meta?.lastUpdatedISO)}`,
    `Sessions: ${sessions.length}`,
    `Source: data.json`
  ];
  el.innerHTML = pills.map(p => `<span class="pill">${p}</span>`).join('');
}

function renderRules(meta) {
  const el = document.getElementById('rulesBox');
  const rules = meta?.rules || {};
  el.innerHTML = `
    <div><strong>Timezone:</strong> ${safeText(meta?.timezone)}</div>
    <div><strong>Punti:</strong> ${safeText(rules.pointsDefinition || meta?.pointsUnit || '—')}</div>
    <div><strong>MAE:</strong> ${safeText(rules.maeDefinition || '—')}</div>
    <div><strong>MFE:</strong> ${safeText(rules.mfeDefinition || '—')}</div>
    <div><strong>QualityScore:</strong> ${safeText(rules.qualityScoreScale || '—')}</div>
    <div><strong>stopHit:</strong> ${safeText(rules.stopHitMeaning || '—')}</div>
  `;
}

function renderKPIs(kpis) {
  const el = document.getElementById('kpis');
  el.innerHTML = `
    <div class="kpi">
      <div class="label">Totale sessioni</div>
      <div class="value">${kpis.total}</div>
    </div>
    <div class="kpi">
      <div class="label">PnL totale (pt)</div>
      <div class="value ${pnlClass(kpis.pnlTotal)}">${fmtPoints(kpis.pnlTotal)}</div>
    </div>
    <div class="kpi">
      <div class="label">% sessioni positive</div>
      <div class="value">${fmtNumber(kpis.winRate, 1)}%</div>
    </div>
    <div class="kpi">
      <div class="label">% stopHit</div>
      <div class="value">${fmtNumber(kpis.stopHitPct, 1)}%</div>
    </div>
  `;
}

function renderLastSession(meta, last) {
  const el = document.getElementById('lastSessionCard');
  if (!last) {
    el.innerHTML = `<h2>Ultima sessione</h2><div class="muted">Nessun dato disponibile.</div>`;
    return;
  }

  const tzLabel = meta?.timezone ? `(${meta.timezone})` : '';
  const instrument = safeText(last.instrument);
  const tf = safeText(last.timeframe);
  const id = safeText(last.id);

  const entry = fmtNumber(last.entryPrice, 2);
  const exit = fmtNumber(last.exitPrice, 2);
  const stop = fmtNumber(last.stopPrice, 2);
  const target = fmtNumber(last.targetPrice, 2);

  const pnl = fmtPoints(last.pnlPoints);
  const mae = fmtPoints(last.maePoints);
  const mfe = fmtPoints(last.mfePoints);

  const stopHit = last.stopHit === true ? `<span class="badge short">STOP HIT</span>` : `<span class="badge long">NO STOP HIT</span>`;
  const qs = safeText(last.qualityScore);
  const qsC = qsClass(last.qualityScore);

  const screenshot = last?.assets?.screenshotUrl ? `<a class="link" href="${last.assets.screenshotUrl}" target="_blank" rel="noopener">Screenshot/Plot</a>` : '—';
  const note = last.note ? `<div class="muted small">${safeText(last.note)}</div>` : '';

  el.innerHTML = `
    <div class="section-header">
      <h2>Ultima sessione</h2>
      <div style="display:flex; gap:8px; align-items:center;">
        ${dirBadge(last.direction)}
        ${stopHit}
      </div>
    </div>

    <div class="muted small">ID: <code>${id}</code></div>
    <div class="muted small">Quando: <code>${fmtDateTime(last.timestampISO, tzLabel)}</code></div>
    <div class="muted small">Strumento: <code>${instrument}</code> • TF: <code>${tf}</code> • Model: <code>${safeText(last.modelVersion || meta?.modelVersion)}</code></div>

    <div class="hr"></div>

    <div class="grid2">
      <div class="kv"><div class="k">Entry</div><div class="v">${entry}</div></div>
      <div class="kv"><div class="k">Exit</div><div class="v">${exit}</div></div>
      <div class="kv"><div class="k">Stop</div><div class="v">${stop}</div></div>
      <div class="kv"><div class="k">Target</div><div class="v">${target}</div></div>
    </div>

    <div class="grid2" style="margin-top:10px;">
      <div class="kv"><div class="k">PnL (pt)</div><div class="v ${pnlClass(last.pnlPoints)}">${pnl}</div></div>
      <div class="kv"><div class="k">Durata</div><div class="v">${safeText(last.durationMin)} min</div></div>
      <div class="kv"><div class="k">MAE</div><div class="v bad">${mae}</div></div>
      <div class="kv"><div class="k">MFE</div><div class="v good">${mfe}</div></div>
    </div>

    <div class="hr"></div>

    <div class="muted small">QualityScore: <strong class="${qsC}">${safeText(qs)}</strong> (0–100)</div>
    <div class="muted small">Link: ${screenshot}</div>
    ${note}
  `;
}

function renderCoherence(meta, last) {
  const el = document.getElementById('coherenceNote');
  if (!last) { el.textContent = ''; return; }

  const lastUpdated = parseISO(meta?.lastUpdatedISO);
  const lastTs = parseISO(last.timestampISO);

  if (lastUpdated && lastTs && lastUpdated.getTime() < lastTs.getTime()) {
    el.innerHTML = `<span class="warn">⚠ Incoerenza:</span> lastUpdated è precedente all’ultima sessione. (Controlla export data.json)`;
  } else {
    el.innerHTML = `✅ Coerenza OK: “Ultima sessione” corrisponde alla riga più recente nello storico.`;
  }
}

function buildRow(meta, s, isHighlighted) {
  const tzLabel = meta?.timezone ? `(${meta.timezone})` : '';
  const dt = fmtDateTime(s.timestampISO, tzLabel);

  const dir = (s.direction || '').toUpperCase();
  const dirCell = dir === 'SHORT'
    ? `<span class="badge short">SHORT</span>`
    : `<span class="badge long">LONG</span>`;

  const link = s?.assets?.screenshotUrl
    ? `<a class="link" href="${s.assets.screenshotUrl}" target="_blank" rel="noopener">link</a>`
    : '—';

  const trClass = isHighlighted ? 'row-highlight' : '';
  return `
    <tr class="${trClass}">
      <td><code>${safeText(dt)}</code></td>
      <td>${dirCell}</td>
      <td>${safeText(s.instrument)}</td>
      <td><code>${safeText(s.timeframe)}</code></td>
      <td class="num">${fmtNumber(s.entryPrice, 2)}</td>
      <td class="num">${fmtNumber(s.exitPrice, 2)}</td>
      <td class="num">${fmtNumber(s.stopPrice, 2)}</td>
      <td class="num">${fmtNumber(s.targetPrice, 2)}</td>
      <td class="num">${safeText(s.durationMin)}</td>
      <td class="num ${pnlClass(s.pnlPoints)}">${fmtPoints(s.pnlPoints)}</td>
      <td class="num bad">${fmtPoints(s.maePoints)}</td>
      <td class="num good">${fmtPoints(s.mfePoints)}</td>
      <td><code>${safeText(s.stopHit)}</code></td>
      <td class="num"><span class="${qsClass(s.qualityScore)}"><code>${safeText(s.qualityScore)}</code></span></td>
      <td>${link}</td>
    </tr>
  `;
}

function applyFilters(list) {
  const dir = document.getElementById('filterDirection').value;
  const stopHit = document.getElementById('filterStopHit').value;
  const qsMin = Number(document.getElementById('filterQS').value || 0);
  const q = (document.getElementById('filterSearch').value || '').trim().toLowerCase();

  return list.filter(s => {
    if (dir !== 'ALL' && (s.direction || '').toUpperCase() !== dir) return false;
    if (stopHit !== 'ALL' && String(s.stopHit) !== stopHit) return false;
    if (!Number.isNaN(qsMin) && Number(s.qualityScore) < qsMin) return false;

    if (q) {
      const hay = `${s.instrument || ''} ${s.note || ''} ${s.id || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function sortList(list) {
  const { key, dir } = sortState;
  const mult = dir === 'asc' ? 1 : -1;

  return [...list].sort((a,b) => {
    let va = a[key];
    let vb = b[key];

    // Dates
    if (key.toLowerCase().includes('timestamp')) {
      const da = parseISO(va)?.getTime() ?? 0;
      const db = parseISO(vb)?.getTime() ?? 0;
      return (da - db) * mult;
    }

    // numbers
    const na = Number(va);
    const nb = Number(vb);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return (na - nb) * mult;

    // booleans/strings
    return String(va ?? '').localeCompare(String(vb ?? '')) * mult;
  });
}

function renderTable(meta, list, lastId) {
  const tbody = document.getElementById('sessionsTbody');
  const filtered = applyFilters(list);
  const sorted = sortList(filtered);

  tbody.innerHTML = sorted.map(s => buildRow(meta, s, s.id === lastId)).join('');
}

/* ====== Events ====== */
function wireEvents(meta) {
  const rerender = () => {
    const last = getLastSession(sessions);
    renderTable(meta, sessions, last?.id);
  };

  ['filterDirection','filterStopHit','filterQS','filterSearch'].forEach(id => {
    document.getElementById(id).addEventListener('input', rerender);
    document.getElementById(id).addEventListener('change', rerender);
  });

  document.getElementById('btnReset').addEventListener('click', () => {
    document.getElementById('filterDirection').value = 'ALL';
    document.getElementById('filterStopHit').value = 'ALL';
    document.getElementById('filterQS').value = 0;
    document.getElementById('filterSearch').value = '';
    rerender();
  });

  // sortable headers
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-sort');
      if (sortState.key === key) {
        sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
      } else {
        sortState.key = key;
        sortState.dir = 'desc';
      }
      rerender();
    });
  });
}

/* ====== Data helpers ====== */
function normalizeSession(s) {
  // allow both nested (entry/exit) or flat props
  const entryPrice = s.entryPrice ?? s.entry?.price ?? null;
  const exitPrice  = s.exitPrice  ?? s.exit?.price  ?? null;
  const stopPrice  = s.stopPrice  ?? s.risk?.stop   ?? null;
  const targetPrice= s.targetPrice?? s.risk?.target ?? null;
  const stopHit    = s.stopHit    ?? s.risk?.stopHit ?? null;

  return {
    id: s.id ?? '',
    timestampISO: s.timestampISO ?? '',
    direction: s.direction ?? '',
    instrument: s.instrument ?? '',
    timeframe: s.timeframe ?? '',
    modelVersion: s.modelVersion ?? null,

    entryPrice,
    exitPrice,
    stopPrice,
    targetPrice,

    durationMin: s.durationMin ?? null,
    pnlPoints: s.pnlPoints ?? s.results?.pnlPoints ?? null,
    maePoints: s.maePoints ?? s.results?.maePoints ?? null,
    mfePoints: s.mfePoints ?? s.results?.mfePoints ?? null,

    stopHit: stopHit === true ? true : stopHit === false ? false : stopHit,
    qualityScore: s.qualityScore ?? null,
    note: s.note ?? '',
    assets: s.assets ?? {}
  };
}

function getLastSession(list) {
  const withDates = list
    .map(s => ({ s, t: parseISO(s.timestampISO)?.getTime() ?? -Infinity }))
    .filter(x => x.t !== -Infinity);

  if (!withDates.length) return null;
  withDates.sort((a,b) => b.t - a.t);
  return withDates[0].s;
}

/* ====== Init ====== */
async function init() {
  try {
    const res = await fetch(DATA_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    rawData = await res.json();

    const meta = rawData.meta || {};
    sessions = (rawData.sessions || []).map(normalizeSession);

    // sort by timestamp desc once
    sessions = sessions.sort((a,b) => (parseISO(b.timestampISO)?.getTime() ?? 0) - (parseISO(a.timestampISO)?.getTime() ?? 0));

    renderMeta(meta);

    const kpis = computeKPIs(sessions);
    renderKPIs(kpis);

    const last = getLastSession(sessions);
    renderLastSession(meta, last);
    renderRules(rawData.meta);
    renderTable(meta, sessions, last?.id);
    renderCoherence(meta, last);

    wireEvents(meta);

  } catch (err) {
    console.error(err);
    document.getElementById('lastSessionCard').innerHTML = `
      <h2>Errore caricamento dati</h2>
      <div class="muted">Impossibile leggere <code>${DATA_URL}</code>. Controlla che il file esista e sia valido JSON.</div>
      <div class="muted small">${safeText(err?.message)}</div>
    `;
  }
}

init();
