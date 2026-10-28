/**
 * CineSense — app.js
 * Main application logic: API calls, UI state management,
 * history panel, batch upload, chart, CSV download.
 *
 * PCCSL 508 – Machine Learning Lab | CSE, FISAT
 */

'use strict';

/* ─────────────────────────────────────────────
   CONFIG — edit these metrics after viva/testing
   They appear in the "About the Model" section.
───────────────────────────────────────────── */
const MODEL_METRICS = {
  Accuracy:  { value: '93.21', unit: '%' },
  Precision: { value: '93.08', unit: '%' },
  Recall:    { value: '93.37', unit: '%' },
  F1:        { value: '93.22', unit: '%' },
};

/* ─────────────────────────────────────────────
   API helper
───────────────────────────────────────────── */
const API_BASE = window.location.origin; // same-origin: FastAPI serves both

async function apiPredict(text) {
  const res = await fetch(`${API_BASE}/predict`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Server error' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function apiBatch(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/predict-batch`, {
    method: 'POST',
    body:   form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Server error' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}


/* ─────────────────────────────────────────────
   HISTORY — max 10 entries per session
───────────────────────────────────────────── */
let analysisHistory = [];

function addToHistory(review, label, confidence) {
  analysisHistory.unshift({ review, label, confidence });
  if (analysisHistory.length > 10) analysisHistory.pop();
  renderHistory();
}

function renderHistory() {
  const list    = document.getElementById('history-list');
  const counter = document.getElementById('history-count');
  if (!list) return;

  if (counter) counter.textContent = `(${analysisHistory.length}/10)`;

  if (analysisHistory.length === 0) {
    list.innerHTML = '<div class="history-empty">🎞️ No screenings yet. Analyze your first review above!</div>';
    return;
  }

  list.innerHTML = analysisHistory.map((item, i) => `
    <div class="history-item reveal visible" role="listitem">
      <span class="history-rank">#${String(i + 1).padStart(2, '0')}</span>
      <span class="history-snippet" title="${escHtml(item.review)}">${escHtml(item.review.slice(0, 90))}…</span>
      <span class="badge ${item.label === 'POSITIVE' ? 'pos' : 'neg'} history-badge">${item.label}</span>
      <span class="history-conf">${(item.confidence * 100).toFixed(1)}%</span>
    </div>
  `).join('');
}


/* ─────────────────────────────────────────────
   CHAR COUNTER
───────────────────────────────────────────── */
function initCharCounter() {
  const textarea = document.getElementById('review-input');
  const counter  = document.getElementById('char-counter');
  if (!textarea || !counter) return;

  const MAX_SHOW = 2000;
  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    counter.textContent = `${len} / ${MAX_SHOW} chars`;
    counter.className   = len > MAX_SHOW ? 'char-counter over' : len > MAX_SHOW * 0.85 ? 'char-counter warn' : 'char-counter';
  });
}


/* ─────────────────────────────────────────────
   EXAMPLE PILLS
───────────────────────────────────────────── */
const EXAMPLES = [
  {
    type: 'pos',
    label: '😍 Positive',
    text: "An absolute masterpiece! The cinematography, the script, the performances — everything was flawless. I left the theater with a huge smile on my face. One of the best films of the decade, without a doubt.",
  },
  {
    type: 'neg',
    label: '😤 Negative',
    text: "What a complete waste of two hours. The plot made no sense, the acting was wooden, and the ending felt like the writers just gave up. I genuinely cannot believe this got a theatrical release. Avoid at all costs.",
  },
  {
    type: 'mix',
    label: '🤔 Mixed',
    text: "It had some genuinely beautiful moments and the lead performance was compelling, but the pacing was off and the third act felt rushed. Worth watching once, but I doubt I'd revisit it.",
  },
];

