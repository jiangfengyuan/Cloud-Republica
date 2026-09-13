# Cloud Republic Iteration 3 (Glassmorphism UI Redesign) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按已批准 spec《2026-07-23-cloud-republic-glassmorphism-design.md》完成第三轮迭代：styles.css 全文重写为 Glassmorphism（玻璃拟态）风格（橙黄渐变背景 + 玻璃令牌 + 新色板 + 离线字体栈），修复卡牌「永久/合同」类型徽标与文档流文本重叠的 bug（卡牌头部改文档流 header 行），不触碰布局结构、交互逻辑与 engine/state/data/i18n。

**Architecture:** 项目结构不变（index.html / styles.css / js/{data,i18n,state,engine,ui}.js / test/simulate.js）。本轮改动面：styles.css 整文件替换；js/ui.js 仅 renderHand 内卡牌模板微调（新增 `.card-header` 文档流行）；index.html 零改动（无 Google Fonts preconnect，@import 只在 styles.css 内，已 grep 确认）。

**Tech Stack:** 纯原生 HTML/CSS/JS（无构建工具、无依赖、无 ES module、无网络字体——删除 Orbitron 的 Google Fonts `@import` 后完全离线）。测试仅需 Node.js 内置 `require`。

## Global Constraints
- 不用 git（用户明确拒绝，计划中不得出现任何 commit 步骤）
- 所有文件在 /Users/haydenjiang/Downloads/RES_REP/ 下
- 不改三栏布局结构、不改交互逻辑、不动 engine/state/data/i18n
- engine.js 不得触碰 DOM（本轮不涉及 engine）
- 无网络字体、无图片资源、无 CSS 框架/预处理器；双击 index.html 即玩
- `node test/simulate.js` 78/78 不得回归；首屏 DOM 节点数 ≤165（第二轮基线：静态 164 + 星空 1）

## 关键设计说明（实现前必读）

1. **CSS 变量向后兼容**：index.html 与 js/ui.js 的内联样式引用了 8 个旧变量名（`--text-secondary`、`--border`、`--accent-gold`、`--accent-rose`、`--accent-purple`、`--accent-cyan`、`--accent-green`、`--text-primary`，已 grep 确认）。新 `:root` 保留这些名字作为别名映射到新色板，HTML/JS 因此零改动：
   - `--accent-gold: #FFCD70`（主强调/选中/资金）、`--accent-cyan: #7EA6FF`（科研/信息，取代青）、`--accent-rose: #FF9B06`（警示/腐蚀，取代玫红）、`--accent-green: #A7F3D0`（成功/净化/完整度）、`--accent-purple: #A78BFA`（治理紫）、`--text-primary: #FFFFFF`、`--text-secondary: #CBD5E1`、`--border: rgba(255,255,255,0.25)`（玻璃边）
   - 新增玻璃令牌：`--glass-bg / --glass-bg-soft / --glass-border / --glass-shadow / --glass-highlight / --font-main`；旧 `--bg-dark/--bg-panel/--bg-card` 随旧选择器一起废弃（无任何 HTML/JS 引用，已 grep 确认）。
