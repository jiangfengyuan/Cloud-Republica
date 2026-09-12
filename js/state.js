// state.js — initial game state factory (difficulty + faction + meta-perk aware). No logic, no DOM.
(function (root) {
  const CR = root.CR = root.CR || {};

  // M4: deck assembly — 'full' (whole CARD_DATABASE x1) or a sanitized custom
  // card-count map. Illegal entries are dropped one by one (unknown id, copies
  // not an integer within 1..DECK_RULES.maxCopies); if the cleaned deck falls
  // outside the size bounds the whole config falls back to 'full'.
  function buildDeckList(deckConfig) {
    const R = CR.data.DECK_RULES;
    const cfg = deckConfig || {};
    if (cfg.deckId === 'custom' && cfg.cards && typeof cfg.cards === 'object') {
      const list = [];
      Object.keys(cfg.cards).forEach(idKey => {
        const id = Number(idKey);
        const copies = cfg.cards[idKey];
        if (!CR.data.CARD_DATABASE.some(c => c.id === id)) return;
        if (!Number.isInteger(copies) || copies < 1 || copies > R.maxCopies) return; // entry dropped
        for (let i = 0; i < copies; i++) list.push(id);
      });
      if (list.length >= R.minSize && list.length <= R.maxSize) {
        return { deckId: 'custom', list };
      }
    }
    return { deckId: 'full', list: CR.data.CARD_DATABASE.map(c => c.id) };
  }

  // Fisher-Yates via the injectable engine rng (same formula as engine's reshuffle).
  function shuffleIds(list, rng) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // Baseline path (faction 'none' / missing, no meta perks) expands to the exact
  // pre-M2 values: every new modifier defaults to its identity value (x1 / +0).
  function createInitialState(difficultyKey, factionId, metaPerks, sandboxConfig, deckConfig, rng) {
    const levels = CR.data.DIFFICULTY_LEVELS;
    const key = (difficultyKey && levels[difficultyKey]) ? difficultyKey : 'medium';
    const diff = levels[key];
    const factions = CR.data.FACTIONS || {};
    const factionKey = (factionId && factions[factionId]) ? factionId : 'none';
    const faction = factions[factionKey] || {};
    const perks = CR.data.META_PERKS || {};
    const perkLevels = metaPerks || {};
    const guaranteed = diff.guaranteedCards || [];

    const resources = { ...diff.resources };
    let corrosionRate = diff.corrosionRate;
    let energyMaintenance = diff.energyMaintenance;
    let initialHandSize = diff.initialHandSize;
    let maxTurns = diff.maxTurns;
    let drawPerTurn = diff.drawPerTurn;

    // M3: sandbox overrides — only when difficulty is 'sandbox'; the 4th arg is
    // ignored for every other difficulty (baseline-path protection). Each field is
    // clamped to SANDBOX_LIMITS and snapped to its step grid; resourcePreset scales
    // the (medium) base resources before faction/meta stacking, per M2 order:
    // difficulty base -> sandbox override -> faction -> perks.
    let sandboxSnapshot = null;
    if (key === 'sandbox') {
      const L = CR.data.SANDBOX_LIMITS;
      const cfg = sandboxConfig || {};
      const num = k => {
        const lim = L[k];
        let v = (typeof cfg[k] === 'number' && isFinite(cfg[k])) ? cfg[k] : lim.def;
        v = Math.min(lim.max, Math.max(lim.min, v));
        v = lim.min + Math.round((v - lim.min) / lim.step) * lim.step;
        return Math.round(v * 100) / 100; // 0.5-step float hygiene
      };
      maxTurns = num('maxTurns');
      corrosionRate = num('corrosionRate');
      energyMaintenance = num('energyMaintenance');
      drawPerTurn = num('drawPerTurn');
      initialHandSize = num('initialHandSize');
      const preset = L.resourcePreset.options.indexOf(cfg.resourcePreset) !== -1 ? cfg.resourcePreset : L.resourcePreset.def;
      const scale = L.resourcePreset.scale[preset];
      ['money', 'materials', 'energy', 'research', 'morale'].forEach(k => {
        resources[k] = Math.round(resources[k] * scale);
      });
      sandboxSnapshot = { maxTurns, corrosionRate, energyMaintenance, drawPerTurn, initialHandSize, resourcePreset: preset };
    }

    // faction startResources (deltas, clamped at 0)
    const start = faction.startResources || {};
    ['money', 'materials', 'energy', 'research', 'morale'].forEach(k => {
      if (start[k]) resources[k] = Math.max(0, resources[k] + start[k]);
    });
    // faction corrosion delta (floor 1.0, spec §2.2)
    if (faction.corrosionDelta) corrosionRate = Math.max(1.0, corrosionRate + faction.corrosionDelta);

    // meta perks (levels clamped to each perk's max; unknown perk ids ignored)
    Object.keys(perks).forEach(id => {
      const def = perks[id];
      let lv = Math.floor(perkLevels[id] || 0);
      if (!(lv > 0)) return;
      lv = Math.min(lv, def.max);
      if (def.startResources) {
        ['money', 'materials', 'energy', 'research', 'morale'].forEach(k => {
          if (def.startResources[k]) resources[k] = Math.max(0, resources[k] + def.startResources[k] * lv);
        });
      }
      if (def.corrosionDelta) corrosionRate = Math.max(1.0, corrosionRate + def.corrosionDelta * lv);
      if (def.energyMaintenanceDelta) energyMaintenance = Math.max(2, energyMaintenance + def.energyMaintenanceDelta * lv);
      if (def.initialHandSizeDelta) initialHandSize += def.initialHandSizeDelta * lv;
    });

    // M4: build + shuffle the deck, then pre-deal guaranteedCards "taken from the
    // deck" — only when the deck actually contains the card (that copy leaves the
    // draw pile, so it can never be drawn a second time beyond deck contents).
    const deck = buildDeckList(deckConfig);
    const deckRng = rng || (CR.engine && CR.engine.rng) || Math.random;
    const drawPile = shuffleIds(deck.list, deckRng);
    const openingHand = [];
    guaranteed.forEach(id => {
      const idx = drawPile.indexOf(id);
      if (idx === -1) return; // custom deck without this card: no guaranteed pre-deal
      drawPile.splice(idx, 1);
      openingHand.push({ ...CR.data.CARD_DATABASE.find(c => c.id === id), uid: openingHand.length + 1 });
    });

    return {
      difficulty: key,
      faction: factionKey,
      turn: 0,
      maxTurns,
      phase: 'setup',              // 'setup' | 'event' | 'action' | 'settlement' | 'ended'
      purification: 0,
      targetPurification: 100,
      habitats: 1,
      targetHabitats: 6,
      corrosionRate,
      energyMaintenance,
      handLimit: diff.handLimit,
      drawPerTurn,
      initialHandSize,
      resources,
      sandboxConfig: sandboxSnapshot, // M3: clamped snapshot for end screen / logs (null outside sandbox)
      deckId: deck.deckId,           // M4: 'full' | 'custom'
      deckSize: deck.list.length,    // M4: total cards in the deck (for the end screen)
      drawPile,                      // M4: shuffled card ids, drawn from the end
      discardPile: [],               // M4: played contract card ids (reshuffled on empty)
      techs: [],                     // M5: unlocked tech node ids (in-run only, no persistence)
      hand: openingHand,
      permanentCards: [],
      selectedCards: [],
      cardsPlayedThisTurn: 0,
      maxCardsPerTurn: 3,          // spec §3: was 2
      gameOver: false,
      gameResult: null,            // null | 'victory' | 'defeat' | 'crash'
      contribution: 0,
      eventTriggered: false,
      extraCardPlayed: false,
      habitatExpansions: 0,
      maxHabitatExpansions: 5,
      prestige: 0,
      hasCharter: false,
      noMoraleDecay: false,
      moraleFloor: 0,
      insurance: false,
      ultimate: false,
      stormShield: false,
      shieldActive: false,
      repairEfficiency: 1,
      repairCostMultiplier: 1,
      transportDiscount: faction.transportDiscount || 1,
      moneyMultiplier: faction.moneyMultiplier || 1,
      purificationMultiplier: faction.purificationMultiplier || 1,
      habitatMaterialsDelta: faction.habitatMaterialsDelta || 0,
      researchIncome: faction.researchIncome || 0,
      researchCostMultiplier: faction.researchCostMultiplier || 1,
      moraleDecayDelta: faction.moraleDecayDelta || 0,
      timedEffects: [],
      delayedEffects: [],
      maturedIncome: { money: 0, materials: 0, energy: 0, research: 0, morale: 0 },
      pendingEvent: null,
      strike: false,
      nextCardUid: openingHand.length + 1
    };
  }

  CR.state = { createInitialState };
  if (typeof module !== 'undefined' && module.exports) module.exports = CR.state;
})(typeof window !== 'undefined' ? window : globalThis);