function initExamplePills() {
  const container = document.getElementById('example-pills');
  const textarea  = document.getElementById('review-input');
  if (!container || !textarea) return;

  EXAMPLES.forEach(ex => {
    const btn = document.createElement('button');
    btn.className = `example-pill ${ex.type}`;
    btn.textContent = ex.label;
    btn.setAttribute('aria-label', `Load ${ex.label} example`);
    btn.addEventListener('click', () => {
      textarea.value = ex.text;
      textarea.dispatchEvent(new Event('input'));
      textarea.focus();
    });
    container.appendChild(btn);
  });
}


/* ─────────────────────────────────────────────
   RESULT CARD DISPLAY
───────────────────────────────────────────── */
function showResult(data) {
  const section = document.getElementById('result-section');
  const card    = document.getElementById('result-card');
  const emoji   = document.getElementById('result-emoji');
  const labelEl = document.getElementById('result-label');
  const confEl  = document.getElementById('confidence-value');
  const badgeEl = document.getElementById('result-badge');
  const barPos  = document.getElementById('bar-pos');
  const barNeg  = document.getElementById('bar-neg');
  const pctPos  = document.getElementById('pct-pos');
  const pctNeg  = document.getElementById('pct-neg');

  // Use the label directly from the API — never invert or swap
  const isPositive = data.label === 'POSITIVE';
  const confPct    = data.confidence * 100;

  // Card class (colour border + spotlight)
  if (card) card.className = `result-card glass-card ${isPositive ? 'positive' : 'negative'}`;

  // Emoji
  if (emoji) emoji.textContent = isPositive ? '🌟' : '💀';

  // Label
  if (labelEl) { labelEl.textContent = data.label; labelEl.className = `result-label ${isPositive ? 'positive' : 'negative'}`; }

  // Badge
  if (badgeEl) { badgeEl.textContent = isPositive ? '👍 Two Thumbs Up!' : '👎 Thumbs Down'; badgeEl.className = `result-badge ${isPositive ? 'positive' : 'negative'}`; }

  // Show section
  if (section) { section.hidden = false; }

  // Animations — uses label directly from API
  if (window.CineSenseAnimations) {
    window.CineSenseAnimations.animateCountUp(confEl, confPct);
    window.CineSenseAnimations.animateStars(data.confidence);
    window.CineSenseAnimations.animateAnalysisResult(data.label, data.confidence);
  } else {
    // Fallback without animations
    if (confEl) confEl.textContent = confPct.toFixed(1);
  }

  // Animate bars (slight delay for drama)
  setTimeout(() => {
    const posW = (data.scores.POSITIVE * 100).toFixed(1);
    const negW = (data.scores.NEGATIVE * 100).toFixed(1);
    if (barPos) barPos.style.width = `${posW}%`;
    if (barNeg) barNeg.style.width = `${negW}%`;
    if (pctPos) pctPos.textContent = `${posW}%`;
    if (pctNeg) pctNeg.textContent = `${negW}%`;
  }, 120);

  // Scroll into view
  setTimeout(() => section?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 200);
}

function hideResult() {
  const section = document.getElementById('result-section');
  if (section) section.hidden = true;
  // Reset bars
  ['bar-pos','bar-neg'].forEach(id => { const el = document.getElementById(id); if (el) el.style.width = '0%'; });
  // Reset stamp
  const stamp = document.getElementById('result-stamp');
  if (stamp) { stamp.className = 'result-stamp'; stamp.textContent = ''; }
  // Reset spotlight
  const sp = document.getElementById('result-spotlight');
  if (sp) sp.className = 'result-spotlight';
  // Reset stars
  document.querySelectorAll('.star').forEach(s => s.classList.remove('filled'));
}

function showError(msg) {
  const el = document.getElementById('error-message');
  if (!el) return;
  const textEl = document.getElementById('error-text');
  if (textEl) textEl.textContent = msg;
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 6000);
}

function hideError() {
  const el = document.getElementById('error-message');
  if (el) el.classList.remove('visible');
}


