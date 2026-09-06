# Cloud Republic Restructure & Mechanics Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把单文件游戏 `~/Downloads/RES-REPBLIC.html`（1635 行）重构为 `~/Downloads/cloud-republic/` 下的多文件结构（引擎与 DOM 解耦），并修复 spec《2026-07-23-cloud-republic-restructure-design.md》第 3 节列出的全部机制问题，使胜利在统计上可达。

**Architecture:** `index.html`（纯标记）+ `styles.css` + `js/data.js`（卡牌/事件数据）→ `js/state.js`（初始状态工厂）→ `js/engine.js`（纯逻辑，不碰 DOM）→ `js/ui.js`（全部 DOM/事件绑定），通过唯一全局命名空间 `CR`（`CR.data` / `CR.state` / `CR.engine`）共享。`test/simulate.js` 为 Node 无依赖测试基座，固定种子 PRNG 注入 engine，驱动数百局自动对局做统计断言。

**Tech Stack:** 纯原生 HTML/CSS/JS（无构建工具、无依赖、无 ES module——file:// 打开时 module 会被 CORS 拦截，用普通 `<script src>` 按 data → state → engine → ui 顺序加载，共享全局命名空间 CR）。测试仅需 Node.js 内置能力（`require`），不引入任何 npm 包。

## Global Constraints
- 不用 git（用户明确拒绝，计划中不得出现任何 commit 步骤）
- 所有文件在 /Users/haydenjiang/Downloads/cloud-republic/ 下
- 保持原有视觉风格与英文 UI 文案不变
- engine.js 不得触碰 DOM；日志通过 onLog 回调交给 ui 层
- 源文件行号引用均指 `/Users/haydenjiang/Downloads/RES-REPBLIC.html`（下文简称「原文件」），已用 Read 逐行确认

## 关键设计说明（实现前必读）

1. **双兼容文件模式**：`data.js` / `state.js` / `engine.js` 三个文件同时支持浏览器（挂 `window.CR`）与 Node（`module.exports` + `globalThis.CR`），统一外壳：
   ```js
   (function (root) {
     const CR = root.CR = root.CR || {};
     // ... 本文件内容 ...
     if (typeof module !== 'undefined' && module.exports) module.exports = <本文件导出的对象>;
   })(typeof window !== 'undefined' ? window : globalThis);
   ```
   `ui.js` 仅浏览器使用，不需要此外壳（直接 `(function (root) { ... })(window)`）。

2. **随机数注入**：engine 内所有随机（抽牌、事件掷骰、卡 8 风险掷骰）一律走 `CR.engine.rng()`，默认 `Math.random`，测试中替换为 mulberry32 固定种子序列。

3. **transportDiscount 只折资金成本**（spec 3.3 语义为「打出卡牌的资金成本」折扣）：`getCardCost` 中 money 项 = `round(cost.money × 成熟度乘数 × transportDiscount)`，materials/energy/research 项只乘成熟度乘数。`transportDiscount` 在写入时即 clamp 到下限 0.4。

4. **永久卡 purification 收入（spec §3.7 已正式纳入；本计划先行覆盖）**：原代码中永久卡的 `venusEffect.purification`（卡 12「+10%」、卡 49「+3%/turn」）从未生效——`endTurn` 的收入循环不含 purification。若不修复，全游戏净化来源仅有 5 张合同卡（合计 +41%）与 1 个事件（+5%），20 回合内数学上不可能达到 100%。因此本计划在 `endTurn` 永久收入结算中纳入 `ve.purification`（每回合 +X%，上限 100）。

5. **状态字段总表**（`createInitialState()` 返回，相对原 `gameState` 字面量（原文件 958–997 行）的变更）：
   - 修改：`maxHabitatExpansions: 3 → 5`；`resources.materials: 30 → 40`（spec §3.8）
   - 新增：`ultimate: false`、`timedEffects: []`、`repairCostMultiplier: 1`、`transportDiscount: 1`、`maturedIncome: {money:0,materials:0,energy:0,research:0,morale:0}`、`gameResult: null`、`contribution: 0`、`pendingEvent: null`、`nextCardUid: 1`
   - 保留并真正使用：`delayedEffects: []`（元素 `{name, turnsLeft, income}`）
   - `timedEffects` 元素形如 `{name, turnsLeft, income: {money, materials, energy}}`
   - 删除：无（其余字段原样保留，包括暂未被读取的 `eventTriggered`，保持最小改动）

6. **历史风险（已按 spec §3.8 解决）**：本计划的全部代码在 /tmp 下做过一次完整干跑（按 Task 1–7 组装后执行 `node test/simulate.js`）：59/60 条机制断言全部通过，但当时 500 局模拟胜率为 **0**。量化根因（详见附录 C）：
   - 净化轨道：23 次抽牌中平均仅 ~2.4 张净化卡；卡 12（唯一够强的净化引擎 +10%/回合）每局被抽到的概率 ~35%，且受 research ≥ 7 门槛限制（500 局中仅 23 局实际打出）；无注入时平均净化仅 ~10%。
   - 栖息地轨道：造 5 个栖息地原需 150 资金 + 100 材料，而材料经济是死亡螺旋（起始 30，材料收入卡本身要材料，修理还要 ~40 材料）；即使把卡 11/12/49 直接注入初始手牌（净化 11 回合即达 100%），栖息地仍停在 2 个。
   - 结论：瓶颈是数值经济而非引擎逻辑。用户已就此拍板 spec §3.8「轻量三件套」（结算抽牌 1→2 张、Build Habitat 造价 30+20 → 20+12、起始材料 30→40），**本计划已按 §3.8 修订完毕，胜率断言以新数值为准**（修订后干跑结果见附录 C）。Task 7 Step 6 的断言照常执行，不再预设失败。

---

## Task 1: 项目脚手架 + styles.css + index.html

**Files:**
- Create: `/Users/haydenjiang/Downloads/cloud-republic/styles.css`
- Create: `/Users/haydenjiang/Downloads/cloud-republic/index.html`
- （目录 `js/`、`test/` 在后续任务写文件时自动创建）

**Interfaces:**
- Consumes: 无（纯静态文件）
- Produces: `index.html` 提供这些 DOM id 供 ui.js 使用（全部来自原文件，未改名）：`stars`、`endScreen`、`endTitle`、`endReason`、`scoreBoard`、`eventModal`、`modalTitle`、`modalText`、`modalBtn`、`resourcePanel`、`res-money`、`res-materials`、`res-energy`、`res-research`、`res-morale`、`res-integrity`、`permanentCards`、`currentPhase`、`phaseIndicator`、`dot-event`、`dot-action`、`dot-settlement`、`turnNumber`、`selectedCount`、`purificationText`、`purificationBar`、`purificationPercent`、`habitatText`、`turnBlocker`、`blockerText`、`handCards`、`playBtn`、`endTurnBtn`、`gameLog`、`corrosionRateText`、`corrosionBar`；**新增** `buildHabitatBtn`。
- Produces: 全局内联 onclick 入口（由 ui.js 在 Task 8 定义为 window 全局函数）：`playSelectedCards()`、`repairHabitat()`、`buildHabitat()`、`endTurn()`、`closeEventModal()`。

- [ ] **Step 1: 创建 styles.css，逐字复制原文件 `<style>` 块内容**
  复制原文件第 **8–646 行**（即第 7 行 `<style>` 与第 647 行 `</style>` 之间的全部内容，含 `@import` 字体行与全部 CSS 规则，一个字节都不改）写入 `/Users/haydenjiang/Downloads/cloud-republic/styles.css`。

- [ ] **Step 2: 创建 index.html 的 head 部分**
  写入文件开头：
  ```html
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cloud Republic: Venus Floating City | Res Publica</title>
      <link rel="stylesheet" href="styles.css">
  </head>
  <body>
  ```

- [ ] **Step 3: 迁移 body 标记**
  把原文件第 **650–856 行**（`<body>` 之后到 `</div>` 闭合 `#game-container` 为止的全部标记）逐字追加到 index.html。此区间不含任何 `<script>`，无需删减。

- [ ] **Step 4: 新增 Build Habitat 按钮**
  在刚迁移的标记中找到 Repair 按钮（原文件第 798 行，内容为 `<button class="btn btn-secondary" onclick="repairHabitat()">Repair (-2 Materials +1%)</button>`），在它**后面**插入一行（缩进与相邻按钮一致，采用与原按钮相同的内联 onclick 风格）：
  ```html
                          <button class="btn btn-secondary" id="buildHabitatBtn" onclick="buildHabitat()">Build Habitat (-20 Funds -12 Materials)</button>
  ```

- [ ] **Step 5: 用 4 个 script 标签收尾（替代原 858–1633 行的内联脚本）**
  在 body 标记之后追加：
  ```html
      <script src="js/data.js"></script>
      <script src="js/state.js"></script>
      <script src="js/engine.js"></script>
      <script src="js/ui.js"></script>
  </body>
  </html>
  ```

- [ ] **Step 6: 静态检查**
  运行 `grep -c 'id="buildHabitatBtn"' /Users/haydenjiang/Downloads/cloud-republic/index.html` 输出应为 `1`；运行 `wc -l /Users/haydenjiang/Downloads/cloud-republic/styles.css` 输出应为 `639`（646 − 8 + 1）。此时浏览器打开会有 JS 报错（js 文件尚未创建），属预期，页面样式应与原文件一致。

---

## Task 2: js/data.js — 卡牌与事件数据逐字迁移

**Files:**
- Create: `/Users/haydenjiang/Downloads/cloud-republic/js/data.js`

**Interfaces:**
- Consumes: 无
- Produces: `CR.data.CARD_DATABASE`（66 张卡，数组元素字段 `id, name, category, maturity, cost:{money,materials,energy,research}, effect, type, venusEffect, [delay], [duration], [risk], [special]`）；`CR.data.EVENTS`（20 个事件，元素字段 `id, name, desc, effect`）。Node 下 `module.exports = CR.data`。

- [ ] **Step 1: 写入 data.js 头部**
  ```js
  // data.js — pure data: card database & event table. No logic, no DOM.
  (function (root) {
    const CR = root.CR = root.CR || {};

  ```

