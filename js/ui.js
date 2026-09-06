// Application shell: composes feature controllers and renders the active game.
(function (root) {
  const CR = root.CR;
  const engine = CR.engine;
  const i18n = CR.i18n;
  const t = (key, params) => i18n.t(key, params);
  const icon = name => CR.icons.get(name);

  let state = null;
  let modalMode = null;        // null | 'event' | 'settlement'
  let modalContext = null;     // { event } for event mode (re-render on language switch)
  let lastHandSig = null;
  let prevResources = null;    // for value rolling / flash
  let prevPermCount = 0;       // for permanent-panel pulse
  let selectedFaction = 'none'; // start-screen faction pick (cr_faction)

  const actions = Object.create(null);
  const deps = { actions, t, icon, engine, cardName, addLog, updateUI, updateFactionButtons, getState: () => state };
  const metaUI = CR.features['meta-ui'](deps);
  const deckUI = CR.features['deck-ui'](deps);
  const sandboxUI = CR.features['sandbox-ui'](deps);
  const techUI = CR.features['tech-ui'](deps);
  const { renderStatsPanel, renderMetaScreen, recordGame, awardLegacy } = metaUI;
  const { renderDeckScreen, updateDeckButton } = deckUI;
  const { renderSandboxPanel } = sandboxUI;
  const { renderTechScreen, updateTechButton } = techUI;

  const THEMES = ['venus', 'glacier', 'abyss'];

  // M2: factions & meta
  const FACTION_IDS = ['none', 'guild', 'covenant', 'technocracy'];

  // ==================== LOG ====================

  // severity classes: '' (neutral info) | 'good' | 'warn' | 'bad' | 'phase' (turn separators)
  const LOG_ICON = { good: 'mat.driving', warn: 'panel.threat', bad: 'panel.threat' };

  const LOG_CLASS = {
    phase: new Set(['log.turn_begin', 'log.turn_complete', 'log.settlement_begin', 'log.event_applied']),
    good: new Set([
      'log.habitat_expanded', 'log.habitat_built', 'log.played_permanent', 'log.played_contract',
      'log.shield_block', 'log.storm_shield_block', 'log.extra_card', 'log.steal',
      'log.output_money', 'log.output_materials', 'log.output_energy', 'log.output_research',
      'log.output_morale', 'log.output_purification', 'log.purification_income',
      'log.transport_discount', 'log.repair_cheaper', 'log.repair_efficient', 'log.morale_floor',
      'log.insurance_active', 'log.storm_shield_active', 'log.no_morale_decay', 'log.charter',
      'log.ultimate_ready', 'log.shield_ready', 'log.delayed_matured', 'log.repaired',
      'log.tech_unlocked'
    ]),
    warn: new Set([
      'log.strike', 'log.hand_full', 'log.low_morale', 'log.risk_failed', 'log.cannot_afford',
      'log.habitat_limit', 'log.morale_decay', 'log.corrosion', 'log.maintenance',
      'log.ultimate_activated', 'log.timed_expired'
    ]),
    bad: new Set(['log.insurance_activated'])
  };

  function classifyLog(key, params) {
    if (key === 'log.game_over') return params && params.result === 'victory' ? 'good' : 'bad';
    // signed templates: '+' prefix means the change helps (purification) or hurts (corrosion)
    if (key === 'log.purification_change' || key === 'log.corrosion_changed') {
      const up = params && String(params.amount).charAt(0) === '+';
      return key === 'log.purification_change' ? (up ? 'good' : 'warn') : (up ? 'warn' : 'good');
    }
    for (const sev of Object.keys(LOG_CLASS)) {
      if (LOG_CLASS[sev].has(key)) return sev;
    }
    return '';
  }

  function addLog(message, sev) {
    const log = document.getElementById('gameLog');
    const entry = document.createElement('div');
    entry.className = 'log-entry slide-in' + (sev ? ' log-' + sev : '');
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const sevIcon = LOG_ICON[sev] ? `<span class="log-icon">${icon(LOG_ICON[sev])}</span>` : '';
    entry.innerHTML = `<span class="log-time">[${time}]</span>${sevIcon} ${message}`;
    log.insertBefore(entry, log.firstChild);

    while (log.children.length > 50) {
      log.removeChild(log.lastChild);
    }
  }

  // engine log bridge: key + params -> localized text; cardId/eventId localized here
  function engineLog(key, params) {
    const p = { ...(params || {}) };
    const sev = classifyLog(key, p); // classify on the raw result before translation
    if (p.cardId !== undefined) {
      const c = CR.data.CARD_DATABASE.find(x => x.id === p.cardId);
      if (c) p.card = i18n.lang === 'zh' ? (c.name_zh || c.name) : c.name;
    }
    if (p.eventId !== undefined) {
      const e = CR.data.EVENTS.find(x => x.id === p.eventId);
      if (e) p.event = i18n.lang === 'zh' ? (e.name_zh || e.name) : e.name;
    }
    if (p.techId !== undefined) p.tech = t('tech.' + p.techId + '.name'); // M5
    if (key === 'log.game_over') p.result = t('result.' + p.result);
    addLog(t(key, p), sev);
  }

  // ==================== STARFIELD (single div + box-shadow) ====================

  function createStars() {
    const el = document.getElementById('stars');
    const w = window.innerWidth, h = window.innerHeight;
    const shadows = [];
    for (let i = 0; i < 120; i++) {
      const x = Math.floor(Math.random() * w);
      const y = Math.floor(Math.random() * h);
      const spread = Math.random() < 0.8 ? 0 : 1;
      const opacity = (0.3 + Math.random() * 0.7).toFixed(2);
      shadows.push(`${x}px ${y}px 0 ${spread}px rgba(255,255,255,${opacity})`);
    }
    el.style.width = '2px';
    el.style.height = '2px';
    el.style.boxShadow = shadows.join(',');
  }

  // ==================== THEME & ANIMATION SWITCH ====================

  function currentTheme() { return document.documentElement.dataset.theme || 'venus'; }
  function animEnabled() { return document.documentElement.dataset.anim !== 'off'; }

  function applyTheme(theme) {
    if (!THEMES.includes(theme)) theme = 'venus';
    document.documentElement.dataset.theme = theme;
    try { CR.storage.setItem('cr_theme', theme); } catch (e) { /* ignore */ }
    updateControlButtons();
  }

  function applyAnim(on) {
    if (on) delete document.documentElement.dataset.anim;
    else document.documentElement.dataset.anim = 'off';
    try { CR.storage.setItem('cr_anim', on ? 'on' : 'off'); } catch (e) { /* ignore */ }
    updateControlButtons();
  }

  actions.setTheme = applyTheme;
  actions.cycleTheme = function () {
    const next = THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length];
    applyTheme(next);
  };
  actions.toggleAnim = function () { applyAnim(!animEnabled()); };

  function updateControlButtons() {
    const theme = currentTheme();
    THEMES.forEach(key => {
      const btn = document.getElementById('themeBtn' + key.charAt(0).toUpperCase() + key.slice(1));
      if (btn) {
        btn.textContent = t('theme.' + key);
        btn.classList.toggle('active', key === theme);
      }
    });
    const cycleBtn = document.getElementById('themeCycleBtn');
    if (cycleBtn) cycleBtn.textContent = t('ui.theme_label') + ': ' + t('theme.' + theme);
    const animLabel = animEnabled() ? t('ui.anim_on') : t('ui.anim_off');
    ['animToggleStart', 'animToggleBtn'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.textContent = animLabel;
    });
  }

  // ==================== LOCALIZED CARD TEXT ====================

  function cardName(card) { return i18n.lang === 'zh' ? (card.name_zh || card.name) : card.name; }
  function cardEffect(card) { return i18n.lang === 'zh' ? (card.effect_zh || card.effect) : card.effect; }

  // ==================== HAND RENDERING (dirty-signature) ====================

  function handSig() {
    const r = state.resources;
    return [
      state.hand.map(c => c.uid).join(','),
      state.phase, state.strike, i18n.lang,
      r.money, r.materials, r.energy, r.research,
      state.transportDiscount, state.extraCardPlayed
    ].join('|');
  }

  function renderHand() {
    const sig = handSig();
    if (sig === lastHandSig) {
      updateSelectionClasses();
      return;
    }
    lastHandSig = sig;

    const container = document.getElementById('handCards');
    container.innerHTML = '';

    state.hand.forEach((card, index) => {
      const isSelected = state.selectedCards.includes(index);
      const canPlay = engine.canAfford(state, card) && state.phase === 'action' && !state.strike;

      const cardEl = document.createElement('div');
      cardEl.className = `card cat-${card.category} ${isSelected ? 'selected' : ''} ${!canPlay ? 'disabled' : ''}`;

      const maturityClass = `maturity-${card.maturity}`;
      const typeName = t('type.' + card.type);
      const cost = engine.getCardCost(state, card); // discounted price (maturity x transportDiscount)

      cardEl.innerHTML = `
        <div class="card-maturity ${maturityClass}">${icon('mat.' + card.maturity)}</div>
        <div class="card-header">
          <div class="card-type-badge">${typeName}</div>
          <div class="card-category">${t('category.' + card.category)}</div>
        </div>
        <div class="card-art-band">${CR.icons.cardArt(card)}</div>
        <div class="card-name">${cardName(card)}</div>
        <div class="card-cost">
          ${cost.money ? `<span class="cost-tag">${icon('res.money')}${cost.money}</span>` : ''}
          ${cost.materials ? `<span class="cost-tag">${icon('res.materials')}${cost.materials}</span>` : ''}
          ${cost.energy ? `<span class="cost-tag">${icon('res.energy')}${cost.energy}</span>` : ''}
          ${cost.research ? `<span class="cost-tag">${icon('res.research')}${cost.research}</span>` : ''}
        </div>
        <div class="card-effect">${cardEffect(card)}</div>
      `;

      if (canPlay) {
        cardEl.addEventListener('click', () => toggleCardSelection(index));
      }
      container.appendChild(cardEl);
    });
    updateSelectionClasses();
  }

  function updateSelectionClasses() {
    const container = document.getElementById('handCards');
    Array.from(container.children).forEach((el, index) => {
      el.classList.toggle('selected', state.selectedCards.includes(index));
    });
    document.getElementById('selectedCount').textContent =
      `${state.selectedCards.length}/${engine.getRemainingCardPlays(state)}`;
  }

  function toggleCardSelection(index) {
    if (state.phase !== 'action') return;
    if (state.strike) {
      addLog(t('fail.strike_cards'), 'bad');
      return;
    }

    const card = state.hand[index];
    if (!engine.canAfford(state, card)) return;

    const pos = state.selectedCards.indexOf(index);
    if (pos > -1) {
      state.selectedCards.splice(pos, 1);
    } else {
      const remaining = engine.getRemainingCardPlays(state);
      if (state.selectedCards.length >= remaining) {
        addLog(t('ui.log.max_selected', { max: remaining }), 'warn');
        return;
      }
      state.selectedCards.push(index);
    }

    updateSelectionClasses(); // no full rebuild (dirty-signature performance optimization)
    document.getElementById('playBtn').disabled = state.selectedCards.length === 0 || state.phase !== 'action';
  }

  // ==================== PHASE INDICATOR & MODAL ====================

  function updatePhaseIndicator() {
    const dots = {
      event: document.getElementById('dot-event'),
      action: document.getElementById('dot-action'),
      settlement: document.getElementById('dot-settlement')
    };

    Object.values(dots).forEach(d => d.classList.remove('active', 'completed'));

    if (state.phase === 'event') {
      dots.event.classList.add('active');
    } else if (state.phase === 'action') {
      dots.event.classList.add('completed');
      dots.action.classList.add('active');
    } else if (state.phase === 'settlement') {
      dots.event.classList.add('completed');
      dots.action.classList.add('completed');
      dots.settlement.classList.add('active');
    }
  }

  function renderModal() {
    const modalBtn = document.getElementById('modalBtn');
    const modalIcon = document.getElementById('modalIcon');
    const setIcon = (name, cls) => {
      modalIcon.className = 'modal-icon ' + cls;
      modalIcon.innerHTML = icon(name);
    };
    if (modalMode === 'event') {
      const event = modalContext && modalContext.event;
      if (event) {
        const name = i18n.lang === 'zh' ? (event.name_zh || event.name) : event.name;
        const desc = i18n.lang === 'zh' ? (event.desc_zh || event.desc) : event.desc;
        document.getElementById('modalTitle').textContent = t('modal.event_title', { name });
        document.getElementById('modalText').textContent = desc;
        setIcon('panel.threat', 'mi-warn');
        modalBtn.textContent = t('modal.apply_event');
      } else {
        document.getElementById('modalTitle').textContent = t('modal.neutralized_title');
        document.getElementById('modalText').textContent = t('modal.neutralized_text');
        setIcon('mat.driving', 'mi-good');
        modalBtn.textContent = t('modal.proceed');
      }
    } else if (modalMode === 'settlement') {
      document.getElementById('modalTitle').textContent = t('modal.settlement_title', { turn: state.turn });
      document.getElementById('modalText').textContent = t('modal.settlement_text', { difficulty: t('difficulty.' + state.difficulty) });
      setIcon('panel.log', 'mi-info');
      modalBtn.textContent = t('btn.begin_turn', { turn: state.turn + 1 });
    }
  }

  function openModal(mode, context) {
    modalMode = mode;
    modalContext = context || null;
    renderModal();
    document.getElementById('eventModal').classList.add('active');
  }

  // ==================== END SCREEN ====================

  function spawnConfetti(container) {
    container.querySelectorAll('.confetti-layer').forEach(el => el.remove());
    const w = window.innerWidth;
    [0, 1].forEach(layer => {
      const el = document.createElement('div');
      el.className = 'confetti-layer';
      const shadows = [];
      for (let i = 0; i < 60; i++) {
        const x = Math.floor(Math.random() * w);
        const y = Math.floor(Math.random() * -40);
        const colors = ['#FFCD70', '#A7F3D0', '#FFFFFF', '#FFB020'];
        shadows.push(`${x}px ${y}px 0 ${Math.random() < 0.5 ? 1 : 2}px ${colors[i % colors.length]}`);
      }
      el.style.boxShadow = shadows.join(',');
      el.style.animationDelay = (layer * 0.7) + 's';
      el.style.animationDuration = (2.6 + layer * 0.9) + 's';
      container.appendChild(el);
    });
  }

  function showEndScreen() {
    const screen = document.getElementById('endScreen');
    const title = document.getElementById('endTitle');
    const reasonText = document.getElementById('endReason');
    const board = document.getElementById('scoreBoard');

    document.getElementById('eventModal').classList.remove('active');
    modalMode = null;
    screen.classList.add('active');

    // record stats + award legacy exactly once per game (refreshTexts may re-render this screen)
    if (!state.statsRecorded) {
      state.statsRecorded = true;
      state.newRecords = recordGame(state);
      state.legacyGained = awardLegacy(state);
      renderStatsPanel();
      updateFactionButtons(); // refresh legacy balance on the start-screen button
    }
    const records = state.newRecords || { newContribution: false, newPurification: false };

    screen.classList.toggle('defeat', state.gameResult !== 'victory');

    if (state.gameResult === 'victory') {
      title.textContent = t('end.victory_title');
      title.style.color = 'var(--accent-gold)';
      reasonText.textContent = t('end.victory_text');
      spawnConfetti(screen);
    } else if (state.gameResult === 'defeat') {
      title.textContent = t('end.defeat_title');
      title.style.color = 'var(--accent-rose)';
      reasonText.textContent = t('end.defeat_text', {
        purification: state.purification.toFixed(1),
        habitats: state.habitats
      });
    } else { // 'crash'
      title.textContent = t('end.crash_title');
      title.style.color = 'var(--accent-danger)';
      reasonText.textContent = t('end.crash_text');
    }

    const badge = (records.newContribution || records.newPurification)
      ? `<div class="record-badge">${t('stats.new_record')}</div>` : '';

    board.innerHTML = `
      <div class="score-card winner">
        <h3>${t('end.score_faction')}</h3>
        <div style="font-size: 2rem; color: var(--accent-gold); margin: 10px 0 2px;">${state.contribution}</div>
        <div class="score-value-label">${t('end.contribution')}</div>
        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 10px; line-height: 1.8;">
          <div class="score-line">${icon('action.build')}${t('end.habitats_score', { value: state.habitats * 20 })}</div>
          <div class="score-line">${icon('cat.environment')}${t('end.purification_score', { value: Math.floor(state.purification) })}</div>
          <div class="score-line">${icon('res.money')}${t('end.funds_score', { value: Math.floor(state.resources.money / 5) })}</div>
          <div class="score-line">${icon('mat.driving')}${t('end.prestige', { value: state.prestige })}</div>
        </div>
        ${badge}
      </div>
      <div class="score-card">
        <h3>${t('end.score_final')}</h3>
        <div style="margin-top: 10px; font-size: 0.9rem; line-height: 1.8; color: var(--text-secondary);">
          <div class="score-line">${icon('panel.threat')}${t('end.difficulty_label', { value: t('difficulty.' + state.difficulty) })}</div>
          <div class="score-line">${icon('action.turn')}${t('end.turn_label', { value: state.turn + '/' + state.maxTurns })}</div>
          <div class="score-line">${icon('cat.environment')}${t('end.purification_label', { value: state.purification.toFixed(1) + '%' })}</div>
          <div class="score-line">${icon('action.build')}${t('end.habitats_label', { value: state.habitats })}</div>
          <div class="score-line">${icon('res.integrity')}${t('end.integrity_label', { value: state.resources.integrity.toFixed(1) + '%' })}</div>
          <div class="score-line">${icon('cat.governance')}${t('end.charter_label', { value: state.hasCharter ? t('end.charter_yes') : t('end.charter_no') })}</div>
          <div class="score-line">${icon('panel.deck')}${t('end.deck_label', { value: t(state.deckId === 'custom' ? 'deck.custom_name' : 'deck.full_name') + ' · ' + state.deckSize })}</div>
          ${(state.legacyGained || 0) > 0 ? `<div class="score-line">${icon('mat.driving')}${t('end.legacy_gained', { value: state.legacyGained })}</div>` : ''}
        </div>
      </div>
    `;
  }

  // ==================== RESOURCE VALUE ROLLING & FLASH ====================

  function animateValue(el, from, to, suffix) {
    const shown = key => (key === '%' ? to.toFixed(0) + '%' : Math.floor(to));
    if (!animEnabled() || from === to || typeof requestAnimationFrame !== 'function') {
      el.textContent = suffix === '%' ? to.toFixed(0) + '%' : Math.floor(to);
      return;
    }
    const start = performance.now();
    const dur = 300;
    function frame(now) {
      const k = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3); // easeOutCubic ~ cubic-bezier(0.4,0,0.2,1) tail
      const v = from + (to - from) * eased;
      el.textContent = suffix === '%' ? v.toFixed(0) + '%' : Math.floor(v);
      if (k < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ==================== UI UPDATE ====================

  function updateUI() {
    const resMap = {
      'res-money': 'money', 'res-materials': 'materials',
      'res-energy': 'energy', 'res-research': 'research',
      'res-morale': 'morale', 'res-integrity': 'integrity'
    };

    for (const [id, key] of Object.entries(resMap)) {
      const el = document.getElementById(id);
      const value = state.resources[key];
      const valueEl = el.querySelector('.resource-value');
      const prev = prevResources ? prevResources[key] : value;
      animateValue(valueEl, prev, value, key === 'integrity' ? '%' : '');

      if (prevResources && value !== prev) {
        el.classList.remove('res-flash-up', 'res-flash-down');
        void el.offsetWidth; // restart animation
        el.classList.add(value > prev ? 'res-flash-up' : 'res-flash-down');
      }

      const bar = el.querySelector('.resource-bar-fill');
      bar.style.width = Math.min(100, value) + '%';

      el.classList.remove('warning', 'critical');
      if (key === 'integrity' && value < 30) el.classList.add('critical');
      else if (key === 'integrity' && value < 50) el.classList.add('warning');
      else if (key === 'morale' && value < 30) el.classList.add('warning');
      else if (key === 'energy' && value < 10) el.classList.add('warning');
    }
    prevResources = { ...state.resources };

    document.getElementById('turnText').textContent = t('ui.turn_of', { turn: state.turn, max: state.maxTurns });
    document.getElementById('difficultyText').textContent = t('ui.difficulty_label') + ': ' + t('difficulty.' + state.difficulty);
    document.getElementById('currentPhase').textContent = t('phase.' + state.phase);

    document.getElementById('purificationText').textContent = state.purification.toFixed(1) + '%';
    document.getElementById('purificationBar').style.width = state.purification + '%';

    document.getElementById('habitatText').textContent = t('ui.habitat_target', { count: state.habitats, target: state.targetHabitats });

    const remainingCardPlays = engine.getRemainingCardPlays(state);
    document.getElementById('selectedCount').textContent = `${state.selectedCards.length}/${remainingCardPlays}`;
    document.getElementById('handHint').textContent = t('ui.hand_hint', { max: remainingCardPlays });

    // M4: draw/discard pile counts (secondary info line under the hand header)
    document.getElementById('pileInfo').textContent =
      t('ui.piles', { draw: state.drawPile.length, discard: state.discardPile.length });

    updateTechButton(); // M5: header tech counter n/9

    document.getElementById('playBtn').disabled = state.selectedCards.length === 0 || state.phase !== 'action';
    document.getElementById('endTurnBtn').disabled = state.phase !== 'action';
    document.getElementById('buildHabitatBtn').disabled =
      state.phase !== 'action' ||
      state.strike ||
      state.habitatExpansions >= state.maxHabitatExpansions ||
      state.resources.money < 20 ||
      state.resources.materials < 12 + state.habitatMaterialsDelta;

    document.getElementById('corrosionRateText').textContent = t('ui.corrosion_rate', { rate: state.corrosionRate });
    // bar shows live corrosion pressure; 5%/turn maps to full width (adjudicated M2 fix: was dead 0%)
    document.getElementById('corrosionBar').style.width = Math.max(0, Math.min(100, state.corrosionRate * 20)) + '%';

    renderHand();

    const permContainer = document.getElementById('permanentCards');
    if (state.permanentCards.length === 0 && state.timedEffects.length === 0 && state.delayedEffects.length === 0) {
      permContainer.innerHTML = t('ui.no_permanents');
    } else {
      permContainer.innerHTML =
        state.permanentCards.map(c =>
          `<div class="perm-row" style="padding: 4px 0; border-bottom: 1px solid var(--border);">
            <span style="color: var(--accent-cyan);">${cardName(c)}</span>
            <span style="font-size: 0.75rem; color: var(--text-secondary);"> - ${cardEffect(c)}</span>
          </div>`
        ).join('') +
        state.timedEffects.map(te => {
          const c = CR.data.CARD_DATABASE.find(x => x.id === te.cardId);
          const name = c ? cardName(c) : te.name;
          return `<div class="perm-row" style="padding: 4px 0; border-bottom: 1px solid var(--border);">
            <span style="color: var(--accent-gold);">${t('perm.timed_remaining', { name, turns: te.turnsLeft })}</span>
          </div>`;
        }).join('') +
        state.delayedEffects.map(de => {
          const c = CR.data.CARD_DATABASE.find(x => x.id === de.cardId);
          const name = c ? cardName(c) : de.name;
          return `<div class="perm-row" style="padding: 4px 0; border-bottom: 1px solid var(--border);">
            <span style="color: var(--accent-purple);">${t('perm.delayed_countdown', { name, turns: de.turnsLeft })}</span>
          </div>`;
        }).join('');
    }
  }

  // pulse the newly added permanent-panel entries (called after updateUI post-play)
  function pulseNewPermanent() {
    const container = document.getElementById('permanentCards');
    const rows = container.querySelectorAll('.perm-row');
    const added = state.permanentCards.length - prevPermCount;
    if (added > 0 && rows.length >= state.permanentCards.length) {
      for (let i = state.permanentCards.length - added; i < state.permanentCards.length; i++) {
        if (rows[i]) rows[i].classList.add('perm-new');
      }
    }
    prevPermCount = state.permanentCards.length;
  }

  // ==================== TURN FLOW (civ-style: fully player-driven) ====================

  function startTurnFlow() {
    engine.startNewTurn(state);
    if (state.gameOver) { showEndScreen(); return; }

    updateUI();
    updatePhaseIndicator();

    const event = engine.triggerEventPhase(state);
    openModal('event', { event }); // null event => neutralized modal
  }

  // ==================== ACTION HANDLERS ====================

  actions.closeEventModal = function () {
    if (modalMode === 'event') {
      document.getElementById('eventModal').classList.remove('active');
      modalMode = null;

      engine.applyEvent(state);
      updateUI();
      updatePhaseIndicator();

      if (state.gameOver) { showEndScreen(); return; }

      if (state.strike) {
        addLog(t('ui.log.strike_action'), 'warn');
      } else {
        addLog(t('ui.log.action_prompt', { max: engine.getRemainingCardPlays(state) }));
      }
    } else if (modalMode === 'settlement') {
      document.getElementById('eventModal').classList.remove('active');
      modalMode = null;
      startTurnFlow();
    }
  };

  actions.playSelectedCards = function () {
    // pre-validate so the fly-out animation only runs on a real play
    if (!state || state.phase !== 'action' || state.strike || state.selectedCards.length === 0) {
      const result = engine.playSelectedCards(state);
      if (!result.ok) addLog(t(result.reason, result.reasonParams), 'bad');
      return;
    }

    const container = document.getElementById('handCards');
    state.selectedCards.forEach(i => {
      const el = container.children[i];
      if (el) el.classList.add('card-fly-out');
    });

    const run = () => {
      const result = engine.playSelectedCards(state);
      if (!result.ok) {
        addLog(t(result.reason, result.reasonParams), 'bad');
        updateUI();
        return;
      }
      updateUI();
      pulseNewPermanent();
      if (state.gameOver) showEndScreen();
    };

    if (animEnabled()) setTimeout(run, 180); // animation delay only; not part of turn flow
    else run();
  };

  actions.repairHabitat = function () {
    const result = engine.repairHabitat(state);
    if (!result.ok) addLog(t(result.reason, result.reasonParams), 'bad');
    updateUI();
  };

  actions.buildHabitat = function () {
    const result = engine.buildHabitat(state);
    if (!result.ok) addLog(t(result.reason, result.reasonParams), 'bad');
    updateUI();
    if (state.gameOver) showEndScreen();
  };

  actions.endTurn = function () { // the "Next Turn" button
    if (!state || state.phase !== 'action') return;

    engine.endTurn(state);
    updateUI();
    updatePhaseIndicator();

    if (state.gameOver) { showEndScreen(); return; }
    openModal('settlement'); // settlement summary parks until the player begins the next turn
  };

  actions.startGame = function (difficultyKey) {
    document.getElementById('startScreen').classList.remove('active');

    state = CR.state.createInitialState(difficultyKey, selectedFaction, metaUI.getMeta().perks,
      difficultyKey === 'sandbox' ? sandboxUI.getConfig() : undefined, deckUI.getConfig());
    lastHandSig = null;
    prevResources = null;
    prevPermCount = 0;
    engine.drawInitialCards(state);
    updateUI();
    updatePhaseIndicator();
    renderFactionBadge();

    addLog(t('ui.log.game_started', { difficulty: t('difficulty.' + state.difficulty) }));
    addLog(t('ui.log.faction_chosen', { faction: t('faction.' + state.faction + '.name'), tagline: t('faction.' + state.faction + '.tagline') }));
    addLog(t('ui.log.goal', { turns: state.maxTurns }));
    addLog(t('ui.log.init_corrosion', { rate: state.corrosionRate }));

    startTurnFlow();
  };

  // ==================== FACTION & META UI ====================

  actions.selectFaction = function (id) {
    if (!CR.data.FACTIONS[id]) id = 'none';
    selectedFaction = id;
    try { CR.storage.setItem('cr_faction', id); } catch (e) { /* ignore */ }
    updateFactionButtons();
  };

  function updateFactionButtons() {
    FACTION_IDS.forEach(id => {
      const btn = document.getElementById('factionBtn' + id.charAt(0).toUpperCase() + id.slice(1));
      if (!btn) return;
      btn.innerHTML = `${icon('faction.' + id)}${t('faction.' + id + '.name')}<br><span class="faction-btn-desc">${t('faction.' + id + '.desc')}</span>`;
      btn.classList.toggle('active', id === selectedFaction);
    });
    const legacyBtnText = document.getElementById('legacyBtnText');
    if (legacyBtnText && metaUI.getMeta()) legacyBtnText.textContent = `${t('meta.title')} · ${metaUI.getMeta().legacy}`;
  }

  function renderFactionBadge() {
    const badge = document.getElementById('factionBadge');
    if (!badge) return;
    if (!state) { badge.style.display = 'none'; return; }
    badge.style.display = 'inline-flex';
    badge.innerHTML = `${icon('faction.' + state.faction)}<span>${t('faction.' + state.faction + '.name')}</span>`;
  }

  actions.toggleLang = function () {
    i18n.setLang(i18n.lang === 'zh' ? 'en' : 'zh'); // setLang triggers CR.ui.refreshTexts()
  };

  // ==================== I18N REFRESH ====================

  function refreshTexts() {
    // static data-i18n elements (text-only; icon spans carry no data-i18n)
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    // fill SVG icon placeholders (idempotent)
    document.querySelectorAll('[data-icon]').forEach(el => {
      el.innerHTML = icon(el.getAttribute('data-icon'));
    });
    // language button shows the OTHER language
    document.getElementById('langBtn').textContent = t('ui.lang_btn');
    // difficulty buttons (name + description)
    ['easy', 'medium', 'hard', 'sandbox'].forEach(key => {
      const btn = document.getElementById('diff' + key.charAt(0).toUpperCase() + key.slice(1));
      btn.innerHTML = `${t('difficulty.' + key)}<br><span style="font-size: 0.7rem; font-weight: 400; text-transform: none;">${t('difficulty.' + key + '_desc')}</span>`;
    });
    renderSandboxPanel();
    updateControlButtons();
    updateFactionButtons();
    updateDeckButton();
    if (document.getElementById('metaScreen').classList.contains('active')) renderMetaScreen();
    if (document.getElementById('deckScreen').classList.contains('active')) renderDeckScreen();
    if (state && document.getElementById('techScreen').classList.contains('active')) renderTechScreen();
    updateTechButton();
    renderStatsPanel();
    // dynamic areas
    if (state) {
      lastHandSig = null; // force hand rebuild in the new language
      updateUI();
      updatePhaseIndicator();
      renderFactionBadge();
      if (modalMode) renderModal();
      if (state.gameOver) showEndScreen();
    }
  }

  CR.ui = { refreshTexts };

  // ==================== INIT ====================

  function boot() {
    i18n.init();
    metaUI.init();
    sandboxUI.init();
    deckUI.init();
    // restore theme & anim preferences (independent of language)
    let savedTheme = 'venus', savedAnim = 'on';
    try {
      savedTheme = CR.storage.getItem('cr_theme') || 'venus';
      savedAnim = CR.storage.getItem('cr_anim') || 'on';
      selectedFaction = CR.storage.getItem('cr_faction') || 'none';
    } catch (e) { /* ignore */ }
    if (!CR.data.FACTIONS[selectedFaction]) selectedFaction = 'none';
    applyTheme(savedTheme);
    applyAnim(savedAnim !== 'off');

    engine.subscribe(event => engineLog(event.key, event.params));
    actions.restart = () => root.location.reload();
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-action]');
      if (!button || button.disabled) return;
      const action = actions[button.dataset.action];
      if (action) action(...JSON.parse(button.dataset.args || '[]'));
    });
    createStars();
    refreshTexts();
    document.getElementById('startScreen').classList.add('active');
  }

  if (typeof document !== 'undefined') root.addEventListener('load', boot);
})(typeof window !== 'undefined' ? window : globalThis);
