// test/simulate.js — deterministic mechanics tests & 3-difficulty full-game simulation.
// No dependencies. Run from project root:  node test/simulate.js
'use strict';

require('../js/data.js');
require('../js/storage.js');
const i18n = require('../js/i18n.js');
require('../js/state.js');
const engine = require('../js/engine.js');
require('../js/icons.js');
require('../js/progression.js');
const CR = globalThis.CR;

// ---------- deterministic PRNG (injectable into engine.rng) ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- tiny test harness ----------
let passed = 0, failed = 0;
function assert(cond, name) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.error('  FAIL ' + name); }
}
function freshState(difficultyKey, factionId, metaPerks, sandboxConfig, deckConfig) { return CR.state.createInitialState(difficultyKey || 'medium', factionId, metaPerks, sandboxConfig, deckConfig); }
function cardById(id) { return CR.data.CARD_DATABASE.find(c => c.id === id); }

engine.onLog = null; // silence engine logs during tests (except log-key capture blocks)

// ==================== [M1] Smoke ====================
console.log('\n[M1] Smoke');
engine.rng = mulberry32(12345);
{
  const s = freshState();
  let threw = null;
  try {
    engine.drawInitialCards(s);
    engine.drawCard(s);
  } catch (e) { threw = e; }
  assert(threw === null, 'modules load; initial state + card draw runs without throwing' + (threw ? ' — ' + threw.message : ''));
  assert(s.hand.length === 5, 'hand holds 4 initial cards (medium) + 1 drawn card');
  assert(s.hand[0].id === 12 && s.maxHabitatExpansions === 5 && s.maxCardsPerTurn === 3, 'initial state intact (guaranteed card 12, 5 expansions, 3 plays/turn)');
}

// ==================== [M2] Difficulty config (NEW) ====================
console.log('\n[M2] Difficulty config');
{
  const s = freshState('easy');
  assert(s.maxTurns === 24 && s.corrosionRate === 1.5 && s.resources.materials === 100 && s.energyMaintenance === 4, 'easy config applied (turns/corrosion/materials/maintenance)');
}
{
  const a = freshState();
  const b = freshState('nonexistent');
  assert(a.difficulty === 'medium' && b.difficulty === 'medium', 'unknown/missing difficulty key falls back to medium');
}
{
  const s = freshState('hard');
  assert(s.maxTurns === 19 && s.corrosionRate === 2.5 && s.resources.research === 7 && s.initialHandSize === 3, 'hard config applied (turns/corrosion/research/hand size)');
}
{
  const s = freshState('easy');
  assert(s.hand.length === 1 && s.hand[0].id === 12 && typeof s.hand[0].uid === 'number', 'guaranteedCards pre-dealt into opening hand with uid (before drawInitialCards)');
}

// ==================== [M3] Resources, costs, payment (adapted from round 1) ====================
console.log('\n[M3] Core engine: resources, costs');
{
  const s = freshState();
  engine.modifyResource(s, 'money', -999);
  assert(s.resources.money === 0, 'money clamped at 0');
  engine.modifyResource(s, 'morale', 200);
  assert(s.resources.morale === 100, 'morale clamped at 100');
  s.moraleFloor = 40;
  engine.modifyResource(s, 'morale', -80);
  assert(s.resources.morale === 40, 'morale floor (card 31) enforced immediately mid-turn');
}
{
  assert(engine.getMaturityMultiplier('driving') === 0.6, 'maturity driving x0.6');
  assert(engine.getMaturityMultiplier('brewing') === 1.5, 'maturity brewing x1.5');
  assert(engine.getMaturityMultiplier('unknown') === 1.0, 'unknown maturity falls back to x1.0');
}
{
  const s = freshState();
  const c5 = cardById(5); // trending (x0.8), cost money 10 / materials 5
  const cost = engine.getCardCost(s, c5);
  assert(cost.money === 8 && cost.materials === 4, 'getCardCost applies maturity multiplier');
  s.transportDiscount = 0.5;
  const d = engine.getCardCost(s, c5);
  assert(d.money === 4 && d.materials === 4, 'transportDiscount applies to money cost only');
}
{
  const s = freshState();
  const c2 = cardById(2); // brewing
  s.resources.research = 9;
  assert(!engine.canAfford(s, c2), 'brewing card unplayable with research < 10');
  s.resources.research = 100; s.resources.money = 100; s.resources.materials = 100; s.resources.energy = 100;
  assert(engine.canAfford(s, c2), 'canAfford true when resources cover the discounted cost');
  const before = { ...s.resources };
  const cost = engine.getCardCost(s, c2);
  engine.payCost(s, c2);
  assert(
    s.resources.money === before.money - cost.money &&
    s.resources.materials === before.materials - cost.materials &&
    s.resources.energy === before.energy - cost.energy &&
    s.resources.research === before.research - cost.research,
    'payCost deducts exactly getCardCost amounts'
  );
}

