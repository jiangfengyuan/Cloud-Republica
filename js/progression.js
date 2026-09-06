// Rules for progression between games. No DOM or persistence.
(function (root) {
  const CR = root.CR;
  const winAwards = { easy: 2, medium: 3, hard: 5, sandbox: 1 };
  function legacyGain(difficulty, result) {
    if (result === 'victory') return winAwards[difficulty] || 1;
    return difficulty === 'sandbox' ? 0 : 1;
  }
  CR.progression = { legacyGain };
  if (typeof module !== 'undefined' && module.exports) module.exports = CR.progression;
})(typeof window !== 'undefined' ? window : globalThis);
