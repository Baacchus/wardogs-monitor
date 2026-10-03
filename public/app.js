/**
 * WARDOGS TACTICAL MONITOR - CLIENT SCRIPT
 * Gère le temps réel, le décompte de rafraîchissement, les filtres et l'interactivité.
 * Sources prises en charge : wardogsfrance.fr, wardogs-france.com, wardogs.7ecompagnie.fr
 */

(function () {
  'use strict';

  // État applicatif
  const state = {
    servers: [],
    summary: null,
    filterSource: 'all', // 'all' | '7e' | 'fr' | 'com'
    searchQuery: '',
    sortBy: 'players-desc',
    activeOnly: false,
    refreshIntervalSeconds: 30,
    secondsRemaining: 30,
    timerId: null,
    isRefreshing: false
  };

  // Éléments du DOM
  const dom = {
    serversGrid: document.getElementById('servers-grid'),
    emptyState: document.getElementById('empty-state'),
    btnResetFilters: document.getElementById('btn-reset-filters'),
    searchInput: document.getElementById('search-input'),
    searchClear: document.getElementById('search-clear'),
    sortSelect: document.getElementById('sort-select'),
    filterActiveOnly: document.getElementById('filter-active-only'),
    tabAll: document.getElementById('tab-all'),
    tab7e: document.getElementById('tab-7e'),
    tabFr: document.getElementById('tab-fr'),
    tabCom: document.getElementById('tab-com'),
    countAll: document.getElementById('count-all'),
    count7e: document.getElementById('count-7e'),
    countFr: document.getElementById('count-fr'),
    countCom: document.getElementById('count-com'),
    btnManualRefresh: document.getElementById('btn-manual-refresh'),
    countdownText: document.getElementById('countdown-text'),
    countdownCircle: document.getElementById('countdown-circle'),
    statTotalPlayers: document.getElementById('stat-total-players'),
    statMaxPlayers: document.getElementById('stat-max-players'),
    statFillPlayers: document.getElementById('stat-fill-players'),
    statOnlineServers: document.getElementById('stat-online-servers'),
    statTotalServers: document.getElementById('stat-total-servers'),
    statSourcesBreakdown: document.getElementById('stat-sources-breakdown'),
    factionPillValk: document.getElementById('faction-pill-valk'),
    factionPillMant: document.getElementById('faction-pill-mant'),
    factionPillLone: document.getElementById('faction-pill-lone'),
    statLastSync: document.getElementById('stat-last-sync'),
    toast: document.getElementById('toast'),
    toastTitle: document.getElementById('toast-title'),
    toastMessage: document.getElementById('toast-message')
  };

  /**
   * Récupère les données des serveurs via l'API locale /api/servers
   */
  async function fetchServersData(force = false) {
    if (state.isRefreshing) return;
    state.isRefreshing = true;
    dom.btnManualRefresh.classList.add('spinning');

    try {
      const url = `/api/servers${force ? '?force=true' : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();

      if (data.success && Array.isArray(data.servers)) {
        state.servers = data.servers;
        state.summary = data.summary;
        updateSummaryHUD();
        renderServers();
      }
    } catch (err) {
      console.error('[Dashboard] Erreur lors du chargement des serveurs :', err);
      showToast('Erreur de synchronisation', 'Impossible de joindre le flux des serveurs.', 4000);
    } finally {
      state.isRefreshing = false;
      dom.btnManualRefresh.classList.remove('spinning');
      resetCountdown();
    }
  }

  /**
   * Met à jour les cartes d'indicateurs globaux (HUD en haut)
   */
  function updateSummaryHUD() {
    if (!state.summary) return;
    const { totalServers, onlineServers, totalPlayers, maxCapacity, occupancyRate, sources, globalFactions } = state.summary;

    dom.statTotalPlayers.textContent = totalPlayers;
    dom.statMaxPlayers.textContent = `/ ${maxCapacity} slots (${occupancyRate}%)`;
    dom.statFillPlayers.style.width = `${Math.min(100, occupancyRate)}%`;

    dom.statOnlineServers.textContent = onlineServers;
    dom.statTotalServers.textContent = `/ ${totalServers} total`;

    if (sources) {
      const cie7Count = sources.cie7?.count || 0;
      const cie7P = sources.cie7?.players || 0;
      const frCount = sources.fr?.count || 0;
      const frP = sources.fr?.players || 0;
      const comCount = sources.com?.count || 0;
      const comP = sources.com?.players || 0;

      dom.statSourcesBreakdown.innerHTML = `<span>${cie7Count} sur 7e (${cie7P}j)</span> · <span>${frCount} sur .fr (${frP}j)</span> · <span>${comCount} sur .com (${comP}j)</span>`;
      
      if (dom.count7e) dom.count7e.textContent = cie7Count;
      if (dom.countFr) dom.countFr.textContent = frCount;
      if (dom.countCom) dom.countCom.textContent = comCount;
    }
    dom.countAll.textContent = totalServers;

    if (globalFactions) {
      dom.factionPillValk.textContent = `VAL ${globalFactions.valkyra || 0}`;
      dom.factionPillMant.textContent = `MAN ${globalFactions.manticore || 0}`;
      dom.factionPillLone.textContent = `LON ${globalFactions.lonestar || 0}`;
    }

    const now = new Date();
    dom.statLastSync.textContent = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  /**
   * Filtre et trie les serveurs selon l'état actuel
   */
  function getFilteredServers() {
    let list = [...state.servers];

    // Filtre source
    if (state.filterSource !== 'all') {
      list = list.filter(s => s.source === state.filterSource);
    }

    // Filtre actifs uniquement (au moins 1 joueur)
    if (state.activeOnly) {
      list = list.filter(s => s.players > 0);
    }

    // Recherche par mot-clé
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      list = list.filter(s => 
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.inGameName && s.inGameName.toLowerCase().includes(q)) ||
        (s.currentMap && s.currentMap.toLowerCase().includes(q)) ||
        (s.nextMap && s.nextMap.toLowerCase().includes(q)) ||
        (s.gameMode && s.gameMode.toLowerCase().includes(q)) ||
        (s.id && s.id.toLowerCase().includes(q))
      );
    }

    // Tri
    list.sort((a, b) => {
      switch (state.sortBy) {
        case 'players-desc':
          return (b.players || 0) - (a.players || 0);
        case 'players-asc':
          return (a.players || 0) - (b.players || 0);
        case 'name-asc':
          return (a.name || '').localeCompare(b.name || '');
        case 'source':
          return a.source.localeCompare(b.source) || (b.players - a.players);
        default:
          return 0;
      }
    });

    return list;
  }

  /**
   * Rendu visuel des cartes de serveurs
   */
  function renderServers() {
    const list = getFilteredServers();

    if (list.length === 0) {
      dom.serversGrid.innerHTML = '';
      dom.emptyState.classList.remove('hidden');
      return;
    }

    dom.emptyState.classList.add('hidden');
    dom.serversGrid.innerHTML = list.map(server => createServerCardHTML(server)).join('');

    // Attacher les écouteurs pour la copie 1-clic
    dom.serversGrid.querySelectorAll('.btn-copy-id').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const srvName = btn.getAttribute('data-name');
        copyToClipboard(id, srvName, btn);
      });
    });
  }

  /**
   * Génère le template HTML pour une carte de serveur
   */
  function createServerCardHTML(s) {
    const pct = s.maxPlayers > 0 ? Math.round((s.players / s.maxPlayers) * 100) : 0;
    
    // Détermination de l'état d'occupation
    let occupancyClass = 'empty';
    let occupancyText = 'Serveur vide';
    if (s.players >= 90) {
      occupancyClass = 'full';
      occupancyText = 'Complet';
    } else if (s.players >= 30) {
      occupancyClass = 'medium';
      occupancyText = 'Forte affluence';
    } else if (s.players > 0) {
      occupancyClass = 'low';
      occupancyText = 'Partie en cours';
    }

    // Factions HTML pour serveurs Classiques & 7e Compagnie
    let factionsHTML = '';
    if (s.factions) {
      const valk = s.factions.valkyra || 0;
      const mant = s.factions.manticore || 0;
      const lone = s.factions.lonestar || 0;
      // La jauge représente la progression vers les 100 points de victoire (KOTH cap)
      const targetScore = 100;
      const valkPct = Math.min(100, Math.max(0, Math.round((valk / targetScore) * 100)));
      const mantPct = Math.min(100, Math.max(0, Math.round((mant / targetScore) * 100)));
      const lonePct = Math.min(100, Math.max(0, Math.round((lone / targetScore) * 100)));

      factionsHTML = `
        <div class="card-factions" title="Scores et progression des 3 factions">
          <div class="faction-row">
            <span class="faction-name valkyra">Valkyra</span>
            <div class="faction-bar-track">
              <div class="faction-bar-fill valkyra" style="width: ${valkPct}%"></div>
            </div>
            <span class="faction-count">${valk}</span>
          </div>
          <div class="faction-row">
            <span class="faction-name manticore">Manticore</span>
            <div class="faction-bar-track">
              <div class="faction-bar-fill manticore" style="width: ${mantPct}%"></div>
            </div>
            <span class="faction-count">${mant}</span>
          </div>
          <div class="faction-row">
            <span class="faction-name lonestar">Lonestar</span>
            <div class="faction-bar-track">
              <div class="faction-bar-fill lonestar" style="width: ${lonePct}%"></div>
            </div>
            <span class="faction-count">${lone}</span>
          </div>
        </div>
      `;
    }

    let sourceTagClass = 'source-tag-fr';
    if (s.source === 'com') sourceTagClass = 'source-tag-com';
    else if (s.source === '7e') sourceTagClass = 'source-tag-7e';

    return `
      <article class="server-card source-${s.source}" id="srv-${s.id}">
        <div class="card-header">
          <div class="card-title-group">
            <span class="card-source-tag ${sourceTagClass}">${s.sourceLabel}</span>
            <h2 class="card-server-name" title="${escapeHTML(s.name)}">${escapeHTML(s.name)}</h2>
            <p class="card-ingame-label" title="Nom de recherche : ${escapeHTML(s.inGameName)}">
              🔍 ${escapeHTML(s.inGameName)}
            </p>
          </div>
          <div class="card-status-badge ${s.online ? 'online' : 'offline'}">
            <span class="status-dot-pulse"></span>
            <span>${s.online ? 'En ligne' : 'Hors ligne'}</span>
          </div>
        </div>

        <!-- Occupancy HUD -->
        <div class="card-occupancy">
          <div class="occupancy-header">
            <div class="occupancy-numbers">
              <span class="occupancy-current">${s.players}</span>
              <span class="occupancy-max">/ ${s.maxPlayers} joueurs</span>
            </div>
            <span class="occupancy-status-text ${occupancyClass}">${occupancyText}</span>
          </div>
          <div class="occupancy-gauge">
            <div class="occupancy-fill ${occupancyClass}" style="width: ${Math.max(2, pct)}%"></div>
          </div>
        </div>

        <!-- Map & Mode Details -->
        <div class="card-meta-grid">
          <div class="meta-item">
            <svg class="meta-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
              <line x1="8" y1="2" x2="8" y2="18"></line>
              <line x1="16" y1="6" x2="16" y2="22"></line>
            </svg>
            <div class="meta-info">
              <span class="meta-label">Carte en cours</span>
              <span class="meta-value" title="${escapeHTML(s.currentMap)}">${escapeHTML(s.currentMap)}</span>
            </div>
          </div>

          <div class="meta-item">
            <svg class="meta-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
            <div class="meta-info">
              <span class="meta-label">${s.nextMap ? 'Carte suivante' : 'Mode de jeu'}</span>
              <span class="meta-value" title="${escapeHTML(s.nextMap || s.gameMode)}">${escapeHTML(s.nextMap || s.gameMode)}</span>
            </div>
          </div>
        </div>

        ${factionsHTML}

        <!-- Actions -->
        <div class="card-actions">
          <button class="btn-copy-id" data-id="${escapeHTML(s.id)}" data-name="${escapeHTML(s.name)}" title="Copier le code de connexion pour le jeu">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copier le Server ID</span>
          </button>

          ${s.statsUrl ? `
            <a href="${s.statsUrl}" target="_blank" rel="noopener noreferrer" class="btn-stats-link" title="Consulter les statistiques complètes du serveur">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="13" x2="18" y2="21"></line>
                <line x1="6" y1="9" x2="6" y2="21"></line>
                <line x1="12" y1="5" x2="12" y2="21"></line>
              </svg>
            </a>
          ` : `
            <a href="${s.sourceUrl}" target="_blank" rel="noopener noreferrer" class="btn-stats-link" title="Ouvrir la page officielle">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </a>
          `}
        </div>
      </article>
    `;
  }

  /**
   * Copie l'identifiant du serveur dans le presse-papiers
   */
  async function copyToClipboard(text, serverName, btnElement) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const input = document.createElement('input');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }

      // Feedback visuel sur le bouton
      if (btnElement) {
        btnElement.classList.add('copied');
        const span = btnElement.querySelector('span');
        const originalText = span.textContent;
        span.textContent = '✓ ID Copié !';
        setTimeout(() => {
          btnElement.classList.remove('copied');
          span.textContent = originalText;
        }, 1800);
      }

      showToast('ID Serveur copié !', `${serverName} : ${text}`, 3000);
    } catch (err) {
      console.error('Erreur lors de la copie :', err);
      showToast('Erreur', 'Impossible de copier dans le presse-papiers.', 3000);
    }
  }

  /**
   * Affiche une notification Toast HUD
   */
  let toastTimeout = null;
  function showToast(title, message, duration = 3000) {
    if (toastTimeout) clearTimeout(toastTimeout);
    dom.toastTitle.textContent = title;
    dom.toastMessage.textContent = message;
    dom.toast.classList.remove('hidden');

    toastTimeout = setTimeout(() => {
      dom.toast.classList.add('hidden');
    }, duration);
  }

  /**
   * Échappe les caractères HTML dangereux
   */
  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Décompte de rafraîchissement automatique (30 secondes)
   */
  const TOTAL_CIRCUMFERENCE = 94.25; // 2 * PI * 15

  function resetCountdown() {
    state.secondsRemaining = state.refreshIntervalSeconds;
    updateCountdownUI();
  }

  function updateCountdownUI() {
    dom.countdownText.textContent = state.secondsRemaining;
    const progress = (state.refreshIntervalSeconds - state.secondsRemaining) / state.refreshIntervalSeconds;
    const offset = TOTAL_CIRCUMFERENCE * (1 - progress);
    dom.countdownCircle.style.strokeDashoffset = offset;
  }

  function startCountdownTimer() {
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = setInterval(() => {
      state.secondsRemaining--;
      if (state.secondsRemaining <= 0) {
        fetchServersData(true);
      } else {
        updateCountdownUI();
      }
    }, 1000);
  }

  /**
   * Configuration des écouteurs d'événements
   */
  function setupEventListeners() {
    // Bouton de rafraîchissement manuel
    dom.btnManualRefresh.addEventListener('click', () => {
      fetchServersData(true);
    });

    // Onglets de filtre de communauté
    const tabs = [
      { btn: dom.tabAll, filter: 'all' },
      { btn: dom.tab7e, filter: '7e' },
      { btn: dom.tabFr, filter: 'fr' },
      { btn: dom.tabCom, filter: 'com' }
    ];

    tabs.forEach(({ btn, filter }) => {
      if (!btn) return;
      btn.addEventListener('click', () => {
        tabs.forEach(t => t.btn && t.btn.classList.remove('active'));
        btn.classList.add('active');
        state.filterSource = filter;
        renderServers();
      });
    });

    // Champ de recherche
    dom.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim();
      dom.searchClear.classList.toggle('hidden', state.searchQuery === '');
      renderServers();
    });

    dom.searchClear.addEventListener('click', () => {
      dom.searchInput.value = '';
      state.searchQuery = '';
      dom.searchClear.classList.add('hidden');
      renderServers();
    });

    // Sélecteur de tri
    dom.sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      renderServers();
    });

    // Toggle serveurs actifs uniquement
    dom.filterActiveOnly.addEventListener('change', (e) => {
      state.activeOnly = e.target.checked;
      renderServers();
    });

    // Réinitialiser les filtres depuis l'empty state
    dom.btnResetFilters.addEventListener('click', () => {
      state.searchQuery = '';
      state.filterSource = 'all';
      state.activeOnly = false;
      dom.searchInput.value = '';
      dom.searchClear.classList.add('hidden');
      dom.filterActiveOnly.checked = false;
      tabs.forEach(t => t.btn && t.btn.classList.remove('active'));
      dom.tabAll.classList.add('active');
      renderServers();
    });
  }

  /**
   * Initialisation générale
   */
  function init() {
    setupEventListeners();
    fetchServersData(false);
    startCountdownTimer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