- [ ] **Step 2: 逐字迁移 CARD_DATABASE**
  复制原文件第 **860–933 行**（`const CARD_DATABASE = [` 到 `];`，66 张卡，含卡 2 的 `delay: 3`、卡 8 的 `risk: true`、卡 24 的 `duration: 3`、各 `special` 字段，一律原样保留）追加到 data.js。

- [ ] **Step 3: 逐字迁移 EVENTS**
  复制原文件第 **935–956 行**（`const EVENTS = [` 到 `];`，20 个事件）追加到 data.js。

- [ ] **Step 4: 写入 data.js 尾部**
  ```js

    CR.data = { CARD_DATABASE, EVENTS };
    if (typeof module !== 'undefined' && module.exports) module.exports = CR.data;
  })(typeof window !== 'undefined' ? window : globalThis);
  ```

- [ ] **Step 5: Node 加载验证**
  运行 `node -e "const d = require('/Users/haydenjiang/Downloads/cloud-republic/js/data.js'); console.log(d.CARD_DATABASE.length, d.EVENTS.length, globalThis.CR.data.CARD_DATABASE[1].delay)"`，预期输出 `66 20 3`。

---

## Task 3: js/state.js — 初始状态工厂

**Files:**
- Create: `/Users/haydenjiang/Downloads/cloud-republic/js/state.js`

**Interfaces:**
- Consumes: 无
- Produces: `CR.state.createInitialState()` → 返回全新 gameState 对象（每次调用独立深拷贝字面量，无共享引用）。Node 下 `module.exports = CR.state`。

- [ ] **Step 1: 创建 state.js（完整代码如下）**
  基于原文件第 958–997 行的 `gameState` 字面量，按「关键设计说明」第 5 条修改/新增字段：
  ```js
  // state.js — initial game state factory. No logic, no DOM.
  (function (root) {
    const CR = root.CR = root.CR || {};

    function createInitialState() {
      return {
        turn: 0,
        maxTurns: 20,
        phase: 'setup',              // 'setup' | 'event' | 'action' | 'settlement' | 'ended'
        purification: 0,
        targetPurification: 100,
        habitats: 1,
        targetHabitats: 6,
        corrosionRate: 2,
        resources: {
          money: 50,
          materials: 40,           // spec 3.8: was 30
          energy: 20,
          research: 5,
          morale: 70,
          integrity: 100
        },
        hand: [],
        permanentCards: [],
        selectedCards: [],
        cardsPlayedThisTurn: 0,
        maxCardsPerTurn: 2,
        gameOver: false,
        gameResult: null,            // null | 'victory' | 'defeat' | 'crash'
        contribution: 0,
        eventTriggered: false,
        extraCardPlayed: false,
        habitatExpansions: 0,
        maxHabitatExpansions: 5,     // spec 3.1: was 3 (1 initial + 5 expansions = 6, victory reachable)
        prestige: 0,
        hasCharter: false,
        noMoraleDecay: false,
        moraleFloor: 0,              // card 31: locked at 40
        insurance: false,            // card 32, one-shot
        ultimate: false,             // card 52, one-shot, no resource loss on crash
        stormShield: false,          // card 53
        shieldActive: false,         // card 27, one-shot event block
        repairEfficiency: 1,         // card 45 -> 2 (% integrity restored per repair)
        repairCostMultiplier: 1,     // card 17 -> 0.75 (repair material cost -25%)
        transportDiscount: 1,        // cards 1/7/42: multiplicative money-cost coefficient, floor 0.4
        moneyMultiplier: 1,
        timedEffects: [],            // e.g. card 24: { name, turnsLeft, income: {money, materials, energy} }
        delayedEffects: [],          // e.g. card 2:  { name, turnsLeft, income: {...} }
        maturedIncome: { money: 0, materials: 0, energy: 0, research: 0, morale: 0 },
        pendingEvent: null,
        strike: false,
        nextCardUid: 1
      };
    }

    CR.state = { createInitialState };
    if (typeof module !== 'undefined' && module.exports) module.exports = CR.state;
  })(typeof window !== 'undefined' ? window : globalThis);
  ```

- [ ] **Step 2: Node 验证**
  运行 `node -e "const s = require('/Users/haydenjiang/Downloads/cloud-republic/js/state.js'); const a = s.createInitialState(), b = s.createInitialState(); a.resources.money = 999; console.log(a.maxHabitatExpansions, a.ultimate, b.resources.money)"`，预期输出 `5 false 50`（验证新字段默认值与实例隔离）。

---

## Task 4: test/simulate.js — Node 测试基座与冒烟断言

**Files:**
- Create: `/Users/haydenjiang/Downloads/cloud-republic/test/simulate.js`

**Interfaces:**
- Consumes: `require('../js/data.js')`、`require('../js/state.js')`、`require('../js/engine.js')`（Task 5 创建；本任务先建测试文件，冒烟断言在 Task 5 Step 1 之后才能跑绿——见 Step 3 的顺序说明）
- Produces: 测试基座设施，供 Task 5/6/7 追加断言：
  - `mulberry32(seed)` → `() => [0,1)` 固定种子 PRNG
  - `assert(cond, name)` → 打印 `  PASS/FAIL <name>` 并累计 `passed`/`failed`
  - `freshState()` → `CR.state.createInitialState()`
  - `cardById(id)` → `CR.data.CARD_DATABASE.find(c => c.id === id)`
  - 运行命令：`node test/simulate.js`（在 `/Users/haydenjiang/Downloads/cloud-republic/` 下执行），退出码：全过 0，有失败 1

- [ ] **Step 1: 创建 test/simulate.js 基座（完整代码如下）**
  ```js
  // test/simulate.js — deterministic mechanics tests & full-game simulation.
  // No dependencies. Run from project root:  node test/simulate.js
  'use strict';

  require('../js/data.js');
  require('../js/state.js');
  const engine = require('../js/engine.js');
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
  function freshState() { return CR.state.createInitialState(); }
  function cardById(id) { return CR.data.CARD_DATABASE.find(c => c.id === id); }

  engine.onLog = null; // silence engine logs during tests
  ```

- [ ] **Step 2: 追加冒烟断言（完整代码如下）**
  说明：engine.js 拆在 Task 5（核心）与 Task 7（回合系统）两步实现，因此本冒烟只覆盖「加载 + 建初始状态 + 抽牌」；「跑一整回合不抛异常」的完整冒烟在 Task 7 断言块的第一组补全。
  ```js

  // ==================== [Task 4] Smoke ====================
  console.log('\n[Task 4] Smoke test');
  engine.rng = mulberry32(12345);
  {
    const s = freshState();
    let threw = null;
    try {
      engine.drawInitialCards(s);
      engine.drawCard(s);
    } catch (e) { threw = e; }
    assert(threw === null, 'modules load; initial state + card draw runs without throwing' + (threw ? ' — ' + threw.message : ''));
    assert(s.hand.length === 4, 'hand holds 3 initial cards + 1 drawn card');
    assert(s.turn === 0 && s.phase === 'setup' && s.maxHabitatExpansions === 5, 'initial state intact (maxHabitatExpansions = 5)');
  }
  ```

- [ ] **Step 3: 追加统计输出页脚（完整代码如下；后续任务的断言块一律插入到此页脚之前）**
  ```js

  // ==================== Summary ====================
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
  ```
  注意：此时 `js/engine.js` 尚不存在（Task 5 创建），`node test/simulate.js` 会因 `require('../js/engine.js')` 报 MODULE_NOT_FOUND——这是预期的 TDD 红态。Task 5 Step 1 创建 engine.js 后，本冒烟断言应立即转绿，预期输出：
  ```
  [Task 4] Smoke test
    PASS modules load; initial state + card draw runs without throwing
    PASS hand holds 3 initial cards + 1 drawn card
    PASS initial state intact (maxHabitatExpansions = 5)

  3 passed, 0 failed
  ```

---

## Task 5: js/engine.js 核心 — 资源/成本/支付（TDD）

**Files:**
- Create: `/Users/haydenjiang/Downloads/cloud-republic/js/engine.js`
- Modify: `/Users/haydenjiang/Downloads/cloud-republic/test/simulate.js`（追加断言块，插入到 `// ==================== Summary ====================` 行之前）

**Interfaces:**
- Consumes: `CR.data.CARD_DATABASE`、`CR.data.EVENTS`（Task 2）；`CR.state.createInitialState()` 产出的 state 形状（Task 3，仅测试用，engine 函数本身只收 state 参数）
- Produces（本任务部分，全部挂在 `CR.engine` 上，Node 下 `module.exports` 为同一对象）：
  - `CR.engine.rng` — 可替换的随机源 `() => [0,1)`，默认 `Math.random`
  - `CR.engine.onLog` — 可替换的日志回调 `(message: string) => void`，默认 `null`
  - `CR.engine.modifyResource(state, type, amount)` — `type` ∈ `'money'|'materials'|'energy'|'research'|'morale'|'integrity'`；统一 clamp（资金/材料/能源/科研 ≥ 0；士气/完整度 0–100）；士气下限 `state.moraleFloor` 即时生效；完整度归 0 走保险/终极备份/坠毁拦截（spec 3.5）。返回 `undefined`
  - `CR.engine.applyResourceEffect(state, effect)` — effect 形如 `{money?, materials?, energy?, research?, morale?, integrity?, purification?}`，逐项走 `modifyResource`，purification 累加并 cap 100。返回 `undefined`
  - `CR.engine.getMaturityMultiplier(maturity)` → `number`（driving 0.6 / trending 0.8 / emerging 1.0 / signaling 1.3 / brewing 1.5 / 未知 1.0）
  - `CR.engine.getCardCost(state, card)` → `{money, materials, energy, research}` 整数；money = `round(cost.money × 成熟度乘数 × state.transportDiscount)`，其余三项 = `round(cost.x × 成熟度乘数)`
  - `CR.engine.canAfford(state, card)` → `boolean`（brewing 卡额外要求 research ≥ 10）
  - `CR.engine.payCost(state, card)` → `undefined`（按 `getCardCost` 扣除）
  - `CR.engine.drawCard(state)` / `CR.engine.drawInitialCards(state)` → `undefined`（手牌上限 8，写日志）
  - `CR.engine.endGame(state, reason)` — reason ∈ `'crash'|'timeout'|'victory'`；置 `gameOver`、`phase='ended'`、`gameResult`（`'timeout'` 时按胜负条件折算为 `'victory'|'defeat'`）、`contribution` 分数。返回 `undefined`
  - `CR.engine.checkVictory(state)` → `boolean`（purification ≥ 100 且 habitats ≥ targetHabitats）

