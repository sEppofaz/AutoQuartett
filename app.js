'use strict';

// ── Konfiguration ───────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'preis_eur',               label: '💰 Preis',          unit: '€',     fmt: 'eur',  lower_wins: false },
  { key: 'leistung_ps',             label: '⚡ Leistung',        unit: 'PS',    fmt: 'int',  lower_wins: false },
  { key: 'drehmoment_nm',           label: '🔩 Drehmoment',      unit: 'Nm',    fmt: 'int',  lower_wins: false },
  { key: 'vmax_kmh',                label: '🚀 Vmax',            unit: 'km/h',  fmt: 'int',  lower_wins: false },
  { key: 'nullhundert_s',           label: '🏁 0–100 km/h',      unit: 's',     fmt: 'dec1', lower_wins: true  },
  { key: 'leistungsgewicht_kg_ps',  label: '⚖️ Leistungsgewicht', unit: 'kg/PS', fmt: 'dec2', lower_wins: true  },
  { key: 'preis_pro_ps',            label: '💎 Preis / PS',      unit: '€/PS',  fmt: 'int',  lower_wins: false }
];

const CAT_META = {
  legende:  { label: 'Legende',  emoji: '🏆' },
  supercar: { label: 'Supercar', emoji: '🔴' },
  hypercar: { label: 'Hypercar', emoji: '🟣' },
  elektro:  { label: 'Elektro',  emoji: '⚡' },
  bmw_m:    { label: 'BMW M',    emoji: '🔵' }
};

const ANTRIEB_LABEL = {
  benziner: 'Benziner',
  elektro:  'Elektro',
  hybrid:   'Hybrid'
};

const CUSTOM_CARS_KEY = 'aq_custom';
const CAR_LOOKUP_URL  = 'https://umbenennen.duckdns.org/autoquartett/car-lookup';

// ── State ────────────────────────────────────────────────────────────────────

let allCars = [];
let statsRange = {};   // { key: { min, max } }
let game = null;

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  try {
    const res = await fetch('cars.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    allCars = await res.json();
  } catch (e) {
    showFetchError();
    return;
  }

  allCars = [...allCars, ...loadCustomCars()];
  computeStatsRange();
  document.getElementById('count-all').textContent = allCars.length;
  renderGallery('all');
  setupTabs();
  setupFilters();
  setupGameButtons();
  setupAddCarModal();
}

function showFetchError() {
  document.querySelector('main').innerHTML = `
    <div style="max-width:520px;margin:60px auto;padding:32px;background:linear-gradient(150deg,#16162a,#0f0f1e);
                border:1px solid rgba(255,255,255,0.08);border-radius:14px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">⚠️</div>
      <h2 style="font-size:20px;margin-bottom:12px;color:#fff">Lokaler Server erforderlich</h2>
      <p style="color:#7a7a9a;margin-bottom:20px">Der Browser blockiert den Datei-Zugriff.<br>Starte einen lokalen Server:</p>
      <code style="display:block;background:rgba(0,0,0,0.4);border-radius:8px;padding:14px;
                   font-size:13px;color:#1abc9c;text-align:left;margin-bottom:20px;white-space:pre">cd ~/Dropbox/Apps/Claude/AutoQuartett
python3 -m http.server 8080</code>
      <p style="color:#7a7a9a;font-size:13px">Dann öffne: <span style="color:#e63946">http://localhost:8080</span></p>
    </div>`;
}

// ── Stats Range ───────────────────────────────────────────────────────────────

function computeStatsRange() {
  CATEGORIES.forEach(cat => {
    const vals = allCars.map(c => c[cat.key]).filter(v => v != null && isFinite(v));
    statsRange[cat.key] = { min: Math.min(...vals), max: Math.max(...vals) };
  });
}

function getBarPct(cat, value) {
  if (value == null) return 0;
  const { min, max } = statsRange[cat.key];
  if (max === min) return 50;
  const pct = cat.lower_wins
    ? ((max - value) / (max - min)) * 100
    : ((value - min) / (max - min)) * 100;
  return Math.max(2, Math.min(100, pct));
}

// ── Formatierung ─────────────────────────────────────────────────────────────

function fmt(cat, value) {
  if (value == null) return '–';
  switch (cat.fmt) {
    case 'eur':  return value.toLocaleString('de-DE') + ' €';
    case 'int':  return value.toLocaleString('de-DE') + ' ' + cat.unit;
    case 'dec1': return value.toFixed(1).replace('.', ',') + ' ' + cat.unit;
    case 'dec2': return value.toFixed(2).replace('.', ',') + ' ' + cat.unit;
    default:     return value + ' ' + cat.unit;
  }
}

