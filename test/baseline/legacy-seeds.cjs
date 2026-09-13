'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('../../js/data.js');
require('../../js/storage.js');
require('../../js/i18n.js');
require('../../js/state.js');
require('../../js/engine.js');
require('../../js/game-session.js');

const CR = globalThis.CR;
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/legacy-seed-baseline.json'), 'utf8'));
CR.engine.rng = () => fixture.deckRng;

for (const expected of fixture.cases) {
  const session = CR.gameSession.create();
  session.start({ difficulty: expected.difficulty, faction: 'none', seed: expected.seed });
  const started = session.getState();
  assert.deepEqual({
    eventId: started.pendingEvent?.id ?? null,
    rngState: started.rngState,
    resources: started.resources,
    handIds: started.hand.map(card => card.id),
    drawTail: started.drawPile.slice(-8)
  }, expected.started);

  session.dispatch('acknowledgeEvent');
  assert.deepEqual(session.getState().resources, expected.actionResources);

  session.dispatch('endTurn');
  assert.deepEqual({
    resources: session.getState().resources,
    handIds: session.getState().hand.map(card => card.id)
  }, expected.settlement);

  session.dispatch('beginNextTurn');
  assert.deepEqual({
    eventId: session.getState().pendingEvent?.id ?? null,
    rngState: session.getState().rngState
  }, expected.nextTurn);
}

console.log('PASS frozen legacy seed-game baselines');