// ==================== [M4] Card effects (adapted from round 1) ====================
console.log('\n[M4] Card effects');
{
  // The engine, rather than only the UI, owns the per-turn card budget.
  const s = freshState();
  s.phase = 'action';
  s.resources.money = s.resources.materials = s.resources.energy = s.resources.research = 999;
  s.hand = [5, 8, 9, 18].map((id, index) => ({ ...cardById(id), uid: 8800 + index }));
  s.selectedCards = [0, 1, 2];
  assert(engine.playSelectedCards(s).ok && s.cardsPlayedThisTurn === 3, 'three cards consume the shared per-turn card budget');
  s.selectedCards = [0];
  const blocked = engine.playSelectedCards(s);
  assert(!blocked.ok && blocked.reason === 'fail.card_limit' && s.hand.length === 1, 'engine rejects further card plays after the per-turn limit');
}
{
  const s = freshState();
  s.phase = 'action';
  s.resources.money = s.resources.materials = s.resources.energy = s.resources.research = 999;
  s.hand = [5, 25, 8, 9].map((id, index) => ({ ...cardById(id), uid: 8900 + index }));
  s.selectedCards = [0, 1, 2];
  engine.playSelectedCards(s);
  s.selectedCards = [0];
  assert(s.extraCardPlayed && engine.getRemainingCardPlays(s) === 1 && engine.playSelectedCards(s).ok, 'extra-card effect expands the same turn budget by exactly one');
}
{
  const s = freshState();
  s.resources.money = 50;
  engine.rng = () => 0.3; // < 0.4 -> deal fails
  engine.applyContractEffect(s, cardById(8));
  assert(s.resources.money === 40, 'card 8 risk roll < 0.4: -10 Funds instead of +10');
  engine.rng = () => 0.9;
  engine.applyContractEffect(s, cardById(8));
  assert(s.resources.money === 50, 'card 8 risk roll >= 0.4: +10 Funds');
  engine.rng = mulberry32(1);
}
{
  const s = freshState();
  const moneyBefore = s.resources.money;
  engine.applyContractEffect(s, cardById(2));
  assert(s.resources.money === moneyBefore, 'card 2: no immediate income on play');
  assert(s.delayedEffects.length === 1 && s.delayedEffects[0].turnsLeft === 3, 'card 2 enqueued into delayedEffects with turnsLeft=3');
  const deltas = [];
  for (let i = 0; i < 4; i++) {
    const before = s.resources.money;
    s.phase = 'action';
    engine.endTurn(s);
    deltas.push(s.resources.money - before);
  }
  assert(deltas[0] === 0 && deltas[1] === 0 && deltas[2] === 0, 'card 2: zero income during the first 3 settlements');
  assert(deltas[3] === 12, 'card 2: +12 Funds/turn starting from the 4th settlement');
  assert(s.delayedEffects.length === 0 && s.maturedIncome.money === 12, 'card 2 matured into permanent income');
}
{
  const s = freshState();
  engine.applyContractEffect(s, cardById(24));
  assert(s.timedEffects.length === 1 && s.timedEffects[0].turnsLeft === 3, 'card 24 enqueued into timedEffects with turnsLeft=3');
  const moneyDeltas = [];
  for (let i = 0; i < 4; i++) {
    const before = s.resources.money;
    s.phase = 'action';
    engine.endTurn(s);
    moneyDeltas.push(s.resources.money - before);
  }
  assert(moneyDeltas[0] === 2 && moneyDeltas[1] === 2 && moneyDeltas[2] === 2, 'card 24: +2 Funds for exactly 3 settlements');
  assert(moneyDeltas[3] === 0, 'card 24: no income after expiry');
  assert(s.timedEffects.length === 0, 'card 24 removed after 3 settlements');
}
{
  const s = freshState();
  engine.applyPermanentEffect(s, cardById(1));  // x0.5
  engine.applyPermanentEffect(s, cardById(7));  // x0.8
  engine.applyPermanentEffect(s, cardById(42)); // x0.6 -> raw 0.24 -> floored
  assert(Math.abs(s.transportDiscount - 0.4) < 1e-9, 'transport discount stacks multiplicatively, coefficient floor 0.4');
}
{
  const s = freshState();
  engine.applyPermanentEffect(s, cardById(17));
  assert(Math.abs(s.repairCostMultiplier - 0.75) < 1e-9, 'card 17: repairCostMultiplier 0.75');
  engine.applyPermanentEffect(s, cardById(45));
  assert(s.repairEfficiency === 2, 'card 45: repairEfficiency 2');
  engine.applyPermanentEffect(s, cardById(31));
  assert(s.moraleFloor === 40, 'card 31: moraleFloor locked at 40');
  engine.applyPermanentEffect(s, cardById(53));
  assert(s.stormShield === true, 'card 53: stormShield flag set');
}
{
  const s = freshState();
  engine.applyPermanentEffect(s, cardById(52));
  assert(s.ultimate === true && s.insurance === false, 'card 52: ultimate flag set, separate from insurance');
  assert(s.prestige === 30, 'card 52: prestige +30 preserved');
}
{
  const s = freshState();
  engine.applyPermanentEffect(s, cardById(32));
  assert(s.insurance === true && s.ultimate === false, 'card 32: insurance flag set');
}
{
  // playSelectedCards end-to-end
  const s = freshState();
  s.phase = 'action';
  engine.rng = mulberry32(42);
  const c5 = { ...cardById(5), uid: 9001 }; // trending: cost 8 money / 4 materials
  s.hand.push(c5);
  const moneyBefore = s.resources.money;
  s.selectedCards = [s.hand.length - 1];
  const r = engine.playSelectedCards(s);
  assert(r.ok === true, 'playSelectedCards returns {ok:true} in action phase');
  assert(!s.hand.some(c => c.uid === 9001) && s.selectedCards.length === 0, 'played card removed from hand, selection cleared');
  assert(s.resources.money === moneyBefore - 8 + 15, 'contract paid discounted cost then applied +15 Funds');
  const r2 = engine.playSelectedCards(s);
  assert(r2.ok === false && r2.reason === 'fail.no_selection', 'empty selection fails with fail.no_selection');
  s.phase = 'event';
  s.selectedCards = [0];
  const r3 = engine.playSelectedCards(s);
  assert(r3.ok === false && r3.reason === 'fail.not_action_phase', 'outside action phase rejected with fail.not_action_phase');
  s.phase = 'action';
}

// ==================== [M5] Turn system, crash handling, habitats (adapted from round 1) ====================
console.log('\n[M5] Turn system, crash handling, habitats');
{
  const s = freshState();
  engine.rng = mulberry32(12345);
  let threw = null;
  try {
    engine.startNewTurn(s);
    engine.triggerEventPhase(s);
    engine.applyEvent(s);
    engine.endTurn(s);
  } catch (e) { threw = e; }
  assert(threw === null, 'one full turn (event -> action -> settlement) runs without throwing');
  assert(s.turn === 1, 'turn counter advanced to 1');
}
{
  const s = freshState();
  s.insurance = true;
  s.resources.money = 100; s.resources.materials = 40; s.resources.energy = 20; s.resources.research = 10;
  engine.modifyResource(s, 'integrity', -200);
  assert(s.resources.integrity === 20, 'insurance: integrity restored to 20 on crash');
  assert(s.resources.money === 50 && s.resources.materials === 20 && s.resources.energy === 10 && s.resources.research === 5, 'insurance: money/materials/energy/research halved');
  assert(s.insurance === false && !s.gameOver, 'insurance consumed, game continues');
  engine.modifyResource(s, 'integrity', -200);
  assert(s.gameOver && s.gameResult === 'crash', 'second crash without insurance ends the game');
}
{
  const s = freshState();
  s.ultimate = true;
  const snap = { ...s.resources };
  engine.modifyResource(s, 'integrity', -200);
  assert(s.resources.integrity === 20 && s.ultimate === false && !s.gameOver, 'ultimate: integrity restored to 20, consumed, game continues');
  assert(s.resources.money === snap.money && s.resources.materials === snap.materials && s.resources.energy === snap.energy && s.resources.research === snap.research, 'ultimate: no resource loss');
}
{
  const s = freshState();
  s.ultimate = true;
  s.insurance = true;
  const snap = { ...s.resources };
  engine.modifyResource(s, 'integrity', -200);
  assert(s.resources.integrity === 20 && s.ultimate === false && s.insurance === true && !s.gameOver && s.resources.money === snap.money && s.resources.materials === snap.materials && s.resources.energy === snap.energy && s.resources.research === snap.research, 'crash with both ultimate+insurance: ultimate takes priority, insurance retained');
}
{
  const s = freshState();
  engine.rng = () => 0.06; // roll = 2 (Solar Storm)
  s.stormShield = true;
  const ev = engine.triggerEventPhase(s);
  assert(ev === null && s.pendingEvent === null, 'card 53: Solar Storm (event id 2) fully neutralized');
  const s2 = freshState();
  const ev2 = engine.triggerEventPhase(s2);
  assert(ev2 !== null && ev2.id === 2, 'same roll without stormShield yields Solar Storm');
  engine.rng = mulberry32(7);
}
{
  const s = freshState();
  s.shieldActive = true;
  engine.rng = () => 0.5; // would roll event id 11
  const ev = engine.triggerEventPhase(s);
  assert(ev === null && s.shieldActive === false, 'card 27: shieldActive blocks the event and is consumed');
  engine.rng = mulberry32(7);
}
{
  const s = freshState(); // medium: materials 75
  s.phase = 'action';
  s.resources.integrity = 50;
  const r = engine.repairHabitat(s);
  assert(r.ok && s.resources.materials === 73 && s.resources.integrity === 51, 'base repair: -2 Materials, +1% Integrity');
  s.repairCostMultiplier = 0.75; s.repairEfficiency = 2;
  const r2 = engine.repairHabitat(s);
  assert(r2.ok && s.resources.materials === 71 && s.resources.integrity === 53, 'card 17+45: cost round(2*0.75)=2 Materials, +2% Integrity per repair');
  s.resources.materials = 0;
  const r3 = engine.repairHabitat(s);
  assert(!r3.ok && r3.reason === 'fail.no_materials_repair', 'repair fails with fail.no_materials_repair when materials insufficient');
}
{
  const s = freshState(); // medium: money 65 / materials 75
  s.phase = 'action';
  const r = engine.buildHabitat(s);
  assert(r.ok && s.habitats === 2 && s.resources.money === 45 && s.resources.materials === 63 && s.habitatExpansions === 1, 'buildHabitat: -20 Funds -12 Materials, +1 habitat');
  s.resources.money = 10; s.resources.materials = 5;
  const r2 = engine.buildHabitat(s);
  assert(!r2.ok && r2.reason === 'fail.build_cost', 'buildHabitat fails with fail.build_cost when resources insufficient');
  s.resources.money = 500; s.resources.materials = 500;
  s.habitatExpansions = 5;
  const r3 = engine.buildHabitat(s);
  assert(!r3.ok && r3.reason === 'fail.habitat_limit' && r3.reasonParams.max === 5, 'buildHabitat blocked at the shared 5-expansion limit (fail.habitat_limit + params)');
  const before = s.habitats;
  engine.applyContractEffect(s, cardById(62));
  assert(s.habitats === before, 'card 62 habitat expansion denied at the same shared limit');
}
{
  const s = freshState();
  s.turn = s.maxTurns; s.purification = 100; s.habitats = 6;
  engine.startNewTurn(s);
  assert(s.gameOver && s.gameResult === 'victory', 'turn maxTurns+1 with goals met = victory (timeout check)');
  const s2 = freshState();
  s2.turn = s2.maxTurns;
  engine.startNewTurn(s2);
  assert(s2.gameOver && s2.gameResult === 'defeat', 'turn maxTurns+1 without goals = defeat');
}
{
  const s = freshState();
  s.phase = 'action';
  s.permanentCards.push({ ...cardById(49), uid: 9002 }); // +3% purification / +4 research per turn
  engine.endTurn(s);
  assert(s.purification === 3, 'permanent card purification income applied each settlement');
}

