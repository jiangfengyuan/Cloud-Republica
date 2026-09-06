# Cloud Republic 重构与机制修复 · 设计文档

日期：2026-07-23
源文件：`~/Downloads/RES-REPBLIC.html`（1635 行单文件游戏）
目标目录：`~/Downloads/cloud-republic/`

## 1. 背景与目标

《Cloud Republic: Venus Floating City》是一个单文件 HTML 卡牌策略游戏：20 回合内完成硫酸云净化（100%）并建成 ≥6 个栖息地。当前代码存在一处导致**胜利不可达**的 bug，以及大量声明了但从未实现的卡牌机制。

目标（已与用户确认）：

- 采用**全面重构**方案：拆分单文件为多文件结构，引擎与 DOM 解耦。
- 修复**全部**已识别的坏机制（scope = fix everything）。
- 不引入构建工具与外部依赖，双击 `index.html` 即玩。

## 2. 项目结构

```
cloud-republic/
├── index.html        # 纯结构标记
├── styles.css        # 全部样式（从原 <style> 原样迁移）
├── js/
│   ├── data.js       # CARD_DATABASE、EVENTS（纯数据）
│   ├── state.js      # gameState 初始状态工厂与重置
│   ├── engine.js     # 回合/资源/卡牌效果/胜负判定（不碰 DOM）
│   └── ui.js         # 渲染、日志、弹窗、按钮事件
├── test/
│   └── simulate.js   # Node 模拟测试
└── docs/superpowers/specs/2026-07-23-cloud-republic-restructure-design.md
```

加载方式：普通 `<script src>` 按 data → state → engine → ui 顺序加载。
**不使用 ES module**——浏览器从 `file://` 打开时 module 会被 CORS 拦截。
跨文件共享通过单一全局命名空间对象 `CR`（`CR.data`、`CR.state`、`CR.engine`），避免散乱全局变量。

职责边界：

- `engine.js` 导出纯逻辑函数，接收/修改 gameState，不读写 DOM、不直接写日志 DOM；日志通过回调（`onLog`）交给 ui 层。
- `ui.js` 负责所有 DOM 操作与事件绑定，调用 engine 函数驱动游戏。
- `state.js` 提供 `createInitialState()`。

## 3. 机制修复清单（最终定稿）

### 3.1 胜负与栖息地
- `maxHabitatExpansions`：3 → **5**（初始 1 + 5 扩容 = 6，可达胜利线）。
- 新增「Build Habitat / 建造栖息地」按钮（与 Repair 并列）：花费 20 资金 + 12 材料，+1 栖息地；与扩容卡共享 5 次上限。

### 3.2 延时/持续类卡牌
- 卡 2（Asteroid Mining Economy）：打出后进入 `delayedEffects` 队列；3 个完整回合后转为永久收入 +12 资金/回合（加入永久收入计算）。
- 卡 24（Trade Agreement）：结算阶段 +2 资金 / +2 材料 / +2 能源，持续 3 个结算后自动移除；左侧永久卡区域显示剩余回合数。

### 3.3 运输折扣（卡 1 / 7 / 42）
- 语义定为「打出卡牌的资金成本」折扣（对应卡牌描述中的 Earth-Venus supply/transport costs）。
- 乘性叠加（0.5 × 0.8 × 0.6），总折扣封顶 60%（即成本系数最低 0.4）。
- 在 `canAfford`、`payCost` 生效，并在卡牌 UI 上显示折后价格。

### 3.4 修理类（卡 17 / 45）
- 卡 17（Biodegradable Materials）：修理材料成本 −25%。
- 卡 45（Nanobot Repair Technology）：修理效率 ×2（每次修理 +2% 完整度）。
- 两者可叠加（成本 2 × 0.75 = 1.5 → 四舍五入；效率体现在恢复量上）。

### 3.5 保险与崩溃（卡 32 / 52）
- 完整度归 0 时依次检查：
  1. `ultimate`（卡 52 意识上传，一次性）：完整度恢复至 20%，**无**资源损失；
  2. `insurance`（卡 32 生存保险，一次性）：完整度恢复至 20%，其他资源（资金/材料/能源/科研）减半；
  3. 都没有 → 正常 `endGame('crash')`。

