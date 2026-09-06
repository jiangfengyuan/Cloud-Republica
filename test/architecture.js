// Node integration tests with a small DOM double; not a browser/layout test.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const base = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
class Element {
  constructor() {
    this.dataset = {}; this.style = {}; this.children = []; this.listeners = {};
    this.parts = new Map(); this.textContent = ''; this.disabled = false;
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach(n => classes.add(n)),
      remove: (...names) => names.forEach(n => classes.delete(n)),
      contains: n => classes.has(n),
      toggle: (n, on = !classes.has(n)) => on ? classes.add(n) : classes.delete(n)
    };
  }
  set innerHTML(value) { this.markup = value; this.children = []; }
  get innerHTML() { return this.markup || ''; }
  appendChild(child) { this.children.push(child); }
  insertBefore(child) { this.children.unshift(child); }
  removeChild(child) { this.children.splice(this.children.indexOf(child), 1); }
  get lastChild() { return this.children.at(-1); }
  querySelector(selector) {
    if (!this.parts.has(selector)) this.parts.set(selector, new Element());
    return this.parts.get(selector);
  }
  querySelectorAll() { return []; }
  addEventListener(name, fn) { this.listeners[name] = fn; }
}
const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m => [m[1], new Element()]));
const docListeners = {};
const document = {
  documentElement: new Element(),
  getElementById: id => elements.get(id) || null,
  querySelectorAll: () => [],
  createElement: () => new Element(),
  addEventListener: (name, fn) => { docListeners[name] = fn; }
};
let boot;
const context = vm.createContext({ document, console, innerWidth: 1200, innerHeight: 900,
  addEventListener(name, fn) { if (name === 'load') boot = fn; },
  setTimeout: fn => fn(), location: { reload() {} }
});
context.window = context;
for (const [, file] of html.matchAll(/<script src="([^"]+)"/g)) {
  vm.runInContext(fs.readFileSync(path.join(base, file), 'utf8'), context, { filename: file });
}
const CR = context.CR;
CR.storage.setItem('cr_anim', 'off');
CR.engine.rng = () => 0.99; // peaceful event, deterministic deck
boot();
const el = id => elements.get(id);
const click = (action, args = [], disabled = false) => docListeners.click({ target: {
  closest: () => ({ dataset: { action, args: JSON.stringify(args) }, disabled })
} });
assert(el('startScreen').classList.contains('active'));
assert.equal(context.startGame, undefined, 'actions do not leak to window');
assert(!/\bonclick=/.test(html), 'static markup has no executable handlers');
click('openMetaScreen');
assert(el('metaPerkGrid').innerHTML.includes('data-action="buyPerk"'));
click('closeMetaScreen');
click('openDeckScreen');
assert(el('deckScreen').innerHTML.includes('data-action="deckAddCard"'));
click('deckClear');
for (let id = 1; id <= 20; id++) click('deckAddCard', [id]);
assert.equal(CR.storage.loadDeck().deckId, 'custom');
assert.equal(Object.keys(CR.storage.loadDeck().cards).length, 20);
click('deckResetFull');
click('closeDeckScreen');
click('adjustSandboxParam', ['maxTurns', 1]);
assert.equal(CR.storage.loadSandbox().maxTurns, CR.data.SANDBOX_LIMITS.maxTurns.def + 1);
click('startGame', ['medium'], true);
assert(el('startScreen').classList.contains('active'), 'disabled actions ignored');
click('selectFaction', ['technocracy']);
click('startGame', ['easy']);
assert(el('eventModal').classList.contains('active'));
assert.equal(el('currentPhase').textContent, CR.i18n.t('phase.event'));
click('closeEventModal');
assert.equal(el('currentPhase').textContent, CR.i18n.t('phase.action'));
const cardsBefore = el('handCards').children.length;
el('handCards').children[0].listeners.click();
click('playSelectedCards');
assert.equal(el('handCards').children.length, cardsBefore - 1);
click('openTechScreen');
assert(el('techScreen').innerHTML.includes('data-action="buyTech"'));
click('buyTech', ['atm_1']);
assert.equal(el('techBtnText').textContent, '1/9');
click('toggleLang');
assert.equal(CR.i18n.lang, 'en');
assert(el('techScreen').innerHTML.includes(CR.i18n.t('tech.atm_1.name')));
click('closeTechScreen');
click('endTurn');
assert.equal(el('currentPhase').textContent, CR.i18n.t('phase.settlement'));
click('closeEventModal');
assert.equal(el('currentPhase').textContent, CR.i18n.t('phase.event'));
assert(el('turnText').textContent.includes('2'));
console.log('PASS script order, feature screens, delegated actions, card play, tech, language and turn flow');

CR.storage.setItem('cr_stats', JSON.stringify({ v: 1, games: 4, wins: { easy: 2, medium: 1, hard: 0 } }));
const migrated = CR.storage.loadStats();
assert.equal(migrated.v, 2);
assert.equal(migrated.games, 4);
assert.equal(migrated.wins.sandbox, 0);
assert.equal(migrated.factions.guild.games, 0);
CR.storage.setItem('cr_meta', '{broken');
assert.equal(CR.storage.loadMeta().legacy, 0);
CR.storage.setItem('cr_deck', JSON.stringify({ v: 99, deckId: 'custom', cards: {} }));
assert.equal(CR.storage.loadDeck().deckId, 'full');
const blocked = vm.createContext({ CR: { data: CR.data } });
Object.defineProperty(blocked, 'localStorage', { get() { throw Error('Unavailable'); } });
vm.runInContext(fs.readFileSync(path.join(base, 'js/storage.js'), 'utf8'), blocked);
blocked.CR.storage.setItem('cr_theme', 'glacier');
assert.equal(blocked.CR.storage.getItem('cr_theme'), 'glacier');
console.log('PASS legacy migration, malformed/unknown saves and unavailable storage fallback');

let first = 0, second = 0, legacy = 0;
const unsub = CR.engine.subscribe(event => {
  first++;
  assert.equal(event.key, 'log.purification_change');
  assert(Object.isFrozen(event.params));
});
const unsub2 = CR.engine.subscribe(() => second++);
CR.engine.onLog = () => legacy++;
const state = CR.state.createInitialState('medium');
CR.engine.applyResourceEffect(state, { purification: 1 });
unsub();
CR.engine.applyResourceEffect(state, { purification: 1 });
unsub2();
assert.equal(first, 1); assert.equal(second, 2); assert.equal(legacy, 2);
console.log('PASS event fan-out, unsubscribe and onLog compatibility');