// ==================== [M6] New iteration-2 mechanics (NEW) ====================
console.log('\n[M6] Iteration-2 mechanics: 3-card limit, hand/draw limits, log keys, i18n');
{
  // 3 cards per turn
  const s = freshState();
  s.phase = 'action';
  const c = [{ ...cardById(29), uid: 9101 }, { ...cardById(37), uid: 9102 }, { ...cardById(25), uid: 9103 }];
  c.forEach(x => s.hand.push(x));
  s.resources.money = 100; s.resources.research = 100;
  const before = s.hand.length;
  s.selectedCards = [before - 3, before - 2, before - 1];
  const r = engine.playSelectedCards(s);
  assert(r.ok && s.hand.length === before - 3 && s.cardsPlayedThisTurn === 3, 'up to 3 cards playable in one turn (maxCardsPerTurn=3)');
}
{
  // handLimit
  const s = freshState();
  s.handLimit = 2;
  s.hand = [{ ...cardById(1), uid: 9201 }, { ...cardById(3), uid: 9202 }];
  engine.drawCard(s);
  engine.drawCard(s);
  assert(s.hand.length === 2, 'drawCard blocked at state.handLimit');
}
{
  // drawPerTurn
  const s = freshState();
  s.phase = 'action';
  s.hand = [];
  engine.rng = mulberry32(9);
  engine.endTurn(s);
  assert(s.hand.length === s.drawPerTurn, 'endTurn draws exactly state.drawPerTurn cards');
}
{
  // log keys: full-turn capture, every key whitelisted + present in both dictionaries
  const s = freshState();
  engine.rng = mulberry32(2024);
  const seen = [];
  engine.onLog = (key, params) => seen.push([key, params]);
  engine.startNewTurn(s);
  engine.triggerEventPhase(s);
  engine.applyEvent(s);
  engine.playSelectedCards(s);
  engine.repairHabitat(s);
  engine.buildHabitat(s);
  engine.endTurn(s);
  engine.onLog = null;
  assert(seen.length > 0 && seen.every(([k]) => engine.logKeys.includes(k)), 'every emitted log key is in engine.logKeys whitelist');
  assert(seen.every(([, p]) => p !== null && typeof p === 'object'), 'every emitted log params is an object');
  const emitted = new Set(seen.map(([k]) => k));
  assert([...emitted].every(k => i18n.DICT.zh[k] !== undefined && i18n.DICT.en[k] !== undefined), 'every emitted log key exists in both zh and en dictionaries');
  assert(engine.logKeys.every(k => i18n.DICT.zh[k] !== undefined && i18n.DICT.en[k] !== undefined), 'every whitelisted log key has zh+en templates');
}
{
  // dictionary parity & t()
  const zhKeys = Object.keys(i18n.DICT.zh).sort().join(',');
  const enKeys = Object.keys(i18n.DICT.en).sort().join(',');
  assert(zhKeys === enKeys, 'i18n dictionary zh/en key sets are identical');
  assert(i18n.lang === 'zh' && i18n.t('btn.next_turn') === '下一回合', 'default lang is zh; t() renders zh');
  i18n.setLang('en');
  assert(i18n.t('log.turn_begin', { turn: 3, max: 22 }) === '=== TURN 3 / 22 BEGINS ===', 'setLang(en) + param interpolation works');
  i18n.setLang('zh');
  assert(i18n.t('nonexistent.key') === 'nonexistent.key', 't() falls back to the key itself when missing');
}

// ==================== [M7] Full-game simulation, 3 difficulties (NEW) ====================
console.log('\n[M7] Full-game simulation (greedy bot, 500 seeded games per difficulty)');
function incomeOf(s, key) {
  let n = 0;
  s.permanentCards.forEach(c => { const ve = c.venusEffect || {}; if (ve[key]) n += ve[key]; });
  return n;
}
function purEngineInHand(s) { return s.hand.some(c => c.id === 12 || c.id === 49); }
function scoreCard(s, card) {
  const ve = card.venusEffect || {};
  const perm = card.type === 'permanent';
  let sc = 0;
  const energyCovered = incomeOf(s, 'energy') >= s.energyMaintenance + 1;
  const ramp = incomeOf(s, 'money') < 12;
  const needRes = purEngineInHand(s) && s.resources.research < 15;

  if (card.id === 12 || card.id === 49) sc += 10000;
  if (ve.purification) sc += 300 + ve.purification * (perm ? 40 : 5);
  if (perm && ve.energy > 0) sc += energyCovered ? 20 + ve.energy * 3 : 600 + ve.energy * 40;
  if (ve.energy < 0) sc -= 300;
  if (ve.research && (needRes || s.resources.research < 10)) sc += 400 + ve.research * 20;
  if (perm && ve.money) sc += (ramp ? 250 : 20) + ve.money * 8;
  if (perm && ve.materials) sc += s.habitats < s.targetHabitats ? 500 + ve.materials * 25 : 40 + ve.materials * 10;
  if (ve.habitat) sc += 120;
  if (ve.corrosion) sc += -ve.corrosion * 25;
  if (card.id === 1 || card.id === 7 || card.id === 42) sc += ramp ? 120 : 20;
  if (card.id === 17 || card.id === 45) sc += 15;
  sc += (ve.morale || 0) * 0.3 + (ve.money || 0) * (perm ? 0 : 0.5);
  return sc;
}

