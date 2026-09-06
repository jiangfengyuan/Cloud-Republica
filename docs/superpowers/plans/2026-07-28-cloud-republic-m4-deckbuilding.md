# M4 实现计划：卡牌构筑（牌库系统）

日期：2026-07-28（干跑标定 2026-07-29）｜ 状态：已干跑验证，待执行
规格：docs/superpowers/specs/2026-07-28-cloud-republic-m4-deckbuilding-design.md（已拍板）
项目：/Users/haydenjiang/Downloads/RES_REP/（零依赖、离线、无 ES module、无 git）
前置基线：M3 完成，node test/simulate.js = 121 passed, 0 failed
干跑环境：/tmp/m4-dryrun（本计划全部改动已实际应用并验证：140/140 全绿，--calibrate 130/130）

## 1. 目标与口径

按 spec 落实三件事：真实牌库三态（抽牌堆/弃牌堆/手牌，无放回 + 抽空重洗）、局前构筑编辑器（cr_deck v1 持久化）、全矩阵重标定重 pin。默认牌库 = 全域 66 张，非构筑玩家路径保持默认。

**裁决口径（本轮新增，与 M1/M2/M3 已裁决项不冲突）：**
1. 洗牌随机源：state.js 开局洗牌与 engine.js 重洗均走 `engine.rng`（Fisher-Yates），两函数同式不同源（各 6 行，globals 记录；与 M3 钳制公式「同源同式」先例一致）。
2. guaranteedCards 语义：「从牌库取出」= 仅当牌库含该 id 才预发，并从 drawPile 移除一张；自定义牌库不含 12 号卡时**不预发**（构筑选择的自然结果，spec §2.1 字面语义）。
3. 非法构筑清洗：逐条剔除（未知 id；copies 非 1..maxCopies 整数 → 整条剔除而非钳到 2）；清洗后总数越界（<20 或 >40）→ 整配置回退 'full'。state.js 与 ui.js 两处清洗规则逐字同源。
4. 编辑器对全域牌库**写时复制**：首次编辑（+/−/清空）将 'full' 分叉为 custom 66×1 工作副本，玩家删减至 ≤40 后「完成」才可用；「恢复全域」随时可回。
5. 编辑器仅设「完成」一个出口且 <20/>40 时置灰 → 不可能带着非法牌库离开编辑器；cr_deck 变更即写（含编辑中间态），加载时经 sanitize 兜底。
6. pin 调整授权（仅数字，语义不变）：实测落既有 pin 内且距最近边界 >2.0pp → 保持不动；越界或余量 ≤2.0pp → 按实测 ±5pp 重 pin 并在 globals/计划留痕。
7. `deck.too_many` 键（spec 未列）为写时复制分叉场景的必需提示，计入 i18n 新增（19×2，spec 估 20×2，见 §6 偏差 2）。

## 2. 任务分解（7 任务，依赖序）

| # | 任务 | 文件 | 依赖 |
|---|---|---|---|
| T1 | data.js DECK_RULES | js/data.js | — |
| T2 | state.js 牌库构建/洗牌/预发移除（第 5 参 deckConfig） | js/state.js | T1 |
| T3 | engine.js 无放回抽牌/重洗/出牌路由/log.deck_empty | js/engine.js | T2 |
| T4 | i18n.js deck 19×2 键 + icons.js panel.deck | js/i18n.js, js/icons.js | T3（log 键名） |
| T5 | index.html 牌库按钮/deckScreen 壳/pileInfo + styles.css M6 段 | index.html, styles.css | —（与 T2-T4 并行可） |
| T6 | ui.js cr_deck + 编辑器 + 局内堆计数 + 结算行 + startGame 接线 | js/ui.js | T1/T2/T4/T5 |
| T7 | simulate.js 透传 + M12 机制单测/构筑冒烟 + 全矩阵重 pin + 终态验收 | test/simulate.js | T1-T6 |

T1→T2→T3 是数值链路；T5 与 T2/T3 无依赖可并行；T7 收口。所有 pin 数字已由干跑实测 pin 死（见 §4、§5），实现者不得改 pin。

## 3. 关键设计说明

