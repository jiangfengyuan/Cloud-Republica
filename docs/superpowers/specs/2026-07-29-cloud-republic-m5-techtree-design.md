# M5 设计规格：科技树（局内研究系统）

日期：2026-07-29 ｜ 状态：已拍板（用户授权全权落实）｜ 前置：M4 牌库系统已完成（140/140）
项目：/Users/haydenjiang/Downloads/RES_REP/（零依赖、离线、无 ES module、无 git）

## 1. 目标与非目标

**目标**
- 局内科技树：对局中消耗「科研」资源解锁科技节点，获得本局生效的规则修正——给科研资源一个出牌之外的出口，增加局内长线决策（攒科研点科技 vs 打科研成本卡）。
- 3 分支 × 3 层级 = 9 节点，分支内按层级解锁（T1→T2→T3），分支间自由。
- 全部节点效果映射到**既有 state 修正器字段**（派系/Meta 同一机制），引擎最小侵入。

**非目标**
- 不做局外科技树/科技点数（那是 M2 Meta 的地盘，不重叠）
- 不加新卡牌、不改既有 66 卡字段、不动胜利条件
- 节点效果不做新机制类型（只用既有修正器字段，不发明新消费点，handLimit 除外——既有字段既有消费点）
- 无持久化（局内状态，刷新即失，与全局一致）
- 不动 M1-M4 已裁决事项

## 2. 科技树设计

### 2.1 节点表（js/data.js 新增 TECH_TREE）

| 节点 | 分支 | 层级 | 效果（state 字段） | 科研费用（干跑标定后可微调） |
|---|---|---|---|---|
| atm_1 | 大气处理 | T1 | purificationMultiplier +0.10 | 8 |
| atm_2 | 大气处理 | T2 | corrosionRate -0.3（钳 ≥1.0） | 14 |
| atm_3 | 大气处理 | T3 | purificationMultiplier +0.15 | 22 |
| log_1 | 轨道物流 | T1 | moneyMultiplier +0.10 | 8 |
| log_2 | 轨道物流 | T2 | transportDiscount ×0.92（叠乘，floor 0.4） | 14 |
| log_3 | 轨道物流 | T3 | habitatMaterialsDelta -2（钳 ≥8） | 22 |
| grid_1 | 能源网络 | T1 | energyMaintenance -1（钳 ≥2） | 8 |
| grid_2 | 能源网络 | T2 | researchIncome +1 | 14 |
| grid_3 | 能源网络 | T3 | handLimit +1 | 22 |

设计原则：每分支 = 一种赢法强化（大气→净化速推、物流→经济建造、能源→续航过牌）；乘区叠加用**加于乘数**（faction 1.15 + atm_1 = 1.25）与**叠乘**（transportDiscount）各归其既有语义；全部钳制沿用既有下限；单局科研预算约可点 2-4 节点（费用干跑标定确认，pacing 目标：T1 中局可及、T3 后期才可及）。

### 2.2 引擎（js/engine.js）

- state 新增 `techs: []`（已解锁节点 id）
- 新公开函数 `unlockTech(state, nodeId)`：校验（节点存在/未解锁/前置层已解锁/科研足够）→ 扣科研 → push techs → 应用修正器到 state 字段 → 返回 `{ok, reason}` 模式；日志走 onLog 白名单新增 `log.tech_unlocked`（1 键）
- 消费点零新增——unlockTech 直接写字段，既有消费点（applyResourceEffect/endTurn/getCardCost/buildHabitat/drawCard handLimit）自然生效
- handLimit +1：既有 drawCard 读 state.handLimit，只改值即可

### 2.3 UI（局内）

- 局内 header 加「科技」按钮（图标 + 已解锁数 1/9 式计数），打开全屏 overlay（复用 .end-screen 层模式，同编辑器）
- 布局：三列分支，每列 3 节点卡（图标、名称、效果描述、费用、状态：可点/前置未解/科研不足/已解锁）
- 顶部显示当前科研余额；购买即刷新（含手牌区可打性变化）并写回渲染
- 懒渲染（打开才构建 DOM）；i18n 双语；图标复用既有 cat.*（environment/economy/tech 三母题）+ 层级用圆点/数字徽章，最多新增 1 枚 panel.tech
- design 约束：复用 .btn/glass/令牌；状态用颜色+图标语义（可点=accent、已解锁=绿勾或 filled、锁定=灰），无多余文字标签

## 3. 平衡与模拟器

### 3.1 预期影响与红线

科技 = 局内战力增益，胜率将全面上移。**M4 警示在先**：easy/medium 5pp 预算已用尽，本轮必须全矩阵 `--calibrate` 重标定后重 pin 全部区间（含 covenant 3.6pp 余量复核）。

### 3.2 模拟器扩展（test/simulate.js）

- AI 加科技决策（启发式：Turn≥4 且科研富余时按分支优先级买 T1，后期补 T2/T3——具体策略干跑调优，目标是「合理使用但非最优」）
- 断言矩阵：
  1. 全既有矩阵（三档基线 + 三派系 + 满配 meta + 沙盒三预设 + 构筑三档）重标定重 pin
  2. 科技机制单测：费用校验、前置层校验、重复解锁拒绝、字段应用正确（9 节点逐一对照）、钳制触发、log 键
  3. 科研经济 pacing：统计 AI 中位解锁节点数（目标 2-4，验证费用曲线合理）
- 与 faction/meta 同字段叠加的交互用例（如 covenant × atm_1 乘区、log_2 × guild 叠乘 floor）

## 4. i18n（zh/en 双语）

新增约 25×2 键：`tech.*`（标题、余额、三分支名、9 节点 name+desc、状态词、解锁日志）、`log.tech_unlocked`、`ui.tech_btn`。沿用 dot 规范。

## 5. 验收标准

1. `node test/simulate.js` 全绿（全矩阵重 pin 后 + 科技机制/pacing 断言）
2. 全矩阵重标定留痕：每档旧值→新值→新 pin 表入 globals；covenant 余量复核记录
3. 科技机制单测全过（9 节点字段应用 + 校验链 + 叠加交互）
4. pacing 断言：AI 中位解锁数 ∈ [2,4]
5. 首屏 DOM ≤ 455（局内 header +1 按钮）；科技 overlay 懒渲染
6. 零外链、零 emoji、zh/en parity、无自治 tick、engine 零 DOM
7. SDD 流程同前轮

## 6. 风险与对策

- **平衡全面上移**：授权全矩阵重 pin（计划留痕每档偏差）；AI 科技策略先干跑调优再 pin
- **科研通胀**：pacing 断言锁定解锁数区间；费用曲线是主要调节阀，干跑标定
- **字段叠加冲突**：9 节点全部复用既有字段与钳制，叠加交互用例入测试
- **UI 复杂度**：overlay 懒渲染 + 三列定宽布局；状态语义化（颜色/图标）减少文字
