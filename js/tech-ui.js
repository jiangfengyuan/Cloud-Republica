// tech-ui: feature controller with explicit dependencies.
(function (root) {
  const CR = root.CR;
  CR.features = CR.features || {};
  CR.features['tech-ui'] = function (deps) {
    const { actions, t, icon, showScreen, hideScreen } = deps;
    const { engine, addLog, updateUI, dispatchGame } = deps;
  // ==================== TECH TREE (M5) ====================

  // Node status drives both the color/icon semantics and the buy-button state:
  // 'unlocked' (filled + check) | 'available' (accent, clickable) |
  // 'prereq' (previous tier missing) | 'research' (not enough research) — the
  // last two render grey/disabled; the engine re-validates on every buy.
  function techStatus(id) {
    const node = CR.data.TECH_TREE[id];
    if (deps.getState().techs.indexOf(id) !== -1) return 'unlocked';
    if (node.tier > 1 && deps.getState().techs.indexOf(node.branch + '_' + (node.tier - 1)) === -1) return 'prereq';
    if (deps.getState().resources.research < node.cost) return 'research';
    return 'available';
  }

  function renderTechScreen() {
    const screen = document.getElementById('techScreen');
    const cols = CR.data.TECH_BRANCHES.map(branch => {
      const nodes = Object.keys(CR.data.TECH_TREE)
        .filter(id => CR.data.TECH_TREE[id].branch === branch)
        .sort((a, b) => CR.data.TECH_TREE[a].tier - CR.data.TECH_TREE[b].tier)
        .map(id => {
          const node = CR.data.TECH_TREE[id];
          const st = techStatus(id);
          const dots = Array.from({ length: 3 }, (_, i) =>
            `<span class="tech-tier-dot${i < node.tier ? ' filled' : ''}"></span>`).join('');
          const check = st === 'unlocked' ? `<span class="tech-check">${icon('mat.driving')}</span>` : '';
          return `<div class="tech-node ${st}">
            <div class="tech-node-head">${icon(node.icon)}<span class="tech-node-name">${t('tech.' + id + '.name')}</span>${check}</div>
            <div class="tech-node-desc">${t('tech.' + id + '.desc')}</div>
            <div class="tech-node-foot">
              <span class="tech-tier">${dots}</span>
              <button class="btn btn-secondary tech-buy-btn" ${st === 'available' ? '' : 'disabled'} data-action="buyTech" data-args="[&quot;${id}&quot;]">${icon('res.research')}${node.cost}</button>
            </div>
          </div>`;
        }).join('');
      return `<div class="tech-branch"><div class="tech-branch-title">${t('tech.branch.' + branch)}</div>${nodes}</div>`;
    }).join('');

    screen.innerHTML = `
      <div class="tech-panel">
        <div class="tech-header">
          <span class="tech-title">${icon('panel.tech')} ${t('tech.title')}</span>
          <span class="tech-balance">${icon('res.research')} ${t('tech.balance', { value: deps.getState().resources.research })}</span>
        </div>
        <div class="tech-tree">${cols}</div>
        <div class="tech-actions"><button class="btn" data-action="closeTechScreen" data-args="[]">${t('meta.close')}</button></div>
      </div>`;
  }

  actions.openTechScreen = function () {
    if (!deps.getState()) return; // in-run only: no tech tree before a game starts
    renderTechScreen();
    showScreen('techScreen');
  };

  actions.closeTechScreen = function () {
    hideScreen('techScreen');
  };

  actions.buyTech = function (id) {
    if (!deps.getState()) return;
    const result = dispatchGame('unlockTech', { nodeId: id });
    if (!result.ok) addLog(t(result.reason), 'bad');
    updateUI(); // research balance and hand playability may have changed
    renderTechScreen();
  };

  function updateTechButton() {
    const el = document.getElementById('techBtnText');
    if (el) el.textContent = (deps.getState() ? deps.getState().techs.length : 0) + '/9';
  }



    return { renderTechScreen, updateTechButton };
  };
})(typeof window !== 'undefined' ? window : globalThis);
