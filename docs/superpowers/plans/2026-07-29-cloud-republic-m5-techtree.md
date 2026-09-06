# M5 实现计划：局内科技树（Tech Tree）

日期：2026-07-29 ｜ 状态：干跑验证完成，待 SDD 执行 ｜ spec：docs/superpowers/specs/2026-07-29-cloud-republic-m5-techtree-design.md
基线：M4 完成态 140/140（calibrate 130/130）｜ 干跑：/tmp/m5-dryrun/（164/164，calibrate 154/154）
项目：/Users/haydenjiang/Downloads/RES_REP/（零依赖、离线、无 ES module、无 git）

## 1. 裁决口径（本轮新增，不推翻 M1-M4 已裁决项）

1. **费用表调整授权已使用**：spec §2.1 费用 8/14/22 经干跑 pacing 标定调整为 **6/12/18**（等比缩放 ≈0.75，层级比 1:2:3 保持），留痕见 §5。其余节点字段/效果/钳制逐字按 spec。
2. **全矩阵重 pin 授权**（m4-final-review backlog #3 联合警示 + spec §3.1）：13 档全部按新实测 ±5pp 取整重 pin，逐档留痕（globals §9）。既有断言只允许 pin 数字与 measured 注释变更，语义逐字不动。
3. **AI 科技策略归属**：scoreCard 逐字不动（M4 口径延续）；科技决策作为独立模块（bestTechGoal/maybeBuyTechs）插入 playGame，含「为目标科技攒科研」的打牌过滤一行（M5 新增行为，拟人蓄力，非胜率优化）。
4. **i18n 键数**：spec「约 25×2」实落 **29×2**（新增 4 个 fail.* 反馈键，UI 购买拒绝必须可显示；parity 245→274=274）。
5. **unlockTech 模式**：`{ok, reason}`，reason 走 fail.tech_*；唯一新 log 键 `log.tech_unlocked`（logKeys 52→53）。
6. **pin 取整规则**：实测 ±5pp，四舍五入到整数边界；sandbox/standard 与 medium 基线保持逐位一致（同参同流）。

## 2. 任务分解（6 任务，依赖线性）

| # | 任务 | 产出 | 依赖 |
|---|---|---|---|
| T1 | 数据与文案：TECH_TREE/TECH_BRANCHES（data.js）+ i18n 29×2 + icons panel.tech | 结构、键、图标 | — |
| T2 | 引擎与状态：state.techs + engine.unlockTech + logKeys | unlockTech API | T1 |
| T3 | UI：index.html 按钮+techScreen、ui.js overlay、styles.css 追加段 | 科技面板 | T1、T2 |
| T4 | 模拟器 AI 科技策略 + pacing 调优 | 中位解锁 ∈ [2,4] | T2 |
| T5 | M13 机制单测 + 全矩阵 13 档重标定重 pin | 164 断言 | T4 |
| T6 | 终态验收 + 红线 + 文档回填 | 门禁全绿 | T1-T5 |

T1→T2→T3 可串行一人完成；T4/T5 必须在引擎稳定后进行（标定依赖最终机制与策略）。

## 3. 关键设计说明

### 3.1 TECH_TREE 结构（data.js，纯数据）

每节点 `{ branch, tier, cost, icon, effect: { field, mode: 'add'|'multiply', value, floor? } }`。
效果描述数据化，engine 按 mode/floor 统一应用，9 节点零分支特判。branch 顺序 `TECH_BRANCHES = ['atm','log','grid']` 供 UI 三列渲染。逐字结构见 globals §2。

### 3.2 AI 科技策略（simulate.js）

- `TECH_RESERVE = 2`：购买后至少保留 2 科研（brewing 门槛与科研成本卡的缓冲）。
- `TECH_MAX_PER_TURN = 1`：每回合最多 1 节点（拟人节奏，防暴点）。
- `bestTechGoal(s)`：turn≥4 起，从可及节点中选评分最高者（阈值 150）；打牌循环中，非净化、评分 <500、科研成本会导致「科研 - 成本 < 目标费 + reserve」的卡被跳过——即「为目标科技攒科研」。
- `maybeBuyTechs(s)`：行动阶段打牌后调用，买得起且过 reserve 即买。
- 评分要点：grid_2 早期最高（320，科研反哺）；atm_1/atm_3 需已有净化引擎（300）；log_3 后期造 Habitat 时 260；其余 60-180 兜底。
- 调优记录：8/14/22 + reserve 6 → 中位 1；reserve 2 + 攒钱过滤 → 1.59；费用 6/12/18 → **中位 2，均值 1.99，胜率 medium 44.8→46.2（+1.4pp）**。0 解锁局 21.8%（科研枯竭局，合理）；T3 全场仅 11 次购买（后期才可及 ✓）。目标「合理使用但非最优」达成，不为胜率继续调参。

### 3.3 科研经济侦察结论（写计划前的自查，500 局 medium 基线实测）

- 来源：初始 7-10（三档）；永久卡 venusEffect.research 仅 5 张（id 10/11/35/44/49，+2/+3/+2/+2/+4）；合同一次性（18/21/39/58，+1..+3）；事件（+6/+8/+10/+2，一次 −2）；technocracy researchIncome +2/回合。
- AI 实况：科研总收入均值 26.5/中位 24；卡牌科研成本支出均值 18.6；峰值余额中位 16；AI 场均仅打 0.06 张科研收入永久卡。
- 结论：spec 费用 8/14/22 下 T3(22) 超出中位峰值余额（16），pacing 不达标；6/12/18 后 T1 中局可及、T2 需 1-2 回合蓄力、T3 后期偶发——与 spec §2.1 pacing 意图一致。

