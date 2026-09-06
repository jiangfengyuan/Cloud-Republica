# Cloud Republic Iteration 2 (Difficulty / Civ-style Turn Flow / i18n / Performance) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在第一轮交付（多文件重构 + 机制修复，61 断言绿）基础上完成第二轮迭代：三档难度系统（开始界面 + 配置表 + 模拟区间验收）、文明式回合流（删除全部 setTimeout 自动推进、出牌上限 2→3、移除 turnBlocker、Next Turn/开始回合手动推进）、全量双语（i18n.js + 86 条卡牌/事件翻译 + 日志键值化）、性能定点优化（星空 DOM、手牌脏标记渲染）、README。

**Architecture:** 沿用第一轮结构，新增 `js/i18n.js`，加载顺序 data → i18n → state → engine → ui。`CR.data.DIFFICULTY_LEVELS` 提供三档配置；`CR.state.createInitialState(difficultyKey)` 应用配置；engine 日志由字符串改为 `log(key, params)` 键值对，ui 经 `CR.i18n.t(key, params)` 渲染；ui 重写为事件驱动回合流（开始界面 → 事件弹窗 → 自由行动 → Next Turn → 结算摘要停驻 → 开始下一回合）。

**Tech Stack:** 纯原生 HTML/CSS/JS（无构建工具、无依赖、无 ES module——file:// 打开时 module 会被 CORS 拦截，普通 `<script src>` 按序加载，共享全局命名空间 CR）。测试仅需 Node.js 内置 `require`。

## Global Constraints
- 不用 git（用户明确拒绝，计划中不得出现任何 commit 步骤）
- 所有文件在 /Users/haydenjiang/Downloads/cloud-republic/ 下
- 保持原有视觉风格；星空改为静态单 div 方案后视觉差异需最小（见 Task 8）
- engine.js 不得触碰 DOM；日志通过 onLog 回调以 `(key, params)` 形式交给 ui 层
- 不拆 ui.js、不引框架/构建工具/包管理器；双击 index.html 即玩

## 关键设计说明（实现前必读）

1. **难度配置已经 /tmp 干跑调参定稿**（调参过程与全部数据见附录 A）。`DIFFICULTY_LEVELS` 除 spec §2 列举的 初始资源/maxTurns/corrosionRate/起始手牌数 外，还包含三个必要旋钮，均已验证、写入配置表：
   - `handLimit` / `drawPerTurn` / `energyMaintenance`：把第一轮写死的常量（8 / 2 / 5）提升为 per-difficulty 配置（当前三档取值均为 8 / 2 / 4~5，属参数化而非新机制）；
   - `guaranteedCards`（开局手牌中必含的卡牌 id 数组）：**这是命中 spec 胜率区间的决定性旋钮**。干跑证明：净化轨道受牌库浓度限制（66 张牌中仅卡 12 是够强的净化引擎，卡 49 受 13 科研门槛），无保底时中等难度 pur100 上限 ~18%、胜率 ~2%，任何资源/回合/抽牌组合都无法把中等拉进 30–50%（附录 A 有完整数据）。三档均保底卡 12（Trace Gas Detection，开局即可打出），难度差异全部由经济参数（起始材料/资金/能源/科研、回合数、腐蚀率、维护费）承载。若用户后续否决此旋钮，需重开调参（预计三档区间需整体下移）。
2. **最终难度参数与实测胜率**（贪心 bot，种子 1–500 / 501–1000 / 1001–1500 三组，全部落区间）：
   - easy：maxTurns 24, corrosion 1.5, 初始手牌 4, handLimit 8, drawPerTurn 2, energyMaintenance 4, guaranteed [12], 资源 90/100/35/10/80/100 → **67.4% / 68.8% / 68.6%**（区间 60–80）
   - medium：maxTurns 22, corrosion 2, 初始手牌 4, handLimit 8, drawPerTurn 2, energyMaintenance 4, guaranteed [12], 资源 60→**65**/70→**75**/25/8/70/100 → **39.8% / 35.4% / 38.0%**（区间 30–50）
   - hard：maxTurns 19, corrosion 2.5, 初始手牌 3, handLimit 8, drawPerTurn 2, energyMaintenance 5, guaranteed [12], 资源 50/55/20/7/60/100 → **15.8% / 12.6% / 13.6%**（区间 10–20）
3. **日志键值化**：engine 内部 `log(key, params)` → `CR.engine.onLog(key, params)`；ui 侧 `onLog = (key, params) => addLog(CR.i18n.t(key, localize(params)))`，其中 `localize` 把 `params.cardId` 解析为当前语言的卡牌名。engine 返回的失败原因同样键值化：`{ok:false, reason:'fail.xxx', reasonParams?}`，ui 用 `t(result.reason, result.reasonParams)` 渲染。simulate.js 直接断言 key 与 params，不经过 i18n。
4. **i18n 字典唯一来源**：全部界面文案、日志模板、规则、结局、难度名、阶段名集中在 `js/i18n.js` 的 `DICT`（zh/en 两棵子树）。卡牌/事件文本不放字典，走 `data.js` 的 `name_zh/effect_zh/desc_zh` 字段（数据与文案同地）。ui 渲染卡牌时按 `CR.i18n.lang` 取字段（`lang==='zh'` 且无 `_zh` 字段时回退英文）。
5. **文明式回合流状态机**：`setup`（开始界面）→ 点难度按钮 `initGame(key)` → `startTurnFlow()`：`engine.startNewTurn` → `engine.triggerEventPhase` → 弹事件窗（phase='event'）→ 玩家点关闭 → `engine.applyEvent`（phase='action'）→ 自由行动（出牌≤3、修理、建造，任意顺序）→ 点「Next Turn」→ `engine.endTurn`（phase='settlement'）→ 结算摘要弹窗停驻 → 点「开始回合 N+1」→ 回到 `startTurnFlow()`。无任何 setTimeout。gameOver 时直接进结局画面。罢工回合引擎层已拦截出牌与建造（`fail.strike_cards` / `fail.strike_build`），ui 只渲染。
6. **手牌脏标记**：ui 计算 `handSig()`（手牌 uid 序列 + phase + strike + lang + 四项资源 + transportDiscount + extraCardPlayed 拼接），与上次签名相同则跳过全量重建，仅同步选中态 class；`toggleCardSelection` 不再触发 `updateUI()` 全量重渲染。
7. **测试载体**：simulate.js 全量重写（Task 5 给出完整文件）：加载 data → i18n → state → engine（i18n 以双兼容模式编写，Node 下可 require）；原有 61 条断言适配新接口（freshState 默认 medium 的新初始值、turn 上限用 `s.maxTurns`、失败原因断言改为 `fail.*` 键、移除旧的单条胜率断言）；新增难度配置/3 张上限/handLimit/drawPerTurn/日志键与字典完备性/i18n.t()/三档 500 局区间共 18 条，总计 **78 条断言**。
8. **第一轮计划的附录 B 函数签名速查依然有效**，本轮变更点：`createInitialState(difficultyKey?)`、`CR.engine.onLog(key, params)`、失败返回增加 `reasonParams`、state 新字段（difficulty/initialHandSize/handLimit/drawPerTurn/energyMaintenance/maxCardsPerTurn=3）。

---

## Task 1: js/data.js — 难度配置表 + 86 条中文翻译

**Files:**
- Modify: `/Users/haydenjiang/Downloads/cloud-republic/js/data.js`

**Interfaces:**
- Consumes: 现有 `CARD_DATABASE`（66 卡）、`EVENTS`（20 事件）字面量（不改动其既有字段）
- Produces:
  - `CR.data.DIFFICULTY_LEVELS`：`{ easy, medium, hard }`，每项 `{ key, maxTurns, corrosionRate, initialHandSize, handLimit, drawPerTurn, energyMaintenance, guaranteedCards: number[], resources: {money,materials,energy,research,morale,integrity} }`
  - 每张卡新增 `name_zh` / `effect_zh` 字段；每个事件新增 `name_zh` / `desc_zh` 字段（通过 `CARD_ZH`/`EVENT_ZH` 映射表在加载时 `Object.assign` 合并，不逐条改原字面量）
  - Node 下 `module.exports = CR.data`（不变）

- [ ] **Step 1: 在 data.js 的 `CR.data = {...}` 赋值之前插入以下完整代码（难度配置表 + 翻译映射 + 合并逻辑）**
  ```js

  // ==================== DIFFICULTY LEVELS (spec §2, tuned via simulation — see plan appendix A) ====================
  const DIFFICULTY_LEVELS = {
    easy: {
      key: 'easy',
      maxTurns: 24,
      corrosionRate: 1.5,
      initialHandSize: 4,
      handLimit: 8,
      drawPerTurn: 2,
      energyMaintenance: 4,
      guaranteedCards: [12],
      resources: { money: 90, materials: 100, energy: 35, research: 10, morale: 80, integrity: 100 }
    },
    medium: {
      key: 'medium',
      maxTurns: 22,
      corrosionRate: 2,
      initialHandSize: 4,
      handLimit: 8,
      drawPerTurn: 2,
      energyMaintenance: 4,
      guaranteedCards: [12],
      resources: { money: 65, materials: 75, energy: 25, research: 8, morale: 70, integrity: 100 }
    },
    hard: {
      key: 'hard',
      maxTurns: 19,
      corrosionRate: 2.5,
      initialHandSize: 3,
      handLimit: 8,
      drawPerTurn: 2,
      energyMaintenance: 5,
      guaranteedCards: [12],
      resources: { money: 50, materials: 55, energy: 20, research: 7, morale: 60, integrity: 100 }
    }
  };

  // ==================== ZH TRANSLATIONS (cards: name_zh / effect_zh; events: name_zh / desc_zh) ====================
  const CARD_ZH = {
    1:  { name_zh: '商业太空发射', effect_zh: '地金运输成本永久减半' },
    2:  { name_zh: '小行星采矿经济', effect_zh: '3 回合后每回合 +12 资金' },
    3:  { name_zh: '太空旅游市场', effect_zh: '每回合 +6 资金 +3 士气' },
    4:  { name_zh: '轨道太阳能电站', effect_zh: '每回合 +8 资金 -2 能源' },
    5:  { name_zh: '氦-3 燃料贸易', effect_zh: '一次性 +15 资金' },
    6:  { name_zh: '太空制造', effect_zh: '每回合 +4 材料 +4 资金' },
    7:  { name_zh: '星际物流网络', effect_zh: '全部运输成本 -20%' },
    8:  { name_zh: '稀有金属期货', effect_zh: '一次性 +10 资金（有风险）' },
    9:  { name_zh: '太空广告', effect_zh: '+8 资金 -2 士气（有争议）' },
    10: { name_zh: '微重力制药', effect_zh: '每回合 +10 资金 +2 科研' },
    11: { name_zh: '大气观测网络', effect_zh: '每回合 +3 科研' },
    12: { name_zh: '痕量气体检测', effect_zh: '净化效率 +10%' },
    13: { name_zh: '太空农业研究', effect_zh: '解锁浮空农场（食物自给）' },
    14: { name_zh: '碳捕获技术', effect_zh: '净化 +8%' },
    15: { name_zh: '生态闭环系统', effect_zh: '每回合 +3 材料 +2 能源' },
    16: { name_zh: '气候调节卫星', effect_zh: '腐蚀率每回合 -0.5%' },
    17: { name_zh: '可降解材料', effect_zh: '修理成本 -25%' },
    18: { name_zh: '硫酸云采样', effect_zh: '净化 +5%，科研 +3' },
    19: { name_zh: '轨道反射镜阵列', effect_zh: '地表温控，士气 +5' },
    20: { name_zh: '微生物净化', effect_zh: '净化 +6%，资金 -3' },
    21: { name_zh: '月球条约谈判', effect_zh: '与玩家共享科研（双方 +3）' },
    22: { name_zh: '太空军事化', effect_zh: '航线不可封锁，士气 -3' },
    23: { name_zh: '星际治理', effect_zh: '解锁《公共共和国宪章》' },
    24: { name_zh: '贸易协定', effect_zh: '全部资源产出 +10%（持续 3 回合）' },
    25: { name_zh: '紧急动员', effect_zh: '本回合可额外打出 1 张牌' },
    26: { name_zh: '资源共享协议', effect_zh: '获得目标玩家 10% 资金' },
    27: { name_zh: '太空法庭', effect_zh: '抵消下一次负面事件' },
    28: { name_zh: '殖民法案', effect_zh: '栖息地容量 +1' },
    29: { name_zh: '税制改革', effect_zh: '立即 +20 资金，士气 -5' },
    30: { name_zh: '外交使团', effect_zh: '士气 +5，净化 +2%' },
    31: { name_zh: '地外身份认同', effect_zh: '士气下限锁定为 40' },
    32: { name_zh: '太空生存保险', effect_zh: '坠毁后保留 50% 资源' },
    33: { name_zh: '虚拟现实娱乐', effect_zh: '士气 +8，能源 -3' },
    34: { name_zh: '太空艺术计划', effect_zh: '士气 +5，资金 +2' },
    35: { name_zh: '教育中心', effect_zh: '每回合 +2 科研 +1 士气' },
    36: { name_zh: '文化节', effect_zh: '士气 +10，材料 -5' },
    37: { name_zh: '心理健康计划', effect_zh: '士气 +6' },
    38: { name_zh: '历史档案馆', effect_zh: '终局声望 +15' },
    39: { name_zh: '多元文化融合', effect_zh: '士气 +4，科研 +2' },
    40: { name_zh: '太空体育联盟', effect_zh: '士气 +7，完整度 +2%' },
    41: { name_zh: '自主太空机器人', effect_zh: '腐蚀率每回合 -1%' },
    42: { name_zh: '可回收火箭革命', effect_zh: '全部运输成本 -40%' },
    43: { name_zh: '太空电梯', effect_zh: '巨构建筑，每回合 +15 材料' },
    44: { name_zh: '量子通信网络', effect_zh: '科研产出 +25%' },
    45: { name_zh: '纳米机器人修理技术', effect_zh: '修理效率翻倍' },
    46: { name_zh: 'AI 管理系统', effect_zh: '能耗 -20%，每回合 +5 资金' },
    47: { name_zh: '核聚变推进器', effect_zh: '每回合 +10 能源' },
    48: { name_zh: '转基因作物', effect_zh: '每回合 +5 材料 +2 士气' },
    49: { name_zh: '深空探测网络', effect_zh: '每回合 +4 科研 +3% 净化' },
    50: { name_zh: '全息投影', effect_zh: '士气 +3，每回合 +3 资金' },
    51: { name_zh: '超导材料', effect_zh: '能源传输损耗 -30%' },
    52: { name_zh: '意识上传备份', effect_zh: '终极保险：坠毁无损失' },
    53: { name_zh: '太空辐射医学', effect_zh: '太阳风暴不再造成伤害' },
    54: { name_zh: '人工重力系统', effect_zh: '士气不再自然衰减' },
    55: { name_zh: '生命维持升级', effect_zh: '每回合 +3 能源 +2 士气' },
    56: { name_zh: '医疗中心', effect_zh: '完整度 +5%，士气 +3' },
    57: { name_zh: '营养合成器', effect_zh: '每回合 +4 材料' },
    58: { name_zh: '心理支持 AI', effect_zh: '士气 +5，科研 +1' },
    59: { name_zh: '紧急避难所', effect_zh: '完整度 +3%，资金 -2' },
    60: { name_zh: '健身设施', effect_zh: '士气 +4，完整度 +1%' },
    61: { name_zh: '硫酸云净化试点', effect_zh: '净化进度 +20%' },
    62: { name_zh: '浮空气泡扩容', effect_zh: '+1 栖息地（与建造共享 5 次上限）' },
    63: { name_zh: 'CO2 电解制氧', effect_zh: '生命维持自给，每回合 +4 能源' },
    64: { name_zh: '高空风能阵列', effect_zh: '每回合 +6 能源（利用超旋转风）' },
    65: { name_zh: '耐酸表皮涂层', effect_zh: '腐蚀率每回合 -1%' },
    66: { name_zh: '云水循环', effect_zh: '食物/水自给率 +25%' }
  };

  const EVENT_ZH = {
    1:  { name_zh: '硫酸云激增', desc_zh: '强酸云席卷，结构完整度 -3%' },
    2:  { name_zh: '太阳风暴', desc_zh: '高能粒子爆发，能源 -5，科研 -2' },
    3:  { name_zh: '补给窗口', desc_zh: '地球补给船抵达，资金 +15，材料 +10' },
    4:  { name_zh: '投资热潮', desc_zh: '星际投资者关注，资金 +20' },
    5:  { name_zh: '重大发现', desc_zh: '科研团队突破，全体科研 +6' },
    6:  { name_zh: '设备老化', desc_zh: '维护系统故障，材料 -8，能源 -3' },
    7:  { name_zh: '工人罢工', desc_zh: '劳工权益抗议，士气 -10，本回合无法行动' },
    8:  { name_zh: '贸易船队', desc_zh: '商船队经过，资金 +12，材料 +8' },
    9:  { name_zh: '酸雨腐蚀', desc_zh: '异常酸雨，结构完整度 -4%' },
    10: { name_zh: '技术突破', desc_zh: '意外发现，科研 +8，净化 +5%' },
    11: { name_zh: '市场崩盘', desc_zh: '星际金融危机，资金 -15' },
    12: { name_zh: '移民潮', desc_zh: '新殖民者抵达，士气 +8，材料 -5' },
    13: { name_zh: '能源泄漏', desc_zh: '反应堆微泄漏，能源 -8，完整度 -2%' },
    14: { name_zh: '外交访问', desc_zh: '地球代表团访问，士气 +6，资金 +5' },
    15: { name_zh: '流星威胁', desc_zh: '小行星逼近，完整度 -5%，材料 -10（防御）' },
    16: { name_zh: '科研竞赛', desc_zh: '国际竞赛获胜，科研 +10，资金 +5' },
    17: { name_zh: '资源枯竭', desc_zh: '矿脉耗尽，材料 -12' },
    18: { name_zh: '文化复兴', desc_zh: '艺术运动兴起，士气 +12' },
    19: { name_zh: '电网过载', desc_zh: '电力系统过载，能源 -6，资金 -5（修理）' },
    20: { name_zh: '和平时期', desc_zh: '相对稳定，全部资源 +2' }
  };

  CARD_DATABASE.forEach(c => { if (CARD_ZH[c.id]) Object.assign(c, CARD_ZH[c.id]); });
  EVENTS.forEach(e => { if (EVENT_ZH[e.id]) Object.assign(e, EVENT_ZH[e.id]); });
  ```