### 3.1 牌库机制（T2/T3）
- state 新增：`deckId`（'full'|'custom'）、`deckSize`、`drawPile[]`（卡 id，洗牌后，从尾部 pop）、`discardPile[]`（卡 id）。
- `createInitialState` 第 5 参 `deckConfig`（形如 cr_deck 去 v：`{deckId, cards}`）；不传 = 全域（既有 4 参调用逐位兼容）。构建顺序：buildDeckList 清洗 → Fisher-Yates（`CR.engine.rng`）→ guaranteedCards 逐张 indexOf 移除并预发。
- `drawCard`：手满 → `log.hand_full`（既有）；drawPile 空且 discardPile 非空 → 弃牌堆整体移入 drawPile 并重洗；两堆皆空 → `log.deck_empty`（新键，入 logKeys 白名单 + 双词典）不抽。
- 出牌路由：contract → `discardPile.push(card.id)`；permanent → permanentCards（既有，**不进弃牌堆**，防无限复制）。回合结束手牌保留（现状不动）。
- 堆中存 id 不存卡对象，抽到时才 `{...card, uid}` —— 与既有手牌元素形状完全一致。

### 3.2 构筑约束（T1/T6）
- `DECK_RULES = { minSize: 20, maxSize: 40, maxCopies: 2, fullDeckId: 'full' }`（spec §2.2 逐字）。
- cr_deck v1：`{ v:1, deckId:'full'|'custom', cards:{[id]:1|2} }`；v!==1/损坏 JSON/清洗后越界 → 回退 defaultDeck()；读写全 try/catch。
- 编辑器：66 行卡池（7 类分组，copies 圆点 + −/+ 按钮，约束实时置灰）+ 右侧摘要（总数、7 色类别分布条、清单、清空/恢复全域/完成）。行式紧凑布局，懒渲染（openDeckScreen 才构建 innerHTML）。

### 3.3 对局内展示（T5/T6）
- 手牌区头部下一行小字 `pileInfo`：`ui.piles`（抽牌堆 N · 弃牌堆 M），updateUI 每刷更新。
- 结算屏「最终状态」卡新增一行：`end.deck_label`（牌库名 · 张数），icon panel.deck。cr_stats schema 不动。

### 3.4 模拟器（T7）
- freshState/playGame 第 5、6 参透传（sandboxConfig 第 4 参语义不变；deckConfig 第 5 参追加，不传 = 全域，既有调用兼容）。
- AI 打分/playGame 主体逐字不动（M2 已裁决口径延续）。
- 新增 M12 段：机制单测 13 断言（无放回/重洗守恒/deck_empty/路由/预发移除/自定义多重集/非法钳制 4 例）+ 构筑冒烟 3 档（0 异常断言常驻 + band 断言 CALIBRATE 跳过）。
- 重 pin 仅 2 处数字变更（full-meta、kind，见 §4），其余 pin 逐字不动；M8 covenant 注入断言、M11 单元断言等一行不改。
- `--calibrate` 语义不变：跳过全部非基线 band（含 M12 三构筑 band；机制单测与 0 异常断言常驻）。预期 calibrate = 130 passed。

## 4. 全矩阵重标定（干跑实测，种子 1..500 固定，2026-07-29）

| 档位 | M3 实测 | M4 实测 | 偏差 | 旧 pin | 新 pin | 处置 |
|---|---|---|---|---|---|---|
| easy 基线 | 67.4 | 72.4 | +5.0pp | [60,80] | [60,80] | 保持（边界内） |
| medium 基线 | 39.8 | 44.8 | +5.0pp | [30,50] | [30,50] | 保持（边界内） |
| hard 基线 | 15.8 | 14.4 | -1.4pp | [10,20] | [10,20] | 保持 |
| guild medium | 51.6 | 56.8 | +5.2pp | [45,60] | [45,60] | 保持（余量 3.2pp，见 §6） |
| covenant medium | 32.2 | 33.6 | +1.4pp | [30,45] | [30,45] | 保持，**新余量 3.6pp**（原 2.2pp） |
| technocracy medium | 37.8 | 38.4 | +0.6pp | [30,45] | [30,45] | 保持 |
| none 满配 medium | 58.0 | 64.0 | +6.0pp | [50,65] | **[59,69]** | 重 pin（余量 1.0pp ≤2.0 阈值，见 §6） |
| sandbox harsh | 6.6 | 5.6 | -1.0pp | [0,15] | [0,15] | 保持 |
| sandbox standard | 39.8 | 44.8 | +5.0pp | [30,50] | [30,50] | 保持，仍 = medium 逐位 |
| sandbox kind | 77.6 | 83.0 | +5.4pp | [70,85] | **[78,88]** | 重 pin（余量 2.0pp 触阈值） |
| hard ×4 派系 × 满配 | 0 异常 | 0 异常 | — | — | — | 只断言 0 异常，不变 |

