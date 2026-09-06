// Versioned browser persistence. Unavailable storage falls back to memory.
(function(root) {
  const CR = root.CR;
  const memory = new Map();
  const storage = {
    getItem(key) {
      if (memory.has(key)) return memory.get(key);
      try { return root.localStorage ? root.localStorage.getItem(key) : null; } catch (_) { return null; }
    },
    setItem(key, value) {
      memory.set(key, String(value));
      try {
        if (root.localStorage) {
          root.localStorage.setItem(key, String(value));
          memory.delete(key);
        }
      } catch (_) { /* session-only fallback */ }
    }
  };
  CR.storage = storage;
  const SANDBOX_PARAM_KEYS = ['maxTurns', 'corrosionRate', 'energyMaintenance', 'drawPerTurn', 'initialHandSize'];
  function defaultStats() {
    return {
      v: 2, games: 0,
      wins: { easy: 0, medium: 0, hard: 0, sandbox: 0 },
      bestContribution: 0, bestPurification: 0,
      factions: {
        none: { games: 0, wins: 0 }, guild: { games: 0, wins: 0 },
        covenant: { games: 0, wins: 0 }, technocracy: { games: 0, wins: 0 }
      }
    };
  }

  function loadStats() {
    try {
      const raw = CR.storage.getItem('cr_stats');
      if (raw) {
        const s = JSON.parse(raw);
        if (s && (s.v === 1 || s.v === 2) && s.wins) {
          // M2: v1 -> v2 migration — keep old fields, add per-faction counters
          const merged = Object.assign(defaultStats(), s, { v: 2 });
          merged.wins = Object.assign(defaultStats().wins, s.wins);
          merged.factions = Object.assign(defaultStats().factions, s.factions || {});
          return merged;
        }
      }
    } catch (e) { /* private mode etc. */ }
    return defaultStats();
  }

  function defaultMeta() {
    return { v: 1, legacy: 0, lifetime: 0, perks: { fund: 0, supplies: 0, lab: 0, coating: 0, grid: 0, handbook: 0 } };
  }

  function loadMeta() {
    try {
      const raw = CR.storage.getItem('cr_meta');
      if (raw) {
        const m = JSON.parse(raw);
        if (m && m.v === 1 && m.perks) {
          const base = defaultMeta();
          base.legacy = Math.max(0, Math.floor(m.legacy || 0));
          base.lifetime = Math.max(0, Math.floor(m.lifetime || 0));
          Object.keys(base.perks).forEach(id => {
            base.perks[id] = Math.min(CR.data.META_PERKS[id].max, Math.max(0, Math.floor(m.perks[id] || 0)));
          });
          return base;
        }
      }
    } catch (e) { /* private mode etc. */ }
    return defaultMeta();
  }

  function defaultSandbox() {
    const L = CR.data.SANDBOX_LIMITS;
    return {
      v: 1,
      maxTurns: L.maxTurns.def,
      corrosionRate: L.corrosionRate.def,
      energyMaintenance: L.energyMaintenance.def,
      drawPerTurn: L.drawPerTurn.def,
      initialHandSize: L.initialHandSize.def,
      resourcePreset: L.resourcePreset.def
    };
  }

  // clamp + step-snap one config object against SANDBOX_LIMITS (same rule as state.js)
  function sanitizeSandbox(cfg) {
    const L = CR.data.SANDBOX_LIMITS;
    const clean = defaultSandbox();
    if (!cfg || typeof cfg !== 'object') return clean;
    SANDBOX_PARAM_KEYS.forEach(k => {
      const lim = L[k];
      let v = (typeof cfg[k] === 'number' && isFinite(cfg[k])) ? cfg[k] : lim.def;
      v = Math.min(lim.max, Math.max(lim.min, v));
      v = lim.min + Math.round((v - lim.min) / lim.step) * lim.step;
      clean[k] = Math.round(v * 100) / 100;
    });
    if (L.resourcePreset.options.indexOf(cfg.resourcePreset) !== -1) clean.resourcePreset = cfg.resourcePreset;
    return clean;
  }

  function loadSandbox() {
    try {
      const raw = CR.storage.getItem('cr_sandbox');
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.v === 1) return sanitizeSandbox(s);
      }
    } catch (e) { /* private mode etc. */ }
    return defaultSandbox();
  }

  function defaultDeck() {
    return { v: 1, deckId: 'full', cards: {} };
  }

  // Same cleaning rule as state.js buildDeckList: drop unknown ids and entries
  // whose copies fall outside 1..DECK_RULES.maxCopies; if the cleaned size lands
  // outside the bounds, the whole config falls back to 'full'.
  function sanitizeDeck(raw) {
    const R = CR.data.DECK_RULES;
    if (!raw || typeof raw !== 'object' || raw.v !== 1) return defaultDeck();
    if (raw.deckId !== 'custom' || !raw.cards || typeof raw.cards !== 'object') return defaultDeck();
    const cards = {};
    let size = 0;
    Object.keys(raw.cards).forEach(idKey => {
      const id = Number(idKey);
      const copies = raw.cards[idKey];
      if (!CR.data.CARD_DATABASE.some(c => c.id === id)) return;
      if (!Number.isInteger(copies) || copies < 1 || copies > R.maxCopies) return;
      cards[id] = copies;
      size += copies;
    });
    if (size < R.minSize || size > R.maxSize) return defaultDeck();
    return { v: 1, deckId: 'custom', cards };
  }

  function loadDeck() {
    try {
      const raw = CR.storage.getItem('cr_deck');
      if (raw) return sanitizeDeck(JSON.parse(raw));
    } catch (e) { /* private mode etc. */ }
    return defaultDeck();
  }


  Object.assign(storage, { loadStats, loadMeta, loadSandbox, sanitizeSandbox, loadDeck, defaultDeck });
  if (typeof module !== 'undefined' && module.exports) module.exports = storage;
})(typeof window !== 'undefined' ? window : globalThis);
