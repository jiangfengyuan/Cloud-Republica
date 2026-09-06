# Cloud Republic M3 实现计划：沙盒模式 + covenant 平衡修正

日期：2026-07-28 ｜ 规格：docs/superpowers/specs/2026-07-28-cloud-republic-m3-sandbox-design.md
前置：M2 派系+Meta 已完成（108/108）｜ 全局约定：.superpowers/sdd/m3-globals.md
干跑环境：/tmp/m3-dryrun（全部改动已按简报逐字应用并实测通过）

## 0. 干跑终态（先给结论）

- `node test/simulate.js`：**121 passed, 0 failed**（108 基线 + 13 新增：M11 单元 10 + 预设 band 3）
- 既有 108 项区间**逐位零漂移**：easy 67.4 / medium 39.8 / hard 15.8；guild 51.6 [45,60]；technocracy 37.8 [30,45]；满配 58.0 [50,65]；hard×4派系满配 0 异常
- covenant medium：**32.2%** ∈ [30,45]（方案 a 单一数值）
- 沙盒三预设 500 局：harsh **6.6%** [0,15] / standard **39.8%** [30,50]（=medium 基线，逐位一致）/ kind **77.6%** [70,85]
- 越界钳制、legacy 规则、zh/en parity、零 emoji、零外链、`--calibrate` 模式（114）全部通过
- 首屏 DOM 估算 ≈310 ≤ 440（M2 ≈267 + 新增 43 静态标签）

## 1. 任务分解（6 任务）

| # | 任务 | 文件 | 形态 | 依赖 |
|---|---|---|---|---|
| T1 | data.js：SANDBOX_LIMITS + DIFFICULTY_LEVELS.sandbox + covenant 数值 | js/data.js | 3 处精确 diff | — |
| T2 | state.js：createInitialState 第 4 参注入 + sandboxConfig 快照 | js/state.js | 3 处精确 diff | T1 |
| T3 | i18n.js：sandbox 13×2 键 + covenant desc 双语同步 | js/i18n.js | 4 处精确 diff | — |
| T4 | icons.js：panel.sandbox 滑杆图标 1 枚 | js/icons.js | 1 处精确 diff | — |
| T5 | UI：沙盒按钮/手风琴面板/步进器/分段按钮 + cr_sandbox 持久化 + legacy 规则 | index.html、js/ui.js、styles.css | index 1 处替换 + ui 9 处 diff + css 末尾追加段 | T1–T4 |
| T6 | simulate.js：covenant 断言同步 + M11 追加 + 终态验收 | test/simulate.js | 6 处 diff + M11 整段追加 | 全部 |

依赖链：T1→T2→T6；T3、T4 独立可并行；T5 需 T1–T4 全部就位（消费 SANDBOX_LIMITS / i18n 键 / 图标）；T6 最后做全量验收。engine.js **零改动**（沙盒只改初始状态形状，引擎消费点全部走既有 state 字段）。

SDD 流程照 M2：每任务 实现者→审查者→修复→复审，报告落 .superpowers/sdd/，台账 progress-m3.md。

## 2. 关键设计说明

### 2.1 covenant 平衡修正：抉择与实测依据

干跑标定（calib.js 逐字复刻 simulate.js 的 playGame/scoreCard，种子 1..500 与正测同源，先复现 25.2% 验证可信），medium covenant 500 局：

| 方案 | 实测胜率 | 结论 |
|---|---|---|
| 现状（M2 终态） | 25.2% | 低于目标带 [30,45] |
| a) habitatMaterialsDelta 4→2（建造 12→14） | **32.2%** | ✅ 入选 |
| b) purificationMultiplier 1.15→1.25 | 25.2% | 零边际效应 |
| c) corrosionDelta -0.5→-0.75 | 25.2% | 零边际效应 |
| a+b / a+c / a+b+c | 32.2% | 与 a 单独完全相同 |
| b+c | 25.2% | 零边际效应 |