// M5: in-run tech purchases. Heuristic tuned by dry run (2026-07-29) to a
// human-plausible cadence: start saving at turn >= 4, keep a research reserve
// for brewing gates / research-costed cards, at most one node per turn, branch
// picked by the current board state. Target: median 2-4 nodes per medium game.
const TECH_RESERVE = 2;
const TECH_MAX_PER_TURN = 1;
function scoreTech(s, id) {
  const late = s.turn >= s.maxTurns - 8;
  switch (id) {
    case 'atm_1': case 'atm_3': return (incomeOf(s, 'purification') > 0 || purEngineInHand(s)) ? 300 : 60;
    case 'atm_2': return s.corrosionRate >= 2 ? 150 : 90;
    case 'log_1': return incomeOf(s, 'money') >= 4 ? 220 : 140;
    case 'log_2': return 160;
    case 'log_3': return (s.habitats < s.targetHabitats && late) ? 260 : 80;
    case 'grid_1': return incomeOf(s, 'energy') < s.energyMaintenance + 1 ? 180 : 70;
    case 'grid_2': return s.turn <= 10 ? 320 : 120;
    case 'grid_3': return 150;
  }
  return 0;
}
function bestTechGoal(s) { // highest-scored reachable node; null when nothing is worth saving for
  if (s.turn < 4 || s.strike) return null;
  let best = null, bestScore = 150; // below this the AI does not save up
  Object.keys(CR.data.TECH_TREE).forEach(id => {
    const node = CR.data.TECH_TREE[id];
    if (s.techs.indexOf(id) !== -1) return;
    if (node.tier > 1 && s.techs.indexOf(node.branch + '_' + (node.tier - 1)) === -1) return;
    const sc = scoreTech(s, id);
    if (sc > bestScore) { bestScore = sc; best = node; }
  });
  return best;
}
function maybeBuyTechs(s) {
  if (s.turn < 4 || s.gameOver || s.phase !== 'action' || s.strike) return;
  for (let n = 0; n < TECH_MAX_PER_TURN; n++) {
    let best = null, bestScore = 0;
    Object.keys(CR.data.TECH_TREE).forEach(id => {
      const node = CR.data.TECH_TREE[id];
      if (s.techs.indexOf(id) !== -1) return;
      if (node.tier > 1 && s.techs.indexOf(node.branch + '_' + (node.tier - 1)) === -1) return;
      if (s.resources.research - node.cost < TECH_RESERVE) return;
      const sc = scoreTech(s, id);
      if (sc > bestScore) { bestScore = sc; best = id; }
    });
    if (!best) return;
    engine.unlockTech(s, best);
  }
}

function playGame(seed, difficultyKey, factionId, metaPerks, sandboxConfig, deckConfig) {
  engine.rng = mulberry32(seed);
  engine.onLog = null;
  const s = CR.state.createInitialState(difficultyKey, factionId, metaPerks, sandboxConfig, deckConfig);
  engine.drawInitialCards(s);
  let guard = 0;
  while (!s.gameOver && guard++ < 100) {
    engine.startNewTurn(s);
    if (s.gameOver) break;
    engine.triggerEventPhase(s);
    engine.applyEvent(s);
    if (s.gameOver) break;

    if (!s.strike) {
      const saving = s.turn >= 8 && s.habitats < s.targetHabitats && s.purification < 100;
      const techGoal = bestTechGoal(s); // M5: divert research from card costs toward a tech goal
      let plays = 0, progressed = true;
      while (progressed && !s.gameOver) {
        progressed = false;
        const maxPlays = s.extraCardPlayed ? s.maxCardsPerTurn + 1 : s.maxCardsPerTurn;
        if (plays >= maxPlays) break;
        let best = -1, bestScore = 0, cycle = -1, cycleCost = Infinity;
        s.hand.forEach((card, i) => {
          if (!engine.canAfford(s, card)) return;
          const sc = scoreCard(s, card);
          const cost = engine.getCardCost(s, card);
          if (techGoal && cost.research > 0 && sc < 500 && !(card.venusEffect || {}).purification &&
              (s.resources.research - cost.research) < techGoal.cost + TECH_RESERVE) return; // M5: saving for techGoal
          if (saving && sc < 250 && (s.resources.money - cost.money) < 20) return;
          if (s.habitats < s.targetHabitats && cost.materials > 0 && sc < 500) {
            const gives = (card.type === 'permanent' && (card.venusEffect || {}).materials > cost.materials * 0.5);
            if (!gives) return;
          }
          if (sc > bestScore) { bestScore = sc; best = i; }
          const total = cost.energy * 5 + cost.materials * 3 + cost.money + cost.research;
          if (total < cycleCost) { cycleCost = total; cycle = i; }
        });
        if (best < 0 && s.hand.length >= 4 && cycle >= 0) {
          if (!saving) best = cycle;
          else {
            const cc = engine.getCardCost(s, s.hand[cycle]);
            if (cc.materials === 0 && (s.resources.money - cc.money) >= 20) best = cycle;
          }
        }
        if (best >= 0) {
          s.selectedCards = [best];
          const r = engine.playSelectedCards(s);
          if (r.ok) { plays++; progressed = true; }
        }
      }
    }

    maybeBuyTechs(s); // M5: tech purchases after card plays, before repair/build

    while (!s.gameOver && s.phase === 'action' && s.resources.integrity < 30) {
      const r = engine.repairHabitat(s); if (!r.ok) break;
    }
    const ready = s.turn >= 8 || s.purification >= 100;
    while (ready && !s.gameOver && s.phase === 'action' && s.habitats < s.targetHabitats) {
      const r = engine.buildHabitat(s); if (!r.ok) break;
    }
    if (s.gameOver) break;
    engine.endTurn(s);
  }
  return s;
}

function runBand(label, difficultyKey, factionId, metaPerks, lo, hi, games, skipAssert) {
  let wins = 0, defeats = 0, crashes = 0;
  for (let seed = 1; seed <= games; seed++) {
    const s = playGame(seed, difficultyKey, factionId, metaPerks);
    if (s.gameResult === 'victory') wins++;
    else if (s.gameResult === 'crash') crashes++;
    else defeats++;
  }
  const rate = wins / games * 100;
  console.log(`  ${label}: ${wins} victories, ${defeats} defeats (timeout), ${crashes} crashes out of ${games} -> ${rate.toFixed(1)}% (target ${lo}-${hi}%)`);
  if (!skipAssert) assert(rate >= lo && rate <= hi, `${label} win rate ${rate.toFixed(1)}% within [${lo}, ${hi}]`);
  return rate;
}