### 3.4 UI 模式

- 复用 `.end-screen` 懒渲染全屏层（同 deckScreen）：index.html 仅空壳 `techScreen` div；局内 header-controls 首位加 `techBtn`（panel.tech 图标 + `techBtnText` n/9 计数）。
- 三列分支网格；节点卡四态 `unlocked/available/prereq/research`（颜色+图标语义：可点=cyan 描边、已解锁=绿描边+勾、其余灰 55% 透明度）；购买按钮内嵌 res.research 图标+费用数字。
- 购买后 updateUI（手牌可打性刷新）+ renderTechScreen 写回；语言切换经 refreshTexts 重渲染（active 时）。
- 图标：复用 cat.environment/economy/tech 三母题 + 新增 1 枚 panel.tech（原子模型，4 子节点）；层级用 3 圆点徽章（复用 deck-copy-dot 视觉语言）。

### 3.5 叠加语义（与 faction/meta 同字段，测试锁定）

- 乘区加法：covenant 1.15 + atm_1 = 1.25；guild 1.25 + log_1 = 1.35（同 M2 语义）。
- 叠乘共享 floor：guild 0.9 × log_2 0.92 = 0.828，再乘卡 1/42 → 共享 0.4 下限。
- 平铺相加：technocracy researchIncome 2 + grid_2 = 3/回合。
- 钳制：corrosion ≥1.0、energyMaintenance ≥2、habitatMaterialsDelta ≥-4（建造材料 ≥8）、transportDiscount ≥0.4。

## 4. spec 偏差建议（留痕）

1. **费用表 8/14/22 → 6/12/18**（spec §2.1 括号授权「干跑标定后可微调」已使用）：标定依据 §3.2/§3.3；若坚持原表，pacing 断言（中位 ∈ [2,4]）必然失败（实测中位 1）。
2. **i18n 键数 25×2 → 29×2**：+4 个 fail.tech_*（购买拒绝 UI 反馈必需）。
3. 其余 spec 项（9 节点字段/效果/钳制/懒渲染/白名单单键/不动 M1-M4）逐字符合。

## 5. 全矩阵重标定留痕（种子 1..500 固定，干跑实测 2026-07-29）

| 档位 | 旧实测 | 旧 pin | 新实测 | 新 pin | Δpp |
|---|---|---|---|---|---|
| easy 基线 | 72.4 | [60,80] | 75.4 | [70,80] | +3.0 |
| medium 基线 | 44.8 | [30,50] | 46.2 | [41,51] | +1.4 |
| hard 基线 | 14.4 | [10,20] | 15.8 | [11,21] | +1.4 |
| guild medium 无 meta | 56.8 | [45,60] | 59.2 | [54,64] | +2.4 |
| covenant medium 无 meta | 33.6 | [30,45] | 35.2 | [30,40] | +1.6 |
| technocracy medium 无 meta | 38.4 | [30,45] | 43.6 | [39,49] | +5.2 |
| none 满配 medium | 64.0 | [59,69] | 65.2 | [60,70] | +1.2 |
| sandbox harsh | 5.6 | [0,15] | 6.0 | [1,11] | +0.4 |
| sandbox standard | 44.8 | [30,50] | 46.2 | [41,51] | +1.4（= medium 逐位） |
| sandbox kind | 83.0 | [78,88] | 85.4 | [80,90] | +2.4 |
| custom/economy/medium | 0.0 | [0,5] | 0.0 | [0,5] | 0 |
| custom/purification/medium | 16.4 | [11,21] | 19.0 | [14,24] | +2.6 |
| custom/min20/medium | 69.8 | [65,75] | 70.2 | [65,75] | +0.4 |
| hard ×4 派系 × 满配 | 0 异常 | 只断言 0 异常 | 0 异常 | 不变 | — |

- **covenant 新余量 5.2pp**（35.2 vs 下界 30；M4 余量 3.6pp → 联合警示缓解，backlog #3 进一步闭环）。atm 分支净化乘区对 covenant 收益最大。
- technocracy 涨幅最大（+5.2pp）：researchIncome 2/回合 + 科研成本 ×0.75 → 场均解锁更多。
- 全档普涨 0~5.2pp，符合 spec §3.1「科技=局内战力增益，胜率全面上移」预期，无异常档位。

## 6. 验收标准（对应 spec §5）

1. `node test/simulate.js` = **164/164**（140 + M13 新增 24）；`--calibrate` = **154/154**
2. 本计划 §5 全表入 globals §9；covenant 余量复核记录（5.2pp）
3. M13 机制单测 23 项 + pacing 1 项全过
4. pacing 断言：AI 中位解锁 = 2 ∈ [2,4]（均值 1.99）
5. 首屏静态标签 272→276（+4），按 M3 口径估算 ≈399 ≤ **455**；科技 overlay 懒渲染（静态仅 1 空壳 div）
6. 零外链、零新 emoji（符号集与基线逐位一致）、zh/en parity 274=274、无自治 tick、engine 零 DOM
7. SDD 流程同前轮（globals + 6 简报 + 台账）

## 7. 风险与对策（干跑已验证）

- ~~平衡全面上移~~ → 13 档全绿，最大偏差 +5.2pp 已在 pin 内。
- ~~科研通胀~~ → pacing 断言锁定中位 2；费用 6/12/18 为主要调节阀（留痕）。
- ~~字段叠加冲突~~ → 5 个叠加用例入 M13（covenant×atm_1、guild×log_2×卡、technocracy×grid_2 等）。
- ~~UI 复杂度~~ → 懒渲染 + 三列定宽 + 四态颜色语义；打开时 ≈260 节点（9 卡 ×~8 + 框架），远低于编辑器 ≈600。
