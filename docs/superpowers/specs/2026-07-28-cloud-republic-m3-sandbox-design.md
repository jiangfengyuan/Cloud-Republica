# M3 设计规格：沙盒模式 + covenant 平衡修正

日期：2026-07-28 ｜ 状态：已拍板（用户授权全权落实）｜ 前置：M2 派系+Meta 已完成（108/108）
项目：/Users/haydenjiang/Downloads/RES_REP/（零依赖、离线、无 ES module、无 git）

## 1. 目标与非目标

**目标**
- 沙盒模式：第 4 种难度「沙盒」，开局前玩家自定义 6 项规则参数，配置持久化；给硬核玩家实验场，也是未来 M6/M7 的规则试验台。
- covenant 平衡修正（M2 backlog）：medium 胜率从 25.2% 拉回 technocracy 同级（目标带 [30,45]），同步改文案与矩阵断言。

**非目标**
- 不改胜利条件（仍为净化 100 + 栖息地 6）
- 不做参数预设分享/导入导出
- 不动其他三档难度与 none/guild/technocracy 的任何数值
- 不动 M1/M2 已裁决事项

## 2. 沙盒模式

### 2.1 可调参数与边界（js/data.js 新增 SANDBOX_LIMITS）

| 参数 | 默认（=medium 基值） | 范围 | 步进 |
|---|---|---|---|
| maxTurns | 22 | 15–30 | 1 |
| corrosionRate | 2.0 | 0–4 | 0.5 |
| energyMaintenance | 4 | 0–8 | 1 |
| drawPerTurn | 2 | 1–4 | 1 |
| initialHandSize | 3 | 2–6 | 1 |
| resourcePreset | standard | poor / standard / rich | 档位 |

resourcePreset 映射（基于 medium 初始资源缩放，取整）：poor ×0.75 / standard ×1.0 / rich ×1.5。
DIFFICULTY_LEVELS 新增 `sandbox` 键 = 上表默认值展开（resources 用 medium 值），保证不传配置时沙盒等价 medium 基线形状；guaranteedCards 沿用 [12]。

### 2.2 状态注入（js/state.js）

`createInitialState(difficultyKey, factionId, metaPerks, sandboxConfig)` 第 4 参：
- 仅当 difficultyKey==='sandbox' 时生效；逐字段按 SANDBOX_LIMITS 钳制（数值参数 clamp 到 [min,max] 并按步进取整；resourcePreset 白名单校验，非法值落默认）
- resources = medium 基值 × preset 倍率（round），之后再叠加 faction/meta（顺序：难度基值→沙盒覆盖→派系→perk，与 M2 顺序兼容）
- handLimit 固定 8 不可调；state 记录 `sandboxConfig` 快照供结算屏/日志展示
- 非 sandbox 难度传第 4 参一律忽略（基线路径保护）

### 2.3 UI（开始界面）

- 难度行加第 4 枚「沙盒」按钮；点击展开其下的配置面板（手风琴式，再点收起），面板内：
  - 5 个数值参数用步进器（− 值 +），当前值居中显示
  - resourcePreset 用三档分段按钮（复用派系行的按钮样式）
  - 「开始沙盒」主按钮（accent CTA）
- 配置变更即写 `cr_sandbox`（v1：6 字段），boot 时恢复
- 沙盒局内：phase 指示/徽章区显示「沙盒」标签（复用 difficulty.* i18n 机制，新增 difficulty.sandbox 键）
- 设计约束：步进器复用既有 .btn 体系与令牌；面板不新增配色；图标用 icons.js 既有 panel.* 或新增 ≤2 枚（滑杆/骰子）

### 2.4 legacy 与战绩

- legacy 表新增 sandbox：**胜 1 / 负 0**（防刷——自定义参数可造出送分局，不给参与奖）
- cr_stats v2 已有 wins.sandbox 槽位与 factions 维度，schema 不变；recordGame 按 difficultyKey='sandbox' 自然命中
- 结算屏 legacy 行沿用 end.legacy_gained（sandbox 负局为 0 时该行不显示）

### 2.5 模拟器（test/simulate.js）

- playGame 支持 sandbox 配置透传
- 新增断言：3 个预设配置各 500 局冒烟 + 胜率 pin（干跑标定后定区间）：
  - harsh（maxTurns 15 / corrosion 4 / poor）：预期极低胜率，区间标定后 pin
  - standard（全默认）：应 ≈ medium 基线 39.8%（同参数同 AI，允许 ±2pp 漂移容差，区间 [30,50]）
  - kind（maxTurns 30 / corrosion 0 / rich / draw 4）：预期高胜率，区间标定后 pin
- 钳制测试：越界配置（maxTurns 99、corrosion -1、preset 'cheat'）注入后落回边界/默认
- sandbox legacy 规则单测（胜 1 负 0）

## 3. covenant 平衡修正

现状（M2 终审实测）：medium 25.2%，远低于 technocracy 37.8% 与基线 39.8%。根因：habitatMaterialsDelta +4 卡死建造节奏，净化加成补不回来。

候选调整（干跑标定后择一或组合，以计划留痕为准）：
- a) habitatMaterialsDelta 4 → 2（建造 12→14）
- b) purificationMultiplier 1.15 → 1.25
- c) corrosionDelta -0.5 → -0.75

目标：covenant medium ∈ [30,45]；确认 guild 51.6 [45,60] 与 technocracy 37.8 [30,45] 区间不变、基线三档不变。
文案同步：faction.covenant.desc 双语（「12→16」需随 a) 改为「12→14」）、data.js 注释。

## 4. i18n（zh/en 双语）

新增约 16×2 键：`difficulty.sandbox`、`sandbox.*`（标题、5 参数名、preset 三档、开始按钮、标签）、ui.choose_difficulty 类既有键复用。covenant desc 双语更新。

## 5. 验收标准

1. `node test/simulate.js` 全绿（108 基线 + 新增矩阵/钳制/legacy 断言）
2. 既有全部区间不漂移（基线三档 + 三派系 + 满配 meta）
3. covenant medium 落入新 pin 区间 [30,45]
4. 沙盒三预设冒烟 0 崩溃；standard ≈ medium 基线
5. 开始界面首屏 DOM ≤ 440（M2 为 ≈267，沙盒面板预算充足；收起状态计入）
6. 零外链、零 emoji（新增图标全 SVG）、zh/en parity、无自治 tick
7. SDD 流程：每任务实现者→审查者→修复→复审，报告落 .superpowers/sdd/

## 6. 风险与对策

- **基线污染**：sandboxConfig 仅在 difficulty==='sandbox' 分支生效，既有三参调用路径字节级不动 → 断言 2 锁死
- **防刷**：sandbox 负局 0 点、胜局 1 点；kind 配置刷点效率低于 hard 胜局（5 点），经济上不划算
- **UI 复杂度**：配置面板手风琴收起为默认态，不干扰普通玩家；步进器粒度粗（5+3 档），不做自由输入
- **balance 连锁**：covenant 调整只动 data.js 数值与 i18n 文案，引擎逻辑不变