2. **玻璃配方**（全文件统一）：`background: rgba(255,255,255,0.15)`、`backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px)`、`border: 1px solid rgba(255,255,255,0.25)`、`box-shadow: 0 8px 32px rgba(31,38,135,0.37), inset 0 1px 0 rgba(255,255,255,0.4)`。子级容器（资源条/卡牌/轨道项/按钮次级）用 `rgba(255,255,255,0.08)` 软玻璃，避免层层 blur 的性能与发灰问题（仅 .panel/.modal-content/.card/.turn-info/.score-card 上 blur）。
3. **卡牌重叠修复**：旧结构 `.card-type-badge`（absolute 左上）+ `.card-category`（文档流首行）+ `.card-maturity`（absolute 右上）三者挤在卡顶。新结构：`.card-header` 文档流行（flex，左 `.card-type-badge` 右 `.card-category`，两者均不再 absolute），`.card-maturity` 保留 absolute 右上，`.card-header` 以 `padding-right: 34px` 避开 28px 圆点 + 8px 边距。三者物理上不可能重叠。renderHand 模板同步改（Task 2），DOM 每卡 +1 节点（动态区，不影响首屏静态基线）。
4. **类别色条映射**（`.cat-*` 的 border-top 色，全部落入新色板）：economy `#FFCD70`（资金金）、environment `#A7F3D0`（生态绿）、governance `#A78BFA`（治理紫）、social `#E2E6F0`（中性亮）、tech `#7EA6FF`（科技蓝）、wellbeing `#CBD5E1`（中性）、venus `#FF9B06`（金星橙）。
5. **删除项**（附录 A 有逐选择器映射）：Google Fonts `@import`；全部 `'Orbitron'`/`'Inter'` 字体引用（统一 `--font-main`）；`.turn-blocker`/`.blocker-text` 规则（组件已于第二轮移除，HTML/JS 无引用）；`.star` 规则（第二轮已改单 div 方案，无引用）。
6. **星空减淡**：`.stars` 保留单 div + box-shadow 方案与整体 twinkle 动画，加 `opacity: 0.5` 减淡（spec §2「星空保留但减淡」），JS 不动。
7. **验收基线**：当前 `node test/simulate.js` = 78 passed；首屏静态元素 164 + 星空 1 = 165；`index.html` 无 `fonts.googleapis`/`preconnect`（已 grep）。本轮只允许：styles.css 更好、ui.js 模板微调、以上指标不回归。

---

## Task 1: styles.css 全文重写（Glassmorphism）

**Files:**
- Modify: `/Users/haydenjiang/Downloads/RES_REP/styles.css`（整文件替换为下方完整代码）

**Interfaces:**
- Consumes: index.html 全部既有 class/id（选择器覆盖对照见附录 A）、ui.js renderHand 新模板（Task 2 的 `.card-header`）
- Produces: 新设计令牌（`:root` 变量，含 8 个别名）+ 全部组件的玻璃样式；无任何网络请求