- [ ] **Step 2: 修改 data.js 末尾的 CR.data 赋值，纳入难度表**
  把 `CR.data = { CARD_DATABASE, EVENTS };` 改为：
  ```js
  CR.data = { CARD_DATABASE, EVENTS, DIFFICULTY_LEVELS };
  ```

- [ ] **Step 3: Node 验证**
  运行 `node -e "const d = require('/Users/haydenjiang/Downloads/cloud-republic/js/data.js'); console.log(Object.keys(d.DIFFICULTY_LEVELS).join(','), d.CARD_DATABASE.filter(c=>c.name_zh).length, d.EVENTS.filter(e=>e.name_zh&&e.desc_zh).length, d.CARD_DATABASE.filter(c=>c.effect_zh).length, d.DIFFICULTY_LEVELS.medium.guaranteedCards[0])"`，预期输出 `easy,medium,hard 66 20 66 12`。

---

## Task 2: js/i18n.js — 全量双语字典与 t()/setLang()

**Files:**
- Create: `/Users/haydenjiang/Downloads/cloud-republic/js/i18n.js`

**Interfaces:**
- Consumes: 无（纯字典 + 函数；双兼容外壳，Node 下可 require）
- Produces: `CR.i18n = { lang, t(key, params?), setLang(lang), DICT }`
  - `lang`：`'zh' | 'en'`，默认 `'zh'`；`setLang` 时持久化到 `localStorage`（`cr_lang`，有 localStorage 才写）并读取恢复
  - `t(key, params)`：查 `DICT[lang][key]`，缺省回退 `DICT.en[key]`，再缺省返回 key 本身；`{placeholder}` 形式替换 params
  - `setLang(lang)`：切换语言并调用 `CR.ui && CR.ui.refreshTexts()`（若 ui 已加载）做整屏重渲染
  - Node 下 `module.exports = CR.i18n`