// ── Card HTML ─────────────────────────────────────────────────────────────────

function buildCard(car, opts = {}) {
  const { selectedCat = null, winState = null, showDelete = false } = opts;
  const catClass = 'cat-' + car.kategorie;
  const meta = CAT_META[car.kategorie] || { label: car.kategorie, emoji: '' };
  const imgSrc = (car.bild && car.bild.startsWith('http')) ? car.bild : `images/${car.id}.jpg`;

  const statsHtml = CATEGORIES.map(cat => {
    const val = car[cat.key];
    const pct = getBarPct(cat, val);
    let rowClass = 'stat-row';
    if (selectedCat && selectedCat.key === cat.key) {
      rowClass += winState === 'win' ? ' highlight-win' : winState === 'lose' ? ' highlight-lose' : ' highlight-sel';
    }
    return `
      <div class="${rowClass}">
        <span class="stat-label">${cat.label}</span>
        <div class="stat-bar-wrap">
          <div class="stat-bar" style="width:${pct}%"></div>
        </div>
        <span class="stat-value">${fmt(cat, val)}</span>
      </div>`;
  }).join('');

  return `
    <div class="card ${catClass}">
      <div class="card-image">
        ${car.custom ? '<span class="card-custom-badge">✨ Eigene</span>' : ''}
        <img src="${imgSrc}"
             alt="${car.name}"
             loading="lazy"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="card-image-fallback" style="display:none;flex-direction:column;align-items:center">
          <span class="fallback-icon">🏎️</span>
          <span class="fallback-name">${car.name}</span>
        </div>
      </div>
      <div class="card-stripe"></div>
      <div class="card-header">
        <div class="card-title-group">
          <div class="card-name">${car.name}</div>
          <div class="card-sub">${car.hersteller} · ${car.baujahr}</div>
        </div>
        <span class="card-badge">${meta.emoji} ${meta.label}</span>
      </div>
      <div class="card-stats">
        ${statsHtml}
        <div class="card-antrieb-row">
          <span class="antrieb-badge antrieb-${car.antrieb}">${ANTRIEB_LABEL[car.antrieb] || car.antrieb}</span>
          <span class="card-country">${car.land}</span>
        </div>
        ${showDelete ? `<button class="card-delete-btn" data-id="${car.id}">🗑 Löschen</button>` : ''}
      </div>
    </div>`;
}

// ── Galerie ───────────────────────────────────────────────────────────────────

let activeFilter = 'all';

function renderGallery(filter) {
  activeFilter = filter;
  const grid = document.getElementById('gallery-grid');
  let filtered;
  if (filter === 'all') filtered = allCars;
  else if (filter === 'eigene') filtered = allCars.filter(c => c.custom);
  else filtered = allCars.filter(c => c.kategorie === filter);

  grid.innerHTML = filtered.map(car => buildCard(car, { showDelete: !!car.custom })).join('');
  grid.querySelectorAll('.card-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteCustomCar(btn.dataset.id));
  });
}

function setupFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderGallery(btn.dataset.filter);
    });
  });
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });
}

// ── Quartett – Setup ──────────────────────────────────────────────────────────

function setupGameButtons() {
  document.getElementById('btn-start-game').addEventListener('click', startGame);
  document.getElementById('btn-play-again').addEventListener('click', startGame);
  document.getElementById('btn-back-gallery').addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    document.querySelector('.tab[data-tab="galerie"]').classList.add('active');
    document.getElementById('tab-galerie').classList.add('active');
  });
}

// ── Quartett – Game Logic ─────────────────────────────────────────────────────

function startGame() {
  showScreen('q-game');

  const shuffled = [...allCars].sort(() => Math.random() - 0.5);
  game = {
    playerPile:  shuffled.slice(0, 17),
    cpuPile:     shuffled.slice(17),
    pendingCards: [],
    round:       1,
    playerTurn:  true,
    waiting:     false
  };

  setupSwipe();
  nextRound();
}

function setupSwipe() {
  const field = document.getElementById('q-game');
  let touchStartX = 0;

  field.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].clientX;
  }, { passive: true });

  field.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (dx < -60 && game?.waiting) proceedToNextRound();
  }, { passive: true });
}

function showScreen(id) {
  ['q-start', 'q-game', 'q-end'].forEach(s => {
    document.getElementById(s).classList.add('hidden');
  });
  document.getElementById(id).classList.remove('hidden');
}