### 3.6 其余单项
- 卡 8（Rare Metal Futures）：40% 概率交易失败，−10 资金替代 +10（结算时掷骰并写日志）。
- 卡 53（Space Radiation Medicine / stormShield）：太阳风暴事件（EVENTS id 2）被完全抵消，写日志。
- 卡 31（Extraterrestrial Identity / moraleFloor=40）：下限校验移入 `modifyResource`，回合内即时生效（不再只在回合末兜底）。
- 卡 27（Space Court / shieldActive）：现有实现正确，保持原样。

### 3.7 顺带修正
- 原代码中 `applyContractEffect`/`applyPermanentEffect`/事件结算三处近乎重复的资源应用逻辑，在 engine 内统一为 `applyResourceEffect(state, effect)` 一个内部函数（属 C 方案重构的自然结果，非额外范围）。
- 永久卡的 `venusEffect.purification`（卡 12/49）原代码从未计入结算，补入 endTurn 永久收入（不补则净化数学上不可能到 100%）。

### 3.8 平衡性调整（2026-07-23 用户拍板，轻量三件套）

背景：计划干跑（500 局贪心 bot 模拟）显示修复后胜率仍为 0，根因是卡牌数值经济（净化卡浓度低 + 材料收入链撑不住），非引擎 bug。用户选定最小数值改动方案：

- 结算阶段抽牌 1 张 → **2 张**；
- Build Habitat 造价 30 资金 + 20 材料 → **20 资金 + 12 材料**（见 §3.1）；
- 起始材料 30 → **40**。

§6 的「胜率 > 0」断言维持不变，以修订后数值重新验证。

## 4. 数据流

1. `window.onload` → `ui.init()` → `state.createInitialState()` → 渲染。
2. 回合推进：`engine.startNewTurn(state)` → 掷事件 → ui 弹窗 → 玩家确认 → `engine.applyEvent(state, event)` → 行动阶段。
3. 行动阶段：ui 收集选牌 → `engine.playSelectedCards(state, indices)` / `engine.repair(state)` / `engine.buildHabitat(state)` → `engine.endTurn(state)` 结算（永久收入、延时队列、限时效果倒计时、维护 −5 能源、腐蚀、士气衰减、抽牌）。
4. 胜负判定全部在 engine 内；ui 只负责展示 `endScreen`。

## 5. 错误处理

- 资源下限：`modifyResource` 统一 clamp（资金/材料/能源/科研 ≥ 0；士气/完整度 0–100；士气下限即时生效）。
- 非法操作（非行动阶段出牌、超上限选牌、材料不足修理/建造）：engine 返回失败原因，ui 写日志，不改变状态。
- 手牌上限 8 张保持原有行为（抽满时写日志）。

## 6. 测试与验证

- `test/simulate.js`（Node，无依赖）：固定随机种子，随机策略自动对局数百局，断言：
  - 胜利在统计学上可达（胜率 > 0）；
  - 完整度归 0 时保险/终极备份正确触发且仅触发一次；
  - 卡 2 延时 3 回合后收入生效；
  - 卡 24 恰好持续 3 个结算；
  - 运输折扣成本系数 ≥ 0.4；
  - 士气下限回合内即时生效。
  运行：`node test/simulate.js`。
- 手工验收清单（浏览器打开 `index.html`）：
  - 建造栖息地按钮可用且计入 5 次上限；
  - 卡牌显示折后价格；
  - 贸易协定显示并倒数剩余回合；
  - 保险触发后游戏继续并显示恢复日志；
  - 20 回合 / 胜利 / 崩溃三种结局画面正常。

## 7. 明确不做（YAGNI）

- 不做多人/AI 对手（原 UI 文案中的 "all players" 等措辞保持原样，仅作文案）。
- 不做新卡牌、新事件、新机制（超出修复范围）。
- 不引入框架、构建工具、包管理器。
- 不改动整体视觉风格。