/* ─────────────────────────────────────────────
   ANALYZE BUTTON
───────────────────────────────────────────── */
function initAnalyzeButton() {
  const btn      = document.getElementById('analyze-btn');
  const textarea = document.getElementById('review-input');
  if (!btn || !textarea) return;

  async function doAnalyze() {
    const text = textarea.value.trim();
    if (!text) {
      showError('Please write or paste a movie review first!');
      return;
    }

    hideError();
    hideResult();
    btn.disabled = true;

    // Cinematic loading effect
    if (window.CineSenseAnimations) {
      window.CineSenseAnimations.soundClap();
      window.CineSenseAnimations.animateAnalysisStart();
    }

    try {
      const data = await apiPredict(text);
      showResult(data);
      addToHistory(text, data.label, data.confidence);
    } catch (err) {
      if (window.CineSenseAnimations) window.CineSenseAnimations.animateAnalysisResult('ERROR', 0);
      showError(`Analysis failed: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }

  btn.addEventListener('click', doAnalyze);

  // Ctrl+Enter shortcut
  textarea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') doAnalyze();
  });
}


/* ─────────────────────────────────────────────
   LIGHT/DARK TOGGLE
───────────────────────────────────────────── */
function initThemeToggle() {
  const btn  = document.getElementById('theme-toggle');
  const root = document.documentElement;
  const saved = localStorage.getItem('cinesense_theme') || 'dark';
  root.setAttribute('data-theme', saved);
  updateThemeIcon(saved);

  if (!btn) return;
  btn.addEventListener('click', () => {
    const current = root.getAttribute('data-theme');
    const next    = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('cinesense_theme', next);
    updateThemeIcon(next);
  });
}

function updateThemeIcon(theme) {
  const btn  = document.getElementById('theme-toggle');
  const icon = document.getElementById('theme-icon');
  if (btn)  btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}


/* ─────────────────────────────────────────────
   SOUND TOGGLE
───────────────────────────────────────────── */
function initSoundToggle() {
  const btn  = document.getElementById('sound-toggle');
  const icon = document.getElementById('sound-icon');
  let on = false;
  if (!btn) return;

  btn.addEventListener('click', () => {
    on = !on;
    if (icon) icon.textContent = on ? '🔊' : '🔇';
    btn.setAttribute('aria-label', on ? 'Mute sound' : 'Enable sound');
    if (window.CineSenseAnimations) window.CineSenseAnimations.toggleSound(on);
  });
}


/* ─────────────────────────────────────────────
   HISTORY CLEAR BUTTON
───────────────────────────────────────────── */
function initHistoryClear() {
  const btn = document.getElementById('clear-history-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    analysisHistory = [];
    renderHistory();
  });
}


/* ─────────────────────────────────────────────
   BATCH MODE
───────────────────────────────────────────── */
let batchChart   = null;
let batchResults = [];

function initBatchMode() {
  const zone        = document.getElementById('upload-zone');
  const fileInput   = document.getElementById('batch-file');
  const downloadBtn = document.getElementById('download-csv-btn');
  if (!zone || !fileInput) return;

  zone.addEventListener('dragover',  (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', ()  => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer?.files[0];
    if (file) processFile(file);
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) processFile(file);
  });

  downloadBtn?.addEventListener('click', downloadCSV);

  async function processFile(file) {
    if (!file.name.match(/\.(csv|txt)$/i)) {
      showError('Please upload a .csv or .txt file.');
      return;
    }

    const p = zone.querySelector('p');
    if (p) p.textContent = `Analysing "${file.name}"…`;

    try {
      const data = await apiBatch(file);
      batchResults = data.results;
      renderBatchResults(data.results, data.count);
      if (p) p.innerHTML = `Done! <strong>${data.count} reviews</strong> analysed.`;
    } catch (err) {
      showError(`Batch failed: ${err.message}`);
      if (p) p.innerHTML = 'Drag & drop or click to upload a <strong>.csv</strong> or <strong>.txt</strong> file.';
    }
  }
}

function renderBatchResults(results, count) {
  const resultsDiv = document.getElementById('batch-results');
  const tableBody  = document.getElementById('batch-table-body');
  const statsEl    = document.getElementById('batch-stats');
  if (!resultsDiv || !tableBody) return;

  const posCount = results.filter(r => r.label === 'POSITIVE').length;
  const negCount = count - posCount;

  if (statsEl) {
    statsEl.innerHTML = `<strong>${count}</strong> reviews — <span style="color:var(--positive)">▲ ${posCount} Positive</span> &nbsp; <span style="color:var(--negative)">▼ ${negCount} Negative</span>`;
  }

  tableBody.innerHTML = results.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td title="${escHtml(r.review)}">${escHtml(r.review.slice(0, 80))}${r.review.length > 80 ? '…' : ''}</td>
      <td><span class="badge ${r.label === 'POSITIVE' ? 'pos' : 'neg'}">${r.label}</span></td>
      <td>${(r.confidence * 100).toFixed(1)}%</td>
    </tr>
  `).join('');

  resultsDiv.hidden = false;
  renderDonutChart(posCount, negCount);
}

function renderDonutChart(pos, neg) {
  const canvas = document.getElementById('batch-chart');
  if (!canvas || typeof Chart === 'undefined') return;
  if (batchChart) batchChart.destroy();

  const isDark    = document.documentElement.getAttribute('data-theme') !== 'light';
  const textColor = isDark ? 'rgba(200,210,220,0.8)' : 'rgba(30,20,10,0.8)';

  batchChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Positive', 'Negative'],
      datasets: [{
        data: [pos, neg],
        backgroundColor: ['rgba(52,211,153,0.80)', 'rgba(255,93,93,0.80)'],
        borderColor:     ['rgba(52,211,153,1)',    'rgba(255,93,93,1)'],
        borderWidth: 2, hoverOffset: 8,
      }],
    },
    options: {
      responsive: true, cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: textColor, font: { family: 'Inter', size: 13 }, padding: 18 },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              return ` ${ctx.label}: ${ctx.raw} (${((ctx.raw / total) * 100).toFixed(1)}%)`;
            },
          },
        },
      },
      animation: { animateRotate: true, duration: 900 },
    },
  });
}

