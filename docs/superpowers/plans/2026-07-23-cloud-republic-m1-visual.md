# Cloud Republic M1 (Visual Suite: Icons / Card Art / Animations / Themes / Local Stats) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按已定稿 spec《2026-07-23-cloud-republic-m1-visual-design.md》落实 M1 视觉全套：新建 `js/icons.js`（约 20 个描边风 SVG 图标 + `cardArt(card)` 程序化卡面）、ui.js 接入图标/卡面/动效钩子/主题系统/动画开关/本地战绩、styles.css 追加三主题变量与动效样式、index.html 加入主题选择器与战绩面板、i18n 追加双语键。engine/state/data 游戏逻辑零改动。

**Architecture:** 结构不变，新增 `js/icons.js`，加载顺序 data → i18n → icons → state → engine → ui。主题经 `<html data-theme="venus|glacier|abyss">` 换肤（CSS 变量作用域覆盖），动画开关经 `<html data-anim="off">`，战绩存 localStorage `cr_stats`（v1）。全部视觉资源为内联 SVG/CSS，完全离线。

**Tech Stack:** 纯原生 HTML/CSS/JS（无构建工具、无依赖、无 ES module、无网络资源——无网络字体/图片/CDN）。测试仅需 Node.js 内置 `require`。

## Global Constraints
- 不用 git（用户明确拒绝，计划中不得出现任何 commit 步骤）
- 所有文件在 /Users/haydenjiang/Downloads/RES_REP/ 下
- engine.js / state.js / data.js 零改动；`node test/simulate.js` 78/78 不得回归
- 完全离线：不新增任何外部资源/依赖/网络请求（grep 验收）
- 无 CSS 框架/预处理器；双击 index.html 即玩
- 视觉动效只用 CSS transform/opacity 与 rAF 计数，统一缓动 `cubic-bezier(0.4, 0, 0.2, 1)`

## 关键设计说明（实现前必读）