- [ ] **Step 1: 整文件替换 styles.css（完整代码如下，711 行）**
  ```css
  /* Cloud Republic — Glassmorphism UI (iteration 3 full rewrite)
     Project design tokens; palette & orange Venus-gradient per approved spec.
     No webfonts, no images, no frameworks. */

  :root {
      /* new palette */
      --accent-gold: #FFCD70;        /* primary accent / selected / funds */
      --accent-green: #A7F3D0;       /* success / purification / integrity */
      --accent-blue: #7EA6FF;        /* research / info */
      --accent-purple: #A78BFA;      /* governance purple */
      --accent-orange: #FF9B06;      /* warning / corrosion */
      --neutral-1: #E2E6F0;
      --neutral-2: #CBD5E1;
      --neutral-3: #94A3B8;

      /* backward-compatible aliases (referenced by inline styles in index.html / js/ui.js) */
      --text-primary: #FFFFFF;
      --text-secondary: var(--neutral-2);
      --accent-cyan: var(--accent-blue);
      --accent-rose: var(--accent-orange);

      /* glass tokens */
      --glass-bg: rgba(255, 255, 255, 0.15);
      --glass-bg-soft: rgba(255, 255, 255, 0.08);
      --glass-border: rgba(255, 255, 255, 0.25);
      --glass-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
      --glass-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.4);
      --border: var(--glass-border);

      --font-main: -apple-system, 'SF Pro Display', 'PingFang SC', 'Helvetica Neue', sans-serif;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
      font-family: var(--font-main);
      color: var(--text-primary);
      min-height: 100vh;
      overflow-x: hidden;
      background:
          radial-gradient(circle at 18% 15%, rgba(255, 205, 112, 0.45) 0%, transparent 45%),
          radial-gradient(circle at 85% 75%, rgba(167, 139, 250, 0.30) 0%, transparent 55%),
          linear-gradient(160deg, #f7b733 0%, #ee9a3a 32%, #d96f32 62%, #7a4b94 100%);
      background-attachment: fixed;
  }

  /* ==================== STARFIELD (single div + box-shadow, dimmed) ==================== */

  .stars {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      z-index: 0;
      opacity: 0.5;
      animation: twinkle 4s ease-in-out infinite;
  }

  @keyframes twinkle {
      0%, 100% { opacity: 0.25; }
      50% { opacity: 0.6; }
  }

  /* ==================== LAYOUT ==================== */

  #game-container {
      position: relative;
      z-index: 1;
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
  }

  .game-header {
      position: relative;
      text-align: center;
      padding: 30px 0;
      border-bottom: 1px solid var(--glass-border);
      margin-bottom: 20px;
  }

  .game-title {
      font-family: var(--font-main);
      font-size: 2.5rem;
      font-weight: 800;
      background: linear-gradient(135deg, #FFFFFF 20%, var(--accent-gold) 80%);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      text-shadow: 0 2px 24px rgba(255, 205, 112, 0.25);
      letter-spacing: 2px;
  }

  .game-subtitle {
      color: var(--neutral-1);
      margin-top: 8px;
      font-size: 0.95rem;
      opacity: 0.85;
  }

  .game-main {
      display: grid;
      grid-template-columns: 280px 1fr 280px;
      gap: 20px;
      margin-bottom: 20px;
  }

  @media (max-width: 1200px) {
      .game-main { grid-template-columns: 1fr; }
  }

  /* ==================== GLASS PANELS ==================== */

  .panel {
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: 16px;
      padding: 20px;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      box-shadow: var(--glass-shadow), var(--glass-highlight);
  }

  .panel-title {
      font-family: var(--font-main);
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: 1px;
      color: var(--accent-gold);
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 8px;
  }

  /* ==================== RESOURCES ==================== */

  .resource-grid { display: grid; gap: 12px; }

  .resource-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: var(--glass-bg-soft);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      border-left: 3px solid var(--accent-blue);
      transition: all 0.3s;
  }

  .resource-item.warning {
      border-left-color: var(--accent-orange);
      animation: pulse-warning 1.5s infinite;
  }

  .resource-item.critical {
      border-left-color: #ff5f56;
      background: rgba(255, 95, 86, 0.15);
  }

  @keyframes pulse-warning {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
  }

  .resource-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.9rem;
  }

  .resource-value {
      font-family: var(--font-main);
      font-size: 1.2rem;
      font-weight: 700;
  }

  .resource-bar {
      width: 100%;
      height: 4px;
      background: rgba(0, 0, 0, 0.25);
      border-radius: 2px;
      margin-top: 6px;
      overflow: hidden;
  }

  .resource-bar-fill {
      height: 100%;
      border-radius: 2px;
      transition: width 0.5s ease;
  }

  /* ==================== CENTER / TRACKS / TURN INFO ==================== */

  .center-area {
      display: flex;
      flex-direction: column;
      gap: 20px;
  }

  .public-track {
      display: flex;
      flex-direction: column;
      gap: 15px;
  }

  .track-item {
      background: var(--glass-bg-soft);
      border: 1px solid rgba(255, 255, 255, 0.12);
      padding: 15px;
      border-radius: 12px;
  }

  .track-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 0.9rem;
  }

  .track-bar-bg {
      width: 100%;
      height: 20px;
      background: rgba(0, 0, 0, 0.25);
      border-radius: 10px;
      overflow: hidden;
      position: relative;
  }

  .track-bar-fill {
      height: 100%;
      border-radius: 10px;
      transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 10px;
      font-size: 0.75rem;
      font-weight: 700;
      color: #14312a;
  }

  .purification-fill {
      background: linear-gradient(90deg, #34d399, var(--accent-green));
  }

  .corrosion-fill {
      background: linear-gradient(90deg, var(--accent-orange), #ffc46b);
  }

  .turn-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px 20px;
      background: linear-gradient(135deg, rgba(255, 205, 112, 0.16), rgba(167, 139, 250, 0.14));
      border: 1px solid var(--glass-border);
      border-radius: 12px;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      box-shadow: var(--glass-shadow), var(--glass-highlight);
  }

  .turn-phase {
      font-family: var(--font-main);
      font-weight: 700;
      letter-spacing: 1px;
      color: var(--accent-gold);
      font-size: 1.1rem;
  }

  .turn-number {
      color: var(--text-secondary);
      font-size: 0.9rem;
  }

  .phase-indicator {
      display: flex;
      gap: 8px;
      margin-top: 10px;
  }

  .phase-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.25);
      transition: all 0.3s;
  }

  .phase-dot.active {
      background: var(--accent-gold);
      box-shadow: 0 0 10px var(--accent-gold);
  }

  .phase-dot.completed {
      background: var(--accent-green);
  }

  /* ==================== CARDS ==================== */

  .card-area { min-height: 200px; }

  .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px;
      margin-top: 15px;
  }

  .card {
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: 14px;
      padding: 12px;
      cursor: pointer;
      transition: all 0.3s;
      position: relative;
      overflow: hidden;
      min-height: 220px;
      display: flex;
      flex-direction: column;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      box-shadow: var(--glass-shadow), var(--glass-highlight);
  }

  .card:hover {
      transform: translateY(-4px);
      border-color: rgba(255, 255, 255, 0.55);
      box-shadow: 0 12px 36px rgba(31, 38, 135, 0.45), var(--glass-highlight);
  }

  .card.selected {
      border-color: var(--accent-gold);
      box-shadow: 0 0 20px rgba(255, 205, 112, 0.35), var(--glass-highlight);
  }

  .card.disabled {
      opacity: 0.5;
      cursor: not-allowed;
  }

  /* header row: type badge (left) + category (right), both in normal flow.
     padding-right clears the absolute maturity dot (28px @ top:8 right:8). */
  .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
      padding-right: 34px;
  }

  .card-maturity {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      color: #1e2440;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  }

  .maturity-driving { background: var(--accent-green); }
  .maturity-trending { background: var(--accent-blue); }
  .maturity-emerging { background: var(--accent-gold); }
  .maturity-signaling { background: var(--accent-purple); }
  .maturity-brewing { background: var(--accent-orange); }

  .card-category {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-secondary);
      opacity: 0.9;
      text-align: right;
  }

  .card-name {
      font-size: 0.85rem;
      font-weight: 700;
      line-height: 1.3;
      margin-bottom: 8px;
      flex-grow: 1;
  }

  .card-cost {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
      font-size: 0.75rem;
  }

  .cost-tag {
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.12);
      padding: 2px 8px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
  }

  .card-effect {
      font-size: 0.75rem;
      color: var(--text-secondary);
      line-height: 1.4;
      padding-top: 8px;
      border-top: 1px solid var(--glass-border);
  }

  .card-type-badge {
      font-size: 0.65rem;
      padding: 2px 8px;
      border-radius: 4px;
      background: var(--glass-bg-soft);
      border: 1px solid var(--glass-border);
      color: var(--neutral-1);
      white-space: nowrap;
  }

  .cat-economy { border-top: 3px solid #FFCD70; }
  .cat-environment { border-top: 3px solid #A7F3D0; }
  .cat-governance { border-top: 3px solid #A78BFA; }
  .cat-social { border-top: 3px solid #E2E6F0; }
  .cat-tech { border-top: 3px solid #7EA6FF; }
  .cat-wellbeing { border-top: 3px solid #CBD5E1; }
  .cat-venus { border-top: 3px solid #FF9B06; }

  /* ==================== BUTTONS ==================== */

  .btn {
      background: linear-gradient(135deg, var(--accent-gold), var(--accent-orange));
      color: #3a2a10;
      border: none;
      padding: 12px 24px;
      border-radius: 10px;
      font-family: var(--font-main);
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.3s;
      text-transform: uppercase;
      letter-spacing: 1px;
      box-shadow: 0 4px 16px rgba(31, 38, 135, 0.25), var(--glass-highlight);
  }

  .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(255, 155, 6, 0.35), var(--glass-highlight);
  }

  .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
  }

  .btn-secondary {
      background: var(--glass-bg-soft);
      color: var(--text-primary);
      border: 1px solid var(--glass-border);
  }

  .btn-danger {
      background: linear-gradient(135deg, #ff7a59, #e0432f);
      color: #FFFFFF;
  }

  .btn-success {
      background: linear-gradient(135deg, #34d399, var(--accent-green));
      color: #0f2e22;
  }

  .btn-group {
      display: flex;
      gap: 10px;
      margin-top: 15px;
      flex-wrap: wrap;
  }

  .phase-actions {
      display: flex;
      gap: 10px;
      margin-top: 15px;
      padding: 15px;
      background: var(--glass-bg-soft);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .phase-actions.hidden {
      display: none;
  }

  .diff-btn {
      min-width: 170px;
      padding: 16px 22px;
      line-height: 1.5;
  }

  /* ==================== MODAL ==================== */

  .modal-overlay {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(26, 18, 46, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s;
  }

  .modal-overlay.active {
      opacity: 1;
      pointer-events: all;
  }

  .modal-content {
      background: rgba(255, 255, 255, 0.18);
      border: 1px solid var(--glass-border);
      border-radius: 20px;
      padding: 30px;
      max-width: 500px;
      width: 90%;
      text-align: center;
      transform: scale(0.9);
      transition: transform 0.3s;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      box-shadow: var(--glass-shadow), var(--glass-highlight);
  }

  .modal-overlay.active .modal-content {
      transform: scale(1);
  }

  .modal-title {
      font-family: var(--font-main);
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--accent-gold);
      margin-bottom: 15px;
  }

  .modal-text {
      color: var(--neutral-1);
      line-height: 1.6;
      margin-bottom: 20px;
  }

  /* ==================== LOG ==================== */

  .log-panel {
      max-height: 300px;
      overflow-y: auto;
  }

  .log-entry {
      padding: 8px 0;
      border-bottom: 1px solid var(--glass-border);
      font-size: 0.85rem;
      color: var(--text-secondary);
  }

  .log-entry:last-child { border-bottom: none; }

  .log-time {
      color: var(--accent-blue);
      font-size: 0.75rem;
  }

  /* ==================== PLAYER INFO ==================== */

  .player-info {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 15px;
      padding: 10px;
      background: var(--glass-bg-soft);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
  }

  .player-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--accent-gold), var(--accent-orange));
      color: #3a2a10;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 1.1rem;
  }

  .player-details h4 {
      font-size: 0.95rem;
      margin-bottom: 2px;
  }

  .player-details span {
      font-size: 0.8rem;
      color: var(--text-secondary);
  }

  /* ==================== ANIMATIONS ==================== */

  @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
  }

  .floating { animation: float 3s ease-in-out infinite; }

  @keyframes slideIn {
      from { opacity: 0; transform: translateX(-20px); }
      to { opacity: 1; transform: translateX(0); }
  }

  .slide-in { animation: slideIn 0.5s ease; }

  /* ==================== END / START SCREENS ==================== */

  .end-screen {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background:
          radial-gradient(circle at 18% 15%, rgba(255, 205, 112, 0.45) 0%, transparent 45%),
          radial-gradient(circle at 85% 75%, rgba(167, 139, 250, 0.30) 0%, transparent 55%),
          linear-gradient(160deg, #f7b733 0%, #ee9a3a 32%, #d96f32 62%, #7a4b94 100%);
      z-index: 2000;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 40px;
  }

  .end-screen.active { display: flex; }

  .end-title {
      font-family: var(--font-main);
      font-size: 3rem;
      font-weight: 800;
      margin-bottom: 20px;
      text-shadow: 0 2px 24px rgba(0, 0, 0, 0.25);
  }

  .end-reason {
      font-size: 1.2rem;
      color: var(--neutral-1);
      margin-bottom: 30px;
  }

  .score-board {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      max-width: 800px;
      width: 100%;
      margin: 30px 0;
  }

  .score-card {
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: 16px;
      padding: 20px;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      box-shadow: var(--glass-shadow), var(--glass-highlight);
  }

  .score-card.winner {
      border-color: var(--accent-gold);
      box-shadow: 0 0 30px rgba(255, 205, 112, 0.25), var(--glass-highlight);
  }

  /* ==================== SCROLLBAR ==================== */

  ::-webkit-scrollbar { width: 8px; }
  ::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); }
  ::-webkit-scrollbar-thumb { background: var(--glass-border); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--accent-gold); }

  /* ==================== SMALL SCREENS ==================== */

  @media (max-width: 768px) {
      .game-title { font-size: 1.5rem; }
      .card-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
      .btn-group { justify-content: center; }
  }
  ```

