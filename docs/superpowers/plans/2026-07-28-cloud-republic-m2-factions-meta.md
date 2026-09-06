# Cloud Republic M2 (Factions + Meta Progression) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按已定稿 spec《2026-07-28-cloud-republic-m2-factions-meta-design.md》落实 M2：data.js 新增 FACTIONS + META_PERKS，state.js 单点注入（difficulty × faction × metaPerks），engine.js 四个最小侵入消费点，i18n 双语 33×2 键，icons.js 四个派系 SVG 图标，ui.js/index.html/styles.css 派系选择行 + 对局徽章 + 传承 overlay + cr_stats v2 / cr_meta v1，simulate.js 扩展派系×Meta 断言矩阵并重新标定。

**Architecture:** 结构不变，无新文件（仅 data/i18n/icons/state/engine/ui/simulate/index/styles 就地修改）。脚本加载顺序 data → i18n → icons → state → engine → ui **不变**。派系与 Meta 全部经 `createInitialState(difficultyKey, factionId, metaPerks)` 单点展开为 state 扁平修正器字段；持久化 `cr_stats` v1→v2（迁移）、`cr_meta` v1（新增）、`cr_faction`（选中派系）。全部资源内联，完全离线。

**Tech Stack:** 纯原生 HTML/CSS/JS（无构建工具、无依赖、无 ES module、无网络资源）。测试仅需 Node.js 内置 `require`。

## Global Constraints
- 不用 git（用户明确拒绝，计划中不得出现任何 commit 步骤）
- 所有文件在 /Users/haydenjiang/Downloads/RES_REP/ 下
- **平衡红线**：无派系无 Meta 基线胜率 easy [60,80] / medium [30,50] / hard [10,20] 不得漂移；基线路径行为字节级不变（见关键设计说明 2）
- 完全离线：不新增任何外部资源/依赖/网络请求（grep 验收）
- 零 emoji：新增图标全 SVG（stroke=currentColor，24×24 viewBox）；M1 裁决 #6 的内文符号（⚠️📊★▶☁）保留不动
- 无 CSS 框架/预处理器；styles.css 新增段落追加文件末尾并以注释标记；双击 index.html 即玩
- 不推翻 M1 已裁决 6 项（m1-final-review.md 第一节）
- spec 数值一律以设计文档为准；微调只能由计划作者在「spec 偏差建议」节留痕，实现者不得改数值

## 关键设计说明（实现前必读）