function updateScoreBar() {
  document.getElementById('score-player').textContent = game.playerPile.length;
  document.getElementById('score-cpu').textContent    = game.cpuPile.length;
  document.getElementById('round-label').textContent  = 'Runde ' + game.round;
}

function nextRound() {
  if (game.playerPile.length === 0 || game.cpuPile.length === 0) {
    endGame();
    return;
  }

  updateScoreBar();

  const playerCard = game.playerPile[0];
  const cpuCard    = game.cpuPile[0];

  // CPU zurücksetzen
  document.getElementById('cpu-card-back').classList.remove('hidden');
  document.getElementById('cpu-card-reveal').classList.add('hidden');
  document.getElementById('cpu-card-reveal').innerHTML = '';
  document.getElementById('round-result-banner').classList.add('hidden');

  // Spielerkarte anzeigen
  document.getElementById('player-card-display').innerHTML = buildCard(playerCard);

  // Beschriftung
  const label = document.getElementById('player-label');

  if (game.playerTurn) {
    label.textContent = 'Deine Karte – wähle eine Kategorie:';
    renderCategoryButtons(playerCard, cpuCard, true);
  } else {
    label.textContent = 'CPU ist dran – warte …';
    renderCategoryButtons(playerCard, cpuCard, false);
    // CPU wählt nach kurzer Pause
    setTimeout(() => cpuChooseCategory(playerCard, cpuCard), 1200);
  }
}

function renderCategoryButtons(playerCard, cpuCard, enabled) {
  const container = document.getElementById('category-buttons');
  container.innerHTML = CATEGORIES.map(cat => {
    const val = playerCard[cat.key];
    const hint = cat.lower_wins ? '↓ niedriger gewinnt' : '↑ höher gewinnt';
    return `
      <button class="cat-btn" data-key="${cat.key}" ${enabled ? '' : 'disabled'}>
        <span class="cat-btn-label">${cat.label}</span>
        <span class="cat-btn-value">${fmt(cat, val)}</span>
        <span class="cat-btn-hint">${hint}</span>
      </button>`;
  }).join('');

  if (enabled) {
    container.querySelectorAll('.cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (game.waiting) return;
        const cat = CATEGORIES.find(c => c.key === btn.dataset.key);
        compareCards(cat, playerCard, cpuCard);
      });
    });
  }
}

function cpuChooseCategory(playerCard, cpuCard) {
  // CPU wählt die Kategorie mit dem höchsten eigenen Prozentsatz (beste Karte)
  let bestCat = CATEGORIES[0];
  let bestPct = -1;
  CATEGORIES.forEach(cat => {
    const pct = getBarPct(cat, cpuCard[cat.key]);
    if (pct > bestPct) { bestPct = pct; bestCat = cat; }
  });
  compareCards(bestCat, playerCard, cpuCard);
}

function compareCards(cat, playerCard, cpuCard) {
  if (game.waiting) return;
  game.waiting = true;

  const pVal = playerCard[cat.key];
  const cVal = cpuCard[cat.key];

  // Alle Buttons deaktivieren
  document.querySelectorAll('.cat-btn').forEach(b => b.disabled = true);

  // CPU-Karte aufdecken
  document.getElementById('cpu-card-back').classList.add('hidden');
  const revealEl = document.getElementById('cpu-card-reveal');
  revealEl.innerHTML = buildCard(cpuCard);
  revealEl.classList.remove('hidden');

  // Sieger ermitteln
  let result;
  if (pVal == null || cVal == null) {
    result = 'draw';
  } else if (cat.lower_wins) {
    result = pVal < cVal ? 'win' : pVal > cVal ? 'lose' : 'draw';
  } else {
    result = pVal > cVal ? 'win' : pVal < cVal ? 'lose' : 'draw';
  }

  // Highlight auf beiden Karten setzen
  highlightStatOnCard('player-card-display', cat, result === 'win' ? 'win' : result === 'lose' ? 'lose' : 'draw');
  highlightStatOnCard('cpu-card-reveal',     cat, result === 'win' ? 'lose' : result === 'lose' ? 'win' : 'draw');

  // Banner anzeigen
  const banner = document.getElementById('round-result-banner');
  banner.classList.remove('hidden', 'win', 'lose', 'draw');

  const pendingInfo = game.pendingCards.length > 0
    ? ` (+${game.pendingCards.length} wartende Karten)`
    : '';

  if (result === 'win') {
    banner.classList.add('win');
    banner.innerHTML = `🏆 Du gewinnst diese Runde! <strong>${cat.label}:</strong> ${fmt(cat, pVal)} vs ${fmt(cat, cVal)}${pendingInfo}`;
    game.playerPile.push(...game.pendingCards, game.playerPile.shift(), game.cpuPile.shift());
    game.pendingCards = [];
    game.playerTurn = true;
  } else if (result === 'lose') {
    banner.classList.add('lose');
    banner.innerHTML = `💥 CPU gewinnt diese Runde. <strong>${cat.label}:</strong> ${fmt(cat, pVal)} vs ${fmt(cat, cVal)}${pendingInfo}`;
    game.cpuPile.push(...game.pendingCards, game.playerPile.shift(), game.cpuPile.shift());
    game.pendingCards = [];
    game.playerTurn = false;
  } else {
    banner.classList.add('draw');
    banner.innerHTML = `🤝 Unentschieden! Beide Karten kommen auf den Stapel.${pendingInfo}`;
    game.pendingCards.push(game.playerPile.shift(), game.cpuPile.shift());
    // Wer zuletzt gewann, bleibt dran; sonst bleibt playerTurn wie es ist
  }

  game.round++;
  updateScoreBar();
  showContinueButton();
}

