// engine.js — pure game logic. No DOM access. Logs via CR.engine.onLog(key, params).
(function (root) {
  const CR = root.CR = root.CR || {};

  const engine = {};

  // Injectable hooks
  engine.rng = Math.random;        // () => [0, 1)
  engine.onLog = null;             // (key: string, params: object) => void

  // Multiple consumers can observe rule events without replacing each other.
  // Each event contains a log key and parameters, not localized presentation.
  const subscribers = new Set();
  engine.subscribe = function (listener) {
    if (typeof listener !== 'function') throw new TypeError('Expected an event listener');
    subscribers.add(listener);
    return () => subscribers.delete(listener);
  };

  // Whitelist of every log key this engine can emit (tested by simulate.js)
  engine.logKeys = [
    'log.ultimate_activated', 'log.insurance_activated', 'log.purification_change',
    'log.hand_full', 'log.game_over', 'log.habitat_limit', 'log.habitat_expanded',
    'log.cannot_afford', 'log.played_permanent', 'log.played_contract', 'log.risk_failed',
    'log.delayed_started', 'log.timed_started', 'log.extra_card', 'log.steal',
    'log.output_money', 'log.output_materials', 'log.output_energy', 'log.output_research',
    'log.output_morale', 'log.output_purification', 'log.corrosion_changed',
    'log.transport_discount', 'log.repair_cheaper', 'log.repair_efficient',
    'log.morale_floor', 'log.insurance_active', 'log.storm_shield_active',
    'log.no_morale_decay', 'log.charter', 'log.ultimate_ready', 'log.shield_ready',
    'log.turn_begin', 'log.shield_block', 'log.storm_shield_block', 'log.event_applied',
    'log.strike', 'log.repaired', 'log.habitat_built', 'log.settlement_begin',
    'log.income_summary', 'log.purification_income', 'log.timed_remaining',
    'log.timed_expired', 'log.delayed_matured', 'log.delayed_countdown',
    'log.maintenance', 'log.corrosion', 'log.morale_decay', 'log.low_morale',
    'log.turn_complete', 'log.deck_empty', 'log.tech_unlocked'
  ];

  function log(key, params) {
    if (engine.onLog) engine.onLog(key, params || {});
    const event = Object.freeze({ key, params: Object.freeze({ ...(params || {}) }) });
    Array.from(subscribers).forEach(listener => listener(event));
  }

  // ==================== RESOURCE MANAGEMENT ====================

  function modifyResource(state, type, amount) {
    state.resources[type] += amount;

    if (type === 'integrity') {
      state.resources.integrity = Math.max(0, Math.min(100, state.resources.integrity));
      if (state.resources.integrity <= 0) {
        handleCrash(state);
      }
    } else if (type === 'morale') {
      state.resources.morale = Math.max(0, Math.min(100, state.resources.morale));
      if (state.moraleFloor > 0 && state.resources.morale < state.moraleFloor) {
        state.resources.morale = state.moraleFloor;
      }
    } else {
      state.resources[type] = Math.max(0, state.resources[type]);
    }
  }

  // spec 3.5: integrity hit 0 -> ultimate (no loss) -> insurance (halve) -> crash
  function handleCrash(state) {
    if (state.ultimate) {
      state.ultimate = false;
      state.resources.integrity = 20;
      log('log.ultimate_activated');
      return;
    }
    if (state.insurance) {
      state.insurance = false;
      state.resources.integrity = 20;
      ['money', 'materials', 'energy', 'research'].forEach(k => {
        state.resources[k] = Math.floor(state.resources[k] / 2);
      });
      log('log.insurance_activated');
      return;
    }
    endGame(state, 'crash');
  }

  // spec 3.7: single shared effect-application path for cards & events
  function applyResourceEffect(state, effect) {
    if (effect.money) modifyResource(state, 'money', effect.money);
    if (effect.materials) modifyResource(state, 'materials', effect.materials);
    if (effect.energy) modifyResource(state, 'energy', effect.energy);
    if (effect.research) modifyResource(state, 'research', effect.research);
    if (effect.morale) modifyResource(state, 'morale', effect.morale);
    if (effect.integrity) modifyResource(state, 'integrity', effect.integrity);
    if (effect.purification) {
      // M2: purificationMultiplier (covenant) amplifies positive purification deltas only
      const delta = effect.purification > 0
        ? effect.purification * (state.purificationMultiplier || 1)
        : effect.purification;
      state.purification = Math.min(100, state.purification + delta);
      log('log.purification_change', { amount: (delta > 0 ? '+' : '') + Math.round(delta * 10) / 10 });
    }
  }

  // ==================== CARD COSTS ====================

  function getMaturityMultiplier(maturity) {
    const multipliers = {
      driving: 0.6, trending: 0.8, emerging: 1.0,
      signaling: 1.3, brewing: 1.5
    };
    return multipliers[maturity] || 1.0;
  }

  // transportDiscount applies to the money (Funds) cost only (spec 3.3)
  // M2: researchCostMultiplier (technocracy) applies to the research cost only
  function getCardCost(state, card) {
    const mult = getMaturityMultiplier(card.maturity);
    return {
      money: Math.round(card.cost.money * mult * state.transportDiscount),
      materials: Math.round(card.cost.materials * mult),
      energy: Math.round(card.cost.energy * mult),
      research: Math.round(card.cost.research * mult * (state.researchCostMultiplier || 1))
    };
  }

  function canAfford(state, card) {
    if (card.maturity === 'brewing' && state.resources.research < 10) {
      return false;
    }
    const cost = getCardCost(state, card);
    return (
      state.resources.money >= cost.money &&
      state.resources.materials >= cost.materials &&
      state.resources.energy >= cost.energy &&
      state.resources.research >= cost.research
    );
  }

  function payCost(state, card) {
    const cost = getCardCost(state, card);
    modifyResource(state, 'money', -cost.money);
    modifyResource(state, 'materials', -cost.materials);
    modifyResource(state, 'energy', -cost.energy);
    modifyResource(state, 'research', -cost.research);
  }

  // ==================== CARD DRAW ====================

  // M4: draw-without-replacement from state.drawPile (shuffled card ids).
  // Empty draw pile reshuffles the discard pile (Fisher-Yates via the injectable
  // rng, same formula as state.js); both piles empty => nothing to draw.
  function drawCard(state) {
    if (state.hand.length >= state.handLimit) {
      log('log.hand_full');
      return;
    }
    if (state.drawPile.length === 0) {
      if (state.discardPile.length === 0) {
        log('log.deck_empty');
        return;
      }
      state.drawPile = state.discardPile;
      state.discardPile = [];
      for (let i = state.drawPile.length - 1; i > 0; i--) {
        const j = Math.floor(engine.rng() * (i + 1));
        const tmp = state.drawPile[i]; state.drawPile[i] = state.drawPile[j]; state.drawPile[j] = tmp;
      }
    }
    const id = state.drawPile.pop();
    const card = CR.data.CARD_DATABASE.find(c => c.id === id);
    state.hand.push({ ...card, uid: state.nextCardUid++ });
  }

  function drawInitialCards(state) {
    while (state.hand.length < state.initialHandSize) drawCard(state);
  }

  // ==================== GAME END ====================

  function checkVictory(state) {
    return state.purification >= 100 && state.habitats >= state.targetHabitats;
  }

  function endGame(state, reason) {
    if (state.gameOver) return;
    state.gameOver = true;
    state.phase = 'ended';
    if (reason === 'timeout') {
      state.gameResult = checkVictory(state) ? 'victory' : 'defeat';
    } else {
      state.gameResult = reason; // 'crash' | 'victory'
    }
    state.contribution =
      state.habitats * 20 +
      Math.floor(state.purification) +
      Math.floor(state.resources.money / 5) +
      state.prestige;
    log('log.game_over', { result: state.gameResult });
  }

  // ==================== CARD PLAY ====================

  // Shared by contract/permanent habitat effects and the Build Habitat button (spec 3.1: one shared limit of 5)
  function expandHabitat(state) {
    if (state.habitatExpansions >= state.maxHabitatExpansions) {
      log('log.habitat_limit', { max: state.maxHabitatExpansions });
      return false;
    }
    state.habitats++;
    state.habitatExpansions++;
    log('log.habitat_expanded', { habitats: state.habitats });
    return true;
  }

  // The UI uses these helpers for feedback, but the engine owns the actual
  // per-turn budget so repeated calls cannot bypass the rule.
  function getCardPlayLimit(state) {
    return state.maxCardsPerTurn + (state.extraCardPlayed ? 1 : 0);
  }

  function getRemainingCardPlays(state) {
    return Math.max(0, getCardPlayLimit(state) - state.cardsPlayedThisTurn);
  }

  function playSelectedCards(state) {
    if (state.phase !== 'action') return { ok: false, reason: 'fail.not_action_phase' };
    if (state.strike) return { ok: false, reason: 'fail.strike_cards' };
    if (state.selectedCards.length === 0) return { ok: false, reason: 'fail.no_selection' };

    // De-duplicate and validate indices before removing cards. Descending order
    // keeps later splices from changing the remaining selected indices.
    const sorted = [...new Set(state.selectedCards)]
      .filter(index => Number.isInteger(index) && index >= 0 && index < state.hand.length)
      .sort((a, b) => b - a);
    if (sorted.length === 0) {
      state.selectedCards = [];
      return { ok: false, reason: 'fail.no_selection' };
    }
    if (sorted.length > getRemainingCardPlays(state)) {
      return { ok: false, reason: 'fail.card_limit', reasonParams: { max: getCardPlayLimit(state) } };
    }

    sorted.forEach(index => {
      const card = state.hand[index];
      if (!card || !canAfford(state, card)) {
        if (card) log('log.cannot_afford', { card: card.name, cardId: card.id });
        return;
      }
      payCost(state, card);

      if (card.type === 'permanent') {
        state.permanentCards.push(card);
        applyPermanentEffect(state, card);
        log('log.played_permanent', { card: card.name, cardId: card.id });
      } else {
        applyContractEffect(state, card);
        state.discardPile.push(card.id); // M4: contracts go to the discard pile; permanents never do (installed)
        log('log.played_contract', { card: card.name, cardId: card.id });
      }

      state.hand.splice(index, 1);
      state.cardsPlayedThisTurn++;
    });

    state.selectedCards = [];

    if (checkVictory(state)) {
      endGame(state, 'victory');
      return { ok: true };
    }
    return { ok: true };
  }

  function applyContractEffect(state, card) {
    const ve = card.venusEffect || {};

    if (card.risk) {
      // Card 8 Rare Metal Futures: 40% chance the deal fails, -10 Funds instead of +10 (spec 3.6)
      if (engine.rng() < 0.4) {
        modifyResource(state, 'money', -10);
        log('log.risk_failed', { card: card.name, cardId: card.id });
      } else {
        applyResourceEffect(state, ve);
      }
    } else if (card.delay) {
      // Card 2 Asteroid Mining Economy: permanent income after `delay` full settlements (spec 3.2)
      state.delayedEffects.push({ name: card.name, cardId: card.id, turnsLeft: card.delay, income: { ...ve } });
      log('log.delayed_started', { card: card.name, cardId: card.id, amount: ve.money, turns: card.delay });
    } else if (card.duration) {
      // Card 24 Trade Agreement: income for exactly `duration` settlements (spec 3.2)
      state.timedEffects.push({ name: card.name, cardId: card.id, turnsLeft: card.duration, income: { ...ve } });
      log('log.timed_started', { card: card.name, cardId: card.id, money: ve.money, materials: ve.materials, energy: ve.energy, turns: card.duration });
    } else {
      applyResourceEffect(state, ve);
    }

    if (ve.habitat && !card.delay && !card.duration) {
      expandHabitat(state);
    }

    if (card.special === 'extraCard') {
      state.extraCardPlayed = true;
      log('log.extra_card');
    }
    if (card.special === 'steal') {
      modifyResource(state, 'money', 5);
      log('log.steal');
    }
  }

  // Cards 1 / 7 / 42: multiplicative transport (money-cost) discount, coefficient floor 0.4 (spec 3.3)
  const TRANSPORT_DISCOUNT_BY_CARD_ID = { 1: 0.5, 7: 0.8, 42: 0.6 };

  function applyPermanentEffect(state, card) {
    const ve = card.venusEffect || {};
    if (ve.money) log('log.output_money', { amount: ve.money });
    if (ve.materials) log('log.output_materials', { amount: ve.materials });
    if (ve.energy) log('log.output_energy', { amount: ve.energy });
    if (ve.research) log('log.output_research', { amount: ve.research });
    if (ve.morale) log('log.output_morale', { amount: ve.morale });
    if (ve.purification) log('log.output_purification', { amount: ve.purification });
    if (ve.corrosion) {
      state.corrosionRate += ve.corrosion;
      log('log.corrosion_changed', { amount: (ve.corrosion > 0 ? '+' : '') + ve.corrosion });
    }
    if (ve.habitat) {
      expandHabitat(state);
    }

    if (TRANSPORT_DISCOUNT_BY_CARD_ID[card.id]) {
      state.transportDiscount = Math.max(0.4, state.transportDiscount * TRANSPORT_DISCOUNT_BY_CARD_ID[card.id]);
      log('log.transport_discount', { coefficient: state.transportDiscount.toFixed(2) });
    }

    // spec 3.4: repair modifiers
    if (card.id === 17) {
      state.repairCostMultiplier *= 0.75;
      log('log.repair_cheaper');
    }
    if (card.id === 45) {
      state.repairEfficiency = 2;
      log('log.repair_efficient');
    }

    if (card.special === 'moraleFloor') {
      state.moraleFloor = 40;
      log('log.morale_floor');
    }
    if (card.special === 'insurance') {
      state.insurance = true;
      log('log.insurance_active');
    }
    if (card.special === 'stormShield') {
      state.stormShield = true;
      log('log.storm_shield_active');
    }
    if (card.special === 'noMoraleDecay') {
      state.noMoraleDecay = true;
      log('log.no_morale_decay');
    }
    if (card.special === 'prestige') state.prestige += 15;
    if (card.special === 'charter') {
      state.hasCharter = true;
      log('log.charter');
    }
    if (card.special === 'megastructure') state.prestige += 25;
    if (card.special === 'ultimate') {
      state.ultimate = true;
      state.prestige += 30;
      log('log.ultimate_ready');
    }
    if (card.special === 'shield') {
      state.shieldActive = true;
      log('log.shield_ready');
    }
  }

  // ==================== TURN SYSTEM ====================

  function startNewTurn(state) {
    if (state.gameOver) return;

    state.turn++;

    if (state.turn > state.maxTurns) {
      endGame(state, 'timeout');
      return;
    }

    state.phase = 'event';
    state.cardsPlayedThisTurn = 0;
    state.selectedCards = [];
    state.extraCardPlayed = false;
    state.eventTriggered = false;
    state.strike = false;

    log('log.turn_begin', { turn: state.turn, max: state.maxTurns });
  }

  // Returns the rolled event (ui shows it in a modal), or null when neutralized.
  function triggerEventPhase(state) {
    if (state.gameOver) return null;

    // Card 27 Space Court: blocks this turn's event entirely (spec 3.6)
    if (state.shieldActive) {
      state.shieldActive = false;
      state.pendingEvent = null;
      log('log.shield_block');
      return null;
    }

    const roll = Math.floor(engine.rng() * 20) + 1;
    const event = CR.data.EVENTS.find(e => e.id === roll) || CR.data.EVENTS[0];

    // Card 53 Space Radiation Medicine: Solar Storm (event id 2) fully neutralized (spec 3.6)
    if (event.id === 2 && state.stormShield) {
      state.pendingEvent = null;
      log('log.storm_shield_block');
      return null;
    }

    state.pendingEvent = event;
    return event;
  }

  // Applies state.pendingEvent (called by ui after the player dismisses the modal), then opens the Action Phase.
  function applyEvent(state) {
    if (state.gameOver) return;
    const event = state.pendingEvent;
    if (event) {
      log('log.event_applied', { turn: state.turn, event: event.name, eventId: event.id });
      applyResourceEffect(state, event.effect);
      if (event.effect.strike) {
        state.strike = true;
        log('log.strike');
      }
      state.pendingEvent = null;
    }
    state.phase = 'action';
  }

  // ==================== ACTION BUTTONS ====================

  // spec 3.4: cost = round(2 x repairCostMultiplier) materials; card 45 -> +2% integrity per repair
  function repairHabitat(state) {
    if (state.phase !== 'action') return { ok: false, reason: 'fail.not_action_phase' };

    const cost = Math.max(1, Math.round(2 * state.repairCostMultiplier));
    if (state.resources.materials < cost) {
      return { ok: false, reason: 'fail.no_materials_repair' };
    }

    modifyResource(state, 'materials', -cost);
    modifyResource(state, 'integrity', state.repairEfficiency);
    log('log.repaired', { cost, amount: state.repairEfficiency });
    return { ok: true };
  }

  // spec 3.1 + 3.8: 20 Funds + 12 Materials, +1 habitat, shares the maxHabitatExpansions (5) limit
  // M2: habitatMaterialsDelta (covenant) raises the materials cost (12 + delta)
  function buildHabitat(state) {
    if (state.phase !== 'action') return { ok: false, reason: 'fail.not_action_phase' };
    if (state.strike) return { ok: false, reason: 'fail.strike_build' };
    if (state.habitatExpansions >= state.maxHabitatExpansions) {
      return { ok: false, reason: 'fail.habitat_limit', reasonParams: { max: state.maxHabitatExpansions } };
    }
    const materialsCost = 12 + (state.habitatMaterialsDelta || 0);
    if (state.resources.money < 20 || state.resources.materials < materialsCost) {
      return { ok: false, reason: 'fail.build_cost' };
    }

    modifyResource(state, 'money', -20);
    modifyResource(state, 'materials', -materialsCost);
    state.habitats++;
    state.habitatExpansions++;
    log('log.habitat_built', { habitats: state.habitats, used: state.habitatExpansions, max: state.maxHabitatExpansions });

    if (checkVictory(state)) endGame(state, 'victory');
    return { ok: true };
  }

  // ==================== SETTLEMENT ====================

  function endTurn(state) {
    if (state.phase !== 'action') return { ok: false, reason: 'fail.not_action_phase' };

    state.phase = 'settlement';
    log('log.settlement_begin');

    // 1. Permanent card outputs + matured delayed income (ve.purification included, spec 3.7)
    let income = { money: 0, materials: 0, energy: 0, research: 0, morale: 0, purification: 0 };

    state.permanentCards.forEach(card => {
      const ve = card.venusEffect || {};
      if (ve.money) income.money += ve.money;
      if (ve.materials) income.materials += ve.materials;
      if (ve.energy) income.energy += ve.energy;
      if (ve.research) income.research += ve.research;
      if (ve.morale) income.morale += ve.morale;
      if (ve.purification) income.purification += ve.purification;
    });
    ['money', 'materials', 'energy', 'research', 'morale'].forEach(k => {
      income[k] += state.maturedIncome[k];
    });

    if (income.money || income.materials || income.energy || income.research || income.morale || income.purification) {
      log('log.income_summary', income);
    }

    if (income.money) modifyResource(state, 'money', Math.round(income.money * state.moneyMultiplier));
    if (income.materials) modifyResource(state, 'materials', income.materials);
    if (income.energy) modifyResource(state, 'energy', income.energy);
    if (income.research) modifyResource(state, 'research', income.research);
    if (income.morale) modifyResource(state, 'morale', income.morale);
    // M2: researchIncome (technocracy) — flat +N research per settlement
    if (state.researchIncome) modifyResource(state, 'research', state.researchIncome);
    if (income.purification) {
      state.purification = Math.min(100, state.purification + income.purification);
      log('log.purification_income', { amount: income.purification, total: state.purification.toFixed(1) });
    }

    // 2. Timed effects (e.g. card 24): apply income, count down, remove expired
    state.timedEffects = state.timedEffects.filter(te => {
      applyResourceEffect(state, te.income);
      te.turnsLeft--;
      if (te.turnsLeft > 0) log('log.timed_remaining', { name: te.name, cardId: te.cardId, turns: te.turnsLeft });
      else log('log.timed_expired', { name: te.name, cardId: te.cardId });
      return te.turnsLeft > 0;
    });

    // 3. Delayed effects (e.g. card 2): count down, mature into permanent income
    state.delayedEffects = state.delayedEffects.filter(de => {
      de.turnsLeft--;
      if (de.turnsLeft <= 0) {
        ['money', 'materials', 'energy', 'research', 'morale'].forEach(k => {
          if (de.income[k]) state.maturedIncome[k] += de.income[k];
        });
        log('log.delayed_matured', { name: de.name, cardId: de.cardId });
        return false;
      }
      log('log.delayed_countdown', { name: de.name, cardId: de.cardId, turns: de.turnsLeft });
      return true;
    });

    // 4. Energy maintenance (per-difficulty)
    modifyResource(state, 'energy', -state.energyMaintenance);
    log('log.maintenance', { amount: -state.energyMaintenance });

    // 5. Corrosion (may trigger insurance / ultimate / crash inside modifyResource)
    modifyResource(state, 'integrity', -state.corrosionRate);
    log('log.corrosion', { amount: -state.corrosionRate });
    if (state.gameOver) return { ok: true };

    // 6. Morale decay (floor already enforced inside modifyResource, spec 3.6)
    // M2: moraleDecayDelta (technocracy) raises the per-turn decay (1 + delta)
    if (!state.noMoraleDecay) {
      const decay = 1 + (state.moraleDecayDelta || 0);
      modifyResource(state, 'morale', -decay);
      log('log.morale_decay', { amount: -decay });
    }
    if (state.resources.morale < 30) {
      log('log.low_morale');
    }

    // 7. Draw cards (per-difficulty drawPerTurn; hand cap = state.handLimit)
    for (let i = 0; i < state.drawPerTurn; i++) drawCard(state);

    if (checkVictory(state)) {
      endGame(state, 'victory');
      return { ok: true };
    }

    log('log.turn_complete', { turn: state.turn });
    return { ok: true };
  }

  // ==================== TECH TREE (M5) ====================

  // spec §2.2: in-run tech unlock. Validates node exists / not yet unlocked /
  // branch prerequisite tier unlocked / research covers the cost, then deducts
  // the cost, records the node and applies its effect onto the EXISTING state
  // modifier field named by the node descriptor (floors per descriptor). No new
  // consumption points — those fields are already read by applyResourceEffect /
  // endTurn / getCardCost / buildHabitat / drawCard.
  function unlockTech(state, nodeId) {
    if (state.gameOver || state.phase !== 'action') return { ok: false, reason: 'fail.not_action_phase' };
    const node = CR.data.TECH_TREE[nodeId];
    if (!node) return { ok: false, reason: 'fail.tech_unknown' };
    if (state.techs.indexOf(nodeId) !== -1) return { ok: false, reason: 'fail.tech_unlocked' };
    if (node.tier > 1 && state.techs.indexOf(node.branch + '_' + (node.tier - 1)) === -1) {
      return { ok: false, reason: 'fail.tech_prereq' };
    }
    if (state.resources.research < node.cost) return { ok: false, reason: 'fail.tech_research' };
    modifyResource(state, 'research', -node.cost);
    state.techs.push(nodeId);
    const fx = node.effect;
    if (fx.mode === 'multiply') {
      state[fx.field] = Math.max(fx.floor, state[fx.field] * fx.value);
    } else {
      state[fx.field] = fx.floor !== undefined
        ? Math.max(fx.floor, state[fx.field] + fx.value)
        : state[fx.field] + fx.value;
    }
    log('log.tech_unlocked', { techId: nodeId });
    return { ok: true };
  }

  // ==================== EXPORTS ====================
  engine.modifyResource = modifyResource;
  engine.applyResourceEffect = applyResourceEffect;
  engine.getMaturityMultiplier = getMaturityMultiplier;
  engine.getCardCost = getCardCost;
  engine.canAfford = canAfford;
  engine.payCost = payCost;
  engine.drawCard = drawCard;
  engine.drawInitialCards = drawInitialCards;
  engine.checkVictory = checkVictory;
  engine.endGame = endGame;
  engine.getCardPlayLimit = getCardPlayLimit;
  engine.getRemainingCardPlays = getRemainingCardPlays;
  engine.playSelectedCards = playSelectedCards;
  engine.applyContractEffect = applyContractEffect;
  engine.applyPermanentEffect = applyPermanentEffect;
  engine.startNewTurn = startNewTurn;
  engine.triggerEventPhase = triggerEventPhase;
  engine.applyEvent = applyEvent;
  engine.repairHabitat = repairHabitat;
  engine.buildHabitat = buildHabitat;
  engine.endTurn = endTurn;
  engine.unlockTech = unlockTech;

  CR.engine = engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = engine;
})(typeof window !== 'undefined' ? window : globalThis);