// Baseline red lines (M2 spec §1): no-faction + no-meta must not drift.
// M5 full-matrix recalibration (2026-07-29): AI buys techs, all bands re-pinned at measured ±5pp.
// measured: easy 75.4 / medium 46.2 / hard 15.8 (was 72.4 / 44.8 / 14.4)
runBand('easy', 'easy', 'none', {}, 70, 80, 500);
runBand('medium', 'medium', 'none', {}, 41, 51, 500);
runBand('hard', 'hard', 'none', {}, 11, 21, 500);

// ==================== [M8] Faction injection (NEW, M2) ====================
console.log('\n[M8] Faction injection (createInitialState + consumption points)');
{
  const s = freshState('medium', 'unknown-faction');
  assert(s.faction === 'none' && s.resources.money === 65 && s.transportDiscount === 1, 'unknown faction falls back to none (baseline values)');
}
{
  const s = freshState('medium', 'guild');
  assert(s.faction === 'guild' && s.resources.money === 80 && s.resources.morale === 60, 'guild: startResources money +15 / morale -10');
  assert(s.moneyMultiplier === 1.25 && Math.abs(s.transportDiscount - 0.9) < 1e-9, 'guild: moneyMultiplier 1.25, transportDiscount 0.9');
  const d = engine.getCardCost(s, cardById(5)); // trending money 10 -> x0.8 x0.9 = 7.2 -> 7
  assert(d.money === 7, 'guild: transportDiscount 0.9 applies to card money cost');
}
{
  const s = freshState('medium', 'covenant');
  assert(Math.abs(s.corrosionRate - 1.5) < 1e-9 && s.habitatMaterialsDelta === 2 && Math.abs(s.purificationMultiplier - 1.15) < 1e-9, 'covenant: corrosion 2->1.5, habitat materials delta +2 (M3 rebalance), purification x1.15');
  engine.applyResourceEffect(s, { purification: 10 });
  assert(Math.abs(s.purification - 11.5) < 1e-9, 'covenant: positive purification delta amplified x1.15');
  engine.applyResourceEffect(s, { purification: -5 });
  assert(Math.abs(s.purification - 6.5) < 1e-9, 'covenant: negative purification delta NOT amplified');
  s.phase = 'action';
  const r = engine.buildHabitat(s);
  assert(r.ok && s.resources.materials === 75 - 14, 'covenant: buildHabitat costs 12+2=14 materials');
}
{
  const s = freshState('medium', 'technocracy');
  assert(s.researchIncome === 2 && Math.abs(s.researchCostMultiplier - 0.75) < 1e-9 && s.moraleDecayDelta === 1, 'technocracy: researchIncome 2, research cost x0.75, morale decay delta +1');
  const d = engine.getCardCost(s, cardById(21)); // signaling research 5 -> x1.3 x0.75 = 4.875 -> 5
  assert(d.research === 5, 'technocracy: researchCostMultiplier applies to research cost only');
  const d2 = engine.getCardCost(s, cardById(5));
  assert(d2.money === 8 && d2.materials === 4, 'technocracy: money/materials costs untouched');
  s.phase = 'action';
  const moraleBefore = s.resources.morale, researchBefore = s.resources.research;
  engine.endTurn(s);
  assert(s.resources.research === researchBefore + 2, 'technocracy: +2 research per settlement');
  assert(s.resources.morale === moraleBefore - 2, 'technocracy: morale decay 1+1=2 per settlement');
}

// ==================== [M9] Meta perk injection (NEW, M2) ====================
console.log('\n[M9] Meta perk injection');
{
  const s = freshState('medium', 'none', { fund: 2, supplies: 2, lab: 2 });
  assert(s.resources.money === 85 && s.resources.materials === 91 && s.resources.research === 16, 'fund/supplies/lab lv2: +20 money, +16 materials, +8 research');
}
{
  const s = freshState('easy', 'covenant', { coating: 2 }); // 1.5 - 0.5 - 0.4 = 0.6 -> clamp 1.0
  assert(Math.abs(s.corrosionRate - 1.0) < 1e-9, 'covenant + coating lv2 on easy: corrosion clamped at 1.0');
  const s2 = freshState('medium', 'none', { coating: 2 });
  assert(Math.abs(s2.corrosionRate - 1.6) < 1e-9, 'coating lv2 on medium: corrosion 2->1.6');
}
{
  const s = freshState('medium', 'none', { grid: 1 });
  assert(s.energyMaintenance === 3, 'grid lv1: energy maintenance 4->3');
  const s2 = freshState('medium', 'none', { grid: 99 }); // over-max level clamped to 1
  assert(s2.energyMaintenance === 3, 'perk level clamped at max (grid max 1)');
}
{
  const s = freshState('medium', 'none', { handbook: 1 });
  assert(s.initialHandSize === 5, 'handbook: initialHandSize 4->5');
  engine.rng = mulberry32(3);
  engine.drawInitialCards(s);
  assert(s.hand.length === 5, 'handbook: opening hand holds 5 cards');
}
{
  const s = freshState('medium', 'none', { bogus: 5 });
  assert(s.resources.money === 65, 'unknown perk id ignored');
}

// ==================== [M10] Faction x Meta matrix (NEW, M2; ranges calibrated 2026-07-28) ====================
console.log('\n[M10] Faction x Meta matrix (500 seeded games per combination)');
const FULL_META = { fund: 2, supplies: 2, lab: 2, coating: 2, grid: 1, handbook: 1 };
const CALIBRATE = process.argv.includes('--calibrate');

// spec §5.2: each faction x no meta x medium (M5 recalibrated 2026-07-29 for the tech tree, re-pinned at measured ±5pp)
// measured: none 46.2 / guild 59.2 / covenant 35.2 / technocracy 43.6 (was 44.8 / 56.8 / 33.6 / 38.4)
const FACTION_BANDS = [
  ['medium/none/no-meta', 'none', 41, 51],   // baseline band (re-asserted here for the matrix)
  ['medium/guild/no-meta', 'guild', 54, 64],
  ['medium/covenant/no-meta', 'covenant', 30, 40],  // M5 recalibration: measured 35.2, margin to lower bound 5.2pp (was 3.6pp)
  ['medium/technocracy/no-meta', 'technocracy', 39, 49]
];
FACTION_BANDS.forEach(([label, faction, lo, hi]) => {
  runBand(label, 'medium', faction, {}, lo, hi, 500, CALIBRATE && faction !== 'none');
});

// spec §5.3: full meta x medium — M5 recalibrated 65.2% (2026-07-29; M4 64.0, re-pinned at measured ±5pp)
runBand('medium/none/full-meta', 'medium', 'none', FULL_META, 60, 70, 500, CALIBRATE);

// spec §5.4: each faction x full meta x hard — crash smoke only (no win-rate band)
['none', 'guild', 'covenant', 'technocracy'].forEach(faction => {
  let crashed = 0;
  for (let seed = 1; seed <= 500; seed++) {
    let threw = null;
    try { playGame(seed, 'hard', faction, FULL_META); } catch (e) { threw = e; }
    if (threw) { crashed++; console.error('  THREW ' + faction + ' seed ' + seed + ': ' + threw.message); }
  }
  assert(crashed === 0, `hard/${faction}/full-meta: 500 games, 0 exceptions`);
});

