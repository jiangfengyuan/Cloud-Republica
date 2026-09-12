// Game-session controller: command boundary, deterministic session RNG and save snapshots.
// It has no DOM dependency, so it can also drive simulations or a future alternate UI.
(function (root) {
  const CR = root.CR = root.CR || {};
  const SAVE_VERSION = 1;
  const SAVE_KEY = 'cr_active_game';
  const PHASES = new Set(['event', 'action', 'settlement']);

  function seedFrom(source) {
    // Use the same injectable source as the engine. A deterministic test or
    // simulation therefore retains one coherent random stream.
    const value = typeof source === 'number' ? source : Math.floor(CR.engine.rng() * 4294967296);
    return (value >>> 0) || 1;
  }

  function serializableClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function validCardList(cards) {
    return Array.isArray(cards) && cards.every(card => card && Number.isInteger(card.id) &&
      CR.data.CARD_DATABASE.some(def => def.id === card.id));
  }

  function validState(state) {
    if (!state || typeof state !== 'object' || !PHASES.has(state.phase) || state.gameOver) return false;
    if (!CR.data.DIFFICULTY_LEVELS[state.difficulty] || !CR.data.FACTIONS[state.faction]) return false;
    if (!state.resources || typeof state.resources !== 'object') return false;
    if (!['money', 'materials', 'energy', 'research', 'morale', 'integrity'].every(k =>
      typeof state.resources[k] === 'number' && isFinite(state.resources[k]))) return false;
    if (!validCardList(state.hand) || !validCardList(state.permanentCards)) return false;
    if (!Array.isArray(state.drawPile) || !Array.isArray(state.discardPile) ||
      !state.drawPile.concat(state.discardPile).every(id => Number.isInteger(id) &&
        CR.data.CARD_DATABASE.some(card => card.id === id))) return false;
    if (!Number.isInteger(state.rngState) || !Number.isInteger(state.nextCardUid) ||
      !Array.isArray(state.selectedCards) || !Array.isArray(state.techs) ||
      !state.selectedCards.every(index => Number.isInteger(index) && index >= 0 && index < state.hand.length) ||
      !state.techs.every(id => CR.data.TECH_TREE[id])) return false;
    if (state.pendingEvent && !CR.data.EVENTS.some(event => event.id === state.pendingEvent.id)) return false;
    const validEffect = effect => effect && Number.isInteger(effect.cardId) && Number.isInteger(effect.turnsLeft) && effect.turnsLeft > 0 &&
      CR.data.CARD_DATABASE.some(card => card.id === effect.cardId);
    if (!Array.isArray(state.timedEffects) || !Array.isArray(state.delayedEffects) ||
      !state.timedEffects.every(validEffect) || !state.delayedEffects.every(validEffect)) return false;
    return state.maturedIncome && ['money', 'materials', 'energy', 'research', 'morale']
      .every(k => typeof state.maturedIncome[k] === 'number' && isFinite(state.maturedIncome[k]));
  }

  function cardById(id) { return CR.data.CARD_DATABASE.find(card => card.id === id); }

  function rehydrateState(raw) {
    // Cards/events are content definitions, not save-owned data. Restoring them
    // from the current database prevents malformed nested objects from reaching
    // the rule engine while preserving run-specific counters and timers.
    const restored = raw;
    const restoreCard = card => Object.assign({}, cardById(card.id), { uid: card.uid });
    restored.hand = restored.hand.map(restoreCard);
    restored.permanentCards = restored.permanentCards.map(restoreCard);
    restored.pendingEvent = restored.pendingEvent ?
      (CR.data.EVENTS.find(event => event.id === restored.pendingEvent.id) || null) : null;
    restored.timedEffects = restored.timedEffects.map(effect => {
      const card = cardById(effect.cardId);
      return { name: card.name, cardId: card.id, turnsLeft: effect.turnsLeft, income: Object.assign({}, card.venusEffect) };
    });
    restored.delayedEffects = restored.delayedEffects.map(effect => {
      const card = cardById(effect.cardId);
      return { name: card.name, cardId: card.id, turnsLeft: effect.turnsLeft, income: Object.assign({}, card.venusEffect) };
    });
    return restored;
  }

  function create() {
    let state = null;
    let history = [];

    function snapshot() {
      return { v: SAVE_VERSION, state: serializableClone(state), history: serializableClone(history) };
    }

    function persist() {
      if (!state || state.gameOver) {
        CR.storage.setItem(SAVE_KEY, '');
        return;
      }
      CR.storage.setItem(SAVE_KEY, JSON.stringify(snapshot()));
    }

    function result(ok, extra) {
      return Object.assign({ ok, state, modal: modal() }, extra || {});
    }

    function modal() {
      if (!state || state.gameOver) return null;
      if (state.phase === 'event') return { mode: 'event', event: state.pendingEvent || null };
      if (state.phase === 'settlement') return { mode: 'settlement' };
      return null;
    }

    function commit(command, payload, operation) {
      const output = operation();
      if (!output || output.ok !== false) {
        history.push({ command, payload: serializableClone(payload || {}) });
        persist();
      }
      return result(!output || output.ok !== false, output || undefined);
    }

    function start(options) {
      const opts = options || {};
      const seed = seedFrom(opts.seed);
      state = CR.state.createInitialState(opts.difficulty, opts.faction, opts.metaPerks,
        opts.sandboxConfig, opts.deckConfig);
      // Deck assembly keeps its existing engine.rng path; the stateful RNG starts
      // after that point and can be persisted with the session snapshot.
      state.rngState = seed;
      CR.engine.drawInitialCards(state);
      history = [{ command: 'start', payload: { difficulty: state.difficulty, faction: state.faction, seed } }];
      CR.engine.startNewTurn(state);
      if (!state.gameOver) CR.engine.triggerEventPhase(state);
      persist();
      return result(true);
    }

    function restore() {
      let saved;
      try { saved = JSON.parse(CR.storage.getItem(SAVE_KEY) || ''); } catch (_) { return result(false, { reason: 'save.invalid' }); }
      if (!saved || saved.v !== SAVE_VERSION || !validState(saved.state) || !Array.isArray(saved.history)) {
        return result(false, { reason: 'save.invalid' });
      }
      state = rehydrateState(saved.state);
      history = saved.history;
      return result(true);
    }

    function discard() {
      state = null;
      history = [];
      CR.storage.setItem(SAVE_KEY, '');
    }

    function dispatch(command, payload) {
      const data = payload || {};
      if (!state) return result(false, { reason: 'save.no_active_game' });
      switch (command) {
        case 'selectCard':
          return commit(command, data, () => {
            const index = data.index;
            if (state.phase !== 'action') return { ok: false, reason: 'fail.not_action_phase' };
            if (state.strike) return { ok: false, reason: 'fail.strike_cards' };
            const card = state.hand[index];
            if (!Number.isInteger(index) || !card || !CR.engine.canAfford(state, card)) return { ok: false, reason: 'fail.no_selection' };
            const selected = state.selectedCards.indexOf(index);
            if (selected >= 0) state.selectedCards.splice(selected, 1);
            else if (state.selectedCards.length >= CR.engine.getRemainingCardPlays(state)) return { ok: false, reason: 'ui.max_selected', reasonParams: { max: CR.engine.getRemainingCardPlays(state) } };
            else state.selectedCards.push(index);
            return { ok: true };
          });
        case 'acknowledgeEvent':
          return commit(command, data, () => {
            if (state.phase !== 'event') return { ok: false, reason: 'fail.not_action_phase' };
            CR.engine.applyEvent(state);
            return { ok: true };
          });
        case 'beginNextTurn':
          return commit(command, data, () => {
            if (state.phase !== 'settlement') return { ok: false, reason: 'fail.not_action_phase' };
            CR.engine.startNewTurn(state);
            if (!state.gameOver) CR.engine.triggerEventPhase(state);
            return { ok: true };
          });
        case 'playSelectedCards':
        case 'repairHabitat':
        case 'buildHabitat':
        case 'endTurn':
        case 'unlockTech': {
          const engineMethod = {
            playSelectedCards: 'playSelectedCards', repairHabitat: 'repairHabitat',
            buildHabitat: 'buildHabitat', endTurn: 'endTurn', unlockTech: 'unlockTech'
          }[command];
          return commit(command, data, () => CR.engine[engineMethod](state, data.nodeId));
        }
        default: return result(false, { reason: 'command.unknown' });
      }
    }

    function hasSavedGame() {
      try {
        const saved = JSON.parse(CR.storage.getItem(SAVE_KEY) || '');
        return Boolean(saved && saved.v === SAVE_VERSION && validState(saved.state) && Array.isArray(saved.history));
      } catch (_) { return false; }
    }

    return { start, restore, discard, dispatch, getState: () => state, getHistory: () => serializableClone(history),
      hasSavedGame, snapshot, SAVE_KEY, SAVE_VERSION };
  }

  CR.gameSession = { create, SAVE_KEY, SAVE_VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = CR.gameSession;
})(typeof window !== 'undefined' ? window : globalThis);