- [ ] **Step 1: 创建 js/i18n.js（完整代码如下）**
  说明：字典是全部界面文案与日志模板的唯一来源。日志键（`log.*`）与 Task 4 engine.js 的调用点一一对应；`fail.*` 为引擎失败原因；simulate.js 会断言「模拟一整局_emit 的全部 log key 都在字典 zh+en 中存在」。
  ```js
  // i18n.js — bilingual dictionary (zh/en) + t() + setLang(). No DOM writes itself (ui refreshes).
  (function (root) {
    const CR = root.CR = root.CR || {};

    const DICT = {
      zh: {
        // ---------- chrome / header / start screen ----------
        'ui.title': '云端共和国',
        'ui.subtitle': 'Res Publica：金星浮空城殖民计划',
        'ui.choose_difficulty': '选择难度开始游戏',
        'ui.start_hint': '20 回合左右完成硫酸云净化（100%）并建成 ≥6 个栖息地',
        'difficulty.easy': '简单',
        'difficulty.medium': '中等',
        'difficulty.hard': '困难',
        'difficulty.easy_desc': '24 回合 · 资源丰富 · 腐蚀缓慢 · 维护 -4 能源',
        'difficulty.medium_desc': '22 回合 · 标准体验 · 维护 -4 能源',
        'difficulty.hard_desc': '19 回合 · 资源紧张 · 腐蚀加剧 · 维护 -5 能源',
        'ui.difficulty_label': '难度',
        'ui.lang_btn': 'EN',

        // ---------- panels ----------
        'ui.player_status': '玩家状态',
        'ui.faction': '玩家阵营',
        'ui.habitat_alpha': '浮空栖息地 Alpha',
        'res.money': '💰 资金',
        'res.materials': '🧱 材料',
        'res.energy': '⚡ 能源',
        'res.research': '🔬 科研',
        'res.morale': '😊 士气',
        'res.integrity': '🔧 完整度',
        'ui.permanent_effects': '永久效果',
        'ui.no_permanents': '暂无永久卡',
        'ui.global_progress': '全局进度',
        'ui.purification_label': '硫酸云净化',
        'ui.habitat_count': '栖息地数量',
        'ui.habitat_target': '{count} / 目标: {target}',
        'ui.hand': '手牌',
        'ui.hand_hint': '点击选择要打出的牌（每回合最多 {max} 张）',
        'ui.cards_selected': '已选卡牌',
        'ui.event_log': '事件日志',
        'ui.threats': '⚠️ 环境威胁',
        'ui.corrosion_label': '硫酸腐蚀速率',
        'ui.corrosion_rate': '-{rate}%/回合',
        'ui.turn_of': '回合 {turn} / {max}',

        // ---------- rules panel ----------
        'rules.title': '📊 游戏规则',
        'rules.defeat': '集体失败：回合结束时净化 <100% 或所有栖息地坠毁',
        'rules.victory': '集体胜利：净化 100% + 栖息地 >=6',
        'rules.personal': '个人胜利：集体胜利后贡献分最高',
        'rules.maturity_header': '成熟度成本系数：',
        'rules.maturity_1': '★ 驱动 x0.6 | ▶ 主流 x0.8',
        'rules.maturity_2': '▲ 新兴 x1.0 | ◐ 信号 x1.3',
        'rules.maturity_3': '☁ 酝酿 x1.5（需要 科研 >=10）',
        'rules.integrity_decay': '• 结构完整度每回合下降（硫酸腐蚀）',
        'rules.crash': '• 归 0 = 栖息地坠毁',
        'rules.repair': '• 修理：2 材料 = 1%',
        'rules.strike': '• 士气 < 30：工人罢工风险',

        // ---------- phases & buttons ----------
        'phase.setup': '准备阶段',
        'phase.event': '事件阶段',
        'phase.action': '行动阶段',
        'phase.settlement': '结算阶段',
        'phase.ended': '游戏结束',
        'btn.play': '打出所选卡牌',
        'btn.repair': '修理（-2 材料 +1%）',
        'btn.build': '建造栖息地（-20 资金 -12 材料）',
        'btn.next_turn': '下一回合',
        'btn.begin_turn': '开始回合 {turn}',
        'btn.play_again': '再来一局',
        'modal.proceed': '进入行动阶段',
        'modal.apply_event': '应用事件并继续',
        'modal.event_title': '环境事件：{name}',
        'modal.neutralized_title': '威胁已抵消',
        'modal.neutralized_text': '本回合的环境威胁已被抵消。进入行动阶段。',
        'modal.settlement_title': '回合 {turn} 结算完成',
        'modal.settlement_text': '结算结果已写入日志。难度：{difficulty}',

        // ---------- end screen ----------
        'end.victory_title': '集体胜利！',
        'end.victory_text': '净化 100% 完成并建成 6+ 栖息地！公共共和国正式成立！',
        'end.defeat_title': '集体失败',
        'end.defeat_text': '回合结束。净化：{purification}%（需要 100%）。栖息地：{habitats}/6。人类文明撤离金星。',
        'end.crash_title': '栖息地坠毁',
        'end.crash_text': '结构完整度归零，浮空栖息地站已坠毁。游戏结束。',
        'end.score_faction': '玩家阵营',
        'end.score_final': '最终状态',
        'end.habitats_score': '栖息地 x20: {value}',
        'end.purification_score': '净化: {value}',
        'end.funds_score': '资金 /5: {value}',
        'end.prestige': '声望: {value}',
        'end.turn_label': '回合: {value}',
        'end.purification_label': '净化: {value}',
        'end.habitats_label': '栖息地: {value}',
        'end.integrity_label': '完整度: {value}',
        'end.charter_label': '宪章: {value}',
        'end.charter_yes': '是',
        'end.charter_no': '否',
        'end.difficulty_label': '难度: {value}',

        // ---------- card rendering ----------
        'category.economy': '经济',
        'category.environment': '环境',
        'category.governance': '治理',
        'category.social': '社会',
        'category.tech': '科技',
        'category.wellbeing': '福祉',
        'category.venus': '金星专项',
        'type.permanent': '永久',
        'type.contract': '合同',
        'perm.timed_remaining': '{name} - 剩余 {turns} 回合',
        'perm.delayed_countdown': '{name} - {turns} 回合后激活',
        'result.victory': '胜利',
        'result.defeat': '失败',
        'result.crash': '坠毁',

        // ---------- ui-side logs ----------
        'ui.log.game_started': '游戏开始（难度：{difficulty}）！金星浮空城殖民计划启动。',
        'ui.log.goal': '目标：在 {turns} 回合内完成硫酸云净化（100%）并建成至少 6 个栖息地。',
        'ui.log.init_corrosion': '初始资源已分配。结构完整度每回合 -{rate}%（硫酸腐蚀）。',
        'ui.log.strike_action': '行动阶段：工人在罢工！本回合只能修理或结束回合。',
        'ui.log.action_prompt': '行动阶段：选择卡牌打出（最多 {max} 张）、修理、建造栖息地，或点「下一回合」。',
        'ui.log.max_selected': '每回合最多选择 {max} 张牌',

        // ---------- engine log templates ----------
        'log.turn_begin': '=== 回合 {turn} / {max} 开始 ===',
        'log.turn_complete': '=== 回合 {turn} 完成 ===',
        'log.settlement_begin': '=== 结算阶段 ===',
        'log.event_applied': '[回合 {turn}] 事件：{event}',
        'log.strike': '工人本回合罢工！',
        'log.shield_block': '太空法庭启动！负面事件被抵消！',
        'log.storm_shield_block': '太空辐射医学：太阳风暴被抵消！无人员伤亡。',
        'log.hand_full': '手牌已满，无法抽牌。',
        'log.game_over': '游戏结束：{result}',
        'log.habitat_limit': '栖息地扩容已达上限（{max} 次）',
        'log.habitat_expanded': '栖息地扩容！当前：{habitats}',
        'log.habitat_built': '新栖息地建成！栖息地：{habitats}（扩容次数：{used}/{max}）',
        'log.cannot_afford': '资源不足，无法打出 {card} - 已跳过',
        'log.played_permanent': '打出永久卡：{card}',
        'log.played_contract': '执行合同：{card}',
        'log.risk_failed': '{card}：交易失败！-10 资金',
        'log.delayed_started': '{card}：{turns} 回合后开始每回合 +{amount} 资金',
        'log.timed_started': '{card}：持续 {turns} 回合，每回合 +{money} 资金 +{materials} 材料 +{energy} 能源',
        'log.extra_card': '紧急动员：本回合可额外打出 1 张牌',
        'log.steal': '从星际市场获得资金',
        'log.output_money': '资金产出：+{amount}/回合',
        'log.output_materials': '材料产出：+{amount}/回合',
        'log.output_energy': '能源产出：+{amount}/回合',
        'log.output_research': '科研产出：+{amount}/回合',
        'log.output_morale': '士气提升：+{amount}',
        'log.output_purification': '净化产出：+{amount}%/回合',
        'log.corrosion_changed': '腐蚀率：{amount}%/回合',
        'log.transport_discount': '运输成本降低。资金成本系数现为 x{coefficient}',
        'log.repair_cheaper': '修理成本降低 25%',
        'log.repair_efficient': '修理效率翻倍（每次修理 +2% 完整度）',
        'log.morale_floor': '士气下限锁定为 40',
        'log.insurance_active': '太空生存保险已激活',
        'log.storm_shield_active': '太阳风暴防护已激活',
        'log.no_morale_decay': '人工重力启动 - 士气不再衰减',
        'log.charter': '《公共共和国宪章》已签署！',
        'log.ultimate_ready': '意识上传备份已就绪',
        'log.shield_ready': '太空法庭已就绪，可应对下一次危机',
        'log.purification_change': '净化：{amount}%',
        'log.income_summary': '永久产出：资金+{money} 材料+{materials} 能源+{energy} 科研+{research} 士气+{morale} 净化+{purification}%',
        'log.purification_income': '净化：+{amount}%（当前 {total}%）',
        'log.timed_remaining': '{name}：剩余 {turns} 回合',
        'log.timed_expired': '{name} 已到期。',
        'log.delayed_matured': '{name} 已全面投产！收入计入永久产出。',
        'log.delayed_countdown': '{name}：{turns} 回合后激活',
        'log.maintenance': '维护：{amount} 能源',
        'log.corrosion': '腐蚀：完整度 {amount}%',
        'log.morale_decay': '士气衰减：{amount}',
        'log.low_morale': '警告：士气低落！罢工风险高！',
        'log.repaired': '修理：-{cost} 材料，完整度 +{amount}%',
        'log.insurance_activated': '太空生存保险启动！完整度恢复至 20%。资金/材料/能源/科研减半。',
        'log.ultimate_activated': '意识上传备份启动！完整度恢复至 20%。无资源损失。',

        // ---------- engine failure reasons (fail.*) ----------
        'fail.not_action_phase': '当前不在行动阶段',
        'fail.strike_cards': '工人在罢工！无法打出卡牌！',
        'fail.no_selection': '未选择卡牌',
        'fail.no_materials_repair': '材料不足，无法修理！',
        'fail.strike_build': '工人在罢工！无法建造！',
        'fail.habitat_limit': '栖息地扩容已达上限（{max} 次）',
        'fail.build_cost': '资源不足：建造栖息地需要 20 资金 + 12 材料'
      },

      en: {
        'ui.title': 'Cloud Republic',
        'ui.subtitle': 'Res Publica: Venus Floating City Colonization Project',
        'ui.choose_difficulty': 'Choose a difficulty to start',
        'ui.start_hint': 'Complete sulfuric acid cloud purification (100%) and build >=6 habitats before turns run out',
        'difficulty.easy': 'Easy',
        'difficulty.medium': 'Medium',
        'difficulty.hard': 'Hard',
        'difficulty.easy_desc': '24 turns · Rich resources · Slow corrosion · -4 Energy upkeep',
        'difficulty.medium_desc': '22 turns · Standard experience · -4 Energy upkeep',
        'difficulty.hard_desc': '19 turns · Tight resources · Faster corrosion · -5 Energy upkeep',
        'ui.difficulty_label': 'Difficulty',
        'ui.lang_btn': '中文',

        'ui.player_status': 'Player Status',
        'ui.faction': 'Player Faction',
        'ui.habitat_alpha': 'Floating Habitat Alpha',
        'res.money': '💰 Funds',
        'res.materials': '🧱 Materials',
        'res.energy': '⚡ Energy',
        'res.research': '🔬 Research',
        'res.morale': '😊 Morale',
        'res.integrity': '🔧 Integrity',
        'ui.permanent_effects': 'Permanent Effects',
        'ui.no_permanents': 'No permanent cards yet',
        'ui.global_progress': 'Global Progress',
        'ui.purification_label': 'Sulfuric Acid Cloud Purification',
        'ui.habitat_count': 'Habitat Count',
        'ui.habitat_target': '{count} / Target: {target}',
        'ui.hand': 'Hand',
        'ui.hand_hint': 'Click to select cards to play (max {max} per turn)',
        'ui.cards_selected': 'Cards Selected',
        'ui.event_log': 'Event Log',
        'ui.threats': '⚠️ Environmental Threats',
        'ui.corrosion_label': 'Sulfuric Acid Corrosion Rate',
        'ui.corrosion_rate': '-{rate}%/turn',
        'ui.turn_of': 'Turn {turn} / {max}',

        'rules.title': '📊 Game Rules',
        'rules.defeat': 'Collective Defeat: Turns end with purification <100% or all habitats crashed',
        'rules.victory': 'Collective Victory: Purification 100% + Habitats >=6',
        'rules.personal': 'Personal Victory: Highest contribution score after collective victory',
        'rules.maturity_header': 'Maturity Cost Multipliers:',
        'rules.maturity_1': '★ Driving x0.6 | ▶ Trending x0.8',
        'rules.maturity_2': '▲ Emerging x1.0 | ◐ Signaling x1.3',
        'rules.maturity_3': '☁ Brewing x1.5 (Requires Research >=10)',
        'rules.integrity_decay': '• Structural Integrity decreases per turn (sulfuric acid corrosion)',
        'rules.crash': '• Reaches 0 = Habitat Crash',
        'rules.repair': '• Repair: 2 Materials = 1%',
        'rules.strike': '• Morale < 30: Workers Strike risk',

        'phase.setup': 'Setup Phase',
        'phase.event': 'Event Phase',
        'phase.action': 'Action Phase',
        'phase.settlement': 'Settlement Phase',
        'phase.ended': 'Game Over',
        'btn.play': 'Play Selected Cards',
        'btn.repair': 'Repair (-2 Materials +1%)',
        'btn.build': 'Build Habitat (-20 Funds -12 Materials)',
        'btn.next_turn': 'Next Turn',
        'btn.begin_turn': 'Begin Turn {turn}',
        'btn.play_again': 'Play Again',
        'modal.proceed': 'Proceed to Action Phase',
        'modal.apply_event': 'Apply Event & Proceed',
        'modal.event_title': 'Environmental Event: {name}',
        'modal.neutralized_title': 'Threat Neutralized',
        'modal.neutralized_text': "This turn's environmental threat was neutralized. Proceed to Action Phase.",
        'modal.settlement_title': 'Turn {turn} Settlement Complete',
        'modal.settlement_text': 'Settlement results have been written to the log. Difficulty: {difficulty}',

        'end.victory_title': 'Collective Victory!',
        'end.victory_text': 'Purification 100% complete with 6+ habitats! The Res Publica Republic is established!',
        'end.defeat_title': 'Collective Defeat',
        'end.defeat_text': 'Turns ended. Purification: {purification}% (need 100%). Habitats: {habitats}/6. Human civilization evacuates Venus.',
        'end.crash_title': 'Habitat Crashed',
        'end.crash_text': 'Structural Integrity reached zero. The floating habitat station has crashed. Game over.',
        'end.score_faction': 'Player Faction',
        'end.score_final': 'Final Status',
        'end.habitats_score': 'Habitats x20: {value}',
        'end.purification_score': 'Purification: {value}',
        'end.funds_score': 'Funds /5: {value}',
        'end.prestige': 'Prestige: {value}',
        'end.turn_label': 'Turn: {value}',
        'end.purification_label': 'Purification: {value}',
        'end.habitats_label': 'Habitats: {value}',
        'end.integrity_label': 'Integrity: {value}',
        'end.charter_label': 'Charter: {value}',
        'end.charter_yes': 'Yes',
        'end.charter_no': 'No',
        'end.difficulty_label': 'Difficulty: {value}',

        'category.economy': 'Economy',
        'category.environment': 'Environment',
        'category.governance': 'Governance',
        'category.social': 'Social',
        'category.tech': 'Technology',
        'category.wellbeing': 'Wellbeing',
        'category.venus': 'Venus Special',
        'type.permanent': 'Permanent',
        'type.contract': 'Contract',
        'perm.timed_remaining': '{name} - {turns} turn(s) remaining',
        'perm.delayed_countdown': '{name} - activates in {turns} turn(s)',
        'result.victory': 'victory',
        'result.defeat': 'defeat',
        'result.crash': 'crash',

        'ui.log.game_started': 'Game started (Difficulty: {difficulty})! Venus Floating City colonization project launched.',
        'ui.log.goal': 'Goal: Complete sulfuric acid cloud purification (100%) and establish at least 6 habitats within {turns} turns.',
        'ui.log.init_corrosion': 'Initial resources allocated. Structural Integrity decreases by {rate}% per turn (sulfuric acid corrosion).',
        'ui.log.strike_action': 'Action Phase: Workers on strike! You can only repair or end turn.',
        'ui.log.action_prompt': 'Action Phase: Select cards to play (max {max}), repair, build habitat, or press Next Turn.',
        'ui.log.max_selected': 'Max {max} cards per turn',

        'log.turn_begin': '=== TURN {turn} / {max} BEGINS ===',
        'log.turn_complete': '=== TURN {turn} COMPLETE ===',
        'log.settlement_begin': '=== SETTLEMENT PHASE ===',
        'log.event_applied': '[Turn {turn}] Event: {event}',
        'log.strike': 'Workers are on strike this turn!',
        'log.shield_block': 'Space Court activated! Negative event neutralized!',
        'log.storm_shield_block': 'Space Radiation Medicine: Solar Storm neutralized! No casualties.',
        'log.hand_full': 'Hand full. Cannot draw.',
        'log.game_over': 'Game over: {result}',
        'log.habitat_limit': 'Habitat expansion limit reached ({max} max)',
        'log.habitat_expanded': 'Habitat expanded! Now: {habitats}',
        'log.habitat_built': 'New habitat built! Habitats: {habitats} (expansions used: {used}/{max})',
        'log.cannot_afford': 'Cannot afford {card} - skipped',
        'log.played_permanent': 'Played permanent: {card}',
        'log.played_contract': 'Executed contract: {card}',
        'log.risk_failed': '{card}: Deal failed! -10 Funds',
        'log.delayed_started': '{card}: +{amount} Funds/turn begins after {turns} turns',
        'log.timed_started': '{card}: +{money} Funds +{materials} Materials +{energy} Energy per turn for {turns} turns',
        'log.extra_card': 'Emergency Mobilization: Can play 1 extra card this turn',
        'log.steal': 'Gained funds from interstellar market',
        'log.output_money': 'Funds output: +{amount}/turn',
        'log.output_materials': 'Materials output: +{amount}/turn',
        'log.output_energy': 'Energy output: +{amount}/turn',
        'log.output_research': 'Research output: +{amount}/turn',
        'log.output_morale': 'Morale boost: +{amount}',
        'log.output_purification': 'Purification output: +{amount}%/turn',
        'log.corrosion_changed': 'Corrosion rate: {amount}%/turn',
        'log.transport_discount': 'Transport costs reduced. Money-cost coefficient now x{coefficient}',
        'log.repair_cheaper': 'Repair costs reduced by 25%',
        'log.repair_efficient': 'Repair efficiency doubled (+2% Integrity per repair)',
        'log.morale_floor': 'Morale floor locked at 40',
        'log.insurance_active': 'Space Survival Insurance active',
        'log.storm_shield_active': 'Solar storm protection active',
        'log.no_morale_decay': 'Artificial gravity active - Morale no longer decays',
        'log.charter': 'Res Publica Charter signed!',
        'log.ultimate_ready': 'Consciousness Upload Backup ready',
        'log.shield_ready': 'Space Court ready for next crisis',
        'log.purification_change': 'Purification: {amount}%',
        'log.income_summary': 'Permanent outputs: Funds+{money} Mat+{materials} En+{energy} Res+{research} Mor+{morale} Pur+{purification}%',
        'log.purification_income': 'Purification: +{amount}% (now {total}%)',
        'log.timed_remaining': '{name}: {turns} turn(s) remaining',
        'log.timed_expired': '{name} has expired.',
        'log.delayed_matured': '{name} is now fully operational! Income added to permanent outputs.',
        'log.delayed_countdown': '{name}: activates in {turns} turn(s)',
        'log.maintenance': 'Maintenance: {amount} Energy',
        'log.corrosion': 'Corrosion: Integrity {amount}%',
        'log.morale_decay': 'Morale decay: {amount}',
        'log.low_morale': 'WARNING: Low morale! Strike risk high!',
        'log.repaired': 'Repaired: -{cost} Materials, Integrity +{amount}%',
        'log.insurance_activated': 'Space Survival Insurance activated! Integrity restored to 20%. Funds/Materials/Energy/Research halved.',
        'log.ultimate_activated': 'Consciousness Upload Backup activated! Integrity restored to 20%. No resources lost.',

        'fail.not_action_phase': 'Not in action phase',
        'fail.strike_cards': 'Workers on strike! Cannot play cards!',
        'fail.no_selection': 'No cards selected',
        'fail.no_materials_repair': 'Insufficient materials for repair!',
        'fail.strike_build': 'Workers on strike! Cannot build!',
        'fail.habitat_limit': 'Habitat expansion limit reached ({max} max)',
        'fail.build_cost': 'Insufficient resources: Build Habitat costs 20 Funds + 12 Materials'
      }
    };

    function interpolate(template, params) {
      if (!params) return template;
      return template.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m));
    }

    const i18n = {
      DICT,
      lang: 'zh',
      t(key, params) {
        const table = DICT[i18n.lang] || DICT.en;
        const template = table[key] !== undefined ? table[key] : (DICT.en[key] !== undefined ? DICT.en[key] : key);
        return interpolate(template, params);
      },
      setLang(lang) {
        if (lang !== 'zh' && lang !== 'en') return;
        i18n.lang = lang;
        try { if (typeof localStorage !== 'undefined') localStorage.setItem('cr_lang', lang); } catch (e) { /* file:// private mode etc. */ }
        if (CR.ui && typeof CR.ui.refreshTexts === 'function') CR.ui.refreshTexts();
      },
      init() {
        try {
          if (typeof localStorage !== 'undefined') {
            const saved = localStorage.getItem('cr_lang');
            if (saved === 'zh' || saved === 'en') i18n.lang = saved;
          }
        } catch (e) { /* ignore */ }
      }
    };

    CR.i18n = i18n;
    if (typeof module !== 'undefined' && module.exports) module.exports = i18n;
  })(typeof window !== 'undefined' ? window : globalThis);
  ```

- [ ] **Step 2: Node 验证**
  运行 `node -e "const i = require('/Users/haydenjiang/Downloads/cloud-republic/js/i18n.js'); console.log(i.lang, i.t('btn.next_turn'), i.t('log.turn_begin', {turn: 3, max: 22})); i.setLang('en'); console.log(i.t('btn.next_turn'), i.t('log.turn_begin', {turn: 3, max: 22})); console.log(Object.keys(i.DICT.zh).length === Object.keys(i.DICT.en).length ? 'key-parity OK' : 'KEY MISMATCH')"`，预期输出：`zh 下一回合 === 回合 3 / 22 开始 ===`、`Next Turn === TURN 3 / 22 BEGINS ===`、`key-parity OK`。

---

## Task 3: js/state.js — createInitialState(difficultyKey)

**Files:**
- Modify: `/Users/haydenjiang/Downloads/cloud-republic/js/state.js`（整文件替换为下方完整代码）

**Interfaces:**
- Consumes: `CR.data.DIFFICULTY_LEVELS`、`CR.data.CARD_DATABASE`
- Produces: `CR.state.createInitialState(difficultyKey?)` → state；`difficultyKey` 无效/缺省时回退 `'medium'`。新字段：`difficulty`、`initialHandSize`、`handLimit`、`drawPerTurn`、`energyMaintenance`；`maxCardsPerTurn: 2 → 3`；`maxTurns`/`corrosionRate`/`resources`/初始手牌由难度配置决定；`hand` 预置 `guaranteedCards`（带 uid）。

- [ ] **Step 1: 整文件替换 state.js（完整代码如下）**
  ```js
  // state.js — initial game state factory (difficulty-aware). No logic, no DOM.
  (function (root) {
    const CR = root.CR = root.CR || {};

    function createInitialState(difficultyKey) {
      const levels = CR.data.DIFFICULTY_LEVELS;
      const key = (difficultyKey && levels[difficultyKey]) ? difficultyKey : 'medium';
      const diff = levels[key];
      const guaranteed = diff.guaranteedCards || [];
      return {
        difficulty: key,
        turn: 0,
        maxTurns: diff.maxTurns,
        phase: 'setup',              // 'setup' | 'event' | 'action' | 'settlement' | 'ended'
        purification: 0,
        targetPurification: 100,
        habitats: 1,
        targetHabitats: 6,
        corrosionRate: diff.corrosionRate,
        energyMaintenance: diff.energyMaintenance,
        handLimit: diff.handLimit,
        drawPerTurn: diff.drawPerTurn,
        initialHandSize: diff.initialHandSize,
        resources: { ...diff.resources },
        hand: guaranteed.map((id, i) => ({ ...CR.data.CARD_DATABASE.find(c => c.id === id), uid: i + 1 })),
        permanentCards: [],
        selectedCards: [],
        cardsPlayedThisTurn: 0,
        maxCardsPerTurn: 3,          // spec §3: was 2
        gameOver: false,
        gameResult: null,            // null | 'victory' | 'defeat' | 'crash'
        contribution: 0,
        eventTriggered: false,
        extraCardPlayed: false,
        habitatExpansions: 0,
        maxHabitatExpansions: 5,
        prestige: 0,
        hasCharter: false,
        noMoraleDecay: false,
        moraleFloor: 0,
        insurance: false,
        ultimate: false,
        stormShield: false,
        shieldActive: false,
        repairEfficiency: 1,
        repairCostMultiplier: 1,
        transportDiscount: 1,
        moneyMultiplier: 1,
        timedEffects: [],
        delayedEffects: [],
        maturedIncome: { money: 0, materials: 0, energy: 0, research: 0, morale: 0 },
        pendingEvent: null,
        strike: false,
        nextCardUid: guaranteed.length + 1
      };
    }

    CR.state = { createInitialState };
    if (typeof module !== 'undefined' && module.exports) module.exports = CR.state;
  })(typeof window !== 'undefined' ? window : globalThis);
  ```