- [ ] **Step 1: 创建 engine.js 骨架 + 本任务全部函数（完整代码如下）**
  注意 `handleCrash` 与 `endGame` 在本步即完整实现（spec 3.5 拦截逻辑属于 `modifyResource` 的一部分）；`endGame` 被 `handleCrash` 前向引用，靠函数声明提升正常工作。exports 块中注释 `// Task 6/7 exports appended here` 之后的行由后续任务逐条补入。
  ```js
  // engine.js — pure game logic. No DOM access. Logs via CR.engine.onLog callback.
  (function (root) {
    const CR = root.CR = root.CR || {};

    const engine = {};

    // Injectable hooks
    engine.rng = Math.random;  // () => [0, 1)
    engine.onLog = null;       // (message: string) => void

    function log(message) {
      if (engine.onLog) engine.onLog(message);
    }

    // ==================== RESOURCE MANAGEMENT ====================

    function modifyResource(state, type, amount) {
      state.resources[type] += amount;

      if (type === 'integrity') {
        state.resources.integrity = Math.max(0, Math.min(100, state.resources.integrity));
        if (state.resources.integrity <= 0) {
          handleCrash(state);
        }
      } else if (type === 'morale') {
        state.resources.morale = Math.max(0, Math.min(100, state.resources.morale));
        // Card 31 (Extraterrestrial Identity): floor enforced immediately, not just at turn end
        if (state.moraleFloor > 0 && state.resources.morale < state.moraleFloor) {
          state.resources.morale = state.moraleFloor;
        }
      } else {
        state.resources[type] = Math.max(0, state.resources[type]);
      }
    }

    // spec 3.5: integrity hit 0 -> ultimate (no loss) -> insurance (halve) -> crash
    function handleCrash(state) {
      if (state.ultimate) {
        state.ultimate = false;
        state.resources.integrity = 20;
        log('Consciousness Upload Backup activated! Integrity restored to 20%. No resources lost.');
        return;
      }
      if (state.insurance) {
        state.insurance = false;
        state.resources.integrity = 20;
        ['money', 'materials', 'energy', 'research'].forEach(k => {
          state.resources[k] = Math.floor(state.resources[k] / 2);
        });
        log('Space Survival Insurance activated! Integrity restored to 20%. Funds/Materials/Energy/Research halved.');
        return;
      }
      endGame(state, 'crash');
    }

    // spec 3.7: single shared effect-application path for cards & events
    function applyResourceEffect(state, effect) {
      if (effect.money) modifyResource(state, 'money', effect.money);
      if (effect.materials) modifyResource(state, 'materials', effect.materials);
      if (effect.energy) modifyResource(state, 'energy', effect.energy);
      if (effect.research) modifyResource(state, 'research', effect.research);
      if (effect.morale) modifyResource(state, 'morale', effect.morale);
      if (effect.integrity) modifyResource(state, 'integrity', effect.integrity);
      if (effect.purification) {
        state.purification = Math.min(100, state.purification + effect.purification);
        log(`Purification: ${effect.purification > 0 ? '+' : ''}${effect.purification}%`);
      }
    }

    // ==================== CARD COSTS ====================

    function getMaturityMultiplier(maturity) {
      const multipliers = {
        driving: 0.6, trending: 0.8, emerging: 1.0,
        signaling: 1.3, brewing: 1.5
      };
      return multipliers[maturity] || 1.0;
    }

    // transportDiscount applies to the money (Funds) cost only — Earth-Venus transport costs (spec 3.3)
    function getCardCost(state, card) {
      const mult = getMaturityMultiplier(card.maturity);
      return {
        money: Math.round(card.cost.money * mult * state.transportDiscount),
        materials: Math.round(card.cost.materials * mult),
        energy: Math.round(card.cost.energy * mult),
        research: Math.round(card.cost.research * mult)
      };
    }

    function canAfford(state, card) {
      if (card.maturity === 'brewing' && state.resources.research < 10) {
        return false;
      }
      const cost = getCardCost(state, card);
      return (
        state.resources.money >= cost.money &&
        state.resources.materials >= cost.materials &&
        state.resources.energy >= cost.energy &&
        state.resources.research >= cost.research
      );
    }

    function payCost(state, card) {
      const cost = getCardCost(state, card);
      modifyResource(state, 'money', -cost.money);
      modifyResource(state, 'materials', -cost.materials);
      modifyResource(state, 'energy', -cost.energy);
      modifyResource(state, 'research', -cost.research);
    }

    // ==================== CARD DRAW ====================

    function drawCard(state) {
      if (state.hand.length >= 8) {
        log('Hand full (8 cards). Cannot draw.');
        return;
      }
      const db = CR.data.CARD_DATABASE;
      const randomCard = db[Math.floor(engine.rng() * db.length)];
      state.hand.push({ ...randomCard, uid: state.nextCardUid++ });
    }

    function drawInitialCards(state) {
      for (let i = 0; i < 3; i++) drawCard(state);
    }

    // ==================== GAME END ====================

    function checkVictory(state) {
      return state.purification >= 100 && state.habitats >= state.targetHabitats;
    }

    function endGame(state, reason) {
      if (state.gameOver) return;
      state.gameOver = true;
      state.phase = 'ended';
      if (reason === 'timeout') {
        state.gameResult = checkVictory(state) ? 'victory' : 'defeat';
      } else {
        state.gameResult = reason; // 'crash' | 'victory'
      }
      state.contribution =
        state.habitats * 20 +
        Math.floor(state.purification) * 1 +
        Math.floor(state.resources.money / 5) +
        state.prestige;
      log(`Game over: ${state.gameResult}`);
    }

    // ==================== EXPORTS ====================
    engine.modifyResource = modifyResource;
    engine.applyResourceEffect = applyResourceEffect;
    engine.getMaturityMultiplier = getMaturityMultiplier;
    engine.getCardCost = getCardCost;
    engine.canAfford = canAfford;
    engine.payCost = payCost;
    engine.drawCard = drawCard;
    engine.drawInitialCards = drawInitialCards;
    engine.checkVictory = checkVictory;
    engine.endGame = endGame;
    // Task 6/7 exports appended here

    CR.engine = engine;
    if (typeof module !== 'undefined' && module.exports) module.exports = engine;
  })(typeof window !== 'undefined' ? window : globalThis);
  ```

- [ ] **Step 2: 先跑冒烟断言确认基座转绿**
  运行 `cd /Users/haydenjiang/Downloads/cloud-republic && node test/simulate.js`，预期 `3 passed, 0 failed`。

- [ ] **Step 3: 在 simulate.js 的 Summary 页脚之前插入 Task 5 断言块（完整代码如下），先跑确认全部 FAIL（函数已在 Step 1 实现时则直接应全 PASS；TDD 口径：若先写断言再实现，此处应先见红）**
  ```js

  // ==================== [Task 5] Resources, costs, payment ====================
  console.log('\n[Task 5] Core engine: resources, costs');
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
  ```

- [ ] **Step 4: 跑测试确认 Task 5 全绿**
  运行 `node test/simulate.js`，预期 `14 passed, 0 failed`（3 冒烟 + 11 本任务）。

---

## Task 6: js/engine.js 卡牌效果 — playSelectedCards / applyContractEffect / applyPermanentEffect（TDD）

**Files:**
- Modify: `/Users/haydenjiang/Downloads/cloud-republic/js/engine.js`（新函数插入到 `// ==================== EXPORTS ====================` 注释行之前；exports 块中 `// Task 6/7 exports appended here` 行之前补 3 行导出）
- Modify: `/Users/haydenjiang/Downloads/cloud-republic/test/simulate.js`（断言块插入到 Summary 页脚之前）

**Interfaces:**
- Consumes: Task 5 全部函数；`CR.data.CARD_DATABASE` 卡牌字段 `type/venusEffect/delay/duration/risk/special/id`
- Produces:
  - `CR.engine.playSelectedCards(state)` → `{ok: boolean, reason?: string}`；读取并清空 `state.selectedCards`（手牌下标数组），逐个支付并结算，从手牌移除；胜利条件满足时 `endGame(state, 'victory')`
  - `CR.engine.applyContractEffect(state, card)` → `undefined`；处理：卡 8 `risk` 40% 失败掷骰（−10 资金替代 +10，写日志）、卡 2 `delay` 入队 `delayedEffects`（不立即给钱）、卡 24 `duration` 入队 `timedEffects`（不立即结算）、其余 contract 立即 `applyResourceEffect`；`venusEffect.habitat` 走共享 5 次上限；`special: 'extraCard'|'steal'` 保持原语义
  - `CR.engine.applyPermanentEffect(state, card)` → `undefined`；产出日志、腐蚀率调整、`venusEffect.habitat` 共享上限；卡 17 → `repairCostMultiplier ×= 0.75`；卡 45 → `repairEfficiency = 2`；卡 1/7/42 → `transportDiscount ×= 0.5/0.8/0.6`（乘性叠加，写入时 clamp 下限 0.4）；special：moraleFloor→40、insurance、ultimate（独立标志，prestige+30）、stormShield、shieldActive、noMoraleDecay、prestige+15、charter、megastructure(prestige+25)