// ==================== [M11] Sandbox mode (NEW, M3; ranges calibrated 2026-07-28) ====================
console.log('\n[M11] Sandbox mode (config injection, clamping, legacy rule, preset bands)');
{
  // default / missing config => exact medium baseline shape (spec §2.1)
  const s = freshState('sandbox');
  assert(s.difficulty === 'sandbox' && s.maxTurns === 22 && Math.abs(s.corrosionRate - 2) < 1e-9 && s.energyMaintenance === 4 && s.drawPerTurn === 2 && s.initialHandSize === 4 && s.resources.money === 65, 'sandbox with no config mirrors the medium baseline shape');
  assert(s.sandboxConfig && s.sandboxConfig.resourcePreset === 'standard' && s.sandboxConfig.maxTurns === 22, 'sandbox state carries a clamped sandboxConfig snapshot');
}
{
  // out-of-range values clamp to bounds / step grid / default preset (spec §2.2)
  const s = freshState('sandbox', 'none', {}, { maxTurns: 99, corrosionRate: -1, resourcePreset: 'cheat' });
  assert(s.maxTurns === 30 && Math.abs(s.corrosionRate - 0) < 1e-9 && s.sandboxConfig.resourcePreset === 'standard', 'out-of-range sandbox config clamped (maxTurns 99->30, corrosion -1->0, cheat preset->standard)');
  const s2 = freshState('sandbox', 'none', {}, { maxTurns: 22.6, corrosionRate: 0.3, drawPerTurn: 9 });
  assert(s2.maxTurns === 23 && Math.abs(s2.corrosionRate - 0.5) < 1e-9 && s2.drawPerTurn === 4, 'sandbox values snapped to the step grid (22.6->23, 0.3->0.5, draw 9->4)');
}
{
  // resourcePreset scales medium base resources (rounded) before faction/meta (spec §2.2)
  const poor = freshState('sandbox', 'none', {}, { resourcePreset: 'poor' });
  assert(poor.resources.money === 49 && poor.resources.materials === 56 && poor.resources.integrity === 100, 'poor preset: base resources x0.75 rounded (money 65->49, materials 75->56), integrity untouched');
  const rich = freshState('sandbox', 'guild', {}, { resourcePreset: 'rich' });
  assert(rich.resources.money === Math.round(65 * 1.5) + 15 && rich.resources.morale === Math.round(70 * 1.5) - 10, 'rich preset x1.5 then guild deltas stack on top (order: base -> sandbox -> faction)');
}
{
  // 4th arg ignored outside sandbox (baseline path protection, spec §2.2)
  const s = freshState('medium', 'none', {}, { maxTurns: 30, resourcePreset: 'rich' });
  assert(s.maxTurns === 22 && s.resources.money === 65 && s.sandboxConfig === null, 'sandbox config ignored for non-sandbox difficulties');
}
{
  // faction corrosion floor still applies on top of the sandbox base (M2 rule unchanged)
  const s = freshState('sandbox', 'covenant', {}, { corrosionRate: 0 });
  assert(Math.abs(s.corrosionRate - 1.0) < 1e-9, 'sandbox corrosion 0 + covenant -0.5 clamped at 1.0 (M2 floor intact)');
}
{
  // sandbox legacy rule: win 1 / defeat 0 / crash 0 (spec §2.4 anti-farming)
  assert(CR.progression.legacyGain('sandbox', 'victory') === 1 && CR.progression.legacyGain('sandbox', 'defeat') === 0 && CR.progression.legacyGain('sandbox', 'crash') === 0, 'sandbox legacy: victory +1, defeat/crash +0');
  assert(CR.progression.legacyGain('easy', 'victory') === 2 && CR.progression.legacyGain('medium', 'victory') === 3 && CR.progression.legacyGain('hard', 'victory') === 5 && CR.progression.legacyGain('medium', 'defeat') === 1, 'legacy table for other difficulties unchanged');
}

// spec §2.5: three preset configs x 500 seeded games (M5 recalibrated 2026-07-29, re-pinned at measured ±5pp)
// measured: harsh 6.0 / standard 46.2 (= medium baseline, identical params + AI + RNG stream) / kind 85.4
const SANDBOX_BANDS = [
  ['sandbox/harsh', { maxTurns: 15, corrosionRate: 4, resourcePreset: 'poor' }, 1, 11],
  ['sandbox/standard', undefined, 41, 51],
  ['sandbox/kind', { maxTurns: 30, corrosionRate: 0, drawPerTurn: 4, resourcePreset: 'rich' }, 80, 90] // M5: 85.4 re-pinned at ±5pp
];
SANDBOX_BANDS.forEach(([label, cfg, lo, hi]) => {
  let wins = 0;
  for (let seed = 1; seed <= 500; seed++) {
    const s = playGame(seed, 'sandbox', 'none', {}, cfg);
    if (s.gameResult === 'victory') wins++;
  }
  const rate = wins / 500 * 100;
  console.log(`  ${label}: ${wins} victories out of 500 -> ${rate.toFixed(1)}% (target ${lo}-${hi}%)`);
  if (!CALIBRATE) assert(rate >= lo && rate <= hi, `${label} win rate ${rate.toFixed(1)}% within [${lo}, ${hi}]`);
});

