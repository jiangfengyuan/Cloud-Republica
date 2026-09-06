# M2 设计规格：派系 + Meta 成长

日期：2026-07-28 ｜ 状态：已拍板（用户授权全权落实）｜ 前置：M1 视觉全套已完成
项目：/Users/haydenjiang/Downloads/RES_REP/（零依赖、离线、无 ES module、无 git）

## 1. 目标与非目标

**目标**
- 派系系统：开局前从 4 个派系（含「无派系」基线）中选 1 个，派系 = 一组规则修正器 + 一个实质性代价（hardcore 取舍），正交于难度。
- Meta 成长：跨局持久的「传承点数」经济 + 6 种可购买的永久增益（perk），存 localStorage，给硬核玩家长线进度钩子。
- 平衡红线：无派系无 Meta 基线胜率必须保持现状（easy [60,80] / medium [30,50] / hard [10,20]）；模拟器扩展为 派系×Meta 矩阵并重新标定。

**非目标**（本轮明确不做）
- 不加新卡牌、不做派系专属牌池（M4 卡牌构筑再议）
- 不做选项事件（事件系统保持被动单效果）
- 不做局内存档（局内 state 依旧不持久化）
- 不动 M1 已裁决事项（glacier 对比度基线等，见 m1-final-review.md）

## 2. 派系系统

### 2.1 数据结构（js/data.js 新增 FACTIONS）

```js
FACTIONS = {
  none:        { modifiers: {} },                                  // 自由殖民地（基线，无修正）
  guild:       { moneyMultiplier: 1.25, transportDiscount: 0.9,    // 苍穹商会：经济特化
                 startResources: { money: +15, morale: -10 } },
  covenant:    { purificationMultiplier: 1.15, corrosionDelta: -0.5,// 生态公约：净化特化
                 habitatMaterialsDelta: +4 },                       // 代价：建造材料 12→16
  technocracy: { researchIncome: 2, researchCostMultiplier: 0.75,  // 技术执政团：科研特化
                 moraleDecayDelta: +1 }                             // 代价：士气衰减 1→2/回合
}
```

设计原则：每派系 2 项增益 + 1 项实质代价；全部映射到**已有 state 修正器字段**或少数集中消费点，不新建通用管道。

### 2.2 引擎消费点（js/engine.js，最小侵入）

| 修正器 | 消费位置 | 说明 |
|---|---|---|
| moneyMultiplier / transportDiscount | 已有（endTurn 收入 / getCardCost） | 复用，floor 0.4 不变 |
| purificationMultiplier（新增 state 字段，默认 1） | applyResourceEffect | 仅放大**正** purification 增量 |
| corrosionDelta | createInitialState 直接改 state.corrosionRate | 下限钳制 1.0 |
| habitatMaterialsDelta（新增，默认 0） | buildHabitat | 材料花费 12 + delta |
| researchIncome（新增，默认 0） | endTurn 收入步 | 每回合 +N 研究 |
| researchCostMultiplier（新增，默认 1） | getCardCost | 仅乘 research 成本 |
| moraleDecayDelta（新增，默认 0） | endTurn 士气步 | 衰减 1 + delta |

### 2.3 state 与 UI

- `createInitialState(difficultyKey, factionId, metaPerks)`：查 DIFFICULTY_LEVELS + FACTIONS + META_PERKS 展开进 state；未知派系/难度回退 none/medium。state 新增 `faction` 字段记录派系 id。
- 开始界面：难度按钮行上方加同款派系按钮行（4 枚，模块级选中态 + active class），`startGame(diff)` 读取当前选中派系；选中项持久化到 `cr_faction`。
- 对局内 header 加派系徽章（图标 + 名称）。
- 派系图标：icons.js 新增 4 个 SVG path（guild=贸易币、 covenant=叶云、technocracy=电路、none=旗帜），走 ICONS[] 机制，禁 emoji。

## 3. Meta 成长系统

### 3.1 传承点数（legacy）

- 获取（endGame 结算时）：胜 = easy 2 / medium 3 / hard 5；负 = 1（参与奖）。
- 存储：localStorage `cr_meta` v1：
  `{ v:1, legacy:<余额>, lifetime:<累计获得>, perks:{ fund:0..2, supplies:0..2, lab:0..2, coating:0..2, grid:0..1, handbook:0..1 } }`