- [ ] **Step 2: 静态验证**
  运行（项目根目录）：
  ```bash
  grep -c 'fonts.googleapis\|Orbitron\|@import' styles.css        # 预期 0
  grep -c 'backdrop-filter' styles.css                            # 预期 10（5 个玻璃组件 .panel/.turn-info/.card/.modal-content/.score-card × 标准+webkit 两行）
  node -e "const s=require('fs').readFileSync('styles.css','utf8');for(const v of ['--accent-gold: #FFCD70','--accent-green: #A7F3D0','--accent-blue: #7EA6FF','--accent-orange: #FF9B06','PingFang SC','rgba(255, 255, 255, 0.15)','blur(20px)','inset 0 1px 0 rgba(255, 255, 255, 0.4)','0 8px 32px rgba(31, 38, 135, 0.37)']){if(!s.includes(v))throw new Error('missing token: '+v)}console.log('tokens OK')"
  ```
- [ ] **Step 3: 选择器覆盖核对**
  用附录 A 的映射表逐行核对（表内每个「保留/改造」选择器都能在新文件 grep 到；「删除」项均查无引用）：`for sel in .panel .card-header .card-type-badge .card-category .card-maturity .diff-btn .score-card .modal-content .phase-dot .cat-venus .cost-tag; do grep -q -- "$sel" styles.css && echo "OK $sel" || echo "MISSING $sel"; done` 预期全 OK。