function showContinueButton() {
  const container = document.getElementById('category-buttons');
  container.innerHTML = `
    <button class="btn-weiter" id="btn-weiter" onclick="proceedToNextRound()">
      Weiter <span class="weiter-arrow">→</span>
    </button>
    <div class="swipe-hint">oder nach links wischen</div>`;
}

function proceedToNextRound() {
  if (!game || !game.waiting) return;
  game.waiting = false;
  nextRound();
}

function highlightStatOnCard(containerId, cat, winState) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const rows = container.querySelectorAll('.stat-row');
  rows.forEach((row, i) => {
    if (CATEGORIES[i]?.key === cat.key) {
      row.classList.remove('highlight-win', 'highlight-lose', 'highlight-sel');
      if (winState === 'win')  row.classList.add('highlight-win');
      if (winState === 'lose') row.classList.add('highlight-lose');
      if (winState === 'draw') row.classList.add('highlight-sel');
      // Balken-Farbe ebenfalls anpassen
      const bar = row.querySelector('.stat-bar');
      if (bar) {
        if (winState === 'win')  { bar.style.background = 'var(--win)'; }
        if (winState === 'lose') { bar.style.background = 'var(--lose)'; }
      }
    }
  });
}

function endGame() {
  showScreen('q-end');
  const playerWon = game.playerPile.length > game.cpuPile.length;
  const draw = game.playerPile.length === game.cpuPile.length;

  document.getElementById('end-icon').textContent  = draw ? '🤝' : playerWon ? '🏆' : '💀';
  document.getElementById('end-title').textContent = draw ? 'Unentschieden!' : playerWon ? 'Du gewinnst!' : 'CPU gewinnt!';
  document.getElementById('end-text').textContent  = draw
    ? 'Beide haben gleich viele Karten. Nochmal?'
    : playerWon
      ? `Du hast alle ${game.playerPile.length} Karten gesammelt. Respekt!`
      : `Die CPU hat ${game.cpuPile.length} Karten. Revanche?`;
}

// ── Service Worker & Update-Toast ────────────────────────────────────────────

let _pendingReg = null;

function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('/AutoQuartett/sw.js', { updateViaCache: 'none' })
    .then(reg => {
      // Bei jedem App-Start nach Updates suchen
      reg.update();

      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        newSW.addEventListener('statechange', () => {
          // Neue Version installiert, wartet auf Aktivierung
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            _pendingReg = reg;
            showUpdateToast();
          }
        });
      });
    })
    .catch(() => {}); // kein SW → kein Problem (z.B. localhost ohne HTTPS)

  // Seite neu laden sobald neuer SW die Kontrolle übernimmt
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloading) { reloading = true; window.location.reload(); }
  });
}

function showUpdateToast() {
  if (document.getElementById('update-toast')) return;
  const toast = document.createElement('div');
  toast.id = 'update-toast';
  toast.className = 'update-toast';
  toast.innerHTML = `
    <span class="update-toast-msg">🆕 Neue Version verfügbar</span>
    <button class="update-toast-btn" onclick="activateUpdate()">Neu laden</button>
    <button class="update-toast-close" onclick="this.closest('#update-toast').remove()">✕</button>`;
  document.body.appendChild(toast);
}

function activateUpdate() {
  if (_pendingReg?.waiting) _pendingReg.waiting.postMessage('SKIP_WAITING');
}