整体上移成因 = spec §3.1 预言的「无放回使净化引擎卡（12/49）期望可得性略升」，方向与量级均符合预期。

**自定义构筑冒烟（medium × none × 无 meta × 500 局，全部 0 异常）：**
| 构筑 | 组成 | 实测 | pin |
|---|---|---|---|
| 经济流 | id 1-10 ×2（20 张，无净化引擎） | 0.0% | [0,5] |
| 净化流 | 12/49/14/18/20/61/30/58/37/56 ×2（20 张） | 16.4% | [11,21] |
| 最小 20 张 | id 1-20 ×1 | 69.8% | [65,75] |

经济流 0.0% 是真实平衡信号而非缺陷：无净化来源的构筑在规则内不可胜，证明构筑是有代价的决策轴。净化流 16.4% 低于全域 medium（44.8%）：20 张窄库反复重洗虽提高引擎卡密度，但失去经济/材料广度，AI 与规则内玩家同样受限。

## 5. 验收标准（终态）

1. `node test/simulate.js` = **140 passed, 0 failed**（121 + M12 新增 19）；`--calibrate` = **130 passed**（跳过 3 派系 + 1 满配 + 3 沙盒 + 3 构筑 = 10 个 band 断言）。
2. pin 逐位命中 §4 表；sandbox/standard = medium 基线逐位。
3. 机制单测全过（无放回/重洗守恒/permanent 路由/预发移除/非法钳制）。
4. 首屏静态节点 269（旧 264，+5）；按 M3 口径估算 ≈395 ≤ 450；编辑器懒渲染（首屏 0 节点，打开时 ≈600 节点：66 池行 ×7 + 摘要 ≈100）。
5. 零外链、零新增 emoji（新键仅沿用已裁决的 `·`/`—`/中文标点）、zh/en parity 245=245、无自治 tick、engine 零 DOM、ui.js 唯一 DOM 接触者、脚本顺序不变。

## 6. spec 偏差建议（留痕，不硬改 spec）

1. **全域默认基线 easy/medium 偏差恰好 +5.0pp**，顶在 spec §5.2 「≤5pp」阈值边界。成因即 spec §3.1 预言的无放回效应，方向正确；未超阈值故按计划口径处理（保持既有宽 pin）。建议：下一轮若再做抽牌/AI 相关改动，先 --calibrate 复核这两档（余量：easy 距上界 7.6pp、medium 距上界 5.2pp、距 M3 值已用尽 5.0pp 预算）。
2. **i18n 键数 19×2（spec 估「约 20×2」）**：新增 `deck.too_many`（写时复制分叉 66>40 场景的必需提示），`ui.deck_btn`/`log.deck_empty`/结算行等其余键按 spec §4 清单落实；无删减。
3. **guild +5.2pp、满配 +6.0pp、kind +5.4pp 超出 5pp**：spec §5.2 的 5pp 阈值字面相范围是「全域默认各档」（三档基线），此三档属派系/meta/沙盒矩阵档；按计划 §1 裁决 6 处理（满配、kind 重 pin，guild 余量 3.2pp 保持并在此留痕）。若用户认为 5pp 阈值应覆盖全矩阵，需回到 spec 层面裁决——本计划不擅自扩大。
4. covenant 警示（M3 backlog #3）闭环：重标定后实测 33.6%，pin [30,45] 不动，**余量从 2.2pp 改善至 3.6pp**，记录于 m4-globals.md §9。

## 7. 风险与对策（落实 spec §6，均已干跑验证）

- 平衡漂移 → §4 全表重标定，2 处重 pin，covenant 余量单独复核 ✅
- 编辑器 DOM 爆炸 → 懒渲染 + 行式布局，首屏 +5 静态节点 ✅
- 状态兼容 → 清洗-回退两级兜底，4 例非法构筑断言 ✅
- 洗牌随机源 → 全部 engine.rng，种子 1..500 全矩阵可复现 ✅
- 新增风险（干跑发现）：openDeckScreen 在 boot 前被调用的防御性 guard（`if (!deck) deck = loadDeck()`），已加入 T6 简报。

## 8. SDD 流程

同前轮：m4-globals.md 全局约定 → 7 份任务简报（m4-task-N-brief.md）→ 逐任务实现 + 报告 + 审查 → progress-m4.md 台账回填 → 终审。既有断言只允许按 §4 授权改 pin 数字（2 处），断言语义不变；M1/M2/M3 已裁决项不得推翻。