---

## Task 2: js/ui.js — renderHand 卡牌模板微调（card-header 文档流行）

**Files:**
- Modify: `/Users/haydenjiang/Downloads/RES_REP/js/ui.js`（仅替换 renderHand 内的 `cardEl.innerHTML` 模板，其余不动）

**Interfaces:**
- Consumes: Task 1 的 `.card-header` / 改造后 `.card-type-badge` / `.card-category` 样式
- Produces: 卡牌 DOM 结构变为 `.card > (.card-maturity[absolute] + .card-header > (.card-type-badge + .card-category) + .card-name + .card-cost + .card-effect)`；`handSig` 脏标记逻辑不变（模板不含状态字段变化）；index.html 零改动（grep 确认无 fonts 相关引用，结构无需调整）

- [ ] **Step 1: 替换 js/ui.js 第 105–117 行的模板字符串**
  现有（js/ui.js:105–117）：
  ```js
      cardEl.innerHTML = `
        <div class="card-maturity ${maturityClass}">${maturitySymbol}</div>
        <div class="card-type-badge">${typeName}</div>
        <div class="card-category">${t('category.' + card.category)}</div>
        <div class="card-name">${cardName(card)}</div>
        <div class="card-cost">
          ${cost.money ? `<span class="cost-tag">&#128176;${cost.money}</span>` : ''}
          ${cost.materials ? `<span class="cost-tag">&#129521;${cost.materials}</span>` : ''}
          ${cost.energy ? `<span class="cost-tag">&#9889;${cost.energy}</span>` : ''}
          ${cost.research ? `<span class="cost-tag">&#128300;${cost.research}</span>` : ''}
        </div>
        <div class="card-effect">${cardEffect(card)}</div>
      `;
  ```
  替换为（唯一变化：类型徽标与类别名包进 `.card-header` 行，顺序不变、文本不变）：
  ```js
      cardEl.innerHTML = `
        <div class="card-maturity ${maturityClass}">${maturitySymbol}</div>
        <div class="card-header">
          <div class="card-type-badge">${typeName}</div>
          <div class="card-category">${t('category.' + card.category)}</div>
        </div>
        <div class="card-name">${cardName(card)}</div>
        <div class="card-cost">
          ${cost.money ? `<span class="cost-tag">&#128176;${cost.money}</span>` : ''}
          ${cost.materials ? `<span class="cost-tag">&#129521;${cost.materials}</span>` : ''}
          ${cost.energy ? `<span class="cost-tag">&#9889;${cost.energy}</span>` : ''}
          ${cost.research ? `<span class="cost-tag">&#128300;${cost.research}</span>` : ''}
        </div>
        <div class="card-effect">${cardEffect(card)}</div>
      `;
  ```

