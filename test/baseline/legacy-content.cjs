'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');

require('../../js/data.js');

const data = globalThis.CR.data;
const payload = JSON.stringify({
  CARD_DATABASE: data.CARD_DATABASE,
  EVENTS: data.EVENTS,
  DIFFICULTY_LEVELS: data.DIFFICULTY_LEVELS,
  FACTIONS: data.FACTIONS,
  META_PERKS: data.META_PERKS,
  SANDBOX_LIMITS: data.SANDBOX_LIMITS,
  DECK_RULES: data.DECK_RULES,
  TECH_TREE: data.TECH_TREE,
  TECH_BRANCHES: data.TECH_BRANCHES
});
const digest = crypto.createHash('sha256').update(payload).digest('hex');

assert.equal(data.CARD_DATABASE.length, 66);
assert.equal(new Set(data.CARD_DATABASE.map(card => card.id)).size, 66);
assert.equal(data.EVENTS.length, 20);
assert.equal(new Set(data.EVENTS.map(event => event.id)).size, 20);
assert.equal(Object.keys(data.TECH_TREE).length, 9);
assert.equal(digest, 'dc410d380ebcc75d3866ff78c589667204a010244455895244ddcac5bd66bf36');
console.log('PASS frozen legacy content fingerprint');