- 读写全部 try/catch，模式照抄 loadStats/saveStats（ui.js:106-119）。

### 3.2 Perk 清单（js/data.js 新增 META_PERKS）

| id | 名称（中/英） | 效果/级 | 上限 | 费用（逐级） |
|---|---|---|---|---|
| fund | 启动资金 / Seed Fund | 起始资金 +10 | 2 | 1, 2 |
| supplies | 物资储备 / Stockpile | 起始材料 +8 | 2 | 1, 2 |
| lab | 研究前哨 / Outpost Lab | 起始研究 +4 | 2 | 1, 2 |
| coating | 防腐涂层 / Anti-Corrosion | 腐蚀速率 -0.2（钳 ≥1.0） | 2 | 2, 3 |
| grid | 高效电网 / Smart Grid | 能源维护 -1（钳 ≥2） | 1 | 2 |
| handbook | 殖民手册 / Field Manual | 起始手牌 +1 | 1 | 3 |

数值原则：单 perk 都是「小加成」，满配约等于难度降半档——Meta 是长线减负而非通关钥匙。

### 3.3 Meta 界面

- 开始界面战绩面板旁加「传承」按钮（图标 + 余额），打开全屏 overlay（复用 .end-screen 全屏层模式，不用 modal）。
- 内容：legacy 余额 + 6 张 perk 卡（图标、名称、效果描述、等级圆点、购买按钮含费用）；余额不足/满级时按钮置灰。
- 购买即写 cr_meta 并刷新界面；双语全键。

## 4. 战绩 schema 升级（cr_stats v1→v2）

v2 增加 `factions: { none|guild|covenant|technocracy: { games, wins } }`；loadStats 迁移 v1（拷贝旧字段 + 补新结构）；recordGame 按 state.faction 记 faction 维度。战绩面板本轮**不改版式**（仅 schema 扩展），派系维度展示留待后续。

## 5. 模拟器扩展（test/simulate.js）

- `playGame(seed, difficultyKey, factionId='none', metaPerks={})`，传入 createInitialState；AI 启发式本轮**不做派系感知**（保持现状，偏差用区间吸收）。
- 断言矩阵：
  1. 基线（none + 无 meta）：三档区间不变 [60,80]/[30,50]/[10,20] —— 回归红线
  2. 每派系 × 无 meta × medium：胜率落在 [15,70]，0 崩溃（宽松带，标定后收紧）
  3. 满配 meta × medium：胜率落在标定区间（目标比基线高 8-20pp，实测后 pin 死）
  4. 每派系 × 满配 meta × hard：0 崩溃冒烟（不定胜率区间）
- 每组合 500 局；zh/en 键集一致性断言保留。

## 6. i18n（js/i18n.js，zh/en 双语同步）

新增键约 40×2：`faction.*`（4×name+desc+tagline）、`meta.*`（标题、余额、购买、满级、6×name+desc）、`ui.faction_label`、`stats` 不动。命名沿用现有 dot 规范。

## 7. 验收标准

1. `node test/simulate.js` 全绿（基线 78 项 + 新增矩阵断言）
2. 基线三档胜率不漂移（无派系无 meta = 现状数值 ±2pp）
3. 满配 meta medium 胜率显著高于基线（≥+8pp），证明 Meta 有实感
4. 开始界面首屏 DOM ≤ 420（M1 为 252，派系行+传承按钮预算 168）
5. 零外链、零 emoji（新增图标全 SVG）、zh/en 键集一致
6. SDD 流程：每任务实现者→审查者→修复→复审，报告落 .superpowers/sdd/

## 8. 风险与对策

- **平衡漂移**：派系/加成经 createInitialState 单点注入，基线路径（none+无 meta）字节级不动 → 用断言 1 锁死
- **开始界面信息过载**：派系行与难度行同构、选中态复用 active class；传承按钮进 header-controls，不新增区块
- **localStorage 损坏**：cr_meta/cr_stats v2 读写全 try/catch + 版本迁移兜底
- **图标审美不一致**：新派系图标沿用 icons.js 描边风（stroke=currentColor, 24×24 viewBox）