- [ ] **Step 2: Node 验证**
  运行 `node -e "require('/Users/haydenjiang/Downloads/cloud-republic/js/data.js'); const st = require('/Users/haydenjiang/Downloads/cloud-republic/js/state.js'); const a = st.createInitialState('easy'), b = st.createInitialState(), c = st.createInitialState('hard'); console.log(a.maxTurns, a.resources.materials, a.hand.map(c=>c.id).join('/'), a.hand[0].uid, b.difficulty, b.maxTurns, b.maxCardsPerTurn, c.maxTurns, c.corrosionRate, c.energyMaintenance)"`，预期输出 `24 100 12 1 medium 22 3 19 2.5 5`（b 缺省回退 medium）。

---

## Task 4: js/engine.js — 日志键值化 + 难度消费（TDD 先行见 Task 5）

**Files:**
- Modify: `/Users/haydenjiang/Downloads/cloud-republic/js/engine.js`（整文件替换为下方完整代码）

**Interfaces:**
- Consumes: `CR.data.CARD_DATABASE` / `CR.data.EVENTS`；state 新字段（`initialHandSize/handLimit/drawPerTurn/energyMaintenance`）
- Produces（签名变更点，其余与第一轮一致）:
  - `CR.engine.onLog(key, params)` — 原来是 `onLog(message)`；`key` 为 i18n 键（`log.*`），`params` 为对象；卡牌类日志传 `cardId`（ui 负责本地化名字）与 `card`（英文名，Node 测试可读）
  - 失败返回 `{ok:false, reason:'fail.*', reasonParams?}`（原来 reason 为英文字符串）
  - `drawCard` 手牌上限 8 → `state.handLimit`；`drawInitialCards` 抽到 `state.initialHandSize`；`endTurn` 抽 `state.drawPerTurn` 张、维护费 `-state.energyMaintenance`
  - `CR.engine.logKeys` — 字符串数组，engine 内全部日志键的白名单（simulate.js 用它断言 onLog 收到的每个 key 都在白名单与字典中）
- 行为不变式：除上述外全部机制与第一轮一致（61 条旧断言适配后必须通过）

- [ ] **Step 1: 整文件替换 engine.js（完整代码如下）**
  ```js
  // engine.js — pure game logic. No DOM access. Logs via CR.engine.onLog(key, params).
  (function (root) {
    const CR = root.CR = root.CR || {};

    const engine = {};

    // Injectable hooks
    engine.rng = Math.random;        // () => [0, 1)
    engine.onLog = null;             // (key: string, params: object) => void

    // Whitelist of every log key this engine can emit (tested by simulate.js)
    engine.logKeys = [
      'log.ultimate_activated', 'log.insurance_activated', 'log.purification_change',
      'log.hand_full', 'log.game_over', 'log.habitat_limit', 'log.habitat_expanded',
      'log.cannot_afford', 'log.played_permanent', 'log.played_contract', 'log.risk_failed',
      'log.delayed_started', 'log.timed_started', 'log.extra_card', 'log.steal',
      'log.output_money', 'log.output_materials', 'log.output_energy', 'log.output_research',
      'log.output_morale', 'log.output_purification', 'log.corrosion_changed',
      'log.transport_discount', 'log.repair_cheaper', 'log.repair_efficient',
      'log.morale_floor', 'log.insurance_active', 'log.storm_shield_active',
      'log.no_morale_decay', 'log.charter', 'log.ultimate_ready', 'log.shield_ready',
      'log.turn_begin', 'log.shield_block', 'log.storm_shield_block', 'log.event_applied',
      'log.strike', 'log.repaired', 'log.habitat_built', 'log.settlement_begin',
      'log.income_summary', 'log.purification_income', 'log.timed_remaining',
      'log.timed_expired', 'log.delayed_matured', 'log.delayed_countdown',
      'log.maintenance', 'log.corrosion', 'log.morale_decay', 'log.low_morale',
      'log.turn_complete'
    ];

    function log(key, params) {
      if (engine.onLog) engine.onLog(key, params || {});
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
        log('log.ultimate_activated');
        return;
      }
      if (state.insurance) {
        state.insurance = false;
        state.resources.integrity = 20;
        ['money', 'materials', 'energy', 'research'].forEach(k => {
          state.resources[k] = Math.floor(state.resources[k] / 2);
        });
        log('log.insurance_activated');
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
        log('log.purification_change', { amount: (effect.purification > 0 ? '+' : '') + effect.purification });
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

    // transportDiscount applies to the money (Funds) cost only (spec 3.3)
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
      if (state.hand.length >= state.handLimit) {
        log('log.hand_full');
        return;
      }
      const db = CR.data.CARD_DATABASE;
      const randomCard = db[Math.floor(engine.rng() * db.length)];
      state.hand.push({ ...randomCard, uid: state.nextCardUid++ });
    }

    function drawInitialCards(state) {
      while (state.hand.length < state.initialHandSize) drawCard(state);
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
        Math.floor(state.purification) +
        Math.floor(state.resources.money / 5) +
        state.prestige;
      log('log.game_over', { result: state.gameResult });
    }

    // ==================== CARD PLAY ====================

    // Shared by contract/permanent habitat effects and the Build Habitat button (spec 3.1: one shared limit of 5)
    function expandHabitat(state) {
      if (state.habitatExpansions >= state.maxHabitatExpansions) {
        log('log.habitat_limit', { max: state.maxHabitatExpansions });
        return false;
      }
      state.habitats++;
      state.habitatExpansions++;
      log('log.habitat_expanded', { habitats: state.habitats });
      return true;
    }

    function playSelectedCards(state) {
      if (state.phase !== 'action') return { ok: false, reason: 'fail.not_action_phase' };
      if (state.strike) return { ok: false, reason: 'fail.strike_cards' };
      if (state.selectedCards.length === 0) return { ok: false, reason: 'fail.no_selection' };

      // Sort descending to avoid index issues when removing
      const sorted = [...state.selectedCards].sort((a, b) => b - a);

      sorted.forEach(index => {
        const card = state.hand[index];
        if (!card || !canAfford(state, card)) {
          if (card) log('log.cannot_afford', { card: card.name, cardId: card.id });
          return;
        }
        payCost(state, card);

        if (card.type === 'permanent') {
          state.permanentCards.push(card);
          applyPermanentEffect(state, card);
          log('log.played_permanent', { card: card.name, cardId: card.id });
        } else {
          applyContractEffect(state, card);
          log('log.played_contract', { card: card.name, cardId: card.id });
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
          log('log.risk_failed', { card: card.name, cardId: card.id });
        } else {
          applyResourceEffect(state, ve);
        }
      } else if (card.delay) {
        // Card 2 Asteroid Mining Economy: permanent income after `delay` full settlements (spec 3.2)
        state.delayedEffects.push({ name: card.name, cardId: card.id, turnsLeft: card.delay, income: { ...ve } });
        log('log.delayed_started', { card: card.name, cardId: card.id, amount: ve.money, turns: card.delay });
      } else if (card.duration) {
        // Card 24 Trade Agreement: income for exactly `duration` settlements (spec 3.2)
        state.timedEffects.push({ name: card.name, cardId: card.id, turnsLeft: card.duration, income: { ...ve } });
        log('log.timed_started', { card: card.name, cardId: card.id, money: ve.money, materials: ve.materials, energy: ve.energy, turns: card.duration });
      } else {
        applyResourceEffect(state, ve);
      }

      if (ve.habitat && !card.delay && !card.duration) {
        expandHabitat(state);
      }

      if (card.special === 'extraCard') {
        state.extraCardPlayed = true;
        log('log.extra_card');
      }
      if (card.special === 'steal') {
        modifyResource(state, 'money', 5);
        log('log.steal');
      }
    }

    // Cards 1 / 7 / 42: multiplicative transport (money-cost) discount, coefficient floor 0.4 (spec 3.3)
    const TRANSPORT_DISCOUNT_BY_CARD_ID = { 1: 0.5, 7: 0.8, 42: 0.6 };

    function applyPermanentEffect(state, card) {
      const ve = card.venusEffect || {};
      if (ve.money) log('log.output_money', { amount: ve.money });
      if (ve.materials) log('log.output_materials', { amount: ve.materials });
      if (ve.energy) log('log.output_energy', { amount: ve.energy });
      if (ve.research) log('log.output_research', { amount: ve.research });
      if (ve.morale) log('log.output_morale', { amount: ve.morale });
      if (ve.purification) log('log.output_purification', { amount: ve.purification });
      if (ve.corrosion) {
        state.corrosionRate += ve.corrosion;
        log('log.corrosion_changed', { amount: (ve.corrosion > 0 ? '+' : '') + ve.corrosion });
      }
      if (ve.habitat) {
        expandHabitat(state);
      }

      if (TRANSPORT_DISCOUNT_BY_CARD_ID[card.id]) {
        state.transportDiscount = Math.max(0.4, state.transportDiscount * TRANSPORT_DISCOUNT_BY_CARD_ID[card.id]);
        log('log.transport_discount', { coefficient: state.transportDiscount.toFixed(2) });
      }

      // spec 3.4: repair modifiers
      if (card.id === 17) {
        state.repairCostMultiplier *= 0.75;
        log('log.repair_cheaper');
      }
      if (card.id === 45) {
        state.repairEfficiency = 2;
        log('log.repair_efficient');
      }

      if (card.special === 'moraleFloor') {
        state.moraleFloor = 40;
        log('log.morale_floor');
      }
      if (card.special === 'insurance') {
        state.insurance = true;
        log('log.insurance_active');
      }
      if (card.special === 'stormShield') {
        state.stormShield = true;
        log('log.storm_shield_active');
      }
      if (card.special === 'noMoraleDecay') {
        state.noMoraleDecay = true;
        log('log.no_morale_decay');
      }
      if (card.special === 'prestige') state.prestige += 15;
      if (card.special === 'charter') {
        state.hasCharter = true;
        log('log.charter');
      }
      if (card.special === 'megastructure') state.prestige += 25;
      if (card.special === 'ultimate') {
        state.ultimate = true;
        state.prestige += 30;
        log('log.ultimate_ready');
      }
      if (card.special === 'shield') {
        state.shieldActive = true;
        log('log.shield_ready');
      }
    }

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

      log('log.turn_begin', { turn: state.turn, max: state.maxTurns });
    }

    // Returns the rolled event (ui shows it in a modal), or null when neutralized.
    function triggerEventPhase(state) {
      if (state.gameOver) return null;

      // Card 27 Space Court: blocks this turn's event entirely (spec 3.6)
      if (state.shieldActive) {
        state.shieldActive = false;
        state.pendingEvent = null;
        log('log.shield_block');
        return null;
      }

      const roll = Math.floor(engine.rng() * 20) + 1;
      const event = CR.data.EVENTS.find(e => e.id === roll) || CR.data.EVENTS[0];

      // Card 53 Space Radiation Medicine: Solar Storm (event id 2) fully neutralized (spec 3.6)
      if (event.id === 2 && state.stormShield) {
        state.pendingEvent = null;
        log('log.storm_shield_block');
        return null;
      }

      state.pendingEvent = event;
      return event;
    }

    // Applies state.pendingEvent (called by ui after the player dismisses the modal), then opens the Action Phase.
    function applyEvent(state) {
      if (state.gameOver) return;
      const event = state.pendingEvent;
      if (event) {
        log('log.event_applied', { turn: state.turn, event: event.name, eventId: event.id });
        applyResourceEffect(state, event.effect);
        if (event.effect.strike) {
          state.strike = true;
          log('log.strike');
        }
        state.pendingEvent = null;
      }
      state.phase = 'action';
    }

    // ==================== ACTION BUTTONS ====================

    // spec 3.4: cost = round(2 x repairCostMultiplier) materials; card 45 -> +2% integrity per repair
    function repairHabitat(state) {
      if (state.phase !== 'action') return { ok: false, reason: 'fail.not_action_phase' };

      const cost = Math.max(1, Math.round(2 * state.repairCostMultiplier));
      if (state.resources.materials < cost) {
        return { ok: false, reason: 'fail.no_materials_repair' };
      }

      modifyResource(state, 'materials', -cost);
      modifyResource(state, 'integrity', state.repairEfficiency);
      log('log.repaired', { cost, amount: state.repairEfficiency });
      return { ok: true };
    }

    // spec 3.1 + 3.8: 20 Funds + 12 Materials, +1 habitat, shares the maxHabitatExpansions (5) limit
    function buildHabitat(state) {
      if (state.phase !== 'action') return { ok: false, reason: 'fail.not_action_phase' };
      if (state.strike) return { ok: false, reason: 'fail.strike_build' };
      if (state.habitatExpansions >= state.maxHabitatExpansions) {
        return { ok: false, reason: 'fail.habitat_limit', reasonParams: { max: state.maxHabitatExpansions } };
      }
      if (state.resources.money < 20 || state.resources.materials < 12) {
        return { ok: false, reason: 'fail.build_cost' };
      }

      modifyResource(state, 'money', -20);
      modifyResource(state, 'materials', -12);
      state.habitats++;
      state.habitatExpansions++;
      log('log.habitat_built', { habitats: state.habitats, used: state.habitatExpansions, max: state.maxHabitatExpansions });

      if (checkVictory(state)) endGame(state, 'victory');
      return { ok: true };
    }

    // ==================== SETTLEMENT ====================

    function endTurn(state) {
      if (state.phase !== 'action') return { ok: false, reason: 'fail.not_action_phase' };

      state.phase = 'settlement';
      log('log.settlement_begin');

      // 1. Permanent card outputs + matured delayed income (ve.purification included, spec 3.7)
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
        log('log.income_summary', income);
      }

      if (income.money) modifyResource(state, 'money', Math.round(income.money * state.moneyMultiplier));
      if (income.materials) modifyResource(state, 'materials', income.materials);
      if (income.energy) modifyResource(state, 'energy', income.energy);
      if (income.research) modifyResource(state, 'research', income.research);
      if (income.morale) modifyResource(state, 'morale', income.morale);
      if (income.purification) {
        state.purification = Math.min(100, state.purification + income.purification);
        log('log.purification_income', { amount: income.purification, total: state.purification.toFixed(1) });
      }

      // 2. Timed effects (e.g. card 24): apply income, count down, remove expired
      state.timedEffects = state.timedEffects.filter(te => {
        applyResourceEffect(state, te.income);
        te.turnsLeft--;
        if (te.turnsLeft > 0) log('log.timed_remaining', { name: te.name, cardId: te.cardId, turns: te.turnsLeft });
        else log('log.timed_expired', { name: te.name, cardId: te.cardId });
        return te.turnsLeft > 0;
      });

      // 3. Delayed effects (e.g. card 2): count down, mature into permanent income
      state.delayedEffects = state.delayedEffects.filter(de => {
        de.turnsLeft--;
        if (de.turnsLeft <= 0) {
          ['money', 'materials', 'energy', 'research', 'morale'].forEach(k => {
            if (de.income[k]) state.maturedIncome[k] += de.income[k];
          });
          log('log.delayed_matured', { name: de.name, cardId: de.cardId });
          return false;
        }
        log('log.delayed_countdown', { name: de.name, cardId: de.cardId, turns: de.turnsLeft });
        return true;
      });

      // 4. Energy maintenance (per-difficulty)
      modifyResource(state, 'energy', -state.energyMaintenance);
      log('log.maintenance', { amount: -state.energyMaintenance });

      // 5. Corrosion (may trigger insurance / ultimate / crash inside modifyResource)
      modifyResource(state, 'integrity', -state.corrosionRate);
      log('log.corrosion', { amount: -state.corrosionRate });
      if (state.gameOver) return { ok: true };

      // 6. Morale decay (floor already enforced inside modifyResource, spec 3.6)
      if (!state.noMoraleDecay) {
        modifyResource(state, 'morale', -1);
        log('log.morale_decay', { amount: -1 });
      }
      if (state.resources.morale < 30) {
        log('log.low_morale');
      }

      // 7. Draw cards (per-difficulty drawPerTurn; hand cap = state.handLimit)
      for (let i = 0; i < state.drawPerTurn; i++) drawCard(state);

      if (checkVictory(state)) {
        endGame(state, 'victory');
        return { ok: true };
      }

      log('log.turn_complete', { turn: state.turn });
      return { ok: true };
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
    engine.playSelectedCards = playSelectedCards;
    engine.applyContractEffect = applyContractEffect;
    engine.applyPermanentEffect = applyPermanentEffect;
    engine.startNewTurn = startNewTurn;
    engine.triggerEventPhase = triggerEventPhase;
    engine.applyEvent = applyEvent;
    engine.repairHabitat = repairHabitat;
    engine.buildHabitat = buildHabitat;
    engine.endTurn = endTurn;

    CR.engine = engine;
    if (typeof module !== 'undefined' && module.exports) module.exports = engine;
  })(typeof window !== 'undefined' ? window : globalThis);
  ```