- [ ] **Step 2: 回归验证**
  ```bash
  node --check js/ui.js                 # 语法通过
  node test/simulate.js                 # 预期 78 passed, 0 failed（ui.js 不被 Node 加载，此处防误改其他行）
  grep -c 'card-header' js/ui.js        # 预期 1
  grep -n 'card-type-badge\|card-category' js/ui.js   # 两处均在 card-header 行内（相邻行号）
  ```

---

## Task 3: 验收（静态核对 + 人工目检）

**Files:**
- 不新建/修改文件

**Interfaces:**
- Consumes: Task 1/2 产物
- Produces: 验收结论

- [ ] **Step 1: 自动化回归与静态核对（项目根目录）**
  ```bash
  node test/simulate.js                                    # 78 passed, 0 failed
  node --check js/ui.js                                    # 通过
  node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const n=(h.match(/<[a-zA-Z]/g)||[]).length;if(n>164)throw new Error('DOM baseline regression: '+n);console.log('static DOM elements:', n, '(+1 star div =', n+1, '<= 165 OK)')"
  grep -rn 'fonts.googleapis\|fonts.gstatic\|preconnect' index.html styles.css js/ || echo 'no webfont references OK'
  grep -c 'Orbitron\|font-family: .Inter' styles.css || echo 'no legacy font refs OK'
  ```