1. **主题机制的 CSS 层实现**：第三轮 styles.css 把背景渐变直接写在 `body` / `.end-screen` 上。本轮**不改正文 712 行**，在末尾追加：`:root` 补 `--bg-image`（当前橙黄渐变），并用同优先级但位置在后的 `body, .end-screen { background: var(--bg-image); background-attachment: fixed; }` 覆盖原背景；`[data-theme="glacier"]` / `[data-theme="abyss"]` 作用域内重定义 `--bg-image` 与调色变量（`--accent-gold` 等），`:root` 即 venus 默认值。`<html>` 无 data-theme 时 = venus，向后兼容。
2. **三主题令牌**：
   - venus（`:root` 默认）：现有橙黄，`--bg-image` = 现有 radial×2 + linear(#f7b733→#ee9a3a→#d96f32→#7a4b94)。
   - glacier：`--bg-image` = radial(rgba(126,166,255,.35)) + radial(rgba(167,243,208,.18)) + linear(160deg, #8fb8e8 → #6b9bd8 → #4a73b8 → #2e4a86)；`--accent-gold: #BFE3FF`（主强调冰蓝白）、`--accent-blue: #7EA6FF`（不变）、`--accent-orange: #FFB020`。
   - abyss：`--bg-image` = radial(rgba(126,166,255,.18)) + radial(rgba(167,139,250,.14)) + linear(160deg, #1c2540 → #121a30 → #0a0e1a)；`--glass-bg: rgba(255,255,255,0.10)`、`--accent-gold: #FFCD70`（不变）。
3. **动画开关**：追加 `[data-anim="off"] *, [data-anim="off"] *::before, [data-anim="off"] *::after { animation: none !important; transition: none !important; }` 与 `@media (prefers-reduced-motion: reduce)` 同规则；JS 侧 rAF 计数动画在 `document.documentElement.dataset.anim === 'off'` 时跳过（直接赋终值）。localStorage 键 `cr_anim`（'on'/'off'，默认 on）、`cr_theme`（默认 venus）与 `cr_lang` 互不干扰。
4. **icons.js 接口**：`CR.icons = { get(name), has(name), names, MATURITY_COLORS, cardArt(card) }`。`get(name)` 返回 `<svg class="icon icon-{name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">…</svg>`（currentColor 着色，尺寸由 CSS `.icon` 控制）；未知 name 返回空字符串（不 throw）。`cardArt(card)` 返回 `<svg class="card-art-svg" viewBox="0 0 200 56">…</svg>`：7 类别母题，`card.id` 经 LCG 种子抖动位置/数量，描边色 = `MATURITY_COLORS[card.maturity]`。双兼容外壳（Node 可 require，用于干跑断言）。
5. **ui.js 改动面**（整文件替换，Task 5 给全文）：renderHand 模板加 `.card-art-band` + 成本/成熟度/面板/按钮图标替换 emoji；`updateUI` 资源数值滚动（rAF 300ms）+ 涨跌变色闪烁（涨 `.res-flash-up` 绿 / 降 `.res-flash-down` 橙）；出牌飞行（play 前给选中卡加 `.card-fly-out`，200ms 后调 engine——此处用 setTimeout 属动效延迟，不涉及回合流自动推进）；永久卡区新条目 `.perm-new` 脉冲；弹窗滑入改 CSS；胜利金色彩带（复用 box-shadow 技法的 `.confetti-layer` ×2）、失败画面渐暗；主题/动画切换函数；战绩 loadStats/recordGame/renderStatsPanel（endGame 时经 `state.statsRecorded` 防重，refreshTexts 重渲染结局不重复记录）。
6. **i18n 追加键**（zh/en 各 14 个，Task 4 给完整插入块）：`theme.venus/glacier/abyss`、`ui.theme_label`、`ui.anim_label`、`ui.anim_on`、`ui.anim_off`、`stats.title`、`stats.games`、`stats.wins`、`stats.best_contribution`、`stats.best_purification`、`stats.new_record`、`stats.no_games`。
7. **战绩数据结构**（localStorage `cr_stats`）：`{ v: 1, games: 0, wins: { easy: 0, medium: 0, hard: 0, sandbox: 0 }, bestContribution: 0, bestPurification: 0 }`。只在 `showEndScreen` 且 `state.gameResult === 'victory'` 时给 `wins[state.difficulty]` +1；`games` 每局 +1（含失败）；纪录判断在写入前取旧值比较，返回 `{ newContribution, newPurification }` 供「新纪录」徽标。读写全部 try/catch。
8. **首屏 DOM 预算**（spec ≤400）：开始界面静态 ~190（含战绩面板与主题行）；对局峰值（8 手牌）≈ 380，明细与实测见附录 B——卡面 SVG 母题每卡 ≤9 个子节点、图标每个 ≤4 个子节点是本预算的硬约束，写 icons.js 时不得超出。
9. **替换 emoji 的边界**（spec §5）：仅替换 UI 图标位（成本标签、成熟度点、面板标题、按钮）；日志正文、规则正文、resource-label 里的 emoji（💰🧱⚡🔬😊🔧 在 `res.*` 文案内）属内文符号，保留不动——资源面板左侧 label 的 emoji 也替换为图标（spec 把 6 资源列入图标体系），i18n `res.*` 文案中的 emoji 字符同步删除（Task 4 给出改后文案）。

---

## Task 1: js/icons.js — SVG 图标体系 + 程序化卡面

**Files:**
- Create: `/Users/haydenjiang/Downloads/RES_REP/js/icons.js`

**Interfaces:**
- Consumes: 无（纯资源函数）
- Produces: `CR.icons = { get(name), has(name), names: string[], MATURITY_COLORS, cardArt(card) }`；`cardArt(card)` 入参为 `{ id, category, maturity }` 形状的对象（不依赖完整卡牌）。Node 下 `module.exports = CR.icons`
- 图标清单（30 个 key）：`res.money/materials/energy/research/morale/integrity`、`cat.economy/environment/governance/social/tech/wellbeing/venus`、`mat.driving/trending/emerging/signaling/brewing`、`action.repair/build/turn/play/restart`、`panel.player/permanent/globe/hand/log/threat/rules`

- [ ] **Step 1: 创建 js/icons.js（完整代码如下）**
  ```js
  // icons.js — stroke-style inline SVG icon system + procedural card art. No dependencies, fully offline.
  (function (root) {
    const CR = root.CR = root.CR || {};

    const MATURITY_COLORS = {
      driving: '#A7F3D0',
      trending: '#7EA6FF',
      emerging: '#FFCD70',
      signaling: '#A78BFA',
      brewing: '#FF9B06'
    };

    // 24x24 stroke icons (currentColor). Keep each icon <= 4 child nodes (DOM budget, plan note 8).
    const PATHS = {
      'res.money': '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v10M9.2 9.5h4.3a1.8 1.8 0 0 1 0 3.6h-3a1.8 1.8 0 0 0 0 3.6h4.3"/>',
      'res.materials': '<rect x="3" y="4" width="18" height="5" rx="1"/><rect x="3" y="10.5" width="18" height="5" rx="1"/><rect x="3" y="17" width="18" height="4" rx="1"/><path d="M12 4v5M8 10.5v5M16 10.5v5M12 17v4"/>',
      'res.energy': '<path d="M13 2 5 13.5h5.5L9.5 22l8-11.5h-5.5L13 2z"/>',
      'res.research': '<path d="M10 2.5h4M10.5 2.5v5.5l-4.8 9.6A3 3 0 0 0 8.4 21h7.2a3 3 0 0 0 2.7-3.4l-4.8-9.6V2.5"/><path d="M7.2 14.5h9.6"/>',
      'res.morale': '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.6 2.2 4 2.2 4-2.2 4-2.2"/><path d="M9 9.2v.6M15 9.2v.6"/>',
      'res.integrity': '<path d="M14.7 6.3a4.6 4.6 0 0 0-6.1 5.6L3 17.5V21h3.5l5.6-5.6a4.6 4.6 0 0 0 5.6-6.1l-3 3-2.4-.6-.6-2.4 3-3z"/>',

      'cat.economy': '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
      'cat.environment': '<path d="M17.5 18a4.5 4.5 0 0 0 .4-9A6 6 0 0 0 6.2 10.5 4 4 0 0 0 6.5 18h11z"/>',
      'cat.governance': '<path d="M3 21h18M4.5 17.5h15M6.5 17.5v-7M10.2 17.5v-7M13.8 17.5v-7M17.5 17.5v-7"/><path d="M3 10.5 12 3.5l9 7H3z"/>',
      'cat.social': '<circle cx="12" cy="8" r="4"/><path d="M4.5 21c.6-4 3.8-6 7.5-6s6.9 2 7.5 6"/>',
      'cat.tech': '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M12 2.5V7M12 17v4.5M2.5 12H7M17 12h4.5M5 5l1.8 1.8M19 19l-1.8-1.8"/>',
      'cat.wellbeing': '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
      'cat.venus': '<circle cx="12" cy="10" r="6.5"/><path d="M8.5 21c1.2-1.6 5.8-1.6 7 0"/><path d="M9.2 8.6a3.2 3.2 0 0 1 2.2-1.6"/>',

      'mat.driving': '<path d="M12 3.5 14.6 9l6 .7-4.5 4 1.2 5.9L12 16.4l-5.3 3.2 1.2-5.9-4.5-4 6-.7L12 3.5z"/>',
      'mat.trending': '<path d="M8 5.5 18.5 12 8 18.5v-13z"/>',
      'mat.emerging': '<path d="M12 5.5 20.5 20h-17L12 5.5z"/>',
      'mat.signaling': '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17V3.5z"/>',
      'mat.brewing': '<path d="M16.5 16.5a4 4 0 0 0 .3-7.6A5.5 5.5 0 0 0 5.8 9.7 3.5 3.5 0 0 0 6.2 16.5h10.3z"/><path d="M8.5 20.5h7"/>',

      'action.repair': '<path d="M14.5 3.5 20.5 9.5 18 12l-6-6 2.5-2.5z"/><path d="M12.5 8.5 4 17a2.1 2.1 0 0 0 3 3l8.5-8.5"/>',
      'action.build': '<path d="M3.5 11 12 3.5 20.5 11"/><path d="M6 10v10.5h12V10"/><path d="M12 13v5M9.5 15.5h5"/>',
      'action.turn': '<path d="M4.5 12h15M13.5 6l6 6-6 6"/>',
      'action.play': '<rect x="3.5" y="6" width="11.5" height="15" rx="2"/><path d="M9 3.5h9.5a2 2 0 0 1 2 2V18"/>',
      'action.restart': '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4.5v5h5"/>',

      'panel.player': '<circle cx="12" cy="8" r="4"/><path d="M4.5 21c.6-4 3.8-6 7.5-6s6.9 2 7.5 6"/>',
      'panel.permanent': '<path d="M12 3l7.5 9L12 21l-7.5-9L12 3z"/>',
      'panel.globe': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18-3-3.5-3-14.5 0-18z"/>',
      'panel.hand': '<rect x="3.5" y="6" width="11.5" height="15" rx="2"/><path d="M9 3.5h9.5a2 2 0 0 1 2 2V18"/>',
      'panel.log': '<path d="M6.5 3.5h11v17h-11z"/><path d="M9.5 7.5h5M9.5 11h5M9.5 14.5h3.5"/>',
      'panel.threat': '<path d="M12 3.5 21.5 20h-19L12 3.5z"/><path d="M12 10v4.5M12 17.2v.3"/>',
      'panel.rules': '<path d="M4.5 4.5h12a3 3 0 0 1 3 3v12h-12a3 3 0 0 1-3-3v-12z"/><path d="M8.5 8.5h7M8.5 12h7"/>'
    };

    function get(name) {
      const body = PATHS[name];
      if (!body) return '';
      return `<svg class="icon icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
    }

    function has(name) { return Object.prototype.hasOwnProperty.call(PATHS, name); }

    // ==================== PROCEDURAL CARD ART ====================
    // viewBox 200x56 motif band; card.id seeds an LCG for position/count jitter;
    // stroke color comes from the card's maturity. Pure function of {id, category, maturity}.

    function lcg(seed) {
      let a = seed >>> 0;
      return function () {
        a = (a * 1664525 + 1013904223) >>> 0;
        return a / 4294967296;
      };
    }

    function cardArt(card) {
      const color = MATURITY_COLORS[card.maturity] || '#E2E6F0';
      const rnd = lcg(card.id * 2654435761 >>> 0);
      const j = amp => (rnd() - 0.5) * 2 * amp; // jitter in [-amp, amp]
      let inner = '';

      switch (card.category) {
        case 'economy': { // arcs of coins
          const n = 3 + Math.floor(rnd() * 3); // 3-5 coins
          for (let i = 0; i < n; i++) {
            const cx = 40 + i * (120 / Math.max(1, n - 1)) + j(6);
            const cy = 40 - Math.sin((i / Math.max(1, n - 1)) * Math.PI) * 16 + j(4);
            inner += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="7"/><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3" opacity="0.6"/>`;
          }
          break;
        }
        case 'environment': { // clouds
          const n = 2 + Math.floor(rnd() * 2); // 2-3 clouds
          for (let i = 0; i < n; i++) {
            const x = 35 + i * 60 + j(10);
            const y = 20 + i * 10 + j(5);
            inner += `<path d="M${(x + 24).toFixed(1)} ${(y + 14).toFixed(1)}a7 7 0 0 0 .6-13.9 9.5 9.5 0 0 0-18.4 2.4 6.3 6.3 0 0 0 .5 11.5h17.3z" transform="translate(${j(4).toFixed(1)} 0)"/>`;
          }
          break;
        }
        case 'governance': { // columns
          const n = 3;
          for (let i = 0; i < n; i++) {
            const x = 55 + i * 45 + j(4);
            inner += `<path d="M${x.toFixed(1)} 46v-24M${(x - 5).toFixed(1)} 22h10M${(x - 5).toFixed(1)} 46h10"/>`;
          }
          inner += `<path d="M${(45 + j(3)).toFixed(1)} 14h110"/>`;
          break;
        }
        case 'social': { // person figures
          const n = 2 + Math.floor(rnd() * 2); // 2-3 figures
          for (let i = 0; i < n; i++) {
            const cx = 60 + i * 40 + j(8);
            inner += `<circle cx="${cx.toFixed(1)}" cy="18" r="6"/><path d="M${(cx - 11).toFixed(1)} 44c1-9 5.5-13 11-13s10 4 11 13"/>`;
          }
          break;
        }
        case 'tech': { // circuit polyline + nodes
          const pts = [];
          for (let i = 0; i <= 4; i++) pts.push(`${(30 + i * 35 + j(6)).toFixed(1)},${(i % 2 === 0 ? 40 : 16).toFixed(1)}`);
          inner += `<polyline points="${pts.join(' ')}"/>`;
          for (let i = 0; i <= 4; i++) {
            const cx = 30 + i * 35 + j(6);
            const cy = i % 2 === 0 ? 40 : 16;
            inner += `<circle cx="${cx.toFixed(1)}" cy="${cy}" r="3.5"/>`;
          }
          break;
        }
        case 'wellbeing': { // crosses in circles
          const n = 2 + Math.floor(rnd() * 3); // 2-4
          for (let i = 0; i < n; i++) {
            const cx = 50 + i * (100 / Math.max(1, n - 1)) + j(6);
            const cy = 28 + j(8);
            inner += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="10"/><path d="M${cx.toFixed(1)} ${(cy - 5).toFixed(1)}v10M${(cx - 5).toFixed(1)} ${cy.toFixed(1)}h10"/>`;
          }
          break;
        }
        default: { // venus: floating bubbles
          const n = 3 + Math.floor(rnd() * 2); // 3-4 bubbles
          for (let i = 0; i < n; i++) {
            const cx = 40 + i * (120 / Math.max(1, n - 1)) + j(8);
            const cy = 22 + j(10);
            const r = 8 + rnd() * 5;
            inner += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}"/><circle cx="${(cx - r * 0.3).toFixed(1)}" cy="${(cy - r * 0.3).toFixed(1)}" r="${(r * 0.25).toFixed(1)}" opacity="0.6"/>`;
          }
          break;
        }
      }

      return `<svg class="card-art-svg" viewBox="0 0 200 56" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.85" aria-hidden="true">${inner}</svg>`;
    }

    CR.icons = {
      get,
      has,
      names: Object.keys(PATHS),
      MATURITY_COLORS,
      cardArt
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = CR.icons;
  })(typeof window !== 'undefined' ? window : globalThis);
  ```

- [ ] **Step 2: Node 验证**
  运行 `node -e "const ic = require('/Users/haydenjiang/Downloads/RES_REP/js/icons.js'); console.log('icons:', ic.names.length); console.log('get res.money ok:', ic.get('res.money').startsWith('<svg')); console.log('unknown ->', JSON.stringify(ic.get('nope'))); const a1 = ic.cardArt({id: 12, category: 'venus', maturity: 'signaling'}); const a2 = ic.cardArt({id: 12, category: 'venus', maturity: 'signaling'}); const a3 = ic.cardArt({id: 13, category: 'venus', maturity: 'signaling'}); console.log('deterministic:', a1 === a2, 'seeded-varies:', a1 !== a3, 'stroke:', a3.includes('#A78BFA')); const cats = ['economy','environment','governance','social','tech','wellbeing','venus']; console.log('all categories render:', cats.every(c => ic.cardArt({id: 1, category: c, maturity: 'driving'}).length > 50)); const childMax = Math.max(...ic.names.map(n => (ic.get(n).match(/<(circle|path|rect|ellipse|polyline|line)/g) || []).length)); console.log('max icon child nodes:', childMax, '(<=4 required)')"`，
  预期输出：`icons: 30`、`get res.money ok: true`、`unknown -> ""`、`deterministic: true seeded-varies: true stroke: true`、`all categories render: true`、`max icon child nodes: 4 (<=4 required)`。

---

## Task 2: styles.css — 追加主题/动效/卡面/战绩样式（不改正文 712 行）

**Files:**
- Modify: `/Users/haydenjiang/Downloads/RES_REP/styles.css`（仅在文件末尾追加下方完整块）

**Interfaces:**
- Consumes: 第三轮令牌与组件；Task 1 的 `.icon` / `.card-art-svg` class 约定；Task 3/5 的新 DOM（`.theme-row`、`.stats-panel`、`.confetti-layer`、`.record-badge`、`.card-art-band`、`.card-fly-out`、`.perm-new`、`.res-flash-up/down`）
- Produces: `--bg-image` 主题背景变量（`:root` = venus 默认）+ `[data-theme]` 两套覆盖 + `[data-anim="off"]` 与 `prefers-reduced-motion` 禁用规则 + 全部 M1 新样式

- [ ] **Step 1: 在 styles.css 末尾追加以下完整块**
  ```css

  /* ==================== M1: themes, animations, card art, stats ==================== */

  /* theme background token: :root == venus (default). Later-rule override of the
     iteration-3 body/.end-screen backgrounds (same specificity, wins by order). */
  :root {
      --bg-image:
          radial-gradient(circle at 18% 15%, rgba(255, 205, 112, 0.45) 0%, transparent 45%),
          radial-gradient(circle at 85% 75%, rgba(167, 139, 250, 0.30) 0%, transparent 55%),
          linear-gradient(160deg, #f7b733 0%, #ee9a3a 32%, #d96f32 62%, #7a4b94 100%);
  }

  body, .end-screen {
      background: var(--bg-image);
      background-attachment: fixed;
  }

  [data-theme="glacier"] {
      --bg-image:
          radial-gradient(circle at 18% 15%, rgba(126, 166, 255, 0.35) 0%, transparent 45%),
          radial-gradient(circle at 85% 75%, rgba(167, 243, 208, 0.18) 0%, transparent 55%),
          linear-gradient(160deg, #8fb8e8 0%, #6b9bd8 35%, #4a73b8 65%, #2e4a86 100%);
      --accent-gold: #BFE3FF;
      --accent-orange: #FFB020;
      --glass-shadow: 0 8px 32px rgba(20, 40, 90, 0.40);
  }

  [data-theme="abyss"] {
      --bg-image:
          radial-gradient(circle at 18% 15%, rgba(126, 166, 255, 0.18) 0%, transparent 45%),
          radial-gradient(circle at 85% 75%, rgba(167, 139, 250, 0.14) 0%, transparent 55%),
          linear-gradient(160deg, #1c2540 0%, #121a30 55%, #0a0e1a 100%);
      --glass-bg: rgba(255, 255, 255, 0.10);
      --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.55);
  }

  /* ---------- animation switch (manual + OS preference) ---------- */

  [data-anim="off"] *, [data-anim="off"] *::before, [data-anim="off"] *::after {
      animation: none !important;
      transition: none !important;
  }

  @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
          animation: none !important;
          transition: none !important;
      }
  }

  /* ---------- SVG icons ---------- */

  .icon {
      width: 1em;
      height: 1em;
      vertical-align: -0.12em;
      flex: none;
  }

  .pt-icon {
      display: inline-flex;
      font-size: 1rem;
      color: var(--accent-gold);
  }

  .pt-icon .icon { width: 1rem; height: 1rem; }

  .btn-icon {
      display: inline-flex;
      margin-right: 6px;
  }

  .cost-tag .icon { width: 0.9em; height: 0.9em; }

  .card-maturity .icon { width: 0.95rem; height: 0.95rem; }

  .resource-label .icon { width: 1rem; height: 1rem; }

  /* ---------- card art band ---------- */

  .card-art-band {
      height: 56px;
      margin: -4px -4px 8px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.18);
      border: 1px solid rgba(255, 255, 255, 0.10);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
  }

  .card-art-svg {
      width: 100%;
      height: 100%;
  }

  /* ---------- play fly-out ---------- */

  .card-fly-out {
      transform: translateY(-28px) scale(0.6) !important;
      opacity: 0 !important;
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
      pointer-events: none;
  }

  /* ---------- permanent panel new-entry pulse ---------- */

  @keyframes permPulse {
      0% { background: rgba(255, 205, 112, 0.35); }
      100% { background: transparent; }
  }

  .perm-new { animation: permPulse 1s cubic-bezier(0.4, 0, 0.2, 1); }

  /* ---------- modal slide-in (overrides iteration-3 scale-in) ---------- */

  .modal-content {
      transform: translateY(18px) scale(0.98);
      opacity: 0;
      transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .modal-overlay.active .modal-content {
      transform: translateY(0) scale(1);
      opacity: 1;
  }

  /* ---------- resource value flash (up = green, down = orange) ---------- */

  @keyframes resFlashUp {
      0% { background: rgba(167, 243, 208, 0.35); }
      100% { background: var(--glass-bg-soft); }
  }

  @keyframes resFlashDown {
      0% { background: rgba(255, 155, 6, 0.35); }
      100% { background: var(--glass-bg-soft); }
  }

  .res-flash-up { animation: resFlashUp 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
  .res-flash-down { animation: resFlashDown 0.6s cubic-bezier(0.4, 0, 0.2, 1); }

  /* ---------- victory confetti (box-shadow technique, same as starfield) ---------- */

  .confetti-layer {
      position: absolute;
      top: -10px;
      left: 0;
      width: 6px;
      height: 6px;
      border-radius: 2px;
      pointer-events: none;
      animation: confettiFall 3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  @keyframes confettiFall {
      0% { transform: translateY(0) rotate(0deg); opacity: 1; }
      100% { transform: translateY(105vh) rotate(720deg); opacity: 0.2; }
  }

  /* ---------- defeat dim ---------- */

  .end-screen.defeat::after {
      content: '';
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(10, 10, 20, 0.45);
      pointer-events: none;
  }

  .end-screen.defeat > * { position: relative; z-index: 1; }

  /* ---------- theme & anim controls ---------- */

  .theme-row {
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: center;
      margin-top: 18px;
      flex-wrap: wrap;
  }

  .theme-btn {
      min-width: 92px;
      padding: 8px 14px;
      font-size: 0.8rem;
  }

  .theme-btn.active {
      border-color: var(--accent-gold);
      box-shadow: 0 0 14px rgba(255, 205, 112, 0.35);
  }

  .header-controls {
      position: absolute;
      top: 20px;
      right: 20px;
      display: flex;
      gap: 8px;
  }

  .header-controls .btn { padding: 8px 14px; font-size: 0.8rem; }

  /* ---------- stats panel (start screen) & record badge ---------- */

  .stats-panel {
      margin-top: 24px;
      padding: 14px 22px;
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: 14px;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      box-shadow: var(--glass-shadow), var(--glass-highlight);
      font-size: 0.85rem;
      color: var(--text-secondary);
      display: flex;
      gap: 22px;
      flex-wrap: wrap;
      justify-content: center;
  }

  .stats-panel strong { color: var(--accent-gold); }

  .stats-title {
      width: 100%;
      text-align: center;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: 1px;
  }

  .record-badge {
      display: inline-block;
      margin-top: 10px;
      padding: 4px 14px;
      border-radius: 999px;
      background: linear-gradient(135deg, var(--accent-gold), var(--accent-orange));
      color: #3a2a10;
      font-weight: 700;
      font-size: 0.8rem;
      letter-spacing: 1px;
      animation: permPulse 1.2s cubic-bezier(0.4, 0, 0.2, 1) 2;
  }
  ```

- [ ] **Step 2: 静态验证**
  ```bash
  wc -l styles.css                                   # 712 + 追加块行数（实测见附录 B）
  grep -c 'data-theme="glacier"\|data-theme="abyss"\|data-anim="off"\|prefers-reduced-motion' styles.css   # 预期 4
  node -e "const s=require('fs').readFileSync('styles.css','utf8');for(const v of ['--bg-image','[data-theme=\"glacier\"]','[data-theme=\"abyss\"]','[data-anim=\"off\"]','prefers-reduced-motion','.card-art-band','.card-fly-out','.perm-new','.confetti-layer','.record-badge','.stats-panel','.res-flash-up','.res-flash-down']){if(!s.includes(v))throw new Error('missing: '+v)}console.log('M1 css blocks OK')"
  ```

---

## Task 3: index.html — 图标位/主题与动画控件/战绩面板/script 顺序

**Files:**
- Modify: `/Users/haydenjiang/Downloads/RES_REP/index.html`（整文件替换为下方完整代码）

**Interfaces:**
- Consumes: `CR.icons.get(name)`（Task 1）；i18n 新键（Task 4）；ui.js 新全局函数（Task 5）：`cycleTheme()`、`setTheme(key)`、`toggleAnim()`
- Produces: 新 DOM id：`themeBtnVenus/Glacier/Abyss`、`animToggleStart`、`statsPanel`、`themeCycleBtn`、`animToggleBtn`；`data-icon` 占位元素（boot 时由 ui 填充 `CR.icons.get`）；script 顺序 data → i18n → icons → state → engine → ui
- 约定：带 `data-icon` 的空 span 由 `CR.ui.refreshTexts()` 填充 SVG（幂等）；`data-i18n` 只挂在纯文本元素上（refreshTexts 的 textContent 赋值不会清掉图标）

- [ ] **Step 1: 整文件替换 index.html（完整代码如下）**
  ```html
  <!DOCTYPE html>
  <html lang="zh-CN" data-theme="venus">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cloud Republic: Venus Floating City | Res Publica</title>
      <link rel="stylesheet" href="styles.css">
  </head>
  <body>
      <div class="stars" id="stars"></div>

      <div class="end-screen" id="endScreen">
          <div class="end-title" id="endTitle">Game Over</div>
          <div class="end-reason" id="endReason"></div>
          <div class="score-board" id="scoreBoard"></div>
          <button class="btn" onclick="location.reload()"><span class="btn-icon" data-icon="action.restart"></span><span data-i18n="btn.play_again">Play Again</span></button>
      </div>

      <div class="end-screen" id="startScreen">
          <div class="game-title" style="font-size: 3rem;" data-i18n="ui.title">Cloud Republic</div>
          <p class="game-subtitle" data-i18n="ui.subtitle" style="margin-top: 10px;">Res Publica: Venus Floating City Colonization Project</p>
          <p style="color: var(--text-secondary); margin: 20px 0 5px;" data-i18n="ui.choose_difficulty">Choose a difficulty to start</p>
          <p style="color: var(--text-secondary); font-size: 0.85rem;" data-i18n="ui.start_hint">Complete purification and build habitats</p>
          <div style="display: flex; gap: 15px; flex-wrap: wrap; justify-content: center; margin-top: 25px;">
              <button class="btn btn-success diff-btn" id="diffEasy" onclick="startGame('easy')"></button>
              <button class="btn diff-btn" id="diffMedium" onclick="startGame('medium')"></button>
              <button class="btn btn-danger diff-btn" id="diffHard" onclick="startGame('hard')"></button>
          </div>
          <div class="theme-row">
              <span style="font-size: 0.8rem; color: var(--text-secondary);" data-i18n="ui.theme_label">Theme</span>
              <button class="btn btn-secondary theme-btn" id="themeBtnVenus" onclick="setTheme('venus')"></button>
              <button class="btn btn-secondary theme-btn" id="themeBtnGlacier" onclick="setTheme('glacier')"></button>
              <button class="btn btn-secondary theme-btn" id="themeBtnAbyss" onclick="setTheme('abyss')"></button>
              <button class="btn btn-secondary theme-btn" id="animToggleStart" onclick="toggleAnim()"></button>
          </div>
          <div class="stats-panel" id="statsPanel"></div>
      </div>

      <div class="modal-overlay" id="eventModal">
          <div class="modal-content">
              <div class="modal-title" id="modalTitle">Environmental Event</div>
              <div class="modal-text" id="modalText"></div>
              <button class="btn" id="modalBtn" onclick="closeEventModal()">Proceed</button>
          </div>
      </div>

      <div id="game-container">
          <header class="game-header">
              <div class="header-controls">
                  <button class="btn btn-secondary" id="themeCycleBtn" onclick="cycleTheme()"></button>
                  <button class="btn btn-secondary" id="animToggleBtn" onclick="toggleAnim()"></button>
                  <button class="btn btn-secondary" id="langBtn" onclick="toggleLang()">EN</button>
              </div>
              <h1 class="game-title" data-i18n="ui.title">Cloud Republic</h1>
              <p class="game-subtitle" data-i18n="ui.subtitle">Res Publica: Venus Floating City Colonization Project</p>
          </header>

          <div class="game-main">
              <div class="left-panel">
                  <div class="panel">
                      <div class="panel-title">
                          <span class="pt-icon" data-icon="panel.player"></span> <span data-i18n="ui.player_status">Player Status</span>
                      </div>
                      <div class="player-info">
                          <div class="player-avatar">P1</div>
                          <div class="player-details">
                              <h4 data-i18n="ui.faction">Player Faction</h4>
                              <span data-i18n="ui.habitat_alpha">Floating Habitat Alpha</span>
                          </div>
                      </div>
                      <div class="resource-grid" id="resourcePanel">
                          <div class="resource-item" id="res-money">
                              <div class="resource-label"><span class="rl-icon" data-icon="res.money"></span><span data-i18n="res.money">Funds</span></div>
                              <div class="resource-value">65</div>
                              <div class="resource-bar">
                                  <div class="resource-bar-fill" style="width: 65%; background: var(--accent-gold)"></div>
                              </div>
                          </div>
                          <div class="resource-item" id="res-materials">
                              <div class="resource-label"><span class="rl-icon" data-icon="res.materials"></span><span data-i18n="res.materials">Materials</span></div>
                              <div class="resource-value">75</div>
                              <div class="resource-bar">
                                  <div class="resource-bar-fill" style="width: 75%; background: #a78bfa"></div>
                              </div>
                          </div>
                          <div class="resource-item" id="res-energy">
                              <div class="resource-label"><span class="rl-icon" data-icon="res.energy"></span><span data-i18n="res.energy">Energy</span></div>
                              <div class="resource-value">25</div>
                              <div class="resource-bar">
                                  <div class="resource-bar-fill" style="width: 25%; background: var(--accent-cyan)"></div>
                              </div>
                          </div>
                          <div class="resource-item" id="res-research">
                              <div class="resource-label"><span class="rl-icon" data-icon="res.research"></span><span data-i18n="res.research">Research</span></div>
                              <div class="resource-value">8</div>
                              <div class="resource-bar">
                                  <div class="resource-bar-fill" style="width: 8%; background: var(--accent-purple)"></div>
                              </div>
                          </div>
                          <div class="resource-item" id="res-morale">
                              <div class="resource-label"><span class="rl-icon" data-icon="res.morale"></span><span data-i18n="res.morale">Morale</span></div>
                              <div class="resource-value">70</div>
                              <div class="resource-bar">
                                  <div class="resource-bar-fill" style="width: 70%; background: var(--accent-green)"></div>
                              </div>
                          </div>
                          <div class="resource-item" id="res-integrity">
                              <div class="resource-label"><span class="rl-icon" data-icon="res.integrity"></span><span data-i18n="res.integrity">Integrity</span></div>
                              <div class="resource-value">100%</div>
                              <div class="resource-bar">
                                  <div class="resource-bar-fill" style="width: 100%; background: #6b7280"></div>
                              </div>
                          </div>
                      </div>
                  </div>

                  <div class="panel" style="margin-top: 20px;">
                      <div class="panel-title">
                          <span class="pt-icon" data-icon="panel.permanent"></span> <span data-i18n="ui.permanent_effects">Permanent Effects</span>
                      </div>
                      <div id="permanentCards" style="font-size: 0.85rem; color: var(--text-secondary);">
                          No permanent cards yet
                      </div>
                  </div>
              </div>

              <div class="center-area">
                  <div class="turn-info">
                      <div>
                          <div class="turn-phase" id="currentPhase">Setup Phase</div>
                          <div class="phase-indicator" id="phaseIndicator">
                              <div class="phase-dot" id="dot-event"></div>
                              <div class="phase-dot" id="dot-action"></div>
                              <div class="phase-dot" id="dot-settlement"></div>
                          </div>
                          <div class="turn-number"><span id="turnText">Turn 0 / 22</span></div>
                          <div class="turn-number" style="margin-top: 4px;"><span id="difficultyText"></span></div>
                      </div>
                      <div style="text-align: right;">
                          <div style="font-size: 0.85rem; color: var(--text-secondary);" data-i18n="ui.cards_selected">Cards Selected</div>
                          <div style="font-size: 1.5rem; color: var(--accent-gold);" id="selectedCount">0/3</div>
                      </div>
                  </div>

                  <div class="panel public-track">
                      <div class="panel-title">
                          <span class="pt-icon" data-icon="panel.globe"></span> <span data-i18n="ui.global_progress">Global Progress</span>
                      </div>
                      <div class="track-item">
                          <div class="track-header">
                              <span data-i18n="ui.purification_label">Sulfuric Acid Cloud Purification</span>
                              <span id="purificationText">0%</span>
                          </div>
                          <div class="track-bar-bg">
                              <div class="track-bar-fill purification-fill" id="purificationBar" style="width: 0%">
                                  <span id="purificationPercent">0%</span>
                              </div>
                          </div>
                      </div>
                      <div class="track-item">
                          <div class="track-header">
                              <span data-i18n="ui.habitat_count">Habitat Count</span>
                              <span id="habitatText">1 / Target: 6</span>
                          </div>
                      </div>
                  </div>

                  <div class="panel card-area" style="position: relative;">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                          <div class="panel-title" style="margin: 0;">
                              <span class="pt-icon" data-icon="panel.hand"></span> <span data-i18n="ui.hand">Hand</span>
                          </div>
                          <div style="font-size: 0.8rem; color: var(--text-secondary);" id="handHint">
                              Click to select cards to play (max 3 per turn)
                          </div>
                      </div>
                      <div class="card-grid" id="handCards">
                      </div>
                      <div class="btn-group">
                          <button class="btn" id="playBtn" onclick="playSelectedCards()" disabled><span class="btn-icon" data-icon="action.play"></span><span data-i18n="btn.play">Play Selected Cards</span></button>
                          <button class="btn btn-secondary" id="repairBtn" onclick="repairHabitat()"><span class="btn-icon" data-icon="action.repair"></span><span data-i18n="btn.repair">Repair (-2 Materials +1%)</span></button>
                          <button class="btn btn-secondary" id="buildHabitatBtn" onclick="buildHabitat()"><span class="btn-icon" data-icon="action.build"></span><span data-i18n="btn.build">Build Habitat (-20 Funds -12 Materials)</span></button>
                      </div>
                      <div class="phase-actions" id="actionPhaseControls">
                          <button class="btn btn-success" id="endTurnBtn" onclick="endTurn()"><span class="btn-icon" data-icon="action.turn"></span><span data-i18n="btn.next_turn">Next Turn</span></button>
                      </div>
                  </div>

                  <div class="panel">
                      <div class="panel-title">
                          <span class="pt-icon" data-icon="panel.log"></span> <span data-i18n="ui.event_log">Event Log</span>
                      </div>
                      <div class="log-panel" id="gameLog">
                      </div>
                  </div>
              </div>

              <div class="right-panel">
                  <div class="panel">
                      <div class="panel-title">
                          <span class="pt-icon" data-icon="panel.threat"></span> <span data-i18n="ui.threats">Environmental Threats</span>
                      </div>
                      <div style="margin-bottom: 15px;">
                          <div class="track-header" style="margin-bottom: 8px;">
                              <span data-i18n="ui.corrosion_label">Sulfuric Acid Corrosion Rate</span>
                              <span style="color: var(--accent-rose);" id="corrosionRateText">-2%/turn</span>
                          </div>
                          <div class="track-bar-bg">
                              <div class="track-bar-fill corrosion-fill" id="corrosionBar" style="width: 0%"></div>
                          </div>
                      </div>
                      <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5;">
                          <p data-i18n="rules.integrity_decay">&#8226; Structural Integrity decreases per turn</p>
                          <p data-i18n="rules.crash">&#8226; Reaches 0 = Habitat Crash</p>
                          <p data-i18n="rules.repair">&#8226; Repair: 2 Materials = 1%</p>
                          <p data-i18n="rules.strike">&#8226; Morale &lt; 30: Workers Strike</p>
                      </div>
                  </div>

                  <div class="panel" style="margin-top: 20px;">
                      <div class="panel-title">
                          <span class="pt-icon" data-icon="panel.rules"></span> <span data-i18n="rules.title">Game Rules</span>
                      </div>
                      <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.6;">
                          <p><strong style="color: var(--text-primary);" data-i18n="rules.defeat">Collective Defeat:</strong></p>
                          <p><strong style="color: var(--text-primary);" data-i18n="rules.victory">Collective Victory:</strong></p>
                          <p><strong style="color: var(--text-primary);" data-i18n="rules.personal">Personal Victory:</strong></p>
                          <br>
                          <p data-i18n="rules.maturity_header">Maturity Cost Multipliers:</p>
                          <p data-i18n="rules.maturity_1">&#9733; Driving x0.6 | &#9654; Trending x0.8</p>
                          <p data-i18n="rules.maturity_2">&#9650; Emerging x1.0 | &#9680; Signaling x1.3</p>
                          <p data-i18n="rules.maturity_3">&#9729; Brewing x1.5 (Requires Research &gt;=10)</p>
                      </div>
                  </div>
              </div>
          </div>
      </div>
      <script src="js/data.js"></script>
      <script src="js/i18n.js"></script>
      <script src="js/icons.js"></script>
      <script src="js/state.js"></script>
      <script src="js/engine.js"></script>
      <script src="js/ui.js"></script>
  </body>
  </html>
  ```

- [ ] **Step 2: 静态检查**
  ```bash
  grep 'script src' index.html           # 顺序：data / i18n / icons / state / engine / ui
  grep -c 'data-icon=' index.html        # 预期 18（7 面板 + 6 资源 + 5 按钮）
  grep -c '&#9670;\|&#9673;\|&#127758;\|&#127183;\|&#128220;\|&#128202;' index.html   # 预期 0（面板标题 emoji 已清除；规则区 ★▶ 等内文符号保留）
  ```

---

## Task 4: js/i18n.js — 追加 M1 键 + 清除 res.* 文案内 emoji

**Files:**
- Modify: `/Users/haydenjiang/Downloads/RES_REP/js/i18n.js`（两处小改：替换 res.* 六条文案；在 zh/en 字典各追加 14 个键）

**Interfaces:**
- Consumes: 现有 DICT 结构
- Produces: 新键 `theme.venus/glacier/abyss`、`ui.theme_label`、`ui.anim_label`、`ui.anim_on`、`ui.anim_off`、`stats.title/games/wins/best_contribution/best_purification/new_record/no_games`（zh+en）；`res.*` 六条改为纯文本（emoji 移至 index.html 的 `data-icon` 图标位）

- [ ] **Step 1: 替换 zh 字典中的 res.* 六条（js/i18n.js 内精确 old→new）**
  old:
  ```js
        'res.money': '💰 资金',
        'res.materials': '🧱 材料',
        'res.energy': '⚡ 能源',
        'res.research': '🔬 科研',
        'res.morale': '😊 士气',
        'res.integrity': '🔧 完整度',
  ```
  new:
  ```js
        'res.money': '资金',
        'res.materials': '材料',
        'res.energy': '能源',
        'res.research': '科研',
        'res.morale': '士气',
        'res.integrity': '完整度',
  ```
  同法替换 en 字典：`'💰 Funds'` → `'Funds'`、`'🧱 Materials'` → `'Materials'`、`'⚡ Energy'` → `'Energy'`、`'🔬 Research'` → `'Research'`、`'😊 Morale'` → `'Morale'`、`'🔧 Integrity'` → `'Integrity'`。

- [ ] **Step 2: 在 zh 字典的 `'ui.lang_btn'` 行之后插入以下 14 个键**
  ```js
        'theme.venus': '金星橙',
        'theme.glacier': '冰川蓝',
        'theme.abyss': '深空黑',
        'ui.theme_label': '主题',
        'ui.anim_label': '动画',
        'ui.anim_on': '动画：开',
        'ui.anim_off': '动画：关',
        'stats.title': '本地战绩',
        'stats.games': '场次',
        'stats.wins': '胜场',
        'stats.best_contribution': '最高贡献',
        'stats.best_purification': '最高净化',
        'stats.new_record': '新纪录！',
        'stats.no_games': '暂无战绩 — 开始你的第一局',
  ```
  在 en 字典的 `'ui.lang_btn': '中文'` 行之后插入：
  ```js
        'theme.venus': 'Venus',
        'theme.glacier': 'Glacier',
        'theme.abyss': 'Abyss',
        'ui.theme_label': 'Theme',
        'ui.anim_label': 'Motion',
        'ui.anim_on': 'Motion: On',
        'ui.anim_off': 'Motion: Off',
        'stats.title': 'Local Records',
        'stats.games': 'Games',
        'stats.wins': 'Wins',
        'stats.best_contribution': 'Best Score',
        'stats.best_purification': 'Best Purification',
        'stats.new_record': 'NEW RECORD!',
        'stats.no_games': 'No records yet — start your first game',
  ```

- [ ] **Step 3: Node 验证（字典对等性回归）**
  ```bash
  node test/simulate.js   # 78/78（含 zh/en key parity 断言）——新增键双语齐全才可通过
  node -e "const i = require('./js/i18n.js'); console.log(i.t('theme.glacier'), '/', i.t('stats.new_record'), '|', i.t('res.money')); i.setLang('en'); console.log(i.t('theme.glacier'), '/', i.t('stats.new_record'), '|', i.t('res.money'))"
  # 预期：冰川蓝 / 新纪录！ | 资金  换行  Glacier / NEW RECORD! | Funds
  ```

---

## Task 5: js/ui.js — 全文替换（图标/卡面/动效/主题/动画开关/战绩）

**Files:**
- Modify: `/Users/haydenjiang/Downloads/RES_REP/js/ui.js`（整文件替换为下方完整代码）

**Interfaces:**
- Consumes: `CR.icons.get/cardArt`（Task 1）；`CR.data/CR.i18n/CR.state/CR.engine`（不变）；index.html 新 DOM（Task 3）
- Produces:
  - window 全局（既有）：`startGame(key)`、`toggleLang()`、`closeEventModal()`、`playSelectedCards()`、`repairHabitat()`、`buildHabitat()`、`endTurn()`
  - window 全局（新增）：`setTheme(theme)`、`cycleTheme()`、`toggleAnim()`
  - `CR.ui = { refreshTexts() }`（扩展：填充 data-icon、主题/动画按钮标签、战绩面板）
  - 模块内新增：`loadStats()` → stats 对象、`recordGame(state)` → `{ newContribution, newPurification }`、`renderStatsPanel()`、`applyTheme(theme)`、`applyAnim(on)`、`animateValue(el, from, to, suffix)`、`pulseNewPermanent()`、`spawnConfetti(container)`

- [ ] **Step 1: 整文件替换 js/ui.js（完整代码如下）**
  ```js
  // ui.js — all DOM access lives here. Loaded last; requires CR.data / CR.i18n / CR.icons / CR.state / CR.engine.
  (function (root) {
    const CR = root.CR;
    const engine = CR.engine;
    const i18n = CR.i18n;
    const t = (key, params) => i18n.t(key, params);
    const icon = name => CR.icons.get(name);

    let state = null;
    let modalMode = null;        // null | 'event' | 'settlement'
    let modalContext = null;     // { event } for event mode (re-render on language switch)
    let lastHandSig = null;
    let prevResources = null;    // for value rolling / flash
    let prevPermCount = 0;       // for permanent-panel pulse
    let stats = null;            // local records (cr_stats v1)

    const THEMES = ['venus', 'glacier', 'abyss'];

    // ==================== LOG ====================

    function addLog(message) {
      const log = document.getElementById('gameLog');
      const entry = document.createElement('div');
      entry.className = 'log-entry slide-in';
      const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      entry.innerHTML = `<span class="log-time">[${time}]</span> ${message}`;
      log.insertBefore(entry, log.firstChild);

      while (log.children.length > 50) {
        log.removeChild(log.lastChild);
      }
    }

    // engine log bridge: key + params -> localized text; cardId/eventId localized here
    function engineLog(key, params) {
      const p = { ...(params || {}) };
      if (p.cardId !== undefined) {
        const c = CR.data.CARD_DATABASE.find(x => x.id === p.cardId);
        if (c) p.card = i18n.lang === 'zh' ? (c.name_zh || c.name) : c.name;
      }
      if (p.eventId !== undefined) {
        const e = CR.data.EVENTS.find(x => x.id === p.eventId);
        if (e) p.event = i18n.lang === 'zh' ? (e.name_zh || e.name) : e.name;
      }
      if (key === 'log.game_over') p.result = t('result.' + p.result);
      addLog(t(key, p));
    }

    // ==================== STARFIELD (single div + box-shadow) ====================

    function createStars() {
      const el = document.getElementById('stars');
      const w = window.innerWidth, h = window.innerHeight;
      const shadows = [];
      for (let i = 0; i < 120; i++) {
        const x = Math.floor(Math.random() * w);
        const y = Math.floor(Math.random() * h);
        const spread = Math.random() < 0.8 ? 0 : 1;
        const opacity = (0.3 + Math.random() * 0.7).toFixed(2);
        shadows.push(`${x}px ${y}px 0 ${spread}px rgba(255,255,255,${opacity})`);
      }
      el.style.width = '2px';
      el.style.height = '2px';
      el.style.boxShadow = shadows.join(',');
    }

    // ==================== LOCAL STATS (cr_stats v1) ====================

    function loadStats() {
      try {
        const raw = localStorage.getItem('cr_stats');
        if (raw) {
          const s = JSON.parse(raw);
          if (s && s.v === 1 && s.wins) return s;
        }
      } catch (e) { /* private mode etc. */ }
      return { v: 1, games: 0, wins: { easy: 0, medium: 0, hard: 0, sandbox: 0 }, bestContribution: 0, bestPurification: 0 };
    }

    function saveStats() {
      try { localStorage.setItem('cr_stats', JSON.stringify(stats)); } catch (e) { /* ignore */ }
    }

    // Called exactly once per finished game (guarded by state.statsRecorded).
    // Returns which records were broken (for the end-screen badge).
    function recordGame(s) {
      const broken = { newContribution: false, newPurification: false };
      stats.games++;
      if (s.gameResult === 'victory' && stats.wins[s.difficulty] !== undefined) {
        stats.wins[s.difficulty]++;
      }
      if (s.contribution > stats.bestContribution) {
        stats.bestContribution = s.contribution;
        broken.newContribution = true;
      }
      const pur = Math.floor(s.purification);
      if (pur > stats.bestPurification) {
        stats.bestPurification = pur;
        broken.newPurification = true;
      }
      saveStats();
      return broken;
    }

    function renderStatsPanel() {
      const el = document.getElementById('statsPanel');
      if (!el) return;
      if (!stats.games) {
        el.innerHTML = `<span class="stats-title">${t('stats.title')}</span><span>${t('stats.no_games')}</span>`;
        return;
      }
      el.innerHTML =
        `<span class="stats-title">${t('stats.title')}</span>` +
        `<span>${t('stats.games')}: <strong>${stats.games}</strong></span>` +
        `<span>${t('stats.wins')}: <strong>${stats.wins.easy}/${stats.wins.medium}/${stats.wins.hard}</strong> (${t('difficulty.easy')}/${t('difficulty.medium')}/${t('difficulty.hard')})</span>` +
        `<span>${t('stats.best_contribution')}: <strong>${stats.bestContribution}</strong></span>` +
        `<span>${t('stats.best_purification')}: <strong>${stats.bestPurification}%</strong></span>`;
    }

    // ==================== THEME & ANIMATION SWITCH ====================

    function currentTheme() { return document.documentElement.dataset.theme || 'venus'; }
    function animEnabled() { return document.documentElement.dataset.anim !== 'off'; }

    function applyTheme(theme) {
      if (!THEMES.includes(theme)) theme = 'venus';
      document.documentElement.dataset.theme = theme;
      try { localStorage.setItem('cr_theme', theme); } catch (e) { /* ignore */ }
      updateControlButtons();
    }

    function applyAnim(on) {
      if (on) delete document.documentElement.dataset.anim;
      else document.documentElement.dataset.anim = 'off';
      try { localStorage.setItem('cr_anim', on ? 'on' : 'off'); } catch (e) { /* ignore */ }
      updateControlButtons();
    }

    root.setTheme = applyTheme;
    root.cycleTheme = function () {
      const next = THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length];
      applyTheme(next);
    };
    root.toggleAnim = function () { applyAnim(!animEnabled()); };

    function updateControlButtons() {
      const theme = currentTheme();
      THEMES.forEach(key => {
        const btn = document.getElementById('themeBtn' + key.charAt(0).toUpperCase() + key.slice(1));
        if (btn) {
          btn.textContent = t('theme.' + key);
          btn.classList.toggle('active', key === theme);
        }
      });
      const cycleBtn = document.getElementById('themeCycleBtn');
      if (cycleBtn) cycleBtn.textContent = t('ui.theme_label') + ': ' + t('theme.' + theme);
      const animLabel = animEnabled() ? t('ui.anim_on') : t('ui.anim_off');
      ['animToggleStart', 'animToggleBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.textContent = animLabel;
      });
    }

    // ==================== LOCALIZED CARD TEXT ====================

    function cardName(card) { return i18n.lang === 'zh' ? (card.name_zh || card.name) : card.name; }
    function cardEffect(card) { return i18n.lang === 'zh' ? (card.effect_zh || card.effect) : card.effect; }

    // ==================== HAND RENDERING (dirty-signature) ====================

    function handSig() {
      const r = state.resources;
      return [
        state.hand.map(c => c.uid).join(','),
        state.phase, state.strike, i18n.lang,
        r.money, r.materials, r.energy, r.research,
        state.transportDiscount, state.extraCardPlayed
      ].join('|');
    }

    function renderHand() {
      const sig = handSig();
      if (sig === lastHandSig) {
        updateSelectionClasses();
        return;
      }
      lastHandSig = sig;

      const container = document.getElementById('handCards');
      container.innerHTML = '';

      state.hand.forEach((card, index) => {
        const isSelected = state.selectedCards.includes(index);
        const canPlay = engine.canAfford(state, card) && state.phase === 'action' && !state.strike;

        const cardEl = document.createElement('div');
        cardEl.className = `card cat-${card.category} ${isSelected ? 'selected' : ''} ${!canPlay ? 'disabled' : ''}`;

        const maturityClass = `maturity-${card.maturity}`;
        const typeName = t('type.' + card.type);
        const cost = engine.getCardCost(state, card); // discounted price (maturity x transportDiscount)

        cardEl.innerHTML = `
          <div class="card-maturity ${maturityClass}">${icon('mat.' + card.maturity)}</div>
          <div class="card-header">
            <div class="card-type-badge">${typeName}</div>
            <div class="card-category">${t('category.' + card.category)}</div>
          </div>
          <div class="card-art-band">${CR.icons.cardArt(card)}</div>
          <div class="card-name">${cardName(card)}</div>
          <div class="card-cost">
            ${cost.money ? `<span class="cost-tag">${icon('res.money')}${cost.money}</span>` : ''}
            ${cost.materials ? `<span class="cost-tag">${icon('res.materials')}${cost.materials}</span>` : ''}
            ${cost.energy ? `<span class="cost-tag">${icon('res.energy')}${cost.energy}</span>` : ''}
            ${cost.research ? `<span class="cost-tag">${icon('res.research')}${cost.research}</span>` : ''}
          </div>
          <div class="card-effect">${cardEffect(card)}</div>
        `;

        if (canPlay) {
          cardEl.onclick = () => toggleCardSelection(index);
        }
        container.appendChild(cardEl);
      });
      updateSelectionClasses();
    }

    function updateSelectionClasses() {
      const container = document.getElementById('handCards');
      Array.from(container.children).forEach((el, index) => {
        el.classList.toggle('selected', state.selectedCards.includes(index));
      });
      const maxCards = state.extraCardPlayed ? state.maxCardsPerTurn + 1 : state.maxCardsPerTurn;
      document.getElementById('selectedCount').textContent = `${state.selectedCards.length}/${maxCards}`;
    }

    function toggleCardSelection(index) {
      if (state.phase !== 'action') return;
      if (state.strike) {
        addLog(t('fail.strike_cards'));
        return;
      }

      const card = state.hand[index];
      if (!engine.canAfford(state, card)) return;

      const pos = state.selectedCards.indexOf(index);
      if (pos > -1) {
        state.selectedCards.splice(pos, 1);
      } else {
        const maxSelect = state.extraCardPlayed ? state.maxCardsPerTurn + 1 : state.maxCardsPerTurn;
        if (state.selectedCards.length >= maxSelect) {
          addLog(t('ui.log.max_selected', { max: maxSelect }));
          return;
        }
        state.selectedCards.push(index);
      }

      updateSelectionClasses(); // no full rebuild (dirty-signature performance optimization)
      document.getElementById('playBtn').disabled = state.selectedCards.length === 0 || state.phase !== 'action';
    }

    // ==================== PHASE INDICATOR & MODAL ====================

    function updatePhaseIndicator() {
      const dots = {
        event: document.getElementById('dot-event'),
        action: document.getElementById('dot-action'),
        settlement: document.getElementById('dot-settlement')
      };

      Object.values(dots).forEach(d => d.classList.remove('active', 'completed'));

      if (state.phase === 'event') {
        dots.event.classList.add('active');
      } else if (state.phase === 'action') {
        dots.event.classList.add('completed');
        dots.action.classList.add('active');
      } else if (state.phase === 'settlement') {
        dots.event.classList.add('completed');
        dots.action.classList.add('completed');
        dots.settlement.classList.add('active');
      }
    }

    function renderModal() {
      const modalBtn = document.getElementById('modalBtn');
      if (modalMode === 'event') {
        const event = modalContext && modalContext.event;
        if (event) {
          const name = i18n.lang === 'zh' ? (event.name_zh || event.name) : event.name;
          const desc = i18n.lang === 'zh' ? (event.desc_zh || event.desc) : event.desc;
          document.getElementById('modalTitle').textContent = t('modal.event_title', { name });
          document.getElementById('modalText').textContent = desc;
          modalBtn.textContent = t('modal.apply_event');
        } else {
          document.getElementById('modalTitle').textContent = t('modal.neutralized_title');
          document.getElementById('modalText').textContent = t('modal.neutralized_text');
          modalBtn.textContent = t('modal.proceed');
        }
      } else if (modalMode === 'settlement') {
        document.getElementById('modalTitle').textContent = t('modal.settlement_title', { turn: state.turn });
        document.getElementById('modalText').textContent = t('modal.settlement_text', { difficulty: t('difficulty.' + state.difficulty) });
        modalBtn.textContent = t('btn.begin_turn', { turn: state.turn + 1 });
      }
    }

    function openModal(mode, context) {
      modalMode = mode;
      modalContext = context || null;
      renderModal();
      document.getElementById('eventModal').classList.add('active');
    }

    // ==================== END SCREEN ====================

    function spawnConfetti(container) {
      container.querySelectorAll('.confetti-layer').forEach(el => el.remove());
      const w = window.innerWidth;
      [0, 1].forEach(layer => {
        const el = document.createElement('div');
        el.className = 'confetti-layer';
        const shadows = [];
        for (let i = 0; i < 60; i++) {
          const x = Math.floor(Math.random() * w);
          const y = Math.floor(Math.random() * -40);
          const colors = ['#FFCD70', '#A7F3D0', '#FFFFFF', '#FFB020'];
          shadows.push(`${x}px ${y}px 0 ${Math.random() < 0.5 ? 1 : 2}px ${colors[i % colors.length]}`);
        }
        el.style.boxShadow = shadows.join(',');
        el.style.animationDelay = (layer * 0.7) + 's';
        el.style.animationDuration = (2.6 + layer * 0.9) + 's';
        container.appendChild(el);
      });
    }

    function showEndScreen() {
      const screen = document.getElementById('endScreen');
      const title = document.getElementById('endTitle');
      const reasonText = document.getElementById('endReason');
      const board = document.getElementById('scoreBoard');

      document.getElementById('eventModal').classList.remove('active');
      modalMode = null;
      screen.classList.add('active');

      // record stats exactly once per game (refreshTexts may re-render this screen)
      if (!state.statsRecorded) {
        state.statsRecorded = true;
        state.newRecords = recordGame(state);
        renderStatsPanel();
      }
      const records = state.newRecords || { newContribution: false, newPurification: false };

      screen.classList.toggle('defeat', state.gameResult !== 'victory');

      if (state.gameResult === 'victory') {
        title.textContent = t('end.victory_title');
        title.style.color = 'var(--accent-gold)';
        reasonText.textContent = t('end.victory_text');
        spawnConfetti(screen);
      } else if (state.gameResult === 'defeat') {
        title.textContent = t('end.defeat_title');
        title.style.color = 'var(--accent-rose)';
        reasonText.textContent = t('end.defeat_text', {
          purification: state.purification.toFixed(1),
          habitats: state.habitats
        });
      } else { // 'crash'
        title.textContent = t('end.crash_title');
        title.style.color = '#dc2626';
        reasonText.textContent = t('end.crash_text');
      }

      const badge = (records.newContribution || records.newPurification)
        ? `<div class="record-badge">${t('stats.new_record')}</div>` : '';

      board.innerHTML = `
        <div class="score-card winner">
          <h3>${t('end.score_faction')}</h3>
          <div style="font-size: 2rem; color: var(--accent-gold); margin: 10px 0;">${state.contribution}</div>
          <div style="font-size: 0.85rem; color: var(--text-secondary);">
            ${t('end.habitats_score', { value: state.habitats * 20 })}<br>
            ${t('end.purification_score', { value: Math.floor(state.purification) })}<br>
            ${t('end.funds_score', { value: Math.floor(state.resources.money / 5) })}<br>
            ${t('end.prestige', { value: state.prestige })}
          </div>
          ${badge}
        </div>
        <div class="score-card">
          <h3>${t('end.score_final')}</h3>
          <div style="margin-top: 10px; font-size: 0.9rem; line-height: 1.8; color: var(--text-secondary);">
            ${t('end.difficulty_label', { value: t('difficulty.' + state.difficulty) })}<br>
            ${t('end.turn_label', { value: state.turn + '/' + state.maxTurns })}<br>
            ${t('end.purification_label', { value: state.purification.toFixed(1) + '%' })}<br>
            ${t('end.habitats_label', { value: state.habitats })}<br>
            ${t('end.integrity_label', { value: state.resources.integrity.toFixed(1) + '%' })}<br>
            ${t('end.charter_label', { value: state.hasCharter ? t('end.charter_yes') : t('end.charter_no') })}
          </div>
        </div>
      `;
    }

    // ==================== RESOURCE VALUE ROLLING & FLASH ====================

    function animateValue(el, from, to, suffix) {
      const shown = key => (key === '%' ? to.toFixed(0) + '%' : Math.floor(to));
      if (!animEnabled() || from === to || typeof requestAnimationFrame !== 'function') {
        el.textContent = suffix === '%' ? to.toFixed(0) + '%' : Math.floor(to);
        return;
      }
      const start = performance.now();
      const dur = 300;
      function frame(now) {
        const k = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - k, 3); // easeOutCubic ~ cubic-bezier(0.4,0,0.2,1) tail
        const v = from + (to - from) * eased;
        el.textContent = suffix === '%' ? v.toFixed(0) + '%' : Math.floor(v);
        if (k < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }

    // ==================== UI UPDATE ====================

    function updateUI() {
      const resMap = {
        'res-money': 'money', 'res-materials': 'materials',
        'res-energy': 'energy', 'res-research': 'research',
        'res-morale': 'morale', 'res-integrity': 'integrity'
      };

      for (const [id, key] of Object.entries(resMap)) {
        const el = document.getElementById(id);
        const value = state.resources[key];
        const valueEl = el.querySelector('.resource-value');
        const prev = prevResources ? prevResources[key] : value;
        animateValue(valueEl, prev, value, key === 'integrity' ? '%' : '');

        if (prevResources && value !== prev) {
          el.classList.remove('res-flash-up', 'res-flash-down');
          void el.offsetWidth; // restart animation
          el.classList.add(value > prev ? 'res-flash-up' : 'res-flash-down');
        }

        const bar = el.querySelector('.resource-bar-fill');
        bar.style.width = Math.min(100, value) + '%';

        el.classList.remove('warning', 'critical');
        if (key === 'integrity' && value < 30) el.classList.add('critical');
        else if (key === 'integrity' && value < 50) el.classList.add('warning');
        else if (key === 'morale' && value < 30) el.classList.add('warning');
        else if (key === 'energy' && value < 10) el.classList.add('warning');
      }
      prevResources = { ...state.resources };

      document.getElementById('turnText').textContent = t('ui.turn_of', { turn: state.turn, max: state.maxTurns });
      document.getElementById('difficultyText').textContent = t('ui.difficulty_label') + ': ' + t('difficulty.' + state.difficulty);
      document.getElementById('currentPhase').textContent = t('phase.' + state.phase);

      document.getElementById('purificationText').textContent = state.purification.toFixed(1) + '%';
      document.getElementById('purificationBar').style.width = state.purification + '%';
      document.getElementById('purificationPercent').textContent = state.purification.toFixed(0) + '%';

      document.getElementById('habitatText').textContent = t('ui.habitat_target', { count: state.habitats, target: state.targetHabitats });

      const maxCards = state.extraCardPlayed ? state.maxCardsPerTurn + 1 : state.maxCardsPerTurn;
      document.getElementById('selectedCount').textContent = `${state.selectedCards.length}/${maxCards}`;
      document.getElementById('handHint').textContent = t('ui.hand_hint', { max: maxCards });

      document.getElementById('playBtn').disabled = state.selectedCards.length === 0 || state.phase !== 'action';
      document.getElementById('endTurnBtn').disabled = state.phase !== 'action';
      document.getElementById('buildHabitatBtn').disabled =
        state.phase !== 'action' ||
        state.strike ||
        state.habitatExpansions >= state.maxHabitatExpansions ||
        state.resources.money < 20 ||
        state.resources.materials < 12;

      document.getElementById('corrosionRateText').textContent = t('ui.corrosion_rate', { rate: state.corrosionRate });

      renderHand();

      const permContainer = document.getElementById('permanentCards');
      if (state.permanentCards.length === 0 && state.timedEffects.length === 0 && state.delayedEffects.length === 0) {
        permContainer.innerHTML = t('ui.no_permanents');
      } else {
        permContainer.innerHTML =
          state.permanentCards.map(c =>
            `<div class="perm-row" style="padding: 4px 0; border-bottom: 1px solid var(--border);">
              <span style="color: var(--accent-cyan);">${cardName(c)}</span>
              <span style="font-size: 0.75rem; color: var(--text-secondary);"> - ${cardEffect(c)}</span>
            </div>`
          ).join('') +
          state.timedEffects.map(te => {
            const c = CR.data.CARD_DATABASE.find(x => x.id === te.cardId);
            const name = c ? cardName(c) : te.name;
            return `<div class="perm-row" style="padding: 4px 0; border-bottom: 1px solid var(--border);">
              <span style="color: var(--accent-gold);">${t('perm.timed_remaining', { name, turns: te.turnsLeft })}</span>
            </div>`;
          }).join('') +
          state.delayedEffects.map(de => {
            const c = CR.data.CARD_DATABASE.find(x => x.id === de.cardId);
            const name = c ? cardName(c) : de.name;
            return `<div class="perm-row" style="padding: 4px 0; border-bottom: 1px solid var(--border);">
              <span style="color: var(--accent-purple);">${t('perm.delayed_countdown', { name, turns: de.turnsLeft })}</span>
            </div>`;
          }).join('');
      }
    }

    // pulse the newly added permanent-panel entries (called after updateUI post-play)
    function pulseNewPermanent() {
      const container = document.getElementById('permanentCards');
      const rows = container.querySelectorAll('.perm-row');
      const added = state.permanentCards.length - prevPermCount;
      if (added > 0 && rows.length >= state.permanentCards.length) {
        for (let i = state.permanentCards.length - added; i < state.permanentCards.length; i++) {
          if (rows[i]) rows[i].classList.add('perm-new');
        }
      }
      prevPermCount = state.permanentCards.length;
    }

    // ==================== TURN FLOW (civ-style: fully player-driven) ====================

    function startTurnFlow() {
      engine.startNewTurn(state);
      if (state.gameOver) { showEndScreen(); return; }

      updateUI();
      updatePhaseIndicator();

      const event = engine.triggerEventPhase(state);
      openModal('event', { event }); // null event => neutralized modal
    }

    // ==================== GLOBAL ENTRY POINTS (inline onclick targets) ====================

    root.closeEventModal = function () {
      if (modalMode === 'event') {
        document.getElementById('eventModal').classList.remove('active');
        modalMode = null;

        engine.applyEvent(state);
        updateUI();
        updatePhaseIndicator();

        if (state.gameOver) { showEndScreen(); return; }

        if (state.strike) {
          addLog(t('ui.log.strike_action'));
        } else {
          const maxCards = state.extraCardPlayed ? state.maxCardsPerTurn + 1 : state.maxCardsPerTurn;
          addLog(t('ui.log.action_prompt', { max: maxCards }));
        }
      } else if (modalMode === 'settlement') {
        document.getElementById('eventModal').classList.remove('active');
        modalMode = null;
        startTurnFlow();
      }
    };

    root.playSelectedCards = function () {
      // pre-validate so the fly-out animation only runs on a real play
      if (!state || state.phase !== 'action' || state.strike || state.selectedCards.length === 0) {
        const result = engine.playSelectedCards(state);
        if (!result.ok) addLog(t(result.reason, result.reasonParams));
        return;
      }

      const container = document.getElementById('handCards');
      state.selectedCards.forEach(i => {
        const el = container.children[i];
        if (el) el.classList.add('card-fly-out');
      });

      const run = () => {
        const result = engine.playSelectedCards(state);
        if (!result.ok) {
          addLog(t(result.reason, result.reasonParams));
          updateUI();
          return;
        }
        updateUI();
        pulseNewPermanent();
        if (state.gameOver) showEndScreen();
      };

      if (animEnabled()) setTimeout(run, 180); // animation delay only; not part of turn flow
      else run();
    };

    root.repairHabitat = function () {
      const result = engine.repairHabitat(state);
      if (!result.ok) addLog(t(result.reason, result.reasonParams));
      updateUI();
    };

    root.buildHabitat = function () {
      const result = engine.buildHabitat(state);
      if (!result.ok) addLog(t(result.reason, result.reasonParams));
      updateUI();
      if (state.gameOver) showEndScreen();
    };

    root.endTurn = function () { // the "Next Turn" button
      if (!state || state.phase !== 'action') return;

      engine.endTurn(state);
      updateUI();
      updatePhaseIndicator();

      if (state.gameOver) { showEndScreen(); return; }
      openModal('settlement'); // settlement summary parks until the player begins the next turn
    };

    root.startGame = function (difficultyKey) {
      document.getElementById('startScreen').classList.remove('active');

      state = CR.state.createInitialState(difficultyKey);
      lastHandSig = null;
      prevResources = null;
      prevPermCount = 0;
      engine.drawInitialCards(state);
      updateUI();
      updatePhaseIndicator();

      addLog(t('ui.log.game_started', { difficulty: t('difficulty.' + state.difficulty) }));
      addLog(t('ui.log.goal', { turns: state.maxTurns }));
      addLog(t('ui.log.init_corrosion', { rate: state.corrosionRate }));

      startTurnFlow();
    };

    root.toggleLang = function () {
      i18n.setLang(i18n.lang === 'zh' ? 'en' : 'zh'); // setLang triggers CR.ui.refreshTexts()
    };

    // ==================== I18N REFRESH ====================

    function refreshTexts() {
      // static data-i18n elements (text-only; icon spans carry no data-i18n)
      document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
      });
      // fill SVG icon placeholders (idempotent)
      document.querySelectorAll('[data-icon]').forEach(el => {
        el.innerHTML = icon(el.getAttribute('data-icon'));
      });
      // language button shows the OTHER language
      document.getElementById('langBtn').textContent = t('ui.lang_btn');
      // difficulty buttons (name + description)
      ['easy', 'medium', 'hard'].forEach(key => {
        const btn = document.getElementById('diff' + key.charAt(0).toUpperCase() + key.slice(1));
        btn.innerHTML = `${t('difficulty.' + key)}<br><span style="font-size: 0.7rem; font-weight: 400; text-transform: none;">${t('difficulty.' + key + '_desc')}</span>`;
      });
      updateControlButtons();
      renderStatsPanel();
      // dynamic areas
      if (state) {
        lastHandSig = null; // force hand rebuild in the new language
        updateUI();
        updatePhaseIndicator();
        if (modalMode) renderModal();
        if (state.gameOver) showEndScreen();
      }
    }

    CR.ui = { refreshTexts };

    // ==================== INIT ====================

    function boot() {
      i18n.init();
      stats = loadStats();
      // restore theme & anim preferences (independent of language)
      let savedTheme = 'venus', savedAnim = 'on';
      try {
        savedTheme = localStorage.getItem('cr_theme') || 'venus';
        savedAnim = localStorage.getItem('cr_anim') || 'on';
      } catch (e) { /* ignore */ }
      applyTheme(savedTheme);
      applyAnim(savedAnim !== 'off');

      engine.onLog = engineLog;
      createStars();
      refreshTexts();
      document.getElementById('startScreen').classList.add('active');
    }

    root.onload = boot;
  })(window);
  ```

- [ ] **Step 2: 静态验证**
  ```bash
  node --check js/ui.js
  grep -c 'card-art-band\|card-fly-out\|perm-new\|confetti-layer\|record-badge\|cr_stats\|data-theme' js/ui.js   # 预期 ≥ 8
  node test/simulate.js   # 78/78（ui.js 不被 Node 加载，防误改）
  ```

---

## Task 6: 验收（Node 回归 + DOM stub 烟测 + 静态核对 + 人工目检）

**Files:**
- 不新建/修改项目文件（stub 脚本放 /tmp，不进项目）

**Interfaces:**
- Consumes: 全部前序任务产物
- Produces: 验收结论

- [ ] **Step 1: 自动化回归与静态核对（项目根目录）**
  ```bash
  node test/simulate.js                                   # 78 passed, 0 failed（逻辑零改动）
  for f in js/*.js test/*.js; do node --check "$f" || echo "SYNTAX FAIL $f"; done
  grep -rn 'https\?://' index.html styles.css js/ | grep -v 'w3.org' || echo 'no external resources OK'
  grep -c 'fonts.googleapis\|fonts.gstatic' index.html styles.css js/*.js || echo 'no webfont refs OK'
  ```

- [ ] **Step 2: DOM stub 烟测（ui.js 的 Node 级冒烟，写 /tmp/dom-smoke.js 后运行）**
  目的：无浏览器条件下验证 boot → 开始界面 → startGame → 事件弹窗 → closeEventModal → endTurn → 结算弹窗 → 再开始回合 全链路不抛异常，且图标/战绩/主题函数被真实调用。完整脚本：
  ```js
  // /tmp/dom-smoke.js — minimal DOM stub smoke test for ui.js (not part of the project)
  'use strict';
  const PROJECT = '/Users/haydenjiang/Downloads/RES_REP';

  // ---------- minimal DOM ----------
  function makeEl(tag) {
    const el = {
      tagName: tag, children: [], style: {}, dataset: {}, innerHTML: '', textContent: '',
      classList: {
        _s: new Set(),
        add(...c) { c.forEach(x => this._s.add(x)); },
        remove(...c) { c.forEach(x => this._s.delete(x)); },
        toggle(c, f) { if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (f) this._s.add(c); else this._s.delete(c); },
        contains(c) { return this._s.has(c); }
      },
      setAttribute(k, v) { el['attr_' + k] = v; },
      getAttribute(k) { return el['attr_' + k] !== undefined ? el['attr_' + k] : null; },
      appendChild(c) { el.children.push(c); return c; },
      insertBefore(c, ref) { el.children.unshift(c); return c; },
      removeChild(c) { el.children = el.children.filter(x => x !== c); },
      remove() {},
      querySelector() { return makeEl('div'); },
      querySelectorAll() { return []; },
      addEventListener() {},
      get firstChild() { return el.children[0] || null; },
      get lastChild() { return el.children[el.children.length - 1] || null; },
      get offsetWidth() { return 100; },
      set onclick(fn) { el._onclick = fn; },
      get onclick() { return el._onclick; },
      disabled: false
    };
    return el;
  }

  const ids = {};
  const idList = ['stars','endScreen','endTitle','endReason','scoreBoard','startScreen','eventModal','modalTitle','modalText','modalBtn','langBtn','themeCycleBtn','animToggleBtn','animToggleStart','themeBtnVenus','themeBtnGlacier','themeBtnAbyss','statsPanel','resourcePanel','res-money','res-materials','res-energy','res-research','res-morale','res-integrity','permanentCards','currentPhase','phaseIndicator','dot-event','dot-action','dot-settlement','turnText','difficultyText','selectedCount','purificationText','purificationBar','purificationPercent','habitatText','handHint','handCards','playBtn','repairBtn','buildHabitatBtn','endTurnBtn','gameLog','corrosionRateText','corrosionBar','diffEasy','diffMedium','diffHard'];
  idList.forEach(id => { ids[id] = makeEl('div'); });
  // resource items need querySelector to return stable children
  ['res-money','res-materials','res-energy','res-research','res-morale','res-integrity'].forEach(id => {
    const val = makeEl('div'), bar = makeEl('div');
    ids[id].querySelector = sel => sel === '.resource-value' ? val : bar;
  });
  ids.handCards.querySelectorAll = () => ids.handCards.children;
  ids.permanentCards.querySelectorAll = () => ids.permanentCards.children;

  const documentEl = makeEl('html');
  global.document = {
    documentElement: documentEl,
    getElementById: id => ids[id] || null,
    createElement: tag => makeEl(tag),
    querySelectorAll: sel => [],
    querySelector: () => null
  };
  global.window = global;
  global.innerWidth = 1400; global.innerHeight = 900;
  global.localStorage = { _m: {}, getItem(k) { return this._m[k] ?? null; }, setItem(k, v) { this._m[k] = String(v); }, removeItem(k) { delete this._m[k]; } };
  // fake clock: each rAF fires once with +350ms so animateValue's 300ms roll completes in one frame
  let vnow = 0;
  global.requestAnimationFrame = fn => { vnow += 350; return fn(vnow); };

  // ---------- load project scripts in browser order ----------
  require(PROJECT + '/js/data.js');
  require(PROJECT + '/js/i18n.js');
  require(PROJECT + '/js/icons.js');
  require(PROJECT + '/js/state.js');
  require(PROJECT + '/js/engine.js');
  // ui.js is an IIFE over `window`; load via require after wrapping
  const fs = require('fs');
  eval(fs.readFileSync(PROJECT + '/js/ui.js', 'utf8'));

  const CR = globalThis.CR;
  let failed = 0;
  const check = (cond, name) => { console.log((cond ? '  PASS ' : '  FAIL ') + name); if (!cond) failed++; };

  // boot
  window.onload();
  check(ids.startScreen.classList.contains('active'), 'boot: start screen shown');
  check(CR.ui && typeof CR.ui.refreshTexts === 'function', 'boot: CR.ui.refreshTexts exposed');
  check(documentEl.dataset.theme === 'venus', 'boot: default theme venus');

  // start a game (medium)
  window.startGame('medium');
  check(!ids.startScreen.classList.contains('active'), 'startGame: start screen hidden');
  check(ids.eventModal.classList.contains('active'), 'startGame: event modal opened');
  check(ids.handCards.children.length > 0, 'startGame: hand rendered');

  // event modal -> action phase
  window.closeEventModal();
  check(!ids.eventModal.classList.contains('active'), 'closeEventModal: modal closed');

  // end turn -> settlement modal -> next turn
  window.endTurn();
  check(ids.eventModal.classList.contains('active'), 'endTurn: settlement modal opened');
  window.closeEventModal();
  check(true, 'closeEventModal(settlement): next turn flow ran without throwing');

  // theme / anim toggles
  window.cycleTheme();
  check(documentEl.dataset.theme === 'glacier', 'cycleTheme: venus -> glacier');
  window.toggleAnim();
  check(documentEl.dataset.anim === 'off', 'toggleAnim: data-anim=off set');
  window.toggleAnim();
  check(documentEl.dataset.anim !== 'off', 'toggleAnim: restored');

  // stats panel rendered
  check(String(ids.statsPanel.innerHTML).length > 0, 'stats panel rendered');

  console.log(failed === 0 ? '\nDOM SMOKE OK' : `\n${failed} FAILURES`);
  process.exit(failed === 0 ? 0 : 1);
  ```
  运行 `node /tmp/dom-smoke.js`，预期全部 PASS + `DOM SMOKE OK`。

- [ ] **Step 3: 首屏 DOM 节点数实测（写入实现总结，预算 ≤400）**
  无浏览器，用标签计数法（口径与第二轮一致 + 动态区静态估算）：
  ```bash
  node -e "
  const fs = require('fs');
  const html = fs.readFileSync('index.html', 'utf8');
  const staticNodes = (html.match(/<[a-zA-Z]/g) || []).length;
  const ic = require('./js/icons.js');
  // 图标占位节点（index.html 内 18 个 data-icon 位，每个 svg 1 + 子节点）
  const iconNodes = name => 1 + ((ic.get(name).match(/<(circle|path|rect|ellipse|polyline|line)/g) || []).length);
  const panelIcons = ['panel.player','panel.permanent','panel.globe','panel.hand','panel.log','panel.threat','panel.rules'];
  const resIcons = ['res.money','res.materials','res.energy','res.research','res.morale','res.integrity'];
  const btnIcons = ['action.restart','action.play','action.repair','action.build','action.turn'];
  const iconTotal = [...panelIcons, ...resIcons, ...btnIcons].reduce((s, n) => s + iconNodes(n), 0);
  // 单卡节点：card 本体1 + maturity(1+icon子) + header(1+2) + art-band(1+1+母题子节点) + name/cost/effect(3) + cost tags(≤4×(1+1+icon子))
  const artChildren = c => (ic.cardArt({ id: 1, category: c, maturity: 'driving' }).match(/<(circle|path|polyline)/g) || []).length;
  const cats = ['economy','environment','governance','social','tech','wellbeing','venus'];
  const artMax = Math.max(...cats.map(artChildren));
  const perCard = 1 + 2 + 3 + (2 + artMax) + 3 + 4 * 3;
  console.log('静态(开始界面):', staticNodes, '+ 星空1 + 图标位', iconTotal, '=', staticNodes + 1 + iconTotal);
  console.log('对局峰值估算(8 手牌): 静态', staticNodes, '+ 星空1 + 图标', iconTotal, '+ 8×' + perCard, '=', staticNodes + 1 + iconTotal + 8 * perCard);
  "
  ```
  预期（本计划干跑实测）：**首屏（开始界面）252 节点（≤400 ✓**，口径与第二轮 165 基线一致：静态标签 197 + 星空 1 + 图标位 54）；**对局峰值估算 ≈ 484**（8 张满手牌 × 每卡 ~29 个 SVG 节点）。对局峰值超出 400 属预期现象——spec 的 ≤400 明确是「首屏」口径（放宽自 165 的开始界面基线）；若用户希望连对局峰值也压到 400 内，两个备选（本轮默认不做）：卡面带改 `data:image/svg+xml` CSS 背景（-56 节点）或将成本图标合并为单 path（-32 节点）。实测值以本步输出为准并写入附录 B。

- [ ] **Step 4: 人工目检（`open /Users/haydenjiang/Downloads/RES_REP/index.html`，逐项核对 spec §7）**
  - [ ] 三主题：开始界面三个主题按钮与 header 循环按钮即时换肤（金星橙/冰川蓝/深空黑），刷新后保持（cr_theme）
  - [ ] 动画开关：关闭后所有过渡/动画消失（含星空闪烁），开启恢复；刷新后保持（cr_anim）
  - [ ] 卡面：7 类别图案带可区分、成熟度描边色正确、同卡多次渲染一致（纯函数）
  - [ ] 图标：成本/成熟度/面板标题/按钮图标统一描边风，无 emoji 残留（日志/规则内文除外）
  - [ ] 动效：出牌飞行、永久卡脉冲、弹窗滑入、资源数值滚动+涨跌变色、胜利金色彩带、失败渐暗
  - [ ] 战绩：打完一局后开始界面战绩面板更新；破纪录时结局画面显示「新纪录！」徽标
  - [ ] 语言/主题/动画三设置互不干扰；中英文切换不破版（含新键：主题名/战绩/新纪录/动画开关）

---

## 附录 A：spec 覆盖对照

| spec 条目 | 覆盖位置 |
|---|---|
| §2 出牌飞行 + 永久卡脉冲 | Task 5（playSelectedCards 预检后 `.card-fly-out` + 180ms 延迟调 engine；pulseNewPermanent）+ Task 2 CSS |
| §2 弹窗滑入 | Task 2（.modal-content translateY+opacity 覆盖第三轮 scale-in） |
| §2 资源数值滚动 + 变色闪烁 | Task 5（prevResources + animateValue rAF 300ms + .res-flash-up/down）+ Task 2 CSS |
| §2 胜利彩带 / 失败渐暗 | Task 5（spawnConfetti box-shadow 技法 ×2 层、.end-screen.defeat）+ Task 2 CSS |
| §2 统一缓动 cubic-bezier(0.4,0,0.2,1) | Task 2（全部新 keyframes/transition）+ Task 5（rAF easeOutCubic 注释对齐） |
| §3 程序化卡面（7 母题、id 种子、成熟度描边色） | Task 1（cardArt 完整实现）+ Task 5（renderHand 接入 .card-art-band） |
| §3 handSig 缓存不破坏 | Task 5（cardArt 为纯函数，模板仅依赖 card 字段，handSig 组成不变） |
| §4 三主题 data-theme + localStorage cr_theme | Task 2（CSS 变量表）+ Task 5（applyTheme/setTheme/cycleTheme/boot 恢复）+ Task 3（选择器按钮） |
| §4 动画开关 data-anim + prefers-reduced-motion | Task 2（禁用规则）+ Task 5（applyAnim/toggleAnim/animateValue 跳过/boot 恢复 cr_anim） |
| §5 icons.js（描边 SVG、currentColor） | Task 1（28 键完整 SVG） |
| §5 替换成本/面板标题/成熟度/按钮符号 | Task 3（data-icon 占位 + 按钮结构）+ Task 5（renderHand 成本与成熟度图标、refreshTexts 填充）+ Task 4（res.* 文案去 emoji） |
| §5 加载顺序 data → i18n → icons → state → engine → ui | Task 3（script 标签） |
| §6 cr_stats v1、endGame 记录、战绩面板、新纪录徽标 | Task 5（loadStats/recordGame/renderStatsPanel/state.statsRecorded 防重/record-badge）+ Task 3（statsPanel 容器）+ Task 4（文案键） |
| §6 读写 try/catch | Task 5（loadStats/saveStats/boot/applyTheme/applyAnim 全部容错） |
| §7 78/78 回归 / node --check / DOM ≤400 / 零外链 / 目检 | Task 6 Step 1–4 |

## 附录 B：计划干跑结果（2026-07-23，/tmp 按计划文本组装实测）

组装方式：复制项目 js/test/styles.css，按计划 Task 1–5 的代码块原文写入 icons.js、styles.css 追加、index.html、ui.js、i18n.js 补丁（res.* 去 emoji + 双语各 14 键），随后逐项验证：

- `node test/simulate.js` = **78 passed, 0 failed**（逻辑零改动确认；含 zh/en key parity 断言——新增 14 键双语齐全）
- `node --check` 全部 js（data/i18n/icons/state/engine/ui + simulate）= 全部通过
- 外链：`grep -rn 'https\?://' index.html styles.css js/ | grep -v w3.org` = 0 处；webfont 引用 = 0 处（完全离线）
- icons.js Node 验证：`icons: 30`（30 个 key）、未知名返回 `""`、cardArt 确定性 ✓、id 种子变化 ✓、成熟度描边色 ✓、7 类别全部渲染 ✓、单图标最多 4 子节点 ✓、卡面母题最多 6 子节点（预算 ≤9 ✓）
- index.html：`data-icon=` 18 处（7 面板 + 6 资源 + 5 按钮）✓；面板标题 emoji 实体 = 0 处 ✓；script 顺序 data → i18n → icons → state → engine → ui ✓
- styles.css：960 行（712 + M1 追加 248 行）；`data-theme="glacier"` / `data-theme="abyss"` / `data-anim="off"` / `prefers-reduced-motion` 各 1 处 ✓
- **DOM 节点（标签计数口径）**：首屏（开始界面）静态 197 + 星空 1 + 图标位 54 = **252（≤400 ✓）**；对局峰值估算（8 满手牌）**≈ 484**——超出首屏口径预算，原因与两个备选压缩项已写入 Task 6 Step 3（spec 的 ≤400 为「首屏」口径，165 基线即开始界面静态计数；此项需用户知悉，默认不处理）
- **DOM stub 烟测**（/tmp/dom-smoke.js，最小 DOM 桩加载真实 ui.js）：13/13 PASS——boot 开始界面、CR.ui.refreshTexts、默认主题 venus、startGame 隐藏开始界面并弹事件窗、手牌渲染、关窗进行动、endTurn 结算弹窗、开始下一回合、cycleTheme→glacier、toggleAnim 开关与恢复、战绩面板渲染
- 干跑中已修正的计划问题：图标计数（28→30）、stub 的同步 rAF 递归（改 +350ms 假时钟）、移除 `global.performance` 覆盖（Node 26 下触发 getter 冲突）

## 附录 C：i18n 新增键清单（与 Task 4 插入块一一对应）

| 键 | zh | en |
|---|---|---|
| theme.venus | 金星橙 | Venus |
| theme.glacier | 冰川蓝 | Glacier |
| theme.abyss | 深空黑 | Abyss |
| ui.theme_label | 主题 | Theme |
| ui.anim_label | 动画 | Motion |
| ui.anim_on | 动画：开 | Motion: On |
| ui.anim_off | 动画：关 | Motion: Off |
| stats.title | 本地战绩 | Local Records |
| stats.games | 场次 | Games |
| stats.wins | 胜场 | Wins |
| stats.best_contribution | 最高贡献 | Best Score |
| stats.best_purification | 最高净化 | Best Purification |
| stats.new_record | 新纪录！ | NEW RECORD! |
| stats.no_games | 暂无战绩 — 开始你的第一局 | No records yet — start your first game |