- [ ] **Step 2: Node 冒烟验证（此时 simulate.js 尚未更新，用内联脚本）**
  运行 `node -e "require('/Users/haydenjiang/Downloads/cloud-republic/js/data.js'); require('/Users/haydenjiang/Downloads/cloud-republic/js/state.js'); const e = require('/Users/haydenjiang/Downloads/cloud-republic/js/engine.js'); const keys = []; e.onLog = (k, p) => keys.push(k); e.rng = () => 0.5; const s = globalThis.CR.state.createInitialState('medium'); e.drawInitialCards(s); e.startNewTurn(s); e.triggerEventPhase(s); e.applyEvent(s); e.endTurn(s); console.log('emitted', keys.length, 'keys;', keys.slice(0,3).join(' | '), '; all whitelisted:', keys.every(k => e.logKeys.includes(k))); console.log('hand', s.hand.length, 'turn', s.turn, 'maxTurns', s.maxTurns)"`，预期：`emitted` ≥ 4 个键、首键 `log.turn_begin`、`all whitelisted: true`、hand 6（初始 4 + 抽 2）、`turn 1 maxTurns 22`。

---

## Task 5: test/simulate.js — 全量重写（TDD 载体：旧 61 条适配（移除 1 条旧胜率断言）+ 新增 18 条 = 78 条）

**Files:**
- Modify: `/Users/haydenjiang/Downloads/cloud-republic/test/simulate.js`（整文件替换为下方完整代码）

**Interfaces:**
- Consumes: `require('../js/data.js')`、`require('../js/i18n.js')`、`require('../js/state.js')`、`require('../js/engine.js')`（Task 1–4 产物）
- Produces: 运行 `node test/simulate.js`，78 条断言，全绿退出码 0。结构：`freshState(difficultyKey?)`（默认 `'medium'`）、`cardById(id)`、`mulberry32(seed)`、`playGame(seed, difficultyKey)`（贪心 bot，与难度验收共用）
- TDD 顺序：本文件先写（Step 1），跑起来应有大片 FAIL（data/state/engine 未完成时）；Task 1–4 完成后转全绿。实际执行顺序建议：Task 1 → 2 → 3 → 4 → 5（每完成一个任务跑一次本文件看收敛）

- [ ] **Step 1: 整文件替换 test/simulate.js（完整代码如下）**
  ```js
  // test/simulate.js — deterministic mechanics tests & 3-difficulty full-game simulation.
  // No dependencies. Run from project root:  node test/simulate.js
  'use strict';

  require('../js/data.js');
  const i18n = require('../js/i18n.js');
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
  function freshState(difficultyKey) { return CR.state.createInitialState(difficultyKey || 'medium'); }
  function cardById(id) { return CR.data.CARD_DATABASE.find(c => c.id === id); }

  engine.onLog = null; // silence engine logs during tests (except log-key capture blocks)

  // ==================== [M1] Smoke ====================
  console.log('\n[M1] Smoke');
  engine.rng = mulberry32(12345);
  {
    const s = freshState();
    let threw = null;
    try {
      engine.drawInitialCards(s);
      engine.drawCard(s);
    } catch (e) { threw = e; }
    assert(threw === null, 'modules load; initial state + card draw runs without throwing' + (threw ? ' — ' + threw.message : ''));
    assert(s.hand.length === 5, 'hand holds 4 initial cards (medium) + 1 drawn card');
    assert(s.hand[0].id === 12 && s.maxHabitatExpansions === 5 && s.maxCardsPerTurn === 3, 'initial state intact (guaranteed card 12, 5 expansions, 3 plays/turn)');
  }

  // ==================== [M2] Difficulty config (NEW) ====================
  console.log('\n[M2] Difficulty config');
  {
    const s = freshState('easy');
    assert(s.maxTurns === 24 && s.corrosionRate === 1.5 && s.resources.materials === 100 && s.energyMaintenance === 4, 'easy config applied (turns/corrosion/materials/maintenance)');
  }
  {
    const a = freshState();
    const b = freshState('nonexistent');
    assert(a.difficulty === 'medium' && b.difficulty === 'medium', 'unknown/missing difficulty key falls back to medium');
  }
  {
    const s = freshState('hard');
    assert(s.maxTurns === 19 && s.corrosionRate === 2.5 && s.resources.research === 7 && s.initialHandSize === 3, 'hard config applied (turns/corrosion/research/hand size)');
  }
  {
    const s = freshState('easy');
    assert(s.hand.length === 1 && s.hand[0].id === 12 && typeof s.hand[0].uid === 'number', 'guaranteedCards pre-dealt into opening hand with uid (before drawInitialCards)');
  }

  // ==================== [M3] Resources, costs, payment (adapted from round 1) ====================
  console.log('\n[M3] Core engine: resources, costs');
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

  // ==================== [M4] Card effects (adapted from round 1) ====================
  console.log('\n[M4] Card effects');
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
    // playSelectedCards end-to-end
    const s = freshState();
    s.phase = 'action';
    engine.rng = mulberry32(42);
    const c5 = { ...cardById(5), uid: 9001 }; // trending: cost 8 money / 4 materials
    s.hand.push(c5);
    const moneyBefore = s.resources.money;
    s.selectedCards = [s.hand.length - 1];
    const r = engine.playSelectedCards(s);
    assert(r.ok === true, 'playSelectedCards returns {ok:true} in action phase');
    assert(!s.hand.some(c => c.uid === 9001) && s.selectedCards.length === 0, 'played card removed from hand, selection cleared');
    assert(s.resources.money === moneyBefore - 8 + 15, 'contract paid discounted cost then applied +15 Funds');
    const r2 = engine.playSelectedCards(s);
    assert(r2.ok === false && r2.reason === 'fail.no_selection', 'empty selection fails with fail.no_selection');
    s.phase = 'event';
    s.selectedCards = [0];
    const r3 = engine.playSelectedCards(s);
    assert(r3.ok === false && r3.reason === 'fail.not_action_phase', 'outside action phase rejected with fail.not_action_phase');
    s.phase = 'action';
  }

  // ==================== [M5] Turn system, crash handling, habitats (adapted from round 1) ====================
  console.log('\n[M5] Turn system, crash handling, habitats');
  {
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
    s.ultimate = true;
    s.insurance = true;
    const snap = { ...s.resources };
    engine.modifyResource(s, 'integrity', -200);
    assert(s.resources.integrity === 20 && s.ultimate === false && s.insurance === true && !s.gameOver && s.resources.money === snap.money && s.resources.materials === snap.materials && s.resources.energy === snap.energy && s.resources.research === snap.research, 'crash with both ultimate+insurance: ultimate takes priority, insurance retained');
  }
  {
    const s = freshState();
    engine.rng = () => 0.06; // roll = 2 (Solar Storm)
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
    assert(ev === null && s.shieldActive === false, 'card 27: shieldActive blocks the event and is consumed');
    engine.rng = mulberry32(7);
  }
  {
    const s = freshState(); // medium: materials 75
    s.phase = 'action';
    s.resources.integrity = 50;
    const r = engine.repairHabitat(s);
    assert(r.ok && s.resources.materials === 73 && s.resources.integrity === 51, 'base repair: -2 Materials, +1% Integrity');
    s.repairCostMultiplier = 0.75; s.repairEfficiency = 2;
    const r2 = engine.repairHabitat(s);
    assert(r2.ok && s.resources.materials === 71 && s.resources.integrity === 53, 'card 17+45: cost round(2*0.75)=2 Materials, +2% Integrity per repair');
    s.resources.materials = 0;
    const r3 = engine.repairHabitat(s);
    assert(!r3.ok && r3.reason === 'fail.no_materials_repair', 'repair fails with fail.no_materials_repair when materials insufficient');
  }
  {
    const s = freshState(); // medium: money 65 / materials 75
    s.phase = 'action';
    const r = engine.buildHabitat(s);
    assert(r.ok && s.habitats === 2 && s.resources.money === 45 && s.resources.materials === 63 && s.habitatExpansions === 1, 'buildHabitat: -20 Funds -12 Materials, +1 habitat');
    s.resources.money = 10; s.resources.materials = 5;
    const r2 = engine.buildHabitat(s);
    assert(!r2.ok && r2.reason === 'fail.build_cost', 'buildHabitat fails with fail.build_cost when resources insufficient');
    s.resources.money = 500; s.resources.materials = 500;
    s.habitatExpansions = 5;
    const r3 = engine.buildHabitat(s);
    assert(!r3.ok && r3.reason === 'fail.habitat_limit' && r3.reasonParams.max === 5, 'buildHabitat blocked at the shared 5-expansion limit (fail.habitat_limit + params)');
    const before = s.habitats;
    engine.applyContractEffect(s, cardById(62));
    assert(s.habitats === before, 'card 62 habitat expansion denied at the same shared limit');
  }
  {
    const s = freshState();
    s.turn = s.maxTurns; s.purification = 100; s.habitats = 6;
    engine.startNewTurn(s);
    assert(s.gameOver && s.gameResult === 'victory', 'turn maxTurns+1 with goals met = victory (timeout check)');
    const s2 = freshState();
    s2.turn = s2.maxTurns;
    engine.startNewTurn(s2);
    assert(s2.gameOver && s2.gameResult === 'defeat', 'turn maxTurns+1 without goals = defeat');
  }
  {
    const s = freshState();
    s.phase = 'action';
    s.permanentCards.push({ ...cardById(49), uid: 9002 }); // +3% purification / +4 research per turn
    engine.endTurn(s);
    assert(s.purification === 3, 'permanent card purification income applied each settlement');
  }

  // ==================== [M6] New iteration-2 mechanics (NEW) ====================
  console.log('\n[M6] Iteration-2 mechanics: 3-card limit, hand/draw limits, log keys, i18n');
  {
    // 3 cards per turn
    const s = freshState();
    s.phase = 'action';
    const c = [{ ...cardById(29), uid: 9101 }, { ...cardById(37), uid: 9102 }, { ...cardById(25), uid: 9103 }];
    c.forEach(x => s.hand.push(x));
    s.resources.money = 100; s.resources.research = 100;
    const before = s.hand.length;
    s.selectedCards = [before - 3, before - 2, before - 1];
    const r = engine.playSelectedCards(s);
    assert(r.ok && s.hand.length === before - 3 && s.cardsPlayedThisTurn === 3, 'up to 3 cards playable in one turn (maxCardsPerTurn=3)');
  }
  {
    // handLimit
    const s = freshState();
    s.handLimit = 2;
    s.hand = [{ ...cardById(1), uid: 9201 }, { ...cardById(3), uid: 9202 }];
    engine.drawCard(s);
    engine.drawCard(s);
    assert(s.hand.length === 2, 'drawCard blocked at state.handLimit');
  }
  {
    // drawPerTurn
    const s = freshState();
    s.phase = 'action';
    s.hand = [];
    engine.rng = mulberry32(9);
    engine.endTurn(s);
    assert(s.hand.length === s.drawPerTurn, 'endTurn draws exactly state.drawPerTurn cards');
  }
  {
    // log keys: full-turn capture, every key whitelisted + present in both dictionaries
    const s = freshState();
    engine.rng = mulberry32(2024);
    const seen = [];
    engine.onLog = (key, params) => seen.push([key, params]);
    engine.startNewTurn(s);
    engine.triggerEventPhase(s);
    engine.applyEvent(s);
    engine.playSelectedCards(s);
    engine.repairHabitat(s);
    engine.buildHabitat(s);
    engine.endTurn(s);
    engine.onLog = null;
    assert(seen.length > 0 && seen.every(([k]) => engine.logKeys.includes(k)), 'every emitted log key is in engine.logKeys whitelist');
    assert(seen.every(([, p]) => p !== null && typeof p === 'object'), 'every emitted log params is an object');
    const emitted = new Set(seen.map(([k]) => k));
    assert([...emitted].every(k => i18n.DICT.zh[k] !== undefined && i18n.DICT.en[k] !== undefined), 'every emitted log key exists in both zh and en dictionaries');
    assert(engine.logKeys.every(k => i18n.DICT.zh[k] !== undefined && i18n.DICT.en[k] !== undefined), 'every whitelisted log key has zh+en templates');
  }
  {
    // dictionary parity & t()
    const zhKeys = Object.keys(i18n.DICT.zh).sort().join(',');
    const enKeys = Object.keys(i18n.DICT.en).sort().join(',');
    assert(zhKeys === enKeys, 'i18n dictionary zh/en key sets are identical');
    assert(i18n.lang === 'zh' && i18n.t('btn.next_turn') === '下一回合', 'default lang is zh; t() renders zh');
    i18n.setLang('en');
    assert(i18n.t('log.turn_begin', { turn: 3, max: 22 }) === '=== TURN 3 / 22 BEGINS ===', 'setLang(en) + param interpolation works');
    i18n.setLang('zh');
    assert(i18n.t('nonexistent.key') === 'nonexistent.key', 't() falls back to the key itself when missing');
  }

  // ==================== [M7] Full-game simulation, 3 difficulties (NEW) ====================
  console.log('\n[M7] Full-game simulation (greedy bot, 500 seeded games per difficulty)');
  function incomeOf(s, key) {
    let n = 0;
    s.permanentCards.forEach(c => { const ve = c.venusEffect || {}; if (ve[key]) n += ve[key]; });
    return n;
  }
  function purEngineInHand(s) { return s.hand.some(c => c.id === 12 || c.id === 49); }
  function scoreCard(s, card) {
    const ve = card.venusEffect || {};
    const perm = card.type === 'permanent';
    let sc = 0;
    const energyCovered = incomeOf(s, 'energy') >= s.energyMaintenance + 1;
    const ramp = incomeOf(s, 'money') < 12;
    const needRes = purEngineInHand(s) && s.resources.research < 15;

    if (card.id === 12 || card.id === 49) sc += 10000;
    if (ve.purification) sc += 300 + ve.purification * (perm ? 40 : 5);
    if (perm && ve.energy > 0) sc += energyCovered ? 20 + ve.energy * 3 : 600 + ve.energy * 40;
    if (ve.energy < 0) sc -= 300;
    if (ve.research && (needRes || s.resources.research < 10)) sc += 400 + ve.research * 20;
    if (perm && ve.money) sc += (ramp ? 250 : 20) + ve.money * 8;
    if (perm && ve.materials) sc += s.habitats < s.targetHabitats ? 500 + ve.materials * 25 : 40 + ve.materials * 10;
    if (ve.habitat) sc += 120;
    if (ve.corrosion) sc += -ve.corrosion * 25;
    if (card.id === 1 || card.id === 7 || card.id === 42) sc += ramp ? 120 : 20;
    if (card.id === 17 || card.id === 45) sc += 15;
    sc += (ve.morale || 0) * 0.3 + (ve.money || 0) * (perm ? 0 : 0.5);
    return sc;
  }

  function playGame(seed, difficultyKey) {
    engine.rng = mulberry32(seed);
    engine.onLog = null;
    const s = CR.state.createInitialState(difficultyKey);
    engine.drawInitialCards(s);
    let guard = 0;
    while (!s.gameOver && guard++ < 100) {
      engine.startNewTurn(s);
      if (s.gameOver) break;
      engine.triggerEventPhase(s);
      engine.applyEvent(s);
      if (s.gameOver) break;

      if (!s.strike) {
        const saving = s.turn >= 8 && s.habitats < s.targetHabitats && s.purification < 100;
        let plays = 0, progressed = true;
        while (progressed && !s.gameOver) {
          progressed = false;
          const maxPlays = s.extraCardPlayed ? s.maxCardsPerTurn + 1 : s.maxCardsPerTurn;
          if (plays >= maxPlays) break;
          let best = -1, bestScore = 0, cycle = -1, cycleCost = Infinity;
          s.hand.forEach((card, i) => {
            if (!engine.canAfford(s, card)) return;
            const sc = scoreCard(s, card);
            const cost = engine.getCardCost(s, card);
            if (saving && sc < 250 && (s.resources.money - cost.money) < 20) return;
            if (s.habitats < s.targetHabitats && cost.materials > 0 && sc < 500) {
              const gives = (card.type === 'permanent' && (card.venusEffect || {}).materials > cost.materials * 0.5);
              if (!gives) return;
            }
            if (sc > bestScore) { bestScore = sc; best = i; }
            const total = cost.energy * 5 + cost.materials * 3 + cost.money + cost.research;
            if (total < cycleCost) { cycleCost = total; cycle = i; }
          });
          if (best < 0 && s.hand.length >= 4 && cycle >= 0) {
            if (!saving) best = cycle;
            else {
              const cc = engine.getCardCost(s, s.hand[cycle]);
              if (cc.materials === 0 && (s.resources.money - cc.money) >= 20) best = cycle;
            }
          }
          if (best >= 0) {
            s.selectedCards = [best];
            const r = engine.playSelectedCards(s);
            if (r.ok) { plays++; progressed = true; }
          }
        }
      }

      while (!s.gameOver && s.phase === 'action' && s.resources.integrity < 30) {
        const r = engine.repairHabitat(s); if (!r.ok) break;
      }
      const ready = s.turn >= 8 || s.purification >= 100;
      while (ready && !s.gameOver && s.phase === 'action' && s.habitats < s.targetHabitats) {
        const r = engine.buildHabitat(s); if (!r.ok) break;
      }
      if (s.gameOver) break;
      engine.endTurn(s);
    }
    return s;
  }

  function runBand(difficultyKey, lo, hi, games) {
    let wins = 0, defeats = 0, crashes = 0;
    for (let seed = 1; seed <= games; seed++) {
      const s = playGame(seed, difficultyKey);
      if (s.gameResult === 'victory') wins++;
      else if (s.gameResult === 'crash') crashes++;
      else defeats++;
    }
    const rate = wins / games * 100;
    console.log(`  ${difficultyKey}: ${wins} victories, ${defeats} defeats (timeout), ${crashes} crashes out of ${games} -> ${rate.toFixed(1)}% (target ${lo}-${hi}%)`);
    assert(rate >= lo && rate <= hi, `${difficultyKey} win rate ${rate.toFixed(1)}% within [${lo}, ${hi}]`);
  }

  runBand('easy', 60, 80, 500);
  runBand('medium', 30, 50, 500);
  runBand('hard', 10, 20, 500);

  // ==================== Summary ====================
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
  ```

