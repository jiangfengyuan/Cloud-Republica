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
const fixture = fs.readFileSync(path.join(__dirname, '../fixtures/legacy-active-game-v1.json'), 'utf8');
CR.storage.setItem('cr_active_game', fixture);

const session = CR.gameSession.create();
assert.equal(session.restore().ok, true);
assert.deepEqual(session.getState().hand.map(card => card.id), [12, 21, 66, 65, 20, 63]);
assert.equal(session.getState().phase, 'settlement');
assert.equal(session.dispatch('beginNextTurn').ok, true);
assert.equal(session.getState().phase, 'event');
console.log('PASS frozen legacy save restores and continues');