1. **FACTIONS 数据结构原样保留 spec 写法**：`none` 带 `modifiers: {}` 包装，其余派系修正器平铺在派系对象顶层（spec §2.1 原文即如此不对称）。state.js 消费时按已知修正器键（moneyMultiplier / transportDiscount / startResources / purificationMultiplier / corrosionDelta / habitatMaterialsDelta / researchIncome / researchCostMultiplier / moraleDecayDelta）逐个带回退读取，`modifiers` 包装字段忽略——结构归一化在消费层完成，不改 spec 文本与数值。
2. **基线字节级不变的机制**：`createInitialState(key)`（不传 factionId/metaPerks）→ factionId 回退 'none'、metaPerks 回退 `{}`，全部新修正器取恒等值（×1 / +0 / 空 startResources），corrosionRate / energyMaintenance / initialHandSize / resources 与 M1 完全一致。state 新增 7 个字段（faction、purificationMultiplier、habitatMaterialsDelta、researchIncome、researchCostMultiplier、moraleDecayDelta + 既有 transportDiscount/moneyMultiplier 由派系回退到 1），引擎消费点全部用 `|| 1` / `|| 0` 回退，基线输出不变。干跑实测：easy 67.4% / medium 39.8% / hard 15.8% —— 与 m1-final-review.md 终值逐位一致。
3. **purificationMultiplier 消费口径**：仅 `applyResourceEffect` 中的**正** purification 增量放大（卡牌/事件一次性净化），负增量不放大；endTurn 永久卡净化收入（如 49 号）**不放大**——spec §2.2 表只列 applyResourceEffect 一个消费点，按 spec 执行，模拟偏差由区间吸收。浮点直接累积（state.purification 本就是 float，UI toFixed(1)），log 金额 `Math.round(delta*10)/10`，基线 delta=原值输出不变。
4. **corrosionDelta 注入口径**：派系 corrosionDelta 与 perk coating 都在 createInitialState 一次性加减进 state.corrosionRate，合并后钳制 ≥1.0（例：easy 1.5 + covenant(-0.5) + coating lv2(-0.4) = 0.6 → 1.0）。运行期永久卡 ve.corrosion（16/41/65 号）不钳，沿用现状不动。
5. **habitatMaterialsDelta 消费口径**：engine.buildHabitat 材料花费 = `12 + (state.habitatMaterialsDelta || 0)`；ui.js buildHabitatBtn disabled 判断同步改为 `materials < 12 + state.habitatMaterialsDelta`。`btn.build` 静态文案「-12 材料」**不改**——与 M1 裁决 #3（修理按钮静态文案 mismatch 接受）同类处理，入 backlog（动态文案）。
6. **moraleDecayDelta 消费口径**：endTurn 第 6 步 `const decay = 1 + (state.moraleDecayDelta || 0)`，modifyResource(-decay) 且 log.morale_decay amount=-decay；基线 decay=1 输出与现状逐字节一致。`noMoraleDecay`（54 号卡）仍整体跳过衰减。
7. **researchIncome 消费口径**：endTurn 收入步在 income 应用之后独立 `if (state.researchIncome) modifyResource(state, 'research', state.researchIncome)`，不进 income_summary 日志（避免改既有日志模板），不乘 moneyMultiplier。
8. **传承按钮位置裁决（spec 内部冲突）**：§3.3 说「开始界面战绩面板旁」，§8 说「进 header-controls」。裁决：放**开始界面战绩面板下方**独立按钮行（图标 + `meta.title · 余额`），不进对局 header——购买 perk 属局间行为，对局内无入口。见「spec 偏差建议」。
9. **cr_stats v1→v2 迁移口径**：loadStats 接受 v1/v2，v1 拷贝旧字段 + Object.assign 补 `factions: { none|guild|covenant|technocracy: { games, wins } }`，写回时 v=2；recordGame 按 `state.faction || 'none'` 记 faction 维度。战绩面板**版式不改**（spec §4，派系维度展示留后续）。cr_meta v1：`{ v:1, legacy, lifetime, perks:{ fund,supplies,lab,coating,grid,handbook } }`，读写全 try/catch，模式照抄 loadStats/saveStats；加载时 perk 等级钳 [0, max]、legacy/lifetime 钳 ≥0 整数。
10. **传承结算防重**：legacy 发放与 recordGame 同在 showEndScreen 的 `state.statsRecorded` 防重块内（胜 easy 2 / medium 3 / hard 5，负/坠毁 1），结果存 `state.legacyGained` 供结局画面 `end.legacy_gained` 行展示；refreshTexts 重渲染结局不重复发放。
11. **Meta overlay 形态**：复用 `.end-screen` 全屏层模式（id=metaScreen，不用 .modal-overlay）；6 张 perk 卡运行时 innerHTML 渲染（图标、名称、效果、等级圆点 max 枚、购买按钮含下一级费用；余额不足/满级 disabled），不占首屏静态 DOM 预算。perk 图标复用现有资源图标（fund=res.money, supplies=res.materials, lab=res.research, coating=res.integrity, grid=res.energy, handbook=panel.hand），只为派系新增 4 枚 SVG。
12. **AI 不做派系感知**（spec §5）：simulate.js 启发式原样；派系/满配区间按干跑实测 ±5pp 取整 pin 死（guild [45,60]、covenant [20,35]、technocracy [30,45]、满配 [50,65]）。
13. **首屏 DOM 预算**：M1 静态 252 + 派系行（label+容器+4 按钮×~6 节点 ≈ 26）+ 传承按钮（≈5）+ metaScreen 静态壳（≈6，隐藏）+ 派系徽章（1）≈ 290 ≤ 420。派系图标每枚 ≤3 子节点（沿用 icons.js ≤4 硬约束）。

## 干跑实测（2026-07-28，/tmp/m2-dryrun 全量应用后）