- [ ] **Step 1: 先在 simulate.js 的 Summary 页脚之前插入 Task 6 断言块（完整代码如下），运行确认全部 FAIL（`engine.playSelectedCards is not a function` 导致抛错或断言失败——TDD 红态）**
  ```js

  // ==================== [Task 6] Card effects ====================
  console.log('\n[Task 6] Card effects');
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
    // playSelectedCards end-to-end: select an affordable contract from hand
    const s = freshState();
    s.phase = 'action';
    engine.rng = mulberry32(42);
    const c5 = { ...cardById(5), uid: 9001 }; // one-time +15 Funds, cost 10 money 5 materials (trending x0.8 -> 8/4)
    s.hand.push(c5);
    const moneyBefore = s.resources.money;
    s.selectedCards = [0];
    const r = engine.playSelectedCards(s);
    assert(r.ok === true, 'playSelectedCards returns {ok:true} in action phase');
    assert(s.hand.length === 0 && s.selectedCards.length === 0, 'played card removed from hand, selection cleared');
    assert(s.resources.money === moneyBefore - 8 + 15, 'contract paid discounted cost then applied +15 Funds');
    const r2 = engine.playSelectedCards(s);
    assert(r2.ok === false && typeof r2.reason === 'string', 'playSelectedCards with empty selection fails with a reason');
    s.phase = 'event';
    s.selectedCards = [0];
    const r3 = engine.playSelectedCards(s);
    assert(r3.ok === false, 'playSelectedCards outside action phase rejected');
  }
  ```
  运行 `node test/simulate.js`：预期这些断言 FAIL（红）。

- [ ] **Step 2: 在 engine.js 的 `// ==================== EXPORTS ====================` 注释行之前插入以下完整函数**
  ```js

    // ==================== CARD PLAY ====================

    // Shared by contract/permanent habitat effects and the Build Habitat button (spec 3.1: one shared limit of 5)
    function expandHabitat(state) {
      if (state.habitatExpansions >= state.maxHabitatExpansions) {
        log(`Habitat expansion limit reached (${state.maxHabitatExpansions} max)`);
        return false;
      }
      state.habitats++;
      state.habitatExpansions++;
      log(`Habitat expanded! Now: ${state.habitats}`);
      return true;
    }

    function playSelectedCards(state) {
      if (state.phase !== 'action') return { ok: false, reason: 'Not in action phase' };
      if (state.strike) return { ok: false, reason: 'Workers on strike! Cannot play cards!' };
      if (state.selectedCards.length === 0) return { ok: false, reason: 'No cards selected' };

      // Sort descending to avoid index issues when removing
      const sorted = [...state.selectedCards].sort((a, b) => b - a);

      sorted.forEach(index => {
        const card = state.hand[index];
        if (!card || !canAfford(state, card)) return;
        payCost(state, card);

        if (card.type === 'permanent') {
          state.permanentCards.push(card);
          applyPermanentEffect(state, card);
          log(`Played permanent: ${card.name}`);
        } else {
          applyContractEffect(state, card);
          log(`Executed contract: ${card.name}`);
        }

        state.hand.splice(index, 1);
        state.cardsPlayedThisTurn++;
      });

      state.selectedCards = [];

      if (checkVictory(state)) {
        endGame(state, 'victory');
        return { ok: true };
      }
      return { ok: true };
    }

    function applyContractEffect(state, card) {
      const ve = card.venusEffect || {};

      if (card.risk) {
        // Card 8 Rare Metal Futures: 40% chance the deal fails, -10 Funds instead of +10 (spec 3.6)
        if (engine.rng() < 0.4) {
          modifyResource(state, 'money', -10);
          log(`${card.name}: Deal failed! -10 Funds`);
        } else {
          applyResourceEffect(state, ve);
        }
      } else if (card.delay) {
        // Card 2 Asteroid Mining Economy: permanent income after `delay` full settlements (spec 3.2)
        state.delayedEffects.push({ name: card.name, turnsLeft: card.delay, income: { ...ve } });
        log(`${card.name}: +${ve.money} Funds/turn begins after ${card.delay} turns`);
      } else if (card.duration) {
        // Card 24 Trade Agreement: income for exactly `duration` settlements (spec 3.2)
        state.timedEffects.push({ name: card.name, turnsLeft: card.duration, income: { ...ve } });
        log(`${card.name}: +${ve.money} Funds +${ve.materials} Materials +${ve.energy} Energy per turn for ${card.duration} turns`);
      } else {
        applyResourceEffect(state, ve);
      }

      if (ve.habitat && !card.delay && !card.duration) {
        expandHabitat(state);
      }

      if (card.special === 'extraCard') {
        state.extraCardPlayed = true;
        log('Emergency Mobilization: Can play 1 extra card this turn');
      }
      if (card.special === 'steal') {
        modifyResource(state, 'money', 5);
        log('Gained funds from interstellar market');
      }
    }

    // Cards 1 / 7 / 42: multiplicative transport (money-cost) discount, coefficient floor 0.4 (spec 3.3)
    const TRANSPORT_DISCOUNT_BY_CARD_ID = { 1: 0.5, 7: 0.8, 42: 0.6 };

    function applyPermanentEffect(state, card) {
      const ve = card.venusEffect || {};
      if (ve.money) log(`Funds output: +${ve.money}/turn`);
      if (ve.materials) log(`Materials output: +${ve.materials}/turn`);
      if (ve.energy) log(`Energy output: +${ve.energy}/turn`);
      if (ve.research) log(`Research output: +${ve.research}/turn`);
      if (ve.morale) log(`Morale boost: +${ve.morale}`);
      if (ve.purification) log(`Purification output: +${ve.purification}%/turn`);
      if (ve.corrosion) {
        state.corrosionRate += ve.corrosion;
        log(`Corrosion rate: ${ve.corrosion > 0 ? '+' : ''}${ve.corrosion}%/turn`);
      }
      if (ve.habitat) {
        expandHabitat(state);
      }

      if (TRANSPORT_DISCOUNT_BY_CARD_ID[card.id]) {
        state.transportDiscount = Math.max(0.4, state.transportDiscount * TRANSPORT_DISCOUNT_BY_CARD_ID[card.id]);
        log(`Transport costs reduced. Money-cost coefficient now x${state.transportDiscount.toFixed(2)}`);
      }

      // spec 3.4: repair modifiers
      if (card.id === 17) { // Biodegradable Materials: repair material cost -25%
        state.repairCostMultiplier *= 0.75;
        log('Repair costs reduced by 25%');
      }
      if (card.id === 45) { // Nanobot Repair Technology: +2% integrity per repair
        state.repairEfficiency = 2;
        log('Repair efficiency doubled (+2% Integrity per repair)');
      }

      if (card.special === 'moraleFloor') {
        state.moraleFloor = 40;
        log('Morale floor locked at 40');
      }
      if (card.special === 'insurance') {
        state.insurance = true;
        log('Space Survival Insurance active');
      }
      if (card.special === 'stormShield') {
        state.stormShield = true;
        log('Solar storm protection active');
      }
      if (card.special === 'noMoraleDecay') {
        state.noMoraleDecay = true;
        log('Artificial gravity active - Morale no longer decays');
      }
      if (card.special === 'prestige') state.prestige += 15;
      if (card.special === 'charter') {
        state.hasCharter = true;
        log('Res Publica Charter signed!');
      }
      if (card.special === 'megastructure') state.prestige += 25;
      if (card.special === 'ultimate') {
        state.ultimate = true;
        state.prestige += 30;
        log('Consciousness Upload Backup ready');
      }
      if (card.special === 'shield') {
        state.shieldActive = true;
        log('Space Court ready for next crisis');
      }
    }
  ```

- [ ] **Step 3: 在 exports 块的 `// Task 6/7 exports appended here` 行之前补 3 行导出**
  把该行替换为：
  ```js
    engine.playSelectedCards = playSelectedCards;
    engine.applyContractEffect = applyContractEffect;
    engine.applyPermanentEffect = applyPermanentEffect;
    // Task 7 exports appended here
  ```

- [ ] **Step 4: 跑测试确认 Task 6 全绿**
  运行 `node test/simulate.js`。注意：卡 2 / 卡 24 共 9 条断言调用 `engine.endTurn`（Task 7 才实现），在 Task 7 完成前脚本会在第一处 `engine.endTurn is not a function` 处抛 TypeError 中止——这即本任务的 TDD 红态，属预期。Task 6 自身（不含 endTurn 依赖）共 15 条断言应在 Step 2 实现后转绿；全量绿态（含卡 2/卡 24）以 Task 7 Step 4 的运行为准。

---

## Task 7: js/engine.js 回合系统 — startNewTurn / 事件 / 修理 / 建造 / endTurn 结算（TDD）

**Files:**
- Modify: `/Users/haydenjiang/Downloads/cloud-republic/js/engine.js`（新函数插入到 `// ==================== EXPORTS ====================` 注释行之前；exports 块中 `// Task 7 exports appended here` 行替换为 7 行导出）
- Modify: `/Users/haydenjiang/Downloads/cloud-republic/test/simulate.js`（断言块插入到 Summary 页脚之前）

**Interfaces:**
- Consumes: Task 5/6 全部函数；`CR.data.EVENTS`
- Produces:
  - `CR.engine.startNewTurn(state)` → `undefined`；turn+1，超过 maxTurns 则 `endGame(state,'timeout')`；重置每回合字段，phase='event'
  - `CR.engine.triggerEventPhase(state)` → `event 对象 | null`；`shieldActive`（卡 27）消耗并拦截一切事件（保持原语义）；掷骰 `floor(rng()*20)+1` 选事件；卡 53 `stormShield` 完全抵消 event id 2（Solar Storm）并写日志；否则置 `state.pendingEvent` 并返回事件（ui 负责弹窗）
  - `CR.engine.applyEvent(state)` → `undefined`；结算 `state.pendingEvent`（走 `applyResourceEffect` + strike 标志），置 phase='action'
  - `CR.engine.repairHabitat(state)` → `{ok, reason?}`；成本 = `max(1, round(2 × state.repairCostMultiplier))` 材料，恢复 = `state.repairEfficiency`% 完整度（spec 3.4：卡 17 成本 2×0.75=1.5 四舍五入为 2；卡 45 每次 +2%）
  - `CR.engine.buildHabitat(state)` → `{ok, reason?}`；20 资金 + 12 材料（spec §3.8），+1 栖息地，与扩容卡共享 `maxHabitatExpansions`(5) 上限；失败返回原因字符串，不改状态
  - `CR.engine.endTurn(state)` → `{ok, reason?}`；结算顺序：永久收入（含 `maturedIncome`、含 `ve.purification`——见「关键设计说明」第 4 条）→ timedEffects 收入+倒数+移除 → delayedEffects 倒数+到期转入 `maturedIncome` → −5 能源维护 → 腐蚀（可能触发保险/坠毁）→ 士气衰减（`noMoraleDecay` 豁免，下限已在 `modifyResource` 内即时生效）→ 低士气警告 → 抽 2 张牌（spec §3.8）→ 胜利检查