// ==================== [M12] Deck system (NEW, M4; ranges calibrated 2026-07-29) ====================
console.log('\n[M12] Deck system (draw-without-replacement, reshuffle, routing, clamping, custom decks)');
{
  // draw-without-replacement: 20 drawn cards are all distinct, draw pile shrinks 1:1
  const s = freshState();
  engine.rng = mulberry32(77);
  s.hand = []; s.handLimit = 30;
  const before = s.drawPile.length;
  for (let i = 0; i < 20; i++) engine.drawCard(s);
  const ids = s.hand.map(c => c.id);
  assert(new Set(ids).size === 20 && s.drawPile.length === before - 20, 'draw-without-replacement: 20 distinct cards, draw pile shrinks 1:1');
}
{
  // reshuffle: empty draw pile pulls the discard pile back in (shuffled), conserving ids
  const s = freshState();
  engine.rng = mulberry32(78);
  s.hand = [];
  s.drawPile = [];
  s.discardPile = [5, 9, 24];
  engine.drawCard(s);
  assert(s.hand.length === 1 && [5, 9, 24].indexOf(s.hand[0].id) !== -1 && s.discardPile.length === 0 && s.drawPile.length === 2, 'empty draw pile reshuffles the discard pile, then draws');
  const rest = s.drawPile.concat(s.hand.map(c => c.id)).sort((a, b) => a - b);
  assert(rest.join(',') === '5,9,24', 'reshuffle conserves all discarded card ids');
}
{
  // both piles empty: nothing drawn, log.deck_empty emitted
  const s = freshState();
  engine.rng = mulberry32(79);
  s.hand = [];
  s.drawPile = []; s.discardPile = [];
  const seen = [];
  engine.onLog = k => seen.push(k);
  engine.drawCard(s);
  engine.onLog = null;
  assert(s.hand.length === 0 && seen.indexOf('log.deck_empty') !== -1, 'both piles empty: no draw, log.deck_empty emitted');
}
{
  // routing: played contracts -> discard pile; permanents -> installed, never discarded
  const s = freshState();
  s.phase = 'action';
  engine.rng = mulberry32(80);
  s.resources.money = 200; s.resources.materials = 200; s.resources.energy = 200; s.resources.research = 200;
  s.hand.push({ ...cardById(5), uid: 9301 });  // contract
  s.hand.push({ ...cardById(1), uid: 9302 });  // permanent
  s.selectedCards = [s.hand.length - 2, s.hand.length - 1];
  const r = engine.playSelectedCards(s);
  assert(r.ok && s.discardPile.length === 1 && s.discardPile[0] === 5, 'played contract card id lands in the discard pile');
  assert(s.permanentCards.some(c => c.uid === 9302) && s.discardPile.indexOf(1) === -1, 'played permanent installed, never enters the discard pile');
}
{
  // guaranteedCards taken from the deck: card 12 leaves the full-deck draw pile
  const s = freshState();
  assert(s.hand[0] && s.hand[0].id === 12 && s.drawPile.length === 65 && s.drawPile.indexOf(12) === -1, 'guaranteed card 12 pre-dealt from the deck (draw pile 65, no id 12 left)');
}
{
  // custom deck: exact multiset built across draw pile + opening hand
  const cards = {}; for (let id = 1; id <= 10; id++) cards[id] = 2; // 20 cards, no card 12
  const s = freshState('medium', 'none', {}, undefined, { deckId: 'custom', cards });
  const total = s.drawPile.length + s.hand.length;
  assert(s.deckId === 'custom' && s.deckSize === 20 && total === 20, 'custom 20-card deck: all 20 cards across draw pile + opening hand');
  const counts = {};
  s.drawPile.concat(s.hand.map(c => c.id)).forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  assert(Object.keys(counts).length === 10 && Object.keys(counts).every(k => counts[k] <= 2), 'custom deck multiset matches the config (ids 1-10, <=2 copies each)');
}
{
  // illegal configs: entries dropped one by one, then whole-config fallback to 'full' (spec §2.2)
  const a = freshState('medium', 'none', {}, undefined, { deckId: 'custom', cards: { 999: 1, 5: 3 } });
  assert(a.deckId === 'full' && a.drawPile.length + a.hand.length === 66, 'unknown id + over-copies dropped; result below min size -> full deck fallback');
  const legal20 = {}; for (let id = 1; id <= 20; id++) legal20[id] = 1;
  legal20[999] = 2;
  const b = freshState('medium', 'none', {}, undefined, { deckId: 'custom', cards: legal20 });
  assert(b.deckId === 'custom' && b.deckSize === 20, 'unknown id dropped; remaining 20 legal cards stay a custom deck');
  const c = freshState('medium', 'none', {}, undefined, { deckId: 'custom', cards: null });
  const d = freshState('medium', 'none', {}, undefined, { deckId: 'weird', cards: { 1: 1 } });
  assert(c.deckId === 'full' && d.deckId === 'full', 'missing cards map / unknown deckId -> full deck fallback');
  const over40 = {}; for (let id = 1; id <= 41; id++) over40[id] = 1;
  const e = freshState('medium', 'none', {}, undefined, { deckId: 'custom', cards: over40 });
  assert(e.deckId === 'full', '41 cards (> max 40) -> full deck fallback');
}

// spec §3.2: three typical custom decks x medium x none x no-meta x 500 seeded games
// measured (M5 recalibration 2026-07-29): economy 0.0 (no purification engine in ids 1-10) / purification 19.0 / min20 70.2
const DECK_ECONOMY = { deckId: 'custom', cards: { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 2 } };
const DECK_PURIFICATION = { deckId: 'custom', cards: { 12: 2, 49: 2, 14: 2, 18: 2, 20: 2, 61: 2, 30: 2, 58: 2, 37: 2, 56: 2 } };
const DECK_MIN20 = { deckId: 'custom', cards: (function () { const c = {}; for (let id = 1; id <= 20; id++) c[id] = 1; return c; })() };
const CUSTOM_DECK_BANDS = [
  ['custom/economy/medium', DECK_ECONOMY, 0, 5],
  ['custom/purification/medium', DECK_PURIFICATION, 14, 24], // M5: 16.4 -> 19.0, re-pinned at ±5pp
  ['custom/min20/medium', DECK_MIN20, 65, 75]
];
CUSTOM_DECK_BANDS.forEach(([label, cfg, lo, hi]) => {
  let wins = 0, threw = 0;
  for (let seed = 1; seed <= 500; seed++) {
    try {
      const s = playGame(seed, 'medium', 'none', {}, undefined, cfg);
      if (s.gameResult === 'victory') wins++;
    } catch (e) { threw++; console.error('  THREW ' + label + ' seed ' + seed + ': ' + e.message); }
  }
  const rate = wins / 500 * 100;
  console.log(`  ${label}: ${wins} victories out of 500 -> ${rate.toFixed(1)}% (target ${lo}-${hi}%)`);
  assert(threw === 0, `${label}: 500 games, 0 exceptions`);
  if (!CALIBRATE) assert(rate >= lo && rate <= hi, `${label} win rate ${rate.toFixed(1)}% within [${lo}, ${hi}]`);
});