| 组合 | 实测胜率 | pin 区间 |
|---|---|---|
| easy / none / 无 meta（基线） | 67.4% | [60,80]（不变） |
| medium / none / 无 meta（基线） | 39.8% | [30,50]（不变） |
| hard / none / 无 meta（基线） | 15.8% | [10,20]（不变） |
| medium / guild / 无 meta | 51.6% | [45,60] |
| medium / covenant / 无 meta | 25.2% | [20,35] |
| medium / technocracy / 无 meta | 37.8% | [30,45] |
| medium / none / 满配 meta | 58.0%（基线 +18.2pp ✓ spec 目标 +8~20pp） | [50,65] |
| hard / 每派系 / 满配 meta | — | 冒烟：500 局 0 异常（不定区间） |

`node test/simulate.js` → **108 passed, 0 failed**（基线 78 项 + 新增 30 项）。zh/en 键集一致断言通过；新增内容零 emoji；零外链。

## spec 偏差建议（留痕，未改 spec 数值）

1. **传承按钮位置冲突**（§3.3 vs §8）：已按 §3.3 落开始界面（关键设计说明 8）。建议 spec 下轮删 §8「进 header-controls」表述。
2. **FACTIONS 结构不对称**（none.modifiers 包装 vs 其余平铺）：消费层归一，未改 spec。建议 spec 补一句「modifiers 键为可选包装，消费按扁平键读取」。
3. **covenant 偏弱观察**：实测 25.2% 显著低于基线 39.8%——代价（建造材料 12→16）对 habitat 冲刺惩罚大，且净化放大按 spec 不覆盖 49 号永久卡收入。落在 spec 宽松带 [15,70] 内，本轮不动数值；**建议 M3 平衡轮复核**（候选：habitatMaterialsDelta +4→+3，或 purificationMultiplier 1.15→1.2，或放大覆盖 endTurn 净化收入）。
4. **btn.build 静态文案**在 covenant 下与实价（16 材料）不符：与 M1 裁决 #3 同类接受，建议与修理按钮一起做动态文案 backlog 项。

## 任务分解（7 任务，串行执行；每任务实现者→审查者→修复→复审，报告落 .superpowers/sdd/）

- [ ] **T1 js/data.js**：追加 FACTIONS + META_PERKS（精确插入块）。依赖：无。产出供 T2/T6/T7。
- [ ] **T2 js/state.js**：全文替换——createInitialState(difficultyKey, factionId, metaPerks) 单点注入。依赖：T1。
- [ ] **T3 js/engine.js**：四处精确 diff（applyResourceEffect / getCardCost / buildHabitat / endTurn×2）。依赖：T2（消费其新字段；基线回退使顺序可互换，但按序执行）。
- [ ] **T4 js/i18n.js**：zh/en 各追加 33 键（精确插入块）。依赖：无（键清单见 m2-globals）。
- [ ] **T5 js/icons.js**：PATHS 追加 4 枚派系图标（精确插入块）。依赖：无。
- [ ] **T6 js/ui.js + index.html + styles.css**：ui.js 全文替换（cr_stats v2 / cr_meta / 派系选择 / 徽章 / 传承 overlay / 结局传承行）；index.html 三处插入（派系行、传承按钮+metaScreen、徽章）；styles.css 末尾追加 M2 段。依赖：T1、T4、T5。
- [ ] **T7 test/simulate.js**：全文替换——playGame(seed, diff, faction, metaPerks)、M8/M9 单元断言、M10 矩阵（区间已 pin）。依赖：T1–T4（T6 不被 Node 加载）。

## 验收标准（终态）

1. `node --check` 全部 js 通过
2. `node test/simulate.js` 108/108 全绿；基线三档 67.4/39.8/15.8 ±0.6pp（种子 1..500 固定）
3. 满配 meta medium 58.0%（基线 +18.2pp，≥+8pp 达标）
4. 首屏 DOM 估算 ≈290 ≤ 420
5. 零外链、新增零 emoji、zh/en 键集一致（套件内置断言）
6. 每个任务报告落 .superpowers/sdd/m2-task-N-report.md