- [ ] **Step 1: 先在 simulate.js 的 Summary 页脚之前插入 Task 7 断言块（完整代码如下），运行确认新增断言 FAIL（TDD 红态）**
  ```js

  // ==================== [Task 7] Turn system, crash handling, habitats ====================
  console.log('\n[Task 7] Turn system, crash handling, habitats');
  {
    // Full-turn smoke (completes the Task 4 smoke now that the turn system exists)
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
    engine.rng = () => 0.06; // roll = floor(0.06*20)+1 = 2 (Solar Storm)
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
    assert(ev === null && s.shieldActive === false, 'card 27: shieldActive blocks the event and is consumed (original semantics)');
    engine.rng = mulberry32(7);
  }
  {
    const s = freshState();
    s.phase = 'action';
    s.resources.integrity = 50;
    const r = engine.repairHabitat(s);
    assert(r.ok && s.resources.materials === 38 && s.resources.integrity === 51, 'base repair: -2 Materials, +1% Integrity');
    s.repairCostMultiplier = 0.75; s.repairEfficiency = 2;
    const r2 = engine.repairHabitat(s);
    assert(r2.ok && s.resources.materials === 36 && s.resources.integrity === 53, 'card 17+45: cost round(2*0.75)=2 Materials, +2% Integrity per repair');
    s.resources.materials = 0;
    const r3 = engine.repairHabitat(s);
    assert(!r3.ok && typeof r3.reason === 'string', 'repair fails with a reason when materials insufficient');
  }
  {
    const s = freshState();
    s.phase = 'action';
    const r = engine.buildHabitat(s);
    assert(r.ok && s.habitats === 2 && s.resources.money === 30 && s.resources.materials === 28 && s.habitatExpansions === 1, 'buildHabitat: -20 Funds -12 Materials, +1 habitat (spec 3.8 cost)');
    s.resources.money = 10; s.resources.materials = 5;
    const r2 = engine.buildHabitat(s);
    assert(!r2.ok && typeof r2.reason === 'string', 'buildHabitat fails when resources insufficient');
    s.resources.money = 500; s.resources.materials = 500;
    s.habitatExpansions = 5;
    const r3 = engine.buildHabitat(s);
    assert(!r3.ok && /limit/.test(r3.reason), 'buildHabitat blocked at the shared 5-expansion limit');
    const before = s.habitats;
    engine.applyContractEffect(s, cardById(62));
    assert(s.habitats === before, 'card 62 habitat expansion denied at the same shared limit');
  }
  {
    const s = freshState();
    s.turn = 20; s.purification = 100; s.habitats = 6;
    engine.startNewTurn(s);
    assert(s.gameOver && s.gameResult === 'victory', 'turn 21 with goals met = victory (timeout check)');
    const s2 = freshState();
    s2.turn = 20;
    engine.startNewTurn(s2);
    assert(s2.gameOver && s2.gameResult === 'defeat', 'turn 21 without goals = defeat');
  }
  {
    // permanent purification income (cards 12/49) feeds the purification track each settlement
    const s = freshState();
    s.phase = 'action';
    s.permanentCards.push({ ...cardById(49), uid: 9002 }); // +3% purification / +4 research per turn
    engine.endTurn(s);
    assert(s.purification === 3, 'permanent card purification income applied each settlement');
  }
  ```

- [ ] **Step 2: 在 engine.js 的 `// ==================== EXPORTS ====================` 注释行之前插入以下完整函数**
  ```js

    // ==================== TURN SYSTEM ====================

    function startNewTurn(state) {
      if (state.gameOver) return;

      state.turn++;

      if (state.turn > state.maxTurns) {
        endGame(state, 'timeout');
        return;
      }

      state.phase = 'event';
      state.cardsPlayedThisTurn = 0;
      state.selectedCards = [];
      state.extraCardPlayed = false;
      state.eventTriggered = false;
      state.strike = false;

      log(`=== TURN ${state.turn} BEGINS ===`);
    }

    // Returns the rolled event (ui shows it in a modal), or null when neutralized.
    function triggerEventPhase(state) {
      if (state.gameOver) return null;

      // Card 27 Space Court: blocks this turn's event entirely (original semantics, kept per spec 3.6)
      if (state.shieldActive) {
        state.shieldActive = false;
        state.pendingEvent = null;
        log('Space Court activated! Negative event neutralized!');
        return null;
      }

      const roll = Math.floor(engine.rng() * 20) + 1;
      const event = CR.data.EVENTS.find(e => e.id === roll) || CR.data.EVENTS[0];

      // Card 53 Space Radiation Medicine: Solar Storm (event id 2) fully neutralized (spec 3.6)
      if (event.id === 2 && state.stormShield) {
        state.pendingEvent = null;
        log('Space Radiation Medicine: Solar Storm neutralized! No casualties.');
        return null;
      }

      state.pendingEvent = event;
      return event;
    }

    // Applies state.pendingEvent (called by ui after the player dismisses the modal), then opens the Action Phase.
    function applyEvent(state) {
      const event = state.pendingEvent;
      if (event) {
        log(`[Turn ${state.turn}] Event: ${event.name}`);
        applyResourceEffect(state, event.effect);
        if (event.effect.strike) {
          state.strike = true;
          log('Workers are on strike this turn!');
        }
        state.pendingEvent = null;
      }
      state.phase = 'action';
    }

    // ==================== ACTION BUTTONS ====================

    // spec 3.4: cost = round(2 x repairCostMultiplier) materials; card 45 -> +2% integrity per repair
    function repairHabitat(state) {
      if (state.phase !== 'action') return { ok: false, reason: 'Not in action phase' };

      const cost = Math.max(1, Math.round(2 * state.repairCostMultiplier));
      if (state.resources.materials < cost) {
        return { ok: false, reason: 'Insufficient materials for repair!' };
      }

      modifyResource(state, 'materials', -cost);
      modifyResource(state, 'integrity', state.repairEfficiency);
      log(`Repaired: -${cost} Materials, Integrity +${state.repairEfficiency}%`);
      return { ok: true };
    }

    // spec 3.1 + 3.8: 20 Funds + 12 Materials, +1 habitat, shares the maxHabitatExpansions (5) limit with expansion cards
    function buildHabitat(state) {
      if (state.phase !== 'action') return { ok: false, reason: 'Not in action phase' };
      if (state.habitatExpansions >= state.maxHabitatExpansions) {
        return { ok: false, reason: `Habitat expansion limit reached (${state.maxHabitatExpansions} max)` };
      }
      if (state.resources.money < 20 || state.resources.materials < 12) {
        return { ok: false, reason: 'Insufficient resources: Build Habitat costs 20 Funds + 12 Materials' };
      }

      modifyResource(state, 'money', -20);
      modifyResource(state, 'materials', -12);
      state.habitats++;
      state.habitatExpansions++;
      log(`New habitat built! Habitats: ${state.habitats} (expansions used: ${state.habitatExpansions}/${state.maxHabitatExpansions})`);

      if (checkVictory(state)) endGame(state, 'victory');
      return { ok: true };
    }

    // ==================== SETTLEMENT ====================

    function endTurn(state) {
      if (state.phase !== 'action') return { ok: false, reason: 'Not in action phase' };

      state.phase = 'settlement';
      log('=== SETTLEMENT PHASE ===');

      // 1. Permanent card outputs + matured delayed income.
      //    NOTE: ve.purification is included (cards 12/49) — see plan "关键设计说明" item 4.
      let income = { money: 0, materials: 0, energy: 0, research: 0, morale: 0, purification: 0 };

      state.permanentCards.forEach(card => {
        const ve = card.venusEffect || {};
        if (ve.money) income.money += ve.money;
        if (ve.materials) income.materials += ve.materials;
        if (ve.energy) income.energy += ve.energy;
        if (ve.research) income.research += ve.research;
        if (ve.morale) income.morale += ve.morale;
        if (ve.purification) income.purification += ve.purification;
      });
      ['money', 'materials', 'energy', 'research', 'morale'].forEach(k => {
        income[k] += state.maturedIncome[k];
      });

      if (income.money || income.materials || income.energy || income.research || income.morale || income.purification) {
        log(`Permanent outputs: Funds+${income.money} Mat+${income.materials} En+${income.energy} Res+${income.research} Mor+${income.morale} Pur+${income.purification}%`);
      }

      if (income.money) modifyResource(state, 'money', Math.round(income.money * state.moneyMultiplier));
      if (income.materials) modifyResource(state, 'materials', income.materials);
      if (income.energy) modifyResource(state, 'energy', income.energy);
      if (income.research) modifyResource(state, 'research', income.research);
      if (income.morale) modifyResource(state, 'morale', income.morale);
      if (income.purification) {
        state.purification = Math.min(100, state.purification + income.purification);
        log(`Purification: +${income.purification}% (now ${state.purification.toFixed(1)}%)`);
      }

      // 2. Timed effects (e.g. card 24 Trade Agreement): apply income, count down, remove expired
      state.timedEffects = state.timedEffects.filter(te => {
        applyResourceEffect(state, te.income);
        te.turnsLeft--;
        if (te.turnsLeft > 0) log(`${te.name}: ${te.turnsLeft} turn(s) remaining`);
        else log(`${te.name} has expired.`);
        return te.turnsLeft > 0;
      });

      // 3. Delayed effects (e.g. card 2 Asteroid Mining): count down, mature into permanent income
      state.delayedEffects = state.delayedEffects.filter(de => {
        de.turnsLeft--;
        if (de.turnsLeft <= 0) {
          ['money', 'materials', 'energy', 'research', 'morale'].forEach(k => {
            if (de.income[k]) state.maturedIncome[k] += de.income[k];
          });
          log(`${de.name} is now fully operational! Income added to permanent outputs.`);
          return false;
        }
        log(`${de.name}: activates in ${de.turnsLeft} turn(s)`);
        return true;
      });

      // 4. Energy maintenance
      modifyResource(state, 'energy', -5);
      log('Maintenance: -5 Energy');

      // 5. Corrosion (may trigger insurance / ultimate / crash inside modifyResource)
      modifyResource(state, 'integrity', -state.corrosionRate);
      log(`Corrosion: Integrity -${state.corrosionRate}%`);
      if (state.gameOver) return { ok: true };

      // 6. Morale decay (floor already enforced inside modifyResource, spec 3.6)
      if (!state.noMoraleDecay) {
        modifyResource(state, 'morale', -1);
        log('Morale decay: -1');
      }
      if (state.resources.morale < 30) {
        log('WARNING: Low morale! Strike risk high!');
      }

      // 7. Draw cards (spec 3.8: 2 per settlement; hand cap 8 unchanged)
      drawCard(state);
      drawCard(state);

      if (checkVictory(state)) {
        endGame(state, 'victory');
        return { ok: true };
      }

      log(`=== TURN ${state.turn} COMPLETE ===`);
      return { ok: true };
    }
  ```

