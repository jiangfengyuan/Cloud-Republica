// meta-ui: feature controller with explicit dependencies.
(function (root) {
  const CR = root.CR;
  CR.features = CR.features || {};
  CR.features['meta-ui'] = function (deps) {
    const { actions, t, icon, showScreen, hideScreen } = deps;
    const { loadStats, loadMeta } = CR.storage;
    let stats = null, meta = null;
    const { updateFactionButtons } = deps;
    const { legacyGain } = CR.progression;
    const PERK_ICONS = { fund: 'res.money', supplies: 'res.materials', lab: 'res.research', coating: 'res.integrity', grid: 'res.energy', handbook: 'panel.hand' };
  // ==================== LOCAL STATS (cr_stats v2) ====================

  function saveStats() {
    try { CR.storage.setItem('cr_stats', JSON.stringify(stats)); } catch (e) { /* ignore */ }
  }

  // Called exactly once per finished game (guarded by state.statsRecorded).
  // Returns which records were broken (for the end-screen badge).
  function recordGame(s) {
    const broken = { newContribution: false, newPurification: false };
    stats.games++;
    if (s.gameResult === 'victory' && stats.wins[s.difficulty] !== undefined) {
      stats.wins[s.difficulty]++;
    }
    // M2: per-faction counters (schema v2; panel layout unchanged this round)
    const f = stats.factions[s.faction || 'none'];
    if (f) {
      f.games++;
      if (s.gameResult === 'victory') f.wins++;
    }
    if (s.contribution > stats.bestContribution) {
      stats.bestContribution = s.contribution;
      broken.newContribution = true;
    }
    const pur = Math.floor(s.purification);
    if (pur > stats.bestPurification) {
      stats.bestPurification = pur;
      broken.newPurification = true;
    }
    saveStats();
    return broken;
  }

  // ==================== META / LEGACY (cr_meta v1) ====================

  function saveMeta() {
    try { CR.storage.setItem('cr_meta', JSON.stringify(meta)); } catch (e) { /* ignore */ }
  }

  // M2 spec §3.1: victory = easy 2 / medium 3 / hard 5; defeat or crash = 1
  // M3 spec §2.4: sandbox victory = 1; sandbox defeat/crash = 0 (custom rules can
  // build free-win setups, so no participation points).
  function awardLegacy(s) {
    const gain = legacyGain(s.difficulty, s.gameResult);
    meta.legacy += gain;
    meta.lifetime += gain;
    saveMeta();
    return gain;
  }

  function renderStatsPanel() {
    const el = document.getElementById('statsPanel');
    if (!el) return;
    if (!stats.games) {
      el.innerHTML = `<span class="stats-title">${t('stats.title')}</span><span>${t('stats.no_games')}</span>`;
      return;
    }
    const totalWins = stats.wins.easy + stats.wins.medium + stats.wins.hard + (stats.wins.sandbox || 0);
    el.innerHTML =
      `<span class="stats-title">${t('stats.title')}</span>` +
      `<div class="stat-kpis">` +
      `<div class="stat-kpi"><div class="stat-kpi-value">${totalWins}</div><div class="stat-kpi-label">${t('stats.wins')}</div></div>` +
      `<div class="stat-kpi"><div class="stat-kpi-value">${stats.bestContribution}</div><div class="stat-kpi-label">${t('stats.best_contribution')}</div></div>` +
      `<div class="stat-kpi"><div class="stat-kpi-value">${stats.bestPurification}%</div><div class="stat-kpi-label">${t('stats.best_purification')}</div></div>` +
      `</div>` +
      `<span class="stat-sub">${t('stats.games')}: <strong>${stats.games}</strong></span>` +
      `<span class="stat-sub">${t('difficulty.easy')}/${t('difficulty.medium')}/${t('difficulty.hard')}: <strong>${stats.wins.easy}/${stats.wins.medium}/${stats.wins.hard}</strong></span>`;
  }

  actions.openMetaScreen = function () {
    renderMetaScreen();
    showScreen('metaScreen');
  };

  actions.closeMetaScreen = function () {
    hideScreen('metaScreen');
  };

  actions.buyPerk = function (id) {
    const def = CR.data.META_PERKS[id];
    if (!def) return;
    const lv = meta.perks[id] || 0;
    if (lv >= def.max) return;
    const cost = def.costs[lv];
    if (meta.legacy < cost) return;
    meta.legacy -= cost;
    meta.perks[id] = lv + 1;
    saveMeta();
    renderMetaScreen();
    updateFactionButtons(); // legacy balance shown on the start-screen button
  };

  function renderMetaScreen() {
    document.getElementById('metaBalance').textContent = t('meta.balance', { value: meta.legacy });
    document.getElementById('metaPerkGrid').innerHTML = Object.keys(CR.data.META_PERKS).map(id => {
      const def = CR.data.META_PERKS[id];
      const lv = meta.perks[id] || 0;
      const maxed = lv >= def.max;
      const cost = maxed ? 0 : def.costs[lv];
      const disabled = maxed || meta.legacy < cost;
      const dots = Array.from({ length: def.max }, (_, i) =>
        `<span class="perk-dot${i < lv ? ' filled' : ''}"></span>`).join('');
      const btnLabel = maxed ? t('meta.maxed') : t('meta.buy', { cost });
      return `<div class="perk-card">
        <div class="perk-title">${icon(PERK_ICONS[id])}<span>${t('meta.' + id + '.name')}</span></div>
        <div class="perk-desc">${t('meta.' + id + '.desc')}</div>
        <div class="perk-dots">${dots}</div>
        <button class="btn btn-secondary" ${disabled ? 'disabled' : ''} data-action="buyPerk" data-args="[&quot;${id}&quot;]">${btnLabel}</button>
      </div>`;
    }).join('');
  }


    return { init() { stats = loadStats(); meta = loadMeta(); }, getMeta() { return meta; }, renderStatsPanel, renderMetaScreen, recordGame, awardLegacy, legacyGain };
  };
})(typeof window !== 'undefined' ? window : globalThis);