// ── Custom Cars ───────────────────────────────────────────────────────────────

function loadCustomCars() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_CARS_KEY) || '[]'); }
  catch { return []; }
}

function deleteCustomCar(id) {
  if (!confirm('Dieses Auto aus der Sammlung löschen?')) return;
  const customs = loadCustomCars().filter(c => c.id !== id);
  localStorage.setItem(CUSTOM_CARS_KEY, JSON.stringify(customs));
  allCars = allCars.filter(c => c.id !== id);
  computeStatsRange();
  document.getElementById('count-all').textContent = allCars.length;
  updateEigeneFilterVisibility();
  if (activeFilter === 'eigene' && !allCars.some(c => c.custom)) {
    document.querySelector('.filter-btn[data-filter="all"]').click();
  } else {
    renderGallery(activeFilter);
  }
}

function updateEigeneFilterVisibility() {
  const btn = document.getElementById('btn-filter-eigene');
  if (btn) btn.style.display = allCars.some(c => c.custom) ? '' : 'none';
}

// ── Add Car Modal ─────────────────────────────────────────────────────────────

let _previewCar = null;

function setupAddCarModal() {
  document.getElementById('btn-add-car').addEventListener('click', openAddCarModal);
  document.getElementById('modal-close').addEventListener('click', closeAddCarModal);
  document.getElementById('btn-lookup-car').addEventListener('click', handleLookup);
  document.getElementById('car-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLookup();
  });
  document.getElementById('btn-save-car').addEventListener('click', handleSaveCar);
  document.getElementById('btn-discard-car').addEventListener('click', discardPreview);
  document.getElementById('add-car-modal').addEventListener('click', e => {
    if (e.target.id === 'add-car-modal') closeAddCarModal();
  });
  updateEigeneFilterVisibility();
}

function openAddCarModal() {
  document.getElementById('add-car-modal').classList.remove('hidden');
  resetModalState();
  setTimeout(() => document.getElementById('car-name-input').focus(), 100);
}

function closeAddCarModal() {
  document.getElementById('add-car-modal').classList.add('hidden');
  _previewCar = null;
}

function resetModalState() {
  document.getElementById('car-name-input').value = '';
  document.getElementById('modal-loading').classList.add('hidden');
  document.getElementById('modal-error').classList.add('hidden');
  document.getElementById('modal-preview').classList.add('hidden');
  document.getElementById('modal-actions').classList.add('hidden');
  _previewCar = null;
}

function discardPreview() {
  _previewCar = null;
  document.getElementById('modal-preview').classList.add('hidden');
  document.getElementById('modal-actions').classList.add('hidden');
  document.getElementById('modal-error').classList.add('hidden');
  document.getElementById('car-name-input').value = '';
  document.getElementById('car-name-input').focus();
}

async function handleLookup() {
  const name = document.getElementById('car-name-input').value.trim();
  if (!name) return;

  const loadingEl = document.getElementById('modal-loading');
  const errorEl   = document.getElementById('modal-error');
  const previewEl = document.getElementById('modal-preview');
  const actionsEl = document.getElementById('modal-actions');
  const searchBtn = document.getElementById('btn-lookup-car');

  loadingEl.classList.remove('hidden');
  errorEl.classList.add('hidden');
  previewEl.classList.add('hidden');
  actionsEl.classList.add('hidden');
  searchBtn.disabled = true;
  _previewCar = null;

  try {
    const res = await fetch(CAR_LOOKUP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Server-Fehler');

    if (allCars.some(c => c.id === data.id)) data.id += '_' + Date.now();
    _previewCar = data;
    previewEl.innerHTML = buildCard(data);
    previewEl.classList.remove('hidden');
    actionsEl.classList.remove('hidden');
  } catch (e) {
    errorEl.textContent = '⚠️ ' + e.message;
    errorEl.classList.remove('hidden');
  } finally {
    loadingEl.classList.add('hidden');
    searchBtn.disabled = false;
  }
}

function handleSaveCar() {
  if (!_previewCar) return;
  const customs = loadCustomCars();
  customs.push(_previewCar);
  localStorage.setItem(CUSTOM_CARS_KEY, JSON.stringify(customs));
  allCars.push(_previewCar);
  computeStatsRange();
  document.getElementById('count-all').textContent = allCars.length;
  updateEigeneFilterVisibility();
  renderGallery(activeFilter);
  closeAddCarModal();
}

// ── Start ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => { init(); registerSW(); });