- [ ] **Step 2: 全量运行**
  运行 `cd /Users/haydenjiang/Downloads/cloud-republic && node test/simulate.js`，预期 `78 passed, 0 failed`（M1 3 + M2 4 + M3 11 + M4 24 + M5 22 + M6 11 + M7 3 = 78），三档胜率打印值应分别为 ~67%、~40%、~16%（实测见附录 A；若某档出界，只允许微调 DIFFICULTY_LEVELS 中该档的 materials/money ±10 以内，重跑至落区间并同步修订计划附录 A 与 data.js——不允许改 bot 判定逻辑或放宽断言区间）。

- [ ] **Step 3: 计数复核**
  以运行输出 `78 passed, 0 failed` 为准（`grep -c 'assert('` 会把 runBand 内的 1 个调用点只数一次，得到 76，属预期）。

---

## Task 6: index.html — 开始界面 + data-i18n + 移除 turnBlocker

**Files:**
- Modify: `/Users/haydenjiang/Downloads/cloud-republic/index.html`（整文件替换为下方完整代码）

**Interfaces:**
- Consumes: i18n 字典键（Task 2）；ui.js 暴露的 window 全局函数（Task 7）：`startGame(key)`、`toggleLang()`、`closeEventModal()`、`playSelectedCards()`、`repairHabitat()`、`buildHabitat()`、`endTurn()`（Next Turn）
- Produces: DOM id（新增）：`startScreen`、`diffEasy`、`diffMedium`、`diffHard`、`langBtn`、`difficultyText`；**移除** `turnBlocker`、`blockerText`；`modalBtn` 文案由 JS 动态设置；脚本顺序 data → i18n → state → engine → ui
- data-i18n 约定：静态文本元素带 `data-i18n="key"`，`CR.ui.refreshTexts()` 批量填 `t(key)`；带占位符或动态内容的一律 JS 渲染（不加属性）