- [ ] **Step 3: 把 exports 块中的 `// Task 7 exports appended here` 行替换为**
  ```js
    engine.startNewTurn = startNewTurn;
    engine.triggerEventPhase = triggerEventPhase;
    engine.applyEvent = applyEvent;
    engine.repairHabitat = repairHabitat;
    engine.buildHabitat = buildHabitat;
    engine.endTurn = endTurn;
  ```

- [ ] **Step 4: 全量跑测试**
  运行 `node test/simulate.js`，预期 `59 passed, 0 failed`（3 冒烟 + 11 Task5 + 24 Task6 + 21 Task7）。若有红，修到全绿再进下一步。

- [ ] **Step 5: 追加全局面模拟（500 局固定种子贪心 bot），插入到 Summary 页脚之前（完整代码如下）**
  ```js

  // ==================== [Task 7] Full-game simulation ====================
  console.log('\n[Task 7] Full-game simulation (greedy bot, 500 seeded games)');
  function playGame(seed) {
    engine.rng = mulberry32(seed);
    engine.onLog = null;
    const s = freshState();
    engine.drawInitialCards(s);

    let guard = 0;
    while (!s.gameOver && guard++ < 100) {
      engine.startNewTurn(s);
      if (s.gameOver) break;
      engine.triggerEventPhase(s);
      engine.applyEvent(s);
      if (s.gameOver) break;

      // Action phase: play up to maxPerTurn affordable cards, best score first
      if (!s.strike) {
        let plays = 0;
        let progressed = true;
        while (progressed && !s.gameOver) {
          progressed = false;
          const maxPlays = s.extraCardPlayed ? 3 : 2;
          if (plays >= maxPlays) break;
          let best = -1, bestScore = 0;
          s.hand.forEach((card, i) => {
            if (!engine.canAfford(s, card)) return;
            const ve = card.venusEffect || {};
            const score =
              (ve.purification || 0) * (card.type === 'permanent' ? 5 : 3) +
              (ve.habitat || 0) * 10 +
              (ve.money || 0) * (card.type === 'permanent' ? 2 : 1) +
              (ve.materials || 0) * 0.5 +
              (ve.energy || 0) * 0.5 +
              (ve.research || 0) * 0.5 +
              (ve.morale || 0) * 0.3;
            if (score > bestScore) { bestScore = score; best = i; }
          });
          if (best >= 0) {
            s.selectedCards = [best];
            const r = engine.playSelectedCards(s);
            if (r.ok) { plays++; progressed = true; }
          }
        }
      }

      // Repair while integrity is low
      while (!s.gameOver && s.phase === 'action' && s.resources.integrity < 60) {
        const r = engine.repairHabitat(s);
        if (!r.ok) break;
      }

      // Build habitats whenever affordable (up to the target)
      while (!s.gameOver && s.phase === 'action' && s.habitats < s.targetHabitats) {
        const r = engine.buildHabitat(s);
        if (!r.ok) break;
      }

      if (s.gameOver) break;
      engine.endTurn(s);
    }
    return s;
  }

  {
    const GAMES = 500;
    let wins = 0, defeats = 0, crashes = 0;
    for (let seed = 1; seed <= GAMES; seed++) {
      const s = playGame(seed);
      if (s.gameResult === 'victory') wins++;
      else if (s.gameResult === 'crash') crashes++;
      else defeats++;
    }
    console.log(`  results: ${wins} victories, ${defeats} defeats (timeout), ${crashes} crashes out of ${GAMES}`);
    assert(wins > 0, `victory is statistically reachable (win rate ${(wins / GAMES * 100).toFixed(1)}%)`);
  }
  ```

- [ ] **Step 6: 全量跑测试确认统计断言**
  运行 `node test/simulate.js`，预期最后一行为 `60 passed, 0 failed`（59 + 1 条胜率断言），且倒数第二段输出 500 局结果中 victories > 0。本计划修订后的干跑（spec §3.8 新数值）结果见附录 C，胜率 > 0 已验证可达。
  **若实现时 win rate 仍为 0**：先检查实现与本计划代码块是否逐字一致（重点是 §3.8 三处数值与 endTurn 抽 2 张）；一致则只允许调整 bot 策略权重/阈值（如提高 purification 权重、提前修理阈值、优先留钱造栖息地）后重跑；不得为通过测试而放松 engine 规则、不得删改该断言。调参后仍为 0 再如实上报（附模拟输出），由用户决定是否进一步修订数值。

---

## Task 8: js/ui.js — 全部 DOM 代码迁移与适配

**Files:**
- Create: `/Users/haydenjiang/Downloads/cloud-republic/js/ui.js`

**Interfaces:**
- Consumes: `CR.state.createInitialState()`；`CR.engine` 全部函数（`drawInitialCards / startNewTurn / triggerEventPhase / applyEvent / playSelectedCards / repairHabitat / buildHabitat / endTurn / canAfford / getCardCost`，签名同 Task 5–7）；`CR.engine.onLog` 日志回调；index.html 的 DOM id（Task 1）
- Produces: window 全局函数（供 index.html 内联 onclick 调用）：`playSelectedCards()`、`repairHabitat()`、`buildHabitat()`、`endTurn()`、`closeEventModal()`；`window.onload = initGame`
- 适配点（相对原文件 858–1633 行内联脚本）：
  1. 所有游戏状态从模块级 `let state` 读取（`initGame` 里 `CR.state.createInitialState()` 创建），不再用全局 `gameState` 字面量；
  2. 卡牌价格用 `CR.engine.getCardCost(state, card)` 显示折后价格（替代原 renderHand 内联的 `Math.round(card.cost.x * costMult)`，原文件 1216–1219 行）；
  3. 永久卡区域额外渲染 `timedEffects`（剩余回合，金色）与 `delayedEffects`（激活倒计时，紫色）；
  4. `updateUI` 增加 `buildHabitatBtn` 禁用逻辑；
  5. engine 日志经 `CR.engine.onLog = addLog` 接入；
  6. 回合流转（原 `setTimeout` 节奏保留）：`initGame` → 1s → `startNewTurnFlow` → 0.5s → 事件弹窗 → `closeEventModal` → 行动阶段 → `endTurn` → 1.5s → 下一回合。