**裁决：方案 a 单一数值**（最小改动原则；组合方案不带来任何额外收益）。b/c 零边际的根因：covenant 败局的支配约束是栖息地建造节奏（材料 16 卡死扩张链），净化倍率与腐蚀微调不触碰该瓶颈，AI 打分与建造/修理阈值对这两个杠杆均不敏感——这与 M2 终审的根因诊断一致，实测予以确认。

**新 pin 区间 [30,45]**：直接采用 spec §3 目标带与验收标准 3 的字面值，而非 m2 惯例的「实测 ±5pp 取整」（那会得 [27,37]，下界越出 spec 目标带）。注意实测 32.2% 距下界仅 2.2pp，后续迭代改动建造/材料相关逻辑时须重跑标定。

**同步改动**（spec §3 明示「同步改文案与矩阵断言」）：
- data.js covenant 行数值 + 注释（12→16 改 12→14）
- i18n faction.covenant.desc 双语「12→16」→「12→14」
- simulate.js M8 covenant 注入断言 2 行（delta +4→+2、建造 16→14）+ M10 pin [20,35]→[30,45]（注释 measured 25.2→32.2）
- guild/technocracy/基线三档/满配区间与数值一律不动（干跑确认零漂移）

### 2.2 沙盒模式设计要点

- **DIFFICULTY_LEVELS.sandbox = medium 逐字复制**（含 initialHandSize 4，见 §3 偏差 1）。不传配置 / 全默认配置时沙盒与 medium 基线形状恒等——干跑实证：standard 预设 39.8% 与 medium 39.8% 逐位一致（同一 AI、同一 RNG 流，createInitialState 不消耗 rng）。
- **钳制规则**（state.js 与 ui.js sanitizeSandbox 同源同式）：数值参数 clamp 到 [min,max] 后按 `min + round((v-min)/step)*step` 吸附步进网格，×100 取整消除 0.5 步浮点毛刺；resourcePreset 白名单校验，非法落 'standard'。越界实测：maxTurns 99→30、corrosion -1→0、22.6→23、0.3→0.5、preset 'cheat'→'standard'。
- **叠加顺序**（spec §2.2）：难度基值 → 沙盒覆盖（resources 按 preset 倍率 round 缩放；integrity 恒 100 不参与缩放）→ 派系 → perk，与 M2 顺序完全兼容。M2 既有钳制语义不变：corrosion ≥1.0 的地板只在派系/coating 增量存在时触发，因此 sandbox corrosion 0 + none = 0 生效（kind 实测印证），sandbox 0 + covenant = 1.0（M11 断言锁定）。
- **基线路径保护**：第 4 参仅在 difficultyKey==='sandbox' 分支读取；非 sandbox 难度传第 4 参一律忽略且 state.sandboxConfig 为 null（M11 断言锁定）；既有三参调用路径字节级不动。
- **UI 形态**：难度行第 4 枚「沙盒」按钮只做手风琴开合（不直接开局）；面板收起为默认态；5 参数步进器（− 值 +，按钮文本 ASCII `-`/`+`）+ preset 三档分段按钮 + accent CTA「开始沙盒」。沙盒局内「标签」复用既有 difficultyText（`t('difficulty.' + state.difficulty)` 自动命中新键），不新增徽章节点。
- **持久化**：cr_sandbox v1 = `{v:1, maxTurns, corrosionRate, energyMaintenance, drawPerTurn, initialHandSize, resourcePreset}`；变更即写、boot 恢复、加载经 sanitizeSandbox 全字段重钳；读写全 try/catch。
- **legacy 防刷**：LEGACY_WIN_AWARD 增 sandbox:1；新增纯函数 `legacyGain(difficulty, result)`——胜查表、负/坠毁 sandbox 0 其余 1；awardLegacy 改调它。结算屏 legacy 行在 gain=0 时条件渲染不显示（spec §2.4）。cr_stats v2 schema 不变，recordGame 按 difficultyKey 自然命中 wins.sandbox 槽位。
- **可测性**：ui.js 尾壳 `})(window)` 改双兼容外壳（与其余 5 个 js 一致），CR.ui 导出 legacyGain；simulate.js require ui.js 后将 CR.ui.refreshTexts 覆为空函数（Node 无 DOM，i18n.setLang 会回调它），即可对 legacy 规则做真单测而非文本断言。