- [ ] **Step 2: 人工目检（无浏览器自动化，用 `open` 打开）**
  运行 `open /Users/haydenjiang/Downloads/RES_REP/index.html`，逐项核对（spec §5）：
  - [ ] 橙黄渐变背景 + 径向光晕可见；面板/卡牌/弹窗有玻璃模糊质感（backdrop-filter 生效，背景透出）；减淡星空可见
  - [ ] 开始界面三档难度按钮风格统一；选择难度进入游戏
  - [ ] **卡牌「永久/合同」徽标与类别名、成熟度圆点三者无重叠**（手牌多于 5 张时逐张检查，含 brewing ☁ 长类别名「金星专项/Venus Special」双语）
  - [ ] 中英文切换：全部组件不破版（标题/按钮/卡牌/弹窗/规则/结局）；无网络字体（字体为系统 SF Pro/萍方回退）
  - [ ] 弹窗（事件/结算摘要）与结局画面玻璃风格统一；打完一局至结局无样式异常
  - [ ] 离线验证：断网（或 DevTools Network 观察）打开页面，无任何 fonts 请求，功能完整
  - [ ] 日志 timed（金）/delayed（紫）效果行、资源条 warning/critical 态、腐蚀条橙色、净化条绿色均正常

---

## 附录 A：旧 styles.css 选择器 → 新文件映射表（覆盖核对基准）