- [ ] **Step 1: 创建 js/ui.js（完整代码如下）**
  ```js
  // ui.js — all DOM access lives here. Loaded last; requires CR.data / CR.state / CR.engine.
  (function (root) {
    const CR = root.CR;
    const engine = CR.engine;

    let state = null;

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

    // ==================== STARFIELD ====================

    function createStars() {
      const container = document.getElementById('stars');
      for (let i = 0; i < 100; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.width = Math.random() * 3 + 'px';
        star.style.height = star.style.width;
        star.style.setProperty('--duration', (Math.random() * 3 + 2) + 's');
        container.appendChild(star);
      }
    }

    // ==================== HAND RENDERING ====================

    function renderHand() {
      const container = document.getElementById('handCards');
      container.innerHTML = '';

      state.hand.forEach((card, index) => {
        const isSelected = state.selectedCards.includes(index);
        const canPlay = engine.canAfford(state, card) && state.phase === 'action' && !state.strike;

        const cardEl = document.createElement('div');
        cardEl.className = `card cat-${card.category} ${isSelected ? 'selected' : ''} ${!canPlay ? 'disabled' : ''}`;

        const maturityClass = `maturity-${card.maturity}`;
        const maturitySymbol = {
          driving: '&#9733;', trending: '&#9654;', emerging: '&#9650;',
          signaling: '&#9680;', brewing: '&#9729;'
        }[card.maturity];

        const categoryNames = {
          economy: 'Economy', environment: 'Environment', governance: 'Governance',
          social: 'Social', tech: 'Technology', wellbeing: 'Wellbeing', venus: 'Venus Special'
        };

        const typeName = card.type === 'permanent' ? 'Permanent' : 'Contract';
        const cost = engine.getCardCost(state, card); // discounted price (maturity x transportDiscount)

        cardEl.innerHTML = `
          <div class="card-maturity ${maturityClass}">${maturitySymbol}</div>
          <div class="card-type-badge">${typeName}</div>
          <div class="card-category">${categoryNames[card.category]}</div>
          <div class="card-name">${card.name}</div>
          <div class="card-cost">
            ${cost.money ? `<span class="cost-tag">&#128176;${cost.money}</span>` : ''}
            ${cost.materials ? `<span class="cost-tag">&#129521;${cost.materials}</span>` : ''}
            ${cost.energy ? `<span class="cost-tag">&#9889;${cost.energy}</span>` : ''}
            ${cost.research ? `<span class="cost-tag">&#128300;${cost.research}</span>` : ''}
          </div>
          <div class="card-effect">${card.effect}</div>
        `;

        if (canPlay) {
          cardEl.onclick = () => toggleCardSelection(index);
        }
        container.appendChild(cardEl);
      });
    }

    function toggleCardSelection(index) {
      if (state.phase !== 'action') return;
      if (state.strike) {
        addLog('Workers on strike! Cannot play cards!');
        return;
      }

      const card = state.hand[index];
      if (!engine.canAfford(state, card)) return;

      const pos = state.selectedCards.indexOf(index);
      if (pos > -1) {
        state.selectedCards.splice(pos, 1);
      } else {
        const maxSelect = state.extraCardPlayed ? 3 : 2;
        if (state.selectedCards.length >= maxSelect) {
          addLog(`Max ${maxSelect} cards per turn`);
          return;
        }
        state.selectedCards.push(index);
      }

      updateUI();
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

    function showEventModal(title, text, hasEvent) {
      document.getElementById('modalTitle').textContent = title;
      document.getElementById('modalText').textContent = text;
      document.getElementById('eventModal').classList.add('active');
      document.getElementById('modalBtn').textContent =
        hasEvent ? 'Apply Event & Proceed' : 'Proceed to Action Phase';
    }

    // ==================== END SCREEN ====================

    function showEndScreen() {
      const screen = document.getElementById('endScreen');
      const title = document.getElementById('endTitle');
      const reasonText = document.getElementById('endReason');
      const board = document.getElementById('scoreBoard');

      screen.classList.add('active');

      if (state.gameResult === 'victory') {
        title.textContent = 'Collective Victory!';
        title.style.color = 'var(--accent-gold)';
        reasonText.textContent = 'Purification 100% complete with 6+ habitats! The Res Publica Republic is established!';
      } else if (state.gameResult === 'defeat') {
        title.textContent = 'Collective Defeat';
        title.style.color = 'var(--accent-rose)';
        reasonText.textContent = `Turn 20 ended. Purification: ${state.purification.toFixed(1)}% (need 100%). Habitats: ${state.habitats}/6. Human civilization evacuates Venus.`;
      } else { // 'crash'
        title.textContent = 'Habitat Crashed';
        title.style.color = '#dc2626';
        reasonText.textContent = 'Structural Integrity reached zero. The floating habitat station has crashed. Game over.';
      }

      board.innerHTML = `
        <div class="score-card winner">
          <h3>Player Faction</h3>
          <div style="font-size: 2rem; color: var(--accent-gold); margin: 10px 0;">${state.contribution}</div>
          <div style="font-size: 0.85rem; color: var(--text-secondary);">
            Habitats x20: ${state.habitats * 20}<br>
            Purification: ${Math.floor(state.purification)}<br>
            Funds /5: ${Math.floor(state.resources.money / 5)}<br>
            Prestige: ${state.prestige}
          </div>
        </div>
        <div class="score-card">
          <h3>Final Status</h3>
          <div style="margin-top: 10px; font-size: 0.9rem; line-height: 1.8; color: var(--text-secondary);">
            Turn: ${state.turn}/20<br>
            Purification: ${state.purification.toFixed(1)}%<br>
            Habitats: ${state.habitats}<br>
            Integrity: ${state.resources.integrity.toFixed(1)}%<br>
            Charter: ${state.hasCharter ? 'Yes' : 'No'}
          </div>
        </div>
      `;
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
        el.querySelector('.resource-value').textContent =
          key === 'integrity' ? value.toFixed(0) + '%' : Math.floor(value);

        const bar = el.querySelector('.resource-bar-fill');
        bar.style.width = Math.min(100, value) + '%';

        el.classList.remove('warning', 'critical');
        if (key === 'integrity' && value < 30) el.classList.add('critical');
        else if (key === 'integrity' && value < 50) el.classList.add('warning');
        else if (key === 'morale' && value < 30) el.classList.add('warning');
        else if (key === 'energy' && value < 10) el.classList.add('warning');
      }

      document.getElementById('turnNumber').textContent = state.turn;

      const phaseNames = {
        setup: 'Setup Phase',
        event: 'Event Phase',
        action: 'Action Phase',
        settlement: 'Settlement Phase',
        ended: 'Game Over'
      };
      document.getElementById('currentPhase').textContent = phaseNames[state.phase] || state.phase;

      document.getElementById('purificationText').textContent = state.purification.toFixed(1) + '%';
      document.getElementById('purificationBar').style.width = state.purification + '%';
      document.getElementById('purificationPercent').textContent = state.purification.toFixed(0) + '%';

      document.getElementById('habitatText').textContent = `${state.habitats} / Target: ${state.targetHabitats}`;

      const maxCards = state.extraCardPlayed ? 3 : 2;
      document.getElementById('selectedCount').textContent = `${state.selectedCards.length}/${maxCards}`;

      document.getElementById('playBtn').disabled = state.selectedCards.length === 0 || state.phase !== 'action';
      document.getElementById('endTurnBtn').disabled = state.phase !== 'action';
      document.getElementById('buildHabitatBtn').disabled =
        state.phase !== 'action' ||
        state.habitatExpansions >= state.maxHabitatExpansions ||
        state.resources.money < 20 ||
        state.resources.materials < 12;

      document.getElementById('corrosionRateText').textContent = `-${state.corrosionRate}%/turn`;

      renderHand();

      const permContainer = document.getElementById('permanentCards');
      if (state.permanentCards.length === 0 && state.timedEffects.length === 0 && state.delayedEffects.length === 0) {
        permContainer.innerHTML = 'No permanent cards yet';
      } else {
        permContainer.innerHTML =
          state.permanentCards.map(c =>
            `<div style="padding: 4px 0; border-bottom: 1px solid var(--border);">
              <span style="color: var(--accent-cyan);">${c.name}</span>
              <span style="font-size: 0.75rem; color: var(--text-secondary);"> - ${c.effect}</span>
            </div>`
          ).join('') +
          state.timedEffects.map(te =>
            `<div style="padding: 4px 0; border-bottom: 1px solid var(--border);">
              <span style="color: var(--accent-gold);">${te.name}</span>
              <span style="font-size: 0.75rem; color: var(--text-secondary);"> - ${te.turnsLeft} turn(s) remaining</span>
            </div>`
          ).join('') +
          state.delayedEffects.map(de =>
            `<div style="padding: 4px 0; border-bottom: 1px solid var(--border);">
              <span style="color: var(--accent-purple);">${de.name}</span>
              <span style="font-size: 0.75rem; color: var(--text-secondary);"> - activates in ${de.turnsLeft} turn(s)</span>
            </div>`
          ).join('');
      }
    }

    // ==================== TURN FLOW (drives engine, keeps original pacing) ====================

    function startNewTurnFlow() {
      engine.startNewTurn(state);
      if (state.gameOver) { showEndScreen(); return; }

      updateUI();
      updatePhaseIndicator();
      document.getElementById('turnBlocker').classList.add('active');
      document.getElementById('blockerText').textContent = 'Waiting for Event Phase...';

      setTimeout(() => {
        const event = engine.triggerEventPhase(state);
        if (event) {
          showEventModal('Environmental Event: ' + event.name, event.desc, true);
        } else {
          showEventModal('Threat Neutralized', "This turn's environmental threat was neutralized. Proceed to Action Phase.", false);
        }
      }, 500);
    }

    // ==================== GLOBAL ENTRY POINTS (inline onclick targets) ====================

    root.closeEventModal = function () {
      document.getElementById('eventModal').classList.remove('active');

      engine.applyEvent(state);
      updateUI();
      updatePhaseIndicator();

      document.getElementById('turnBlocker').classList.remove('active');
      document.getElementById('blockerText').textContent = '';

      if (state.gameOver) { showEndScreen(); return; }

      if (state.strike) {
        addLog('Action Phase: Workers on strike! You can only repair or end turn.');
      } else {
        addLog('Action Phase: Select cards to play (max 2), repair, build habitat, or end turn.');
      }
    };

    root.playSelectedCards = function () {
      const result = engine.playSelectedCards(state);
      if (!result.ok) { addLog(result.reason); return; }
      updateUI();
      if (state.gameOver) showEndScreen();
    };

    root.repairHabitat = function () {
      const result = engine.repairHabitat(state);
      if (!result.ok) addLog(result.reason);
      updateUI();
    };

    root.buildHabitat = function () {
      const result = engine.buildHabitat(state);
      if (!result.ok) addLog(result.reason);
      updateUI();
      if (state.gameOver) showEndScreen();
    };

    root.endTurn = function () {
      if (!state || state.phase !== 'action') return;

      document.getElementById('turnBlocker').classList.add('active');
      document.getElementById('blockerText').textContent = 'Settlement Phase...';

      engine.endTurn(state);
      updateUI();
      updatePhaseIndicator();

      if (state.gameOver) { showEndScreen(); return; }
      setTimeout(startNewTurnFlow, 1500);
    };

    // ==================== INIT ====================

    function initGame() {
      engine.onLog = addLog;
      state = CR.state.createInitialState();

      createStars();
      engine.drawInitialCards(state);
      updateUI();
      updatePhaseIndicator();

      addLog('Game started! Venus Floating City colonization project launched.');
      addLog('Goal: Complete sulfuric acid cloud purification (100%) and establish at least 6 habitats within 20 turns.');
      addLog('Initial resources allocated. Structural Integrity decreases by 2% per turn (sulfuric acid corrosion).');

      setTimeout(startNewTurnFlow, 1000);
    }

    root.onload = initGame;
  })(window);
  ```

- [ ] **Step 2: 静态一致性检查**
  运行：
  ```bash
  cd /Users/haydenjiang/Downloads/cloud-republic
  node -e "const e = require('./js/engine.js'); ['drawInitialCards','startNewTurn','triggerEventPhase','applyEvent','playSelectedCards','repairHabitat','buildHabitat','endTurn','canAfford','getCardCost'].forEach(f => { if (typeof e[f] !== 'function') throw new Error('missing ' + f); }); console.log('engine interface OK');"
  grep -o 'getElementById(.[a-zA-Z]*.)' js/ui.js | sort -u
  ```
  预期：第一行命令输出 `engine interface OK`；第二条列出的所有 id 都能在 index.html 中找到（逐一 `grep` 确认，重点：`buildHabitatBtn`、`permanentCards`、`turnBlocker`、`blockerText`）。

