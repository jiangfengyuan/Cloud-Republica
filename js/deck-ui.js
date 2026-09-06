// deck-ui: feature controller with explicit dependencies.
(function (root) {
  const CR = root.CR;
  CR.features = CR.features || {};
  CR.features['deck-ui'] = function (deps) {
    const { actions, t, icon } = deps;
    const { loadDeck, defaultDeck } = CR.storage;
    let deck = null;
    const { cardName } = deps;
  // ==================== DECK BUILDING (cr_deck v1, M4) ====================

  const DECK_CATEGORY_ORDER = ['economy', 'environment', 'governance', 'social', 'tech', 'wellbeing', 'venus'];
  const DECK_CATEGORY_COLORS = { // same palette as the .cat-* card borders
    economy: '#FFCD70', environment: '#A7F3D0', governance: '#A78BFA',
    social: '#E2E6F0', tech: '#7EA6FF', wellbeing: '#CBD5E1', venus: '#FF9B06'
  };

  function saveDeck() {
    try { CR.storage.setItem('cr_deck', JSON.stringify(deck)); } catch (e) { /* ignore */ }
  }

  function deckEntries() { // [{card, copies}] in card-id order, from the CURRENT deck
    if (deck.deckId !== 'custom') return CR.data.CARD_DATABASE.map(card => ({ card, copies: 1 }));
    return Object.keys(deck.cards)
      .map(id => ({ card: CR.data.CARD_DATABASE.find(c => c.id === Number(id)), copies: deck.cards[id] }))
      .filter(e => e.card)
      .sort((a, b) => a.card.id - b.card.id);
  }

  function deckSize() {
    return deckEntries().reduce((n, e) => n + e.copies, 0);
  }

  function updateDeckButton() {
    const el = document.getElementById('deckBtnText');
    if (!el) return;
    const name = t(deck.deckId === 'custom' ? 'deck.custom_name' : 'deck.full_name');
    el.textContent = t('deck.btn_label', { name, count: deckSize() });
  }

  // Editing is copy-on-write: the first edit of the 'full' deck forks it into a
  // custom working copy (66x1), which can then be trimmed into the 20-40 window.
  function ensureCustomDeck() {
    if (deck.deckId === 'custom') return;
    const cards = {};
    CR.data.CARD_DATABASE.forEach(c => { cards[c.id] = 1; });
    deck = { v: 1, deckId: 'custom', cards };
  }

  function renderDeckScreen() {
    const R = CR.data.DECK_RULES;
    const screen = document.getElementById('deckScreen');
    const entries = deckEntries();
    const size = entries.reduce((n, e) => n + e.copies, 0);
    const copiesOf = {};
    entries.forEach(e => { copiesOf[e.card.id] = e.copies; });

    const poolHtml = DECK_CATEGORY_ORDER.map(cat => {
      const rows = CR.data.CARD_DATABASE.filter(c => c.category === cat).map(card => {
        const copies = copiesOf[card.id] || 0;
        const dots = Array.from({ length: R.maxCopies }, (_, i) =>
          `<span class="deck-copy-dot${i < copies ? ' filled' : ''}"></span>`).join('');
        const addDisabled = copies >= R.maxCopies || size >= R.maxSize;
        const removeDisabled = copies <= 0;
        return `<div class="deck-row">
          <span class="deck-row-name">${cardName(card)}</span>
          <span class="deck-row-meta">${t('type.' + card.type)}</span>
          <span class="deck-copies">${dots}</span>
          <button class="btn btn-secondary deck-step-btn" ${removeDisabled ? 'disabled' : ''} data-action="deckRemoveCard" data-args="[${card.id}]">-</button>
          <button class="btn btn-secondary deck-step-btn" ${addDisabled ? 'disabled' : ''} data-action="deckAddCard" data-args="[${card.id}]">+</button>
        </div>`;
      }).join('');
      return `<div class="deck-pool-title">${t('category.' + cat)}</div>${rows}`;
    }).join('');

    const distTotal = Math.max(1, size);
    const distHtml = DECK_CATEGORY_ORDER.map(cat => {
      const n = entries.filter(e => e.card.category === cat).reduce((s, e) => s + e.copies, 0);
      if (!n) return '';
      return `<div class="deck-dist-seg" style="width: ${(n / distTotal * 100).toFixed(1)}%; background: ${DECK_CATEGORY_COLORS[cat]};" title="${t('category.' + cat)} ${n}"></div>`;
    }).join('');

    const listHtml = size === 0
      ? `<div class="deck-hint">${t('deck.empty_list')}</div>`
      : entries.map(e =>
        `<div class="deck-list-row"><span>${cardName(e.card)}</span><span class="deck-row-meta">x${e.copies}</span></div>`).join('');

    let warn = '';
    if (size < R.minSize) warn = t('deck.too_few', { min: R.minSize, count: size });
    else if (size > R.maxSize) warn = t('deck.too_many', { max: R.maxSize, count: size });
    const doneDisabled = size < R.minSize || size > R.maxSize;

    screen.innerHTML = `
      <div class="deck-editor">
        <div class="deck-pool">
          <div class="deck-heading">${icon('panel.deck')} ${t('deck.title')} — ${t('deck.pool')}</div>
          <div class="deck-hint">${t('deck.copies_hint', { max: R.maxCopies, min: R.minSize })}</div>
          ${poolHtml}
        </div>
        <div class="deck-summary">
          <div class="deck-heading">${t('deck.current')} · ${t('deck.count', { count: size, max: R.maxSize })}</div>
          <div class="deck-hint">${t('deck.distribution')}</div>
          <div class="deck-dist">${distHtml}</div>
          ${warn ? `<div class="deck-warn">${warn}</div>` : ''}
          ${listHtml}
          <div class="deck-actions">
            <button class="btn btn-secondary" data-action="deckClear" data-args="[]">${t('deck.clear')}</button>
            <button class="btn btn-secondary" data-action="deckResetFull" data-args="[]">${t('deck.reset_full')}</button>
            <button class="btn btn-success" ${doneDisabled ? 'disabled' : ''} data-action="closeDeckScreen" data-args="[]">${t('deck.done')}</button>
          </div>
        </div>
      </div>`;
  }

  actions.openDeckScreen = function () {
    if (!deck) deck = loadDeck(); // defensive: boot() normally loads it first
    renderDeckScreen();
    document.getElementById('deckScreen').classList.add('active');
  };

  actions.closeDeckScreen = function () {
    document.getElementById('deckScreen').classList.remove('active');
    updateDeckButton();
  };

  actions.deckAddCard = function (id) {
    const R = CR.data.DECK_RULES;
    const card = CR.data.CARD_DATABASE.find(c => c.id === id);
    if (!card) return;
    ensureCustomDeck();
    const copies = deck.cards[id] || 0;
    if (copies >= R.maxCopies || deckSize() >= R.maxSize) return;
    deck.cards[id] = copies + 1;
    saveDeck();
    renderDeckScreen();
  };

  actions.deckRemoveCard = function (id) {
    ensureCustomDeck();
    if (!deck.cards[id]) return;
    deck.cards[id]--;
    if (deck.cards[id] <= 0) delete deck.cards[id];
    saveDeck();
    renderDeckScreen();
  };

  actions.deckClear = function () {
    deck = { v: 1, deckId: 'custom', cards: {} };
    saveDeck();
    renderDeckScreen();
  };

  actions.deckResetFull = function () {
    deck = defaultDeck();
    saveDeck();
    renderDeckScreen();
  };


    return { init() { deck = loadDeck(); }, getConfig() { return deck; }, renderDeckScreen, updateDeckButton };
  };
})(typeof window !== 'undefined' ? window : globalThis);