| 旧选择器（650 行版） | 新文件归宿 |
|---|---|
| `@import url(fonts.googleapis…)` | **删除**（完全离线） |
| `:root`（旧变量） | `:root` 新色板 + 玻璃令牌 + 8 个别名（`--bg-dark/--bg-panel/--bg-card` 废弃） |
| `*` reset | 保留（原样） |
| `body` | 改造：橙黄渐变 + 径向光晕、`--font-main` |
| `.stars`（fixed 全屏） | 保留 + `opacity: 0.5` + twinkle 动画（合并第二轮追加块） |
| `.star`（单星） | **删除**（第二轮已改单 div 方案，无引用） |
| `@keyframes twinkle` | 保留（透明度区间改为 0.25–0.6 配合减淡） |
| `#game-container` | 保留（原样） |
| `.game-header` | 保留 + `position: relative`（合并第二轮追加块） |
| `.game-title` | 改造：`--font-main` 800、白→金渐变文字 |
| `.game-subtitle` | 改造：neutral-1 |
| `.game-main` + `@media 1200px` | 保留（原样） |
| `.panel` | 改造：玻璃令牌（blur 20px 含 -webkit-） |
| `.panel-title` | 改造：`--font-main` 700、金 |
| `.resource-grid` / `.resource-item` | 保留结构，软玻璃底；warning 橙、critical #ff5f56 |
| `@keyframes pulse-warning` | 保留（原样） |
| `.resource-label` / `.resource-value` | 保留；value 改 `--font-main` |
| `.resource-bar` / `.resource-bar-fill` | 保留；轨道底改 rgba(0,0,0,0.25) |
| `.center-area` / `.public-track` | 保留（原样） |
| `.track-item` / `.track-header` | 保留结构，软玻璃底 |
| `.track-bar-bg` / `.track-bar-fill` | 保留；fill 文字色改深（#14312a 配浅绿） |
| `.purification-fill` | 改造：#34d399→#A7F3D0 |
| `.corrosion-fill` | 改造：#FF9B06→#ffc46b |
| `.turn-info` | 改造：金→紫径向淡彩 + 玻璃 |
| `.turn-phase` / `.turn-number` | 保留；phase 改 `--font-main` 金 |
| `.phase-indicator` / `.phase-dot`（+active/completed） | 保留；idle 点改 rgba(255,255,255,0.25) |
| `.card-area` / `.card-grid` | 保留（原样） |
| `.card`（+hover/selected/disabled） | 改造：玻璃卡；selected 金光；disabled 原样 |
| `.card-maturity` + `.maturity-*`（5 色） | 保留 absolute 右上；五色映射新色板；文字改深色 #1e2440 |
| **（新增）** `.card-header` | **新增**：flex 文档流行 + `padding-right: 34px` 避让成熟度点 |
| `.card-category` | 改造：去 absolute 时代余量，入 header 右侧，去 margin-bottom |
| `.card-name` / `.card-cost` / `.cost-tag` | 保留；cost-tag 改深色玻璃底 |
| `.card-effect` | 保留；分隔线改玻璃边 |
| `.card-type-badge` | 改造：去 absolute，入 header 左侧 |
| `.cat-economy/environment/governance/social/tech/wellbeing/venus` | 保留 border-top 色条，七色全部重映射新色板（设计说明 4） |
| `.btn`（+hover/disabled） | 改造：金→橙渐变、深字、玻璃高光 |
| `.btn-secondary` | 改造：软玻璃底白字 |
| `.btn-danger` | 改造：红橙渐变（hard 难度按钮） |
| `.btn-success` | 改造：绿渐变（easy 难度/Next Turn） |
| `.btn-group` / `.phase-actions`（+hidden） | 保留；phase-actions 软玻璃底 |
| `.modal-overlay`（+active） | 保留结构；遮罩改 rgba(26,18,46,0.55) |
| `.modal-content` | 改造：强玻璃（0.18 底 + blur 20px） |
| `.modal-title` / `.modal-text` | 保留；title 改 `--font-main` 800 金 |
| `.log-panel` / `.log-entry`（+last-child） | 保留；分隔线改玻璃边 |
| `.log-time` | 保留；改 accent-blue |
| `.player-info` / `.player-avatar` / `.player-details` | 保留；avatar 金橙渐变深字 |
| `@keyframes float` / `.floating` / `@keyframes slideIn` / `.slide-in` | 保留（原样） |
| `.end-screen`（+active） | 改造：背景同 body 橙黄渐变（开始/结局画面统一） |
| `.end-title` / `.end-reason` | 保留；title 改 `--font-main` 800 |
| `.score-board` / `.score-card`（+winner） | 改造：玻璃卡；winner 金边金光 |
| `.turn-blocker`（+active）/`.blocker-text` | **删除**（组件已于第二轮移除，HTML/JS 无引用） |
| `::-webkit-scrollbar` 系列 | 保留；配色改玻璃边/金 |
| `@media 768px` | 保留（原样） |
| `.diff-btn`（第二轮追加） | 保留（并入按钮区） |

## 附录 B：计划干跑结果（2026-07-23，/tmp 组装实测）

- 基线（改动前）：`node test/simulate.js` = 78 passed, 0 failed；index.html 静态元素 164（+1 星空 = 165）；`grep fonts.googleapis/preconnect index.html` = 0 处（index.html 零改动依据）。
- 按本计划组装（新 styles.css 全文 + ui.js 模板替换）：`node --check js/ui.js` 通过；`node test/simulate.js` = **78 passed, 0 failed**；新 styles.css **共 711 行**；`grep -c 'fonts.googleapis\|Orbitron\|@import'` = 0；`grep -c 'backdrop-filter'` = 10（5 个玻璃组件 × 标准+webkit 两行）；附录 A 全部「保留/改造」选择器 grep 命中、「删除」选择器（`.star`/`.turn-blocker`/`.blocker-text`/`--bg-dark`/`--bg-panel`/`--bg-card`）在 index.html 与 js/*.js 中引用数为 0。
- index.html 与 js/ui.js 内联样式引用的 8 个变量名在新 `:root` 全部有定义（别名映射），渲染不会因变量缺失回退异常。