- [ ] **Step 3: 浏览器烟测（手工）**
  双击打开 `index.html`：星空背景与样式与原游戏一致；1 秒后开始第 1 回合并弹出事件窗；确认后进入行动阶段；卡牌可点选、Play/Repair/Build Habitat/End Turn 按钮均可用；日志持续滚动。任何异常对照浏览器 Console 报错修复。

---

## Task 9: 手工验收 + 最终全量回归

**Files:**
- 不新建/修改文件（验收与回归）

**Interfaces:**
- Consumes: 全部前序任务产物
- Produces: 验收结论

- [ ] **Step 1: 最终全量自动化回归**
  运行 `cd /Users/haydenjiang/Downloads/cloud-republic && node test/simulate.js`，预期最后一行 `60 passed, 0 failed`，退出码 0（`echo $?` 验证）。spec §3.8 平衡性修订已并入本计划（关键设计说明第 6 条），胜率断言应正常通过。

- [ ] **Step 2: 手工验收清单（浏览器打开 index.html，逐项核对 spec §6）**
  - [ ] 建造栖息地按钮可用：行动阶段资金 ≥20 且材料 ≥12 时可点击，扣 20 资金 + 12 材料、栖息地 +1；与扩容卡合计达到 5 次后按钮置灰、点击写拒绝日志
  - [ ] 卡牌显示折后价格：打出卡 1/7/42 后，手牌中卡牌的 Funds 价格下降（如卡 5 从 8 降到 4）
  - [ ] 贸易协定（卡 24）打出后左侧 Permanent Effects 区域显示金色条目与剩余回合数，每个结算倒数，3 次后消失
  - [ ] 保险触发后游戏继续：完整度归 0 时写「Space Survival Insurance activated!」日志、完整度回到 20%、资源减半，游戏不结束；第二次归 0 才出现坠毁结局
  - [ ] 三种结局画面正常：20 回合 timeout（胜利/失败两种文案）、崩溃（Habitat Crashed）——endScreen 全屏展示、Play Again 按钮可重开
  - [ ] 视觉回归：整体布局、配色、字体、卡牌样式与原 `RES-REPBLIC.html` 一致（可并排打开两个文件对照）

- [ ] **Step 3: 交付确认**
  确认目录结构为：
  ```
  cloud-republic/
  ├── index.html
  ├── styles.css
  ├── js/data.js
  ├── js/state.js
  ├── js/engine.js
  ├── js/ui.js
  ├── test/simulate.js
  └── docs/superpowers/
      ├── specs/2026-07-23-cloud-republic-restructure-design.md
      └── plans/2026-07-23-cloud-republic-restructure.md
  ```

---

## 附录 A：spec 修复清单覆盖对照

| spec 条目 | 覆盖位置 |
|---|---|
| 3.1 maxHabitatExpansions 3→5 | Task 3（state.js 字段）+ Task 7 断言 |
| 3.1 Build Habitat 按钮（20 资金 + 12 材料，共享 5 次上限，造价见 §3.8） | Task 1（HTML）+ Task 7（engine.buildHabitat）+ Task 8（绑定与置灰） |
| 3.2 卡 2 延时 3 回合转永久收入 | Task 6（applyContractEffect delay 分支）+ Task 7（endTurn 结算/maturedIncome）+ 断言 |
| 3.2 卡 24 持续 3 个结算并显示剩余回合 | Task 6（duration 分支）+ Task 7（endTurn timedEffects）+ Task 8（金色条目倒数） |
| 3.3 运输折扣乘性叠加、系数下限 0.4、资金成本折扣、UI 折后价 | Task 5（getCardCost/canAfford/payCost）+ Task 6（卡 1/7/42）+ Task 8（renderHand） |
| 3.4 卡 17 修理成本 −25%、卡 45 效率 ×2（+2%/次） | Task 6（applyPermanentEffect）+ Task 7（repairHabitat）+ 断言 |
| 3.5 完整度归 0：ultimate → insurance → crash 依次拦截，一次性 | Task 5（modifyResource/handleCrash）+ Task 7 断言 |
| 3.6 卡 8 40% 风险掷骰 | Task 6（risk 分支，经 engine.rng）+ 断言 |
| 3.6 卡 53 抵消太阳风暴（event id 2） | Task 7（triggerEventPhase）+ 断言 |
| 3.6 卡 31 士气下限回合内即时生效 | Task 5（modifyResource 内 floor）+ 断言 |
| 3.6 卡 27 shieldActive 保持原语义 | Task 7（triggerEventPhase 拦截并消耗）+ 断言 |
| 3.7 统一 applyResourceEffect | Task 5（定义）+ Task 6/7（contract/事件/timedEffects 全部走它） |
| §6 胜率统计可达 | Task 7（500 局贪心 bot 断言） |
| §6 手工验收清单 | Task 9 Step 2 |
| 3.7 永久卡 purification 收入（卡 12/49）计入 endTurn 结算 | 「关键设计说明」第 4 条 + Task 7（endTurn）+ 断言 |
| 3.8 平衡性三件套（起始材料 40、造价 20+12、结算抽 2 张） | Task 3（state.js）+ Task 1/7/8/9（造价）+ Task 7（endTurn 抽牌）+ 断言 |

## 附录 B：全局函数签名速查（接口一致性基准）

```text
CR.data.CARD_DATABASE : Card[]            CR.data.EVENTS : Event[]
CR.state.createInitialState() -> state
CR.engine.rng : () => number              CR.engine.onLog : (msg: string) => void
CR.engine.modifyResource(state, type, amount) -> undefined
CR.engine.applyResourceEffect(state, effect) -> undefined
CR.engine.getMaturityMultiplier(maturity) -> number
CR.engine.getCardCost(state, card) -> {money, materials, energy, research}   // 整数
CR.engine.canAfford(state, card) -> boolean
CR.engine.payCost(state, card) -> undefined
CR.engine.drawCard(state) -> undefined
CR.engine.drawInitialCards(state) -> undefined
CR.engine.checkVictory(state) -> boolean
CR.engine.endGame(state, reason /* 'crash'|'timeout'|'victory' */) -> undefined
CR.engine.playSelectedCards(state) -> {ok: boolean, reason?: string}
CR.engine.applyContractEffect(state, card) -> undefined
CR.engine.applyPermanentEffect(state, card) -> undefined
CR.engine.startNewTurn(state) -> undefined
CR.engine.triggerEventPhase(state) -> Event | null
CR.engine.applyEvent(state) -> undefined
CR.engine.repairHabitat(state) -> {ok: boolean, reason?: string}
CR.engine.buildHabitat(state) -> {ok: boolean, reason?: string}
CR.engine.endTurn(state) -> {ok: boolean, reason?: string}
window.playSelectedCards() / window.repairHabitat() / window.buildHabitat() / window.endTurn() / window.closeEventModal()  // ui 层包装，无参无返回
state.timedEffects[i]    = { name, turnsLeft, income: {money, materials, energy} }
state.delayedEffects[i]  = { name, turnsLeft, income }
state.maturedIncome      = { money, materials, energy, research, morale }
```

## 附录 C：胜率风险的干跑证据（2026-07-23，计划撰写时实测）

按本计划 Task 1–7 的代码在 /tmp 完整组装（data.js 按指定行号从原文件抽取、state/engine/simulate 按计划内代码块原文拼装），执行 `node test/simulate.js` 的结果：

**第一次干跑（spec §3.8 修订前数值）：**

- 机制断言：**59/59 通过**（冒烟 3 + Task5 11 + Task6 24 + Task7 21），含保险一次性、ultimate 无损失、卡 2 延时 3 回合、卡 24 恰好 3 结算、折扣下限 0.4、士气下限即时生效、共享 5 次上限等全部 spec 修复点。
- 500 局模拟（计划内贪心 bot，种子 1–500）：`0 victories, 500 defeats (timeout), 0 crashes`；平均净化 ~10%，平均栖息地 ~2.3。

进一步诊断实验（仅诊断，不在计划代码内）：

| 实验 | 结果 |
|---|---|
| 净化卡打出计数（500 局） | 卡 30×88、卡 18×57、卡 14×33、卡 12×23、卡 20×19、卡 49×3、卡 61×1 |
| 提高净化/研究权重、修理阈值 60→25（dbg4） | 0 胜，avgPur 10.3，avgHab 2.31 |
| 材料/能源经济权重 ×10、推迟造栖息地（dbg7） | 0 胜，avgPur 12.4，avgHab 1.68 |
| 初始手牌注入卡 11+12+49（净化 T11 即达 100%） | 0 胜 / 200，avgPur 68.3，**avgHab 2.15** |

单局轨迹（注入 11/12/49，种子 1）：净化第 11 回合达 100%，但材料从第 2 回合起归零并整局无法恢复（材料收入卡本身要材料；手牌第 10 回合起撑满 8 张停止抽牌；能源第 5 回合归零使带能源成本的卡全部卡手），栖息地停在 2。

结论（第一次干跑）：瓶颈是**数值经济**（净化卡浓度 + 材料/能源收入链），不是引擎逻辑 bug。该结论已上报用户，用户拍板 spec §3.8「轻量三件套」。

**第二次干跑（2026-07-23，spec §3.8 新数值：起始材料 40、Build Habitat 20 资金 + 12 材料、结算抽 2 张）：**

- 机制断言：**59/59 通过**（同上，含 buildHabitat 新造价断言）。
- 500 局模拟（计划内贪心 bot，种子 1–500，未调权重）：`2 victories, 498 defeats (timeout), 0 crashes`，**胜率 0.4% > 0**，胜率断言通过；全量结果 `60 passed, 0 failed`，退出码 0。
- 说明：0.4% 仅证明「胜利统计可达」这一 spec 验收成立，不代表游戏难度合理；是否进一步调平衡属用户体验范畴，超出本计划范围。实现时若复跑胜率与此有出入，先核对实现与计划代码块逐字一致，再按 Task 7 Step 6 的流程处理。
