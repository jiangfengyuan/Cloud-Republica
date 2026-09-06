// sandbox-ui: feature controller with explicit dependencies.
(function (root) {
  const CR = root.CR;
  CR.features = CR.features || {};
  CR.features['sandbox-ui'] = function (deps) {
    const { actions, t, icon } = deps;
    const { loadSandbox, sanitizeSandbox } = CR.storage;
    let sandboxConfig = null;
  // M3: sandbox tunables (bounds live in CR.data.SANDBOX_LIMITS)
  const SANDBOX_PARAM_KEYS = ['maxTurns', 'corrosionRate', 'energyMaintenance', 'drawPerTurn', 'initialHandSize'];
  const SANDBOX_VALUE_ID = {
    maxTurns: 'sandboxValMaxTurns', corrosionRate: 'sandboxValCorrosionRate',
    energyMaintenance: 'sandboxValEnergyMaintenance', drawPerTurn: 'sandboxValDrawPerTurn',
    initialHandSize: 'sandboxValInitialHandSize'
  };

  // ==================== SANDBOX MODE (cr_sandbox v1) ====================

  function saveSandbox() {
    try { CR.storage.setItem('cr_sandbox', JSON.stringify(sandboxConfig)); } catch (e) { /* ignore */ }
  }

  function renderSandboxPanel() {
    if (!sandboxConfig) return;
    SANDBOX_PARAM_KEYS.forEach(k => {
      const el = document.getElementById(SANDBOX_VALUE_ID[k]);
      if (el) el.textContent = k === 'corrosionRate' ? sandboxConfig[k].toFixed(1) : sandboxConfig[k];
    });
    CR.data.SANDBOX_LIMITS.resourcePreset.options.forEach(p => {
      const btn = document.getElementById('sandboxPreset' + p.charAt(0).toUpperCase() + p.slice(1));
      if (!btn) return;
      btn.textContent = t('sandbox.preset.' + p);
      btn.classList.toggle('active', p === sandboxConfig.resourcePreset);
    });
  }

  actions.toggleSandboxPanel = function () {
    const panel = document.getElementById('sandboxPanel');
    if (!panel) return;
    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none'; // accordion: click again to collapse
    renderSandboxPanel();
  };

  actions.adjustSandboxParam = function (key, dir) {
    if (SANDBOX_PARAM_KEYS.indexOf(key) === -1) return;
    const lim = CR.data.SANDBOX_LIMITS[key];
    const next = sandboxConfig[key] + lim.step * (dir >= 0 ? 1 : -1);
    sandboxConfig[key] = sanitizeSandbox({ [key]: next })[key];
    saveSandbox();
    renderSandboxPanel();
  };

  actions.setSandboxPreset = function (p) {
    if (CR.data.SANDBOX_LIMITS.resourcePreset.options.indexOf(p) === -1) return;
    sandboxConfig.resourcePreset = p;
    saveSandbox();
    renderSandboxPanel();
  };

  actions.startSandbox = function () { actions.startGame('sandbox'); };


    return { init() { sandboxConfig = loadSandbox(); }, getConfig() { return sandboxConfig; }, renderSandboxPanel };
  };
})(typeof window !== 'undefined' ? window : globalThis);