### 2.3 全部裁决口径（不得推翻 M1/M2 已裁决项；以下为本轮新增裁决）

1. 「既有 108 项断言一字不改」的适用范围：**除 covenant 平衡直接必要的 3 行**（M8 covenant 注入断言 ×2、M10 covenant pin 区间 ×1，spec §3 授权同步）外，其余 105 项逐字不动；新增断言只能追加（M11 段 13 项）。freshState/playGame 签名扩展沿用 m2-task-7 已裁决口径。
2. DOM 预算口径：首屏 = startScreen 静态标签（收起状态计入），M2 ≈267 + 本批 43 ≈ 310 ≤ 440。
3. i18n 新增键 13×2（spec 估「约 16×2」为约数，实测 13 键齐备无缺口；zh/en parity 断言锁定）。
4. 图标新增 1 枚 panel.sandbox（≤2 预算内，3 子节点 ≤4 上限）。
5. styles.css 一律末尾追加，注释段标记 `M5: sandbox mode (2026-07-28 M3 iteration)`（M4 段为 M2 已占用）。
6. 步进器按钮文本用 ASCII `-`/`+`，零 emoji 检查无新增命中（U+2192 `→` 为 M2 已裁决保留的 spec 原文箭头，本批未新增该类字符）。
7. `--calibrate` 模式跳过全部非基线 band（含 M11 三预设），供再标定。
8. 沙盒面板开合状态不持久化（刷新即收起，与手风琴默认态一致）。
9. resourcePreset 缩放五资源（money/materials/energy/research/morale），integrity 恒 100 不缩放（钳制断言锁定）。
10. simulate.js 顶部新增 require icons/ui 两行 + refreshTexts 覆写一行，属测试基建，不计入「108 项断言」语义范围。

## 3. spec 偏差建议（实现者不得自行改 spec 数值；以下留痕待用户裁决）

1. **SANDBOX_LIMITS.initialHandSize 默认 3 → 4（已按 4 落实）**。spec §2.1 表内「默认（=medium 基值）」列写 3，但 medium 真基值 initialHandSize=4（3 是 hard 档的值，疑笔误）；若按 3，DIFFICULTY_LEVELS.sandbox 无法「等价 medium 基线形状」（§2.1 末句），standard 预设实测必然偏离 39.8%。按 4 落实后 standard 实测 39.8% 逐位等于基线，满足 §2.5。
2. **i18n 键数 16×2 → 13×2（实测齐备）**。spec §4 为约数；13 键清单见 m3-globals §1，无功能缺口。
3. 无其他数值偏差；covenant 三候选中 b/c 经实测零效应未采用（§2.1 留痕，非 spec 偏差——spec 本就说「择一或组合，以计划留痕为准」）。

## 4. 验收标准映射（spec §5）

| spec 验收 | 干跑证据 |
|---|---|
| 1. 全绿（108 基线+新增） | 121 passed, 0 failed |
| 2. 既有区间不漂移 | 67.4/39.8/15.8、51.6/37.8/58.0 逐位一致 |
| 3. covenant ∈ [30,45] | 32.2% |
| 4. 三预设冒烟 0 崩溃；standard ≈ 基线 | 6.6/39.8/77.6，standard 逐位=39.8 |
| 5. 首屏 DOM ≤ 440 | ≈310 |
| 6. 零外链/零 emoji/parity/无自治 tick | grep 全空；parity 断言通过；无 setInterval 新增 |
| 7. SDD 流程 | 本计划 + globals + 6 简报 + 台账 |