- [ ] **Step 1: 整文件替换 index.html（完整代码如下）**
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
      <div class="stars" id="stars"></div>

      <div class="end-screen" id="endScreen">
          <div class="end-title" id="endTitle">Game Over</div>
          <div class="end-reason" id="endReason"></div>
          <div class="score-board" id="scoreBoard"></div>
          <button class="btn" onclick="location.reload()" data-i18n="btn.play_again">Play Again</button>
      </div>

      <div class="end-screen" id="startScreen">
          <div class="game-title" style="font-size: 3rem;" data-i18n="ui.title">Cloud Republic</div>
          <p class="game-subtitle" data-i18n="ui.subtitle" style="margin-top: 10px;">Res Publica: Venus Floating City Colonization Project</p>
          <p style="color: var(--text-secondary); margin: 20px 0 5px;" data-i18n="ui.choose_difficulty">Choose a difficulty to start</p>
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 25px;" data-i18n="ui.start_hint">Complete purification and build habitats</p>
          <div style="display: flex; gap: 15px; flex-wrap: wrap; justify-content: center;">
              <button class="btn btn-success diff-btn" id="diffEasy" onclick="startGame('easy')"></button>
              <button class="btn diff-btn" id="diffMedium" onclick="startGame('medium')"></button>
              <button class="btn btn-danger diff-btn" id="diffHard" onclick="startGame('hard')"></button>
          </div>
      </div>

      <div class="modal-overlay" id="eventModal">
          <div class="modal-content">
              <div class="modal-title" id="modalTitle">Environmental Event</div>
              <div class="modal-text" id="modalText"></div>
              <button class="btn" id="modalBtn" onclick="closeEventModal()">Proceed</button>
          </div>
      </div>

      <div id="game-container">
          <header class="game-header">
              <button class="btn btn-secondary" id="langBtn" onclick="toggleLang()" style="position: absolute; top: 20px; right: 20px; padding: 8px 16px; font-size: 0.8rem;">EN</button>
              <h1 class="game-title" data-i18n="ui.title">Cloud Republic</h1>
              <p class="game-subtitle" data-i18n="ui.subtitle">Res Publica: Venus Floating City Colonization Project</p>
          </header>

          <div class="game-main">
              <div class="left-panel">
                  <div class="panel">
                      <div class="panel-title">
                          <span>&#9670;</span> <span data-i18n="ui.player_status">Player Status</span>
                      </div>
                      <div class="player-info">
                          <div class="player-avatar">P1</div>
                          <div class="player-details">
                              <h4 data-i18n="ui.faction">Player Faction</h4>
                              <span data-i18n="ui.habitat_alpha">Floating Habitat Alpha</span>
                          </div>
                      </div>
                      <div class="resource-grid" id="resourcePanel">
                          <div class="resource-item" id="res-money">
                              <div class="resource-label" data-i18n="res.money">&#128176; Funds</div>
                              <div class="resource-value">65</div>
                              <div class="resource-bar">
                                  <div class="resource-bar-fill" style="width: 65%; background: var(--accent-gold)"></div>
                              </div>
                          </div>
                          <div class="resource-item" id="res-materials">
                              <div class="resource-label" data-i18n="res.materials">&#129521; Materials</div>
                              <div class="resource-value">75</div>
                              <div class="resource-bar">
                                  <div class="resource-bar-fill" style="width: 75%; background: #a78bfa"></div>
                              </div>
                          </div>
                          <div class="resource-item" id="res-energy">
                              <div class="resource-label" data-i18n="res.energy">&#9889; Energy</div>
                              <div class="resource-value">25</div>
                              <div class="resource-bar">
                                  <div class="resource-bar-fill" style="width: 25%; background: var(--accent-cyan)"></div>
                              </div>
                          </div>
                          <div class="resource-item" id="res-research">
                              <div class="resource-label" data-i18n="res.research">&#128300; Research</div>
                              <div class="resource-value">8</div>
                              <div class="resource-bar">
                                  <div class="resource-bar-fill" style="width: 8%; background: var(--accent-purple)"></div>
                              </div>
                          </div>
                          <div class="resource-item" id="res-morale">
                              <div class="resource-label" data-i18n="res.morale">&#128522; Morale</div>
                              <div class="resource-value">70</div>
                              <div class="resource-bar">
                                  <div class="resource-bar-fill" style="width: 70%; background: var(--accent-green)"></div>
                              </div>
                          </div>
                          <div class="resource-item" id="res-integrity">
                              <div class="resource-label" data-i18n="res.integrity">&#128295; Integrity</div>
                              <div class="resource-value">100%</div>
                              <div class="resource-bar">
                                  <div class="resource-bar-fill" style="width: 100%; background: #6b7280"></div>
                              </div>
                          </div>
                      </div>
                  </div>

                  <div class="panel" style="margin-top: 20px;">
                      <div class="panel-title">
                          <span>&#9673;</span> <span data-i18n="ui.permanent_effects">Permanent Effects</span>
                      </div>
                      <div id="permanentCards" style="font-size: 0.85rem; color: var(--text-secondary);">
                          No permanent cards yet
                      </div>
                  </div>
              </div>

              <div class="center-area">
                  <div class="turn-info">
                      <div>
                          <div class="turn-phase" id="currentPhase">Setup Phase</div>
                          <div class="phase-indicator" id="phaseIndicator">
                              <div class="phase-dot" id="dot-event"></div>
                              <div class="phase-dot" id="dot-action"></div>
                              <div class="phase-dot" id="dot-settlement"></div>
                          </div>
                          <div class="turn-number"><span id="turnText">Turn 0 / 22</span></div>
                          <div class="turn-number" style="margin-top: 4px;"><span id="difficultyText"></span></div>
                      </div>
                      <div style="text-align: right;">
                          <div style="font-size: 0.85rem; color: var(--text-secondary);" data-i18n="ui.cards_selected">Cards Selected</div>
                          <div style="font-family: 'Orbitron'; font-size: 1.5rem; color: var(--accent-gold);" id="selectedCount">0/3</div>
                      </div>
                  </div>

                  <div class="panel public-track">
                      <div class="panel-title">
                          <span>&#127758;</span> <span data-i18n="ui.global_progress">Global Progress</span>
                      </div>
                      <div class="track-item">
                          <div class="track-header">
                              <span data-i18n="ui.purification_label">Sulfuric Acid Cloud Purification</span>
                              <span id="purificationText">0%</span>
                          </div>
                          <div class="track-bar-bg">
                              <div class="track-bar-fill purification-fill" id="purificationBar" style="width: 0%">
                                  <span id="purificationPercent">0%</span>
                              </div>
                          </div>
                      </div>
                      <div class="track-item">
                          <div class="track-header">
                              <span data-i18n="ui.habitat_count">Habitat Count</span>
                              <span id="habitatText">1 / Target: 6</span>
                          </div>
                      </div>
                  </div>

                  <div class="panel card-area" style="position: relative;">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                          <div class="panel-title" style="margin: 0;">
                              <span>&#127183;</span> <span data-i18n="ui.hand">Hand</span>
                          </div>
                          <div style="font-size: 0.8rem; color: var(--text-secondary);" id="handHint">
                              Click to select cards to play (max 3 per turn)
                          </div>
                      </div>
                      <div class="card-grid" id="handCards">
                      </div>
                      <div class="btn-group">
                          <button class="btn" id="playBtn" onclick="playSelectedCards()" disabled data-i18n="btn.play">Play Selected Cards</button>
                          <button class="btn btn-secondary" id="repairBtn" onclick="repairHabitat()" data-i18n="btn.repair">Repair (-2 Materials +1%)</button>
                          <button class="btn btn-secondary" id="buildHabitatBtn" onclick="buildHabitat()" data-i18n="btn.build">Build Habitat (-20 Funds -12 Materials)</button>
                      </div>
                      <div class="phase-actions" id="actionPhaseControls">
                          <button class="btn btn-success" id="endTurnBtn" onclick="endTurn()" data-i18n="btn.next_turn">Next Turn</button>
                      </div>
                  </div>

                  <div class="panel">
                      <div class="panel-title">
                          <span>&#128220;</span> <span data-i18n="ui.event_log">Event Log</span>
                      </div>
                      <div class="log-panel" id="gameLog">
                      </div>
                  </div>
              </div>

              <div class="right-panel">
                  <div class="panel">
                      <div class="panel-title">
                          <span>&#9888;&#65039;</span> <span data-i18n="ui.threats">Environmental Threats</span>
                      </div>
                      <div style="margin-bottom: 15px;">
                          <div class="track-header" style="margin-bottom: 8px;">
                              <span data-i18n="ui.corrosion_label">Sulfuric Acid Corrosion Rate</span>
                              <span style="color: var(--accent-rose);" id="corrosionRateText">-2%/turn</span>
                          </div>
                          <div class="track-bar-bg">
                              <div class="track-bar-fill corrosion-fill" id="corrosionBar" style="width: 0%"></div>
                          </div>
                      </div>
                      <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5;">
                          <p data-i18n="rules.integrity_decay">&#8226; Structural Integrity decreases per turn</p>
                          <p data-i18n="rules.crash">&#8226; Reaches 0 = Habitat Crash</p>
                          <p data-i18n="rules.repair">&#8226; Repair: 2 Materials = 1%</p>
                          <p data-i18n="rules.strike">&#8226; Morale &lt; 30: Workers Strike</p>
                      </div>
                  </div>

                  <div class="panel" style="margin-top: 20px;">
                      <div class="panel-title">
                          <span>&#128202;</span> <span data-i18n="rules.title">Game Rules</span>
                      </div>
                      <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.6;">
                          <p><strong style="color: var(--text-primary);" data-i18n="rules.defeat">Collective Defeat:</strong></p>
                          <p><strong style="color: var(--text-primary);" data-i18n="rules.victory">Collective Victory:</strong></p>
                          <p><strong style="color: var(--text-primary);" data-i18n="rules.personal">Personal Victory:</strong></p>
                          <br>
                          <p data-i18n="rules.maturity_header">Maturity Cost Multipliers:</p>
                          <p data-i18n="rules.maturity_1">&#9733; Driving x0.6 | &#9654; Trending x0.8</p>
                          <p data-i18n="rules.maturity_2">&#9650; Emerging x1.0 | &#9680; Signaling x1.3</p>
                          <p data-i18n="rules.maturity_3">&#9729; Brewing x1.5 (Requires Research &gt;=10)</p>
                      </div>
                  </div>
              </div>
          </div>
      </div>
      <script src="js/data.js"></script>
      <script src="js/i18n.js"></script>
      <script src="js/state.js"></script>
      <script src="js/engine.js"></script>
      <script src="js/ui.js"></script>
  </body>
  </html>
  ```

- [ ] **Step 2: 静态检查**
  运行 `grep -c 'turnBlocker\|blockerText\|setTimeout' /Users/haydenjiang/Downloads/cloud-republic/index.html`（预期 `0`）、`grep -c 'data-i18n' index.html`（预期 ≥ 30）、`grep 'script src' index.html` 顺序为 data/i18n/state/engine/ui。

---

## Task 7: js/ui.js — 文明式回合流 + i18n 渲染 + 性能优化（全文重写）

**Files:**
- Modify: `/Users/haydenjiang/Downloads/cloud-republic/js/ui.js`（整文件替换为下方完整代码）

**Interfaces:**
- Consumes: `CR.data`（含翻译字段）、`CR.i18n`、`CR.state.createInitialState`、`CR.engine` 全部函数（签名同 Task 4）
- Produces:
  - window 全局：`startGame(difficultyKey)`、`toggleLang()`、`closeEventModal()`、`playSelectedCards()`、`repairHabitat()`、`buildHabitat()`、`endTurn()`
  - `CR.ui = { refreshTexts() }`：data-i18n 批量刷新 + 动态区重渲染（供 `CR.i18n.setLang` 回调）
  - 回合流（无 setTimeout）：`startGame` → `startTurnFlow()`（事件弹窗，modalMode='event'）→ `closeEventModal`（applyEvent → 行动）→ `endTurn`（endTurn → 结算弹窗，modalMode='settlement'）→ `closeEventModal`（→ `startTurnFlow`）
- 性能：星空 1 个 div + box-shadow；renderHand 签名比对跳过重建

- [ ] **Step 1: 整文件替换 js/ui.js（完整代码如下）**
  ```js
  // ui.js — all DOM access lives here. Loaded last; requires CR.data / CR.i18n / CR.state / CR.engine.
  (function (root) {
    const CR = root.CR;
    const engine = CR.engine;
    const i18n = CR.i18n;
    const t = (key, params) => i18n.t(key, params);

    let state = null;
    let modalMode = null;        // null | 'event' | 'settlement'
    let modalContext = null;     // { event } for event mode (re-render on language switch)
    let lastHandSig = null;

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

    // engine log bridge: key + params -> localized text; cardId/eventId localized here
    function engineLog(key, params) {
      const p = { ...(params || {}) };
      if (p.cardId !== undefined) {
        const c = CR.data.CARD_DATABASE.find(x => x.id === p.cardId);
        if (c) p.card = i18n.lang === 'zh' ? (c.name_zh || c.name) : c.name;
      }
      if (p.eventId !== undefined) {
        const e = CR.data.EVENTS.find(x => x.id === p.eventId);
        if (e) p.event = i18n.lang === 'zh' ? (e.name_zh || e.name) : e.name;
      }
      if (key === 'log.game_over') p.result = t('result.' + p.result);
      addLog(t(key, p));
    }

    // ==================== STARFIELD (single div + box-shadow; was 100 DOM nodes) ====================

    function createStars() {
      const el = document.getElementById('stars');
      const w = window.innerWidth, h = window.innerHeight;
      const shadows = [];
      for (let i = 0; i < 120; i++) {
        const x = Math.floor(Math.random() * w);
        const y = Math.floor(Math.random() * h);
        const spread = Math.random() < 0.8 ? 0 : 1;
        const opacity = (0.3 + Math.random() * 0.7).toFixed(2);
        shadows.push(`${x}px ${y}px 0 ${spread}px rgba(255,255,255,${opacity})`);
      }
      el.style.width = '2px';
      el.style.height = '2px';
      el.style.boxShadow = shadows.join(',');
    }

    // ==================== LOCALIZED CARD TEXT ====================

    function cardName(card) { return i18n.lang === 'zh' ? (card.name_zh || card.name) : card.name; }
    function cardEffect(card) { return i18n.lang === 'zh' ? (card.effect_zh || card.effect) : card.effect; }

    // ==================== HAND RENDERING (dirty-signature; rebuild only when inputs change) ====================

    function handSig() {
      const r = state.resources;
      return [
        state.hand.map(c => c.uid).join(','),
        state.phase, state.strike, i18n.lang,
        r.money, r.materials, r.energy, r.research,
        state.transportDiscount, state.extraCardPlayed
      ].join('|');
    }

    function renderHand() {
      const sig = handSig();
      if (sig === lastHandSig) {
        updateSelectionClasses();
        return;
      }
      lastHandSig = sig;

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

        const typeName = t('type.' + card.type);
        const cost = engine.getCardCost(state, card); // discounted price (maturity x transportDiscount)

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

        if (canPlay) {
          cardEl.onclick = () => toggleCardSelection(index);
        }
        container.appendChild(cardEl);
      });
      updateSelectionClasses();
    }

    function updateSelectionClasses() {
      const container = document.getElementById('handCards');
      Array.from(container.children).forEach((el, index) => {
        el.classList.toggle('selected', state.selectedCards.includes(index));
      });
      const maxCards = state.extraCardPlayed ? state.maxCardsPerTurn + 1 : state.maxCardsPerTurn;
      document.getElementById('selectedCount').textContent = `${state.selectedCards.length}/${maxCards}`;
    }

    function toggleCardSelection(index) {
      if (state.phase !== 'action') return;
      if (state.strike) {
        addLog(t('fail.strike_cards'));
        return;
      }

      const card = state.hand[index];
      if (!engine.canAfford(state, card)) return;

      const pos = state.selectedCards.indexOf(index);
      if (pos > -1) {
        state.selectedCards.splice(pos, 1);
      } else {
        const maxSelect = state.extraCardPlayed ? state.maxCardsPerTurn + 1 : state.maxCardsPerTurn;
        if (state.selectedCards.length >= maxSelect) {
          addLog(t('ui.log.max_selected', { max: maxSelect }));
          return;
        }
        state.selectedCards.push(index);
      }

      updateSelectionClasses(); // no full rebuild (dirty-signature performance optimization)
      document.getElementById('playBtn').disabled = state.selectedCards.length === 0 || state.phase !== 'action';
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

    function renderModal() {
      const modalBtn = document.getElementById('modalBtn');
      if (modalMode === 'event') {
        const event = modalContext && modalContext.event;
        if (event) {
          const name = i18n.lang === 'zh' ? (event.name_zh || event.name) : event.name;
          const desc = i18n.lang === 'zh' ? (event.desc_zh || event.desc) : event.desc;
          document.getElementById('modalTitle').textContent = t('modal.event_title', { name });
          document.getElementById('modalText').textContent = desc;
          modalBtn.textContent = t('modal.apply_event');
        } else {
          document.getElementById('modalTitle').textContent = t('modal.neutralized_title');
          document.getElementById('modalText').textContent = t('modal.neutralized_text');
          modalBtn.textContent = t('modal.proceed');
        }
      } else if (modalMode === 'settlement') {
        document.getElementById('modalTitle').textContent = t('modal.settlement_title', { turn: state.turn });
        document.getElementById('modalText').textContent = t('modal.settlement_text', { difficulty: t('difficulty.' + state.difficulty) });
        modalBtn.textContent = t('btn.begin_turn', { turn: state.turn + 1 });
      }
    }

    function openModal(mode, context) {
      modalMode = mode;
      modalContext = context || null;
      renderModal();
      document.getElementById('eventModal').classList.add('active');
    }

    // ==================== END SCREEN ====================

    function showEndScreen() {
      const screen = document.getElementById('endScreen');
      const title = document.getElementById('endTitle');
      const reasonText = document.getElementById('endReason');
      const board = document.getElementById('scoreBoard');

      document.getElementById('eventModal').classList.remove('active');
      modalMode = null;
      screen.classList.add('active');

      if (state.gameResult === 'victory') {
        title.textContent = t('end.victory_title');
        title.style.color = 'var(--accent-gold)';
        reasonText.textContent = t('end.victory_text');
      } else if (state.gameResult === 'defeat') {
        title.textContent = t('end.defeat_title');
        title.style.color = 'var(--accent-rose)';
        reasonText.textContent = t('end.defeat_text', {
          purification: state.purification.toFixed(1),
          habitats: state.habitats
        });
      } else { // 'crash'
        title.textContent = t('end.crash_title');
        title.style.color = '#dc2626';
        reasonText.textContent = t('end.crash_text');
      }

      board.innerHTML = `
        <div class="score-card winner">
          <h3>${t('end.score_faction')}</h3>
          <div style="font-size: 2rem; color: var(--accent-gold); margin: 10px 0;">${state.contribution}</div>
          <div style="font-size: 0.85rem; color: var(--text-secondary);">
            ${t('end.habitats_score', { value: state.habitats * 20 })}<br>
            ${t('end.purification_score', { value: Math.floor(state.purification) })}<br>
            ${t('end.funds_score', { value: Math.floor(state.resources.money / 5) })}<br>
            ${t('end.prestige', { value: state.prestige })}
          </div>
        </div>
        <div class="score-card">
          <h3>${t('end.score_final')}</h3>
          <div style="margin-top: 10px; font-size: 0.9rem; line-height: 1.8; color: var(--text-secondary);">
            ${t('end.difficulty_label', { value: t('difficulty.' + state.difficulty) })}<br>
            ${t('end.turn_label', { value: state.turn + '/' + state.maxTurns })}<br>
            ${t('end.purification_label', { value: state.purification.toFixed(1) + '%' })}<br>
            ${t('end.habitats_label', { value: state.habitats })}<br>
            ${t('end.integrity_label', { value: state.resources.integrity.toFixed(1) + '%' })}<br>
            ${t('end.charter_label', { value: state.hasCharter ? t('end.charter_yes') : t('end.charter_no') })}
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

      document.getElementById('turnText').textContent = t('ui.turn_of', { turn: state.turn, max: state.maxTurns });
      document.getElementById('difficultyText').textContent = t('ui.difficulty_label') + ': ' + t('difficulty.' + state.difficulty);
      document.getElementById('currentPhase').textContent = t('phase.' + state.phase);

      document.getElementById('purificationText').textContent = state.purification.toFixed(1) + '%';
      document.getElementById('purificationBar').style.width = state.purification + '%';
      document.getElementById('purificationPercent').textContent = state.purification.toFixed(0) + '%';

      document.getElementById('habitatText').textContent = t('ui.habitat_target', { count: state.habitats, target: state.targetHabitats });

      const maxCards = state.extraCardPlayed ? state.maxCardsPerTurn + 1 : state.maxCardsPerTurn;
      document.getElementById('selectedCount').textContent = `${state.selectedCards.length}/${maxCards}`;
      document.getElementById('handHint').textContent = t('ui.hand_hint', { max: maxCards });

      document.getElementById('playBtn').disabled = state.selectedCards.length === 0 || state.phase !== 'action';
      document.getElementById('endTurnBtn').disabled = state.phase !== 'action';
      document.getElementById('buildHabitatBtn').disabled =
        state.phase !== 'action' ||
        state.strike ||
        state.habitatExpansions >= state.maxHabitatExpansions ||
        state.resources.money < 20 ||
        state.resources.materials < 12;

      document.getElementById('corrosionRateText').textContent = t('ui.corrosion_rate', { rate: state.corrosionRate });

      renderHand();

      const permContainer = document.getElementById('permanentCards');
      if (state.permanentCards.length === 0 && state.timedEffects.length === 0 && state.delayedEffects.length === 0) {
        permContainer.innerHTML = t('ui.no_permanents');
      } else {
        permContainer.innerHTML =
          state.permanentCards.map(c =>
            `<div style="padding: 4px 0; border-bottom: 1px solid var(--border);">
              <span style="color: var(--accent-cyan);">${cardName(c)}</span>
              <span style="font-size: 0.75rem; color: var(--text-secondary);"> - ${cardEffect(c)}</span>
            </div>`
          ).join('') +
          state.timedEffects.map(te => {
            const c = CR.data.CARD_DATABASE.find(x => x.id === te.cardId);
            const name = c ? cardName(c) : te.name;
            return `<div style="padding: 4px 0; border-bottom: 1px solid var(--border);">
              <span style="color: var(--accent-gold);">${t('perm.timed_remaining', { name, turns: te.turnsLeft })}</span>
            </div>`;
          }).join('') +
          state.delayedEffects.map(de => {
            const c = CR.data.CARD_DATABASE.find(x => x.id === de.cardId);
            const name = c ? cardName(c) : de.name;
            return `<div style="padding: 4px 0; border-bottom: 1px solid var(--border);">
              <span style="color: var(--accent-purple);">${t('perm.delayed_countdown', { name, turns: de.turnsLeft })}</span>
            </div>`;
          }).join('');
      }
    }

    // ==================== TURN FLOW (civ-style: fully player-driven, no timers) ====================

    function startTurnFlow() {
      engine.startNewTurn(state);
      if (state.gameOver) { showEndScreen(); return; }

      updateUI();
      updatePhaseIndicator();

      const event = engine.triggerEventPhase(state);
      openModal('event', { event }); // null event => neutralized modal
    }

    // ==================== GLOBAL ENTRY POINTS (inline onclick targets) ====================

    root.closeEventModal = function () {
      if (modalMode === 'event') {
        document.getElementById('eventModal').classList.remove('active');
        modalMode = null;

        engine.applyEvent(state);
        updateUI();
        updatePhaseIndicator();

        if (state.gameOver) { showEndScreen(); return; }

        if (state.strike) {
          addLog(t('ui.log.strike_action'));
        } else {
          const maxCards = state.extraCardPlayed ? state.maxCardsPerTurn + 1 : state.maxCardsPerTurn;
          addLog(t('ui.log.action_prompt', { max: maxCards }));
        }
      } else if (modalMode === 'settlement') {
        document.getElementById('eventModal').classList.remove('active');
        modalMode = null;
        startTurnFlow();
      }
    };

    root.playSelectedCards = function () {
      const result = engine.playSelectedCards(state);
      if (!result.ok) { addLog(t(result.reason, result.reasonParams)); return; }
      updateUI();
      if (state.gameOver) showEndScreen();
    };

    root.repairHabitat = function () {
      const result = engine.repairHabitat(state);
      if (!result.ok) addLog(t(result.reason, result.reasonParams));
      updateUI();
    };

    root.buildHabitat = function () {
      const result = engine.buildHabitat(state);
      if (!result.ok) addLog(t(result.reason, result.reasonParams));
      updateUI();
      if (state.gameOver) showEndScreen();
    };

    root.endTurn = function () { // the "Next Turn" button
      if (!state || state.phase !== 'action') return;

      engine.endTurn(state);
      updateUI();
      updatePhaseIndicator();

      if (state.gameOver) { showEndScreen(); return; }
      openModal('settlement'); // settlement summary parks until the player begins the next turn
    };

    root.startGame = function (difficultyKey) {
      document.getElementById('startScreen').classList.remove('active');

      state = CR.state.createInitialState(difficultyKey);
      lastHandSig = null;
      engine.drawInitialCards(state);
      updateUI();
      updatePhaseIndicator();

      addLog(t('ui.log.game_started', { difficulty: t('difficulty.' + state.difficulty) }));
      addLog(t('ui.log.goal', { turns: state.maxTurns }));
      addLog(t('ui.log.init_corrosion', { rate: state.corrosionRate }));

      startTurnFlow();
    };

    root.toggleLang = function () {
      i18n.setLang(i18n.lang === 'zh' ? 'en' : 'zh'); // setLang triggers CR.ui.refreshTexts()
    };

    // ==================== I18N REFRESH ====================

    function refreshTexts() {
      // static data-i18n elements
      document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
      });
      // language button shows the OTHER language
      document.getElementById('langBtn').textContent = t('ui.lang_btn');
      // difficulty buttons (name + description)
      ['easy', 'medium', 'hard'].forEach(key => {
        const btn = document.getElementById('diff' + key.charAt(0).toUpperCase() + key.slice(1));
        btn.innerHTML = `${t('difficulty.' + key)}<br><span style="font-size: 0.7rem; font-weight: 400; text-transform: none;">${t('difficulty.' + key + '_desc')}</span>`;
      });
      // dynamic areas
      if (state) {
        lastHandSig = null; // force hand rebuild in the new language
        updateUI();
        updatePhaseIndicator();
        if (modalMode) renderModal();
        if (state.gameOver) showEndScreen();
      }
    }

    CR.ui = { refreshTexts };

    // ==================== INIT ====================

    function boot() {
      i18n.init();
      engine.onLog = engineLog;
      createStars();
      refreshTexts();
      document.getElementById('startScreen').classList.add('active');
    }

    root.onload = boot;
  })(window);
  ```

- [ ] **Step 2: 静态检查**
  运行 `grep -c 'setTimeout\|turnBlocker' js/ui.js`（预期 `0`）、`node -e "require('./js/data.js');require('./js/i18n.js');require('./js/state.js');require('./js/engine.js');console.log('engine loads OK')"`。
  注意 ui.js 是浏览器专用（IIFE 参数为 `window`），不要尝试在 Node 中 require 它。

- [ ] **Step 3: 浏览器烟测（手工）**
  双击 index.html：开始界面三档按钮（默认中文）；选难度 → 第 1 回合事件弹窗；关闭后自由行动；「下一回合」→ 结算弹窗 →「开始回合 2」；header 语言按钮即时切换全界面语言；无任何自动等待。

---

## Task 8: styles.css — 追加迭代 2 样式（不改动既有 639 行）

**Files:**
- Modify: `/Users/haydenjiang/Downloads/cloud-republic/styles.css`（仅在文件末尾追加）

**Interfaces:**
- Consumes: 既有 `.stars`（fixed 全屏）与 `@keyframes twinkle`
- Produces: 星空单 div 的整体闪烁动画、难度按钮尺寸、header 相对定位（lang 按钮锚点）

- [ ] **Step 1: 在 styles.css 末尾追加以下完整块**
  ```css

  /* ==================== Iteration 2: start screen, i18n, starfield ==================== */
  /* Starfield is now a single 2px div + box-shadow dots (was 100 .star DOM nodes).
     The whole field pulses gently to approximate the old per-star twinkle. */
  .stars {
      animation: twinkle 4s ease-in-out infinite;
  }

  .diff-btn {
      min-width: 170px;
      padding: 16px 22px;
      line-height: 1.5;
  }

  .game-header {
      position: relative;
  }
  ```

- [ ] **Step 2: 确认既有样式未被修改**
  `wc -l styles.css` 应为 `639 + 追加行数`（追加块 18 行含注释与空行 → 657）；不用 git，用 `head -639 styles.css | tail -1` 确认第 639 行仍是原文件最后一行（`}`）。

---

## Task 9: README.md

**Files:**
- Create: `/Users/haydenjiang/Downloads/cloud-republic/README.md`

**Interfaces:**
- Consumes: 无
- Produces: 项目说明文档

- [ ] **Step 1: 创建 README.md（完整内容如下）**
  ```markdown
  # Cloud Republic: Venus Floating City

  单人卡牌策略游戏：在限定回合内完成金星硫酸云净化（100%）并建成 ≥6 个栖息地。
  纯原生 HTML/CSS/JS——无构建工具、无依赖、无 ES module，**双击 `index.html` 即玩**。

  ## 玩法

  1. 打开 `index.html`，在开始界面选择难度：**简单 / 中等 / 困难**。
  2. 每回合流程（完全由玩家驱动，无自动计时）：
     - 掷环境事件 → 弹窗展示 → 点击关闭进入行动阶段；
     - 行动阶段可任意顺序、任意组合地：**打出卡牌**（每回合最多 3 张）、**修理**（材料换完整度）、**建造栖息地**（20 资金 + 12 材料，与扩容卡共享 5 次上限）；
     - 点「下一回合」进入结算（永久产出、维护、腐蚀、士气、抽牌）→ 结算摘要 → 点「开始回合 N+1」。
  3. 胜负：回合耗尽时净化 ≥100% 且栖息地 ≥6 即集体胜利；完整度归 0 则坠毁（保险/意识上传可一次性挽回）。

  ## 难度

  | 难度 | 回合 | 腐蚀/回合 | 维护费 | 起始资源 | 模拟胜率（贪心 bot，500 局） |
  |---|---|---|---|---|---|
  | 简单 | 24 | -1.5% | -4 能源 | 充裕 | ~67% |
  | 中等 | 22 | -2% | -4 能源 | 标准 | ~38% |
  | 困难 | 19 | -2.5% | -5 能源 | 紧张 | ~14% |

  三档开局手牌均包含「痕量气体检测」（净化引擎卡），难度差异由经济参数承载（配置见 `js/data.js` 的 `DIFFICULTY_LEVELS`）。

  ## 中英文切换

  header 右上角「中文 / EN」按钮即时切换全界面语言（界面、卡牌、事件、日志、规则、结局），
  选择持久化在 `localStorage`，默认中文。

  ## 运行测试

  ```bash
  node test/simulate.js
  ```

  78 条断言：引擎机制（保险/延时/限时/折扣/修理/建造/回合流）、难度配置、日志键值、
  i18n 字典完备性、三档难度各 500 局胜率区间（简单 60–80% / 中等 30–50% / 困难 10–20%）。

  ## 目录结构

  ```
  cloud-republic/
  ├── index.html      # 结构标记（开始界面 / 游戏主界面 / 弹窗 / 结局）
  ├── styles.css      # 全部样式
  ├── js/
  │   ├── data.js     # 卡牌库、事件表、难度配置、中文翻译（纯数据）
  │   ├── i18n.js     # 双语字典 + t() + setLang()
  │   ├── state.js    # createInitialState(difficultyKey)
  │   ├── engine.js   # 纯逻辑：回合/资源/卡牌/胜负（不碰 DOM，日志为 key+params）
  │   └── ui.js       # 全部 DOM：渲染、弹窗、回合流、语言切换
  ├── test/
  │   └── simulate.js # Node 无依赖测试（机制断言 + 三档胜率模拟）
  └── docs/superpowers/  # 设计文档与实现计划
  ```
  ```

---

## Task 10: 全量干跑 + 手工验收

**Files:**
- 不新建/修改文件（验收与回归）

**Interfaces:**
- Consumes: 全部前序任务产物
- Produces: 验收结论

- [ ] **Step 1: 全量自动化回归**
  运行 `cd /Users/haydenjiang/Downloads/cloud-republic && node test/simulate.js`，预期 `78 passed, 0 failed`，退出码 0；三档胜率打印在区间内。

- [ ] **Step 2: 性能验收（首屏 DOM 节点数对比）**
  统计并记录（写入实现总结，目标值见附录 B 的实测数据）：
  ```bash
  # 旧结构（第一轮 index.html + 100 个 .star div）
  node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');console.log('static elements:', (h.match(/<[a-zA-Z]/g)||[]).length)"
  ```
  优化前 = 旧静态节点 + 100（星空）+ 手牌节点；优化后 = 新静态节点 + 1（星空单 div）+ 手牌节点。浏览器 Console 复核：`document.querySelectorAll('*').length`（开始界面）与开局后各一次，星空应只占 1 个节点。手牌脏标记复核：Console 里点选卡牌时 `document.getElementById('handCards').children` 的节点引用不变（不被重建）。

- [ ] **Step 3: 手工验收清单（浏览器打开 index.html，逐项核对 spec §6）**
  - [ ] 开始界面三档可选，按钮显示难度名与描述（当前语言）
  - [ ] 回合流无自动等待：事件弹窗不自动关闭、结算后停驻、点「开始回合 N+1」才推进；全程无 setTimeout 闪烁
  - [ ] 行动阶段出牌/修理/建造任意顺序任意组合；每回合最多打出 3 张（卡 25 打出后 4 张）
  - [ ] 语言切换：header 按钮切换后界面/卡牌/事件/日志新条目/规则/结局全部无漏译；刷新页面后语言保持（localStorage）
  - [ ] 结算与结局画面显示本局难度
  - [ ] 星空视觉无回归（静态星点 + 整体微闪烁，与原逐星闪烁差异不可察觉级别）
  - [ ] 三结局画面正常；罢工回合只能修理/结束回合

---

## 附录 A：难度调参干跑数据（2026-07-23，/tmp 完整组装实测）

### A.1 调参历程（贪心 bot 各 500 局）

| 阶段 | 配置要点 | easy | medium | hard |
|---|---|---|---|---|
| 基线（第一轮数值 + 3 张上限） | 原难度表初稿 | 2.0% | 0.4% | 0.0% |
| 富资源 easy | money 120/materials 80 起 | 9.4% | — | — |
| GOD 上限（200/150 起, dr3, hl14, 维护 0, 25 回合） | 测引擎天花板 | — | 46.2%（= pur100 率） | — |
| 抽牌流强化（handLimit 12 + drawPerTurn 3） | 富资源 | 11.0% | — | — |
| bot v8（能量安全+攒钱建造）+ guaranteed [12] | — | 26.0% | 5.4% | 0.0% |
| bot v11（材料保留+材料收入优先）+ guaranteed [12] | — | 37.8% | 10.4% | 0.2% |
| 最终配置（见下） | bot v11 不变 | **67.4%** | **39.8%** | **15.8%** |

关键诊断结论（全部有 instrumentation 数据）：

1. 净化轨道是硬瓶颈：66 张牌中仅卡 12（+10%/回合）是够强的净化引擎；卡 49（+3%）有 13 科研门槛。无保底时即使 GOD 经济 pur100 上限也只有 46.2%，中等难度实测 ~10–18%。`guaranteedCards: [12]` 是三档共用的决定性旋钮（打不出时 pur100≈0；打出即 ~100%），已在关键设计说明第 1 条标注——若用户否决需重开调参。
2. 能量维护费是抽牌流杀手：能源归 0 后全 deck 约 60% 卡牌永久卡手（实测 46% 对局前 8 抽无能源收入卡），hand 撑满后抽牌完全停止。三档 energyMaintenance 定为 4/4/5。
3. 栖息地轨道的瓶颈是材料而非资金（实测失败局结束资金均值 83、材料均值 13）：bot 对材料收入卡（48/57/6/15/66/43）给最高经济权重，且非材料收入卡不得消耗材料。

### A.2 最终配置与三组种子带实测（bot v11 未变，每组 500 局）

| 难度 | maxTurns | corrosion | 初始手牌 | handLimit | drawPerTurn | energyMaintenance | guaranteedCards | 资源 (money/materials/energy/research/morale/integrity) | 种子 1–500 | 501–1000 | 1001–1500 | 目标区间 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| easy | 24 | 1.5 | 4 | 8 | 2 | 4 | [12] | 90/100/35/10/80/100 | 67.4% | 68.8% | 68.6% | 60–80 ✓ |
| medium | 22 | 2 | 4 | 8 | 2 | 4 | [12] | 65/75/25/8/70/100 | 39.8% | 35.4% | 38.0% | 30–50 ✓ |
| hard | 19 | 2.5 | 3 | 8 | 2 | 5 | [12] | 50/55/20/7/60/100 | 15.8% | 12.6% | 13.6% | 10–20 ✓ |

simulate.js 的区间断言使用种子 1–500（67.4% / 39.8% / 15.8%，距区间边界均有 ≥4 个百分点余量）。

## 附录 B：spec 覆盖对照

| spec 条目 | 覆盖位置 |
|---|---|
| §2 难度系统（开始界面、DIFFICULTY_LEVELS、createInitialState(key)） | Task 1（配置表）+ Task 3（state）+ Task 6（开始界面）+ Task 7（startGame） |
| §2 胜率区间验收（简单 60–80 / 中等 30–50 / 困难 10–20） | Task 5（runBand × 3）+ 附录 A 调参数据 |
| §2 结算/结局显示难度 | Task 7（结算弹窗 modal.settlement_text + 结局 score-board） |
| §3 删除 setTimeout ×3 | Task 7（全文无 setTimeout；Step 2 grep 验证） |
| §3 事件弹窗玩家自行关闭 | Task 7（modalMode='event'，closeEventModal 才 applyEvent） |
| §3 出牌上限 2→3 | Task 3（maxCardsPerTurn: 3）+ Task 5（3 张断言）+ Task 7（selectedCount/handHint 动态 max） |
| §3 移除 turnBlocker | Task 6（HTML 删除）+ Task 7（无引用） |
| §3 Next Turn → 结算 → 摘要停驻 → 开始回合 N+1 | Task 7（endTurn → openModal('settlement') → closeEventModal → startTurnFlow） |
| §3 罢工保持原规则 | Task 4（fail.strike_cards / fail.strike_build）+ Task 7（按钮置灰） |
| §4 i18n.js（lang/t/setLang） | Task 2（完整字典） |
| §4 data-i18n 静态文本 | Task 6（全部静态元素）+ Task 7（refreshTexts） |
| §4 卡牌/事件 86 条翻译 | Task 1（CARD_ZH 66 + EVENT_ZH 20，全文） |
| §4 日志键值化（约 40 处） | Task 4（50 键白名单 logKeys + 全部调用点）+ Task 5（键断言） |
| §4 header 语言按钮 + localStorage + 默认 zh | Task 6（langBtn）+ Task 7（toggleLang）+ Task 2（init/setLang） |
| §4 加载顺序 data → i18n → state → engine → ui | Task 6（script 标签顺序） |
| §5 星空 100 DOM → 单 div + box-shadow | Task 7（createStars）+ Task 8（CSS）+ Task 10 Step 2（节点数对比） |
| §5 renderHand 脏标记 | Task 7（handSig + updateSelectionClasses）+ Task 10 Step 2（节点引用复核） |
| §6 README.md | Task 9 |
| §6 simulate.js 扩展（区间/3 张/日志键/难度配置 + 旧断言适配） | Task 5（78 条全量） |
| §6 手工验收 | Task 10 Step 3 |

## 附录 C：性能验收基线（本计划干跑时实测，供 Task 10 Step 2 核对）

- 旧 index.html 静态元素 **148** 个 + 星空 100 div = **248 节点**（未含手牌与日志动态节点）；
- 新 index.html 静态元素 **164** 个（含开始界面/语言按钮/难度显示等新增）+ 星空 1 div = **165 节点**；
- 首屏净减少 **83 个节点**（-33%），其中星空部分 -99。手牌区在选中切换时 0 重建（脏标记）。
- 统计口径：`index.html` 中 `<[a-zA-Z]` 标签数 + 星空节点数（干跑脚本实测，见 Task 10 Step 2 命令）。