function downloadCSV() {
  if (!batchResults.length) return;
  const header = 'Review,Label,Confidence,Positive Score,Negative Score\n';
  const rows   = batchResults.map(r =>
    `"${r.review.replace(/"/g, '""')}","${r.label}","${(r.confidence*100).toFixed(2)}%","${(r.scores.POSITIVE*100).toFixed(2)}%","${(r.scores.NEGATIVE*100).toFixed(2)}%"`
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'cinesense_batch_results.csv';
  a.click();
  URL.revokeObjectURL(url);
}


/* ─────────────────────────────────────────────
   ABOUT / METRICS
───────────────────────────────────────────── */
function renderMetrics() {
  const grid = document.getElementById('metrics-grid');
  if (!grid) return;

  const circumference = 163; // 2πr where r=26
  grid.innerHTML = Object.entries(MODEL_METRICS).map(([name, { value, unit }]) => {
    const pct    = parseFloat(value);
    const offset = circumference - (pct / 100) * circumference;
    return `
      <div class="metric-card reveal" role="img" aria-label="${name}: ${value}${unit}">
        <div class="metric-ring-wrap">
          <svg class="metric-ring-svg" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
            <circle class="track" cx="32" cy="32" r="26"/>
            <circle class="prog"  cx="32" cy="32" r="26" data-offset="${offset}"/>
          </svg>
          <div class="metric-ring-val">${value}</div>
        </div>
        <div class="metric-name">${name}</div>
      </div>
    `;
  }).join('');

  // Animate rings after paint — trigger CSS transition
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.querySelectorAll('.metric-ring-svg circle.prog').forEach(c => {
        c.style.strokeDashoffset = c.dataset.offset;
      });
    });
  });
}


/* ─────────────────────────────────────────────
   UTILITY: HTML escape
───────────────────────────────────────────── */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initSoundToggle();
  initCharCounter();
  initExamplePills();
  initAnalyzeButton();
  initHistoryClear();
  initBatchMode();
  renderMetrics();
  renderHistory(); // show empty state
});