// ==================== [M13] Tech tree (NEW, M5; pacing calibrated 2026-07-29) ====================
console.log('\n[M13] Tech tree (unlock chain, field application, clamps, faction/meta stacking, pacing)');
{
  const s = freshState();
  s.resources.research = 20;
  const rejected = engine.unlockTech(s, 'atm_1');
  assert(!rejected.ok && rejected.reason === 'fail.not_action_phase' && s.techs.length === 0,
    'tech unlock is rejected outside the action phase');
}
{
  // atm branch chain: T1 -> T2 -> T3, field application one by one
  const s = freshState();
  s.phase = 'action';
  s.resources.research = 100;
  const r1 = engine.unlockTech(s, 'atm_1');
  assert(r1.ok && Math.abs(s.purificationMultiplier - 1.10) < 1e-9 && s.resources.research === 94 && s.techs.join(',') === 'atm_1', 'atm_1: purificationMultiplier +0.10, cost 6 deducted, node recorded');
  const r2 = engine.unlockTech(s, 'atm_2');
  assert(r2.ok && Math.abs(s.corrosionRate - 1.7) < 1e-9 && s.resources.research === 82, 'atm_2: corrosionRate 2 -> 1.7 after prerequisite atm_1');
  const r3 = engine.unlockTech(s, 'atm_3');
  assert(r3.ok && Math.abs(s.purificationMultiplier - 1.25) < 1e-9 && s.resources.research === 64, 'atm_3: purificationMultiplier 1.10 -> 1.25 (additive in the multiplier band)');
}
{
  // log branch chain
  const s = freshState();
  s.phase = 'action';
  s.resources.research = 100;
  const r1 = engine.unlockTech(s, 'log_1');
  assert(r1.ok && Math.abs(s.moneyMultiplier - 1.10) < 1e-9, 'log_1: moneyMultiplier +0.10');
  const r2 = engine.unlockTech(s, 'log_2');
  assert(r2.ok && Math.abs(s.transportDiscount - 0.92) < 1e-9, 'log_2: transportDiscount x0.92 (multiplicative)');
  s.phase = 'action';
  const r3 = engine.unlockTech(s, 'log_3');
  const rb = engine.buildHabitat(s);
  assert(r3.ok && s.habitatMaterialsDelta === -2 && rb.ok && s.resources.materials === 75 - 10, 'log_3: habitatMaterialsDelta -2, buildHabitat costs 12-2=10 materials');
}
{
  // grid branch chain + handLimit consumption point
  const s = freshState();
  s.phase = 'action';
  s.resources.research = 100;
  engine.rng = mulberry32(55);
  const r1 = engine.unlockTech(s, 'grid_1');
  assert(r1.ok && s.energyMaintenance === 3, 'grid_1: energyMaintenance 4 -> 3');
  const r2 = engine.unlockTech(s, 'grid_2');
  assert(r2.ok && s.researchIncome === 1, 'grid_2: researchIncome 0 -> 1');
  const r3 = engine.unlockTech(s, 'grid_3');
  s.hand = [];
  for (let i = 0; i < 12; i++) engine.drawCard(s);
  assert(r3.ok && s.handLimit === 9 && s.hand.length === 9, 'grid_3: handLimit 8 -> 9, drawCard fills to the new limit');
  engine.rng = mulberry32(7);
}
{
  // validation chain: unknown / prerequisite / insufficient research / duplicate
  const s = freshState();
  s.phase = 'action';
  const ru = engine.unlockTech(s, 'nope');
  assert(!ru.ok && ru.reason === 'fail.tech_unknown' && s.techs.length === 0, 'unknown node rejected with fail.tech_unknown');
  const rp = engine.unlockTech(s, 'atm_2');
  assert(!rp.ok && rp.reason === 'fail.tech_prereq' && s.techs.length === 0, 'tier 2 without tier 1 rejected with fail.tech_prereq');
  s.resources.research = 5;
  const rr = engine.unlockTech(s, 'atm_1');
  assert(!rr.ok && rr.reason === 'fail.tech_research' && s.resources.research === 5 && s.techs.length === 0, 'insufficient research rejected with fail.tech_research, nothing deducted');
  s.resources.research = 50;
  engine.unlockTech(s, 'atm_1');
  const rd = engine.unlockTech(s, 'atm_1');
  assert(!rd.ok && rd.reason === 'fail.tech_unlocked' && s.resources.research === 44, 'duplicate unlock rejected with fail.tech_unlocked');
}
{
  // clamps: every floored effect stops at its established floor
  const s = freshState();
  s.phase = 'action';
  s.resources.research = 200;
  s.corrosionRate = 1.2;
  engine.unlockTech(s, 'atm_1'); engine.unlockTech(s, 'atm_2');
  assert(Math.abs(s.corrosionRate - 1.0) < 1e-9, 'atm_2 clamp: corrosion 1.2 - 0.3 floored at 1.0');
  s.transportDiscount = 0.42;
  engine.unlockTech(s, 'log_1'); engine.unlockTech(s, 'log_2');
  assert(Math.abs(s.transportDiscount - 0.4) < 1e-9, 'log_2 clamp: transportDiscount 0.42 x0.92 floored at 0.4');
  s.energyMaintenance = 2;
  engine.unlockTech(s, 'grid_1');
  assert(s.energyMaintenance === 2, 'grid_1 clamp: energyMaintenance floored at 2');
  s.habitatMaterialsDelta = -3;
  engine.unlockTech(s, 'log_3');
  s.phase = 'action'; s.resources.money = 100; s.resources.materials = 100;
  const rb = engine.buildHabitat(s);
  assert(s.habitatMaterialsDelta === -4 && rb.ok && s.resources.materials === 92, 'log_3 clamp: habitatMaterialsDelta floored at -4 (build cost 8)');
}
{
  // log key: emitted on unlock, whitelisted, localized in both dictionaries
  const s = freshState();
  s.phase = 'action';
  s.resources.research = 20;
  const seen = [];
  engine.onLog = (key, params) => seen.push([key, params]);
  engine.unlockTech(s, 'atm_1');
  engine.onLog = null;
  assert(seen.some(([k, p]) => k === 'log.tech_unlocked' && p.techId === 'atm_1') && engine.logKeys.indexOf('log.tech_unlocked') !== -1, 'log.tech_unlocked emitted with techId and whitelisted');
}
{
  // stacking: covenant x atm_1 (additive in the multiplier band, then amplified delta)
  const s = freshState('medium', 'covenant');
  s.phase = 'action';
  s.resources.research = 50;
  engine.unlockTech(s, 'atm_1');
  assert(Math.abs(s.purificationMultiplier - 1.25) < 1e-9, 'covenant x atm_1: purificationMultiplier 1.15 + 0.10 = 1.25');
  engine.applyResourceEffect(s, { purification: 10 });
  assert(Math.abs(s.purification - 12.5) < 1e-9, 'covenant x atm_1: +10 purification amplified to +12.5');
}
{
  // stacking: log_2 x guild (multiplicative band, shared 0.4 floor with the card discounts)
  const s = freshState('medium', 'guild');
  s.phase = 'action';
  s.resources.research = 50;
  engine.unlockTech(s, 'log_1'); engine.unlockTech(s, 'log_2');
  assert(Math.abs(s.transportDiscount - 0.828) < 1e-9, 'guild x log_2: transportDiscount 0.9 x0.92 = 0.828');
  engine.applyPermanentEffect(s, cardById(1));  // x0.5
  engine.applyPermanentEffect(s, cardById(42)); // x0.6 -> below the floor
  assert(Math.abs(s.transportDiscount - 0.4) < 1e-9, 'guild x log_2 x cards 1+42: shared coefficient floor 0.4 holds');
}
{
  // stacking: grid_2 x technocracy (flat research income adds up per settlement)
  const s = freshState('medium', 'technocracy');
  s.phase = 'action';
  s.resources.research = 50;
  engine.unlockTech(s, 'grid_1'); engine.unlockTech(s, 'grid_2');
  s.phase = 'action';
  const before = s.resources.research;
  engine.endTurn(s);
  assert(s.researchIncome === 3 && s.resources.research === before + 3, 'technocracy x grid_2: researchIncome 2 + 1 = 3 per settlement');
}
{
  // pacing: median nodes unlocked per medium game within [2,4] (spec §3.2 goal 3)
  // calibrated 2026-07-29: fees 6/12/18 (spec table 8/14/22 gave median 1), median 2, mean 1.99
  const counts = [];
  for (let seed = 1; seed <= 500; seed++) counts.push(playGame(seed, 'medium', 'none', {}).techs.length);
  counts.sort((a, b) => a - b);
  const median = counts[Math.floor(counts.length / 2)];
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  console.log(`  tech pacing: median ${median}, mean ${mean.toFixed(2)} nodes unlocked per medium game (target median 2-4)`);
  assert(median >= 2 && median <= 4, `tech pacing: median unlocks ${median} within [2, 4]`);
}

// ==================== Summary ====================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
