# Cloud Republic M1 · 视觉全套 + 主题自定义 + 本地战绩

日期：2026-07-23
项目目录：`~/Downloads/RES_REP/`（第三轮交付基础上：78/78 断言绿、Glassmorphism 已落地）
定位：精美硬核策略个人作品（用户访谈结论）；本轮只动视觉/前端，**engine/state/data 游戏逻辑零改动**

## 1. 范围（用户已授权全权落实）

1. **动效打磨**（纯 CSS/transform+opacity，无库）
2. **程序化卡面**（内联 SVG 生成，无图片资源）
3. **SVG 图标体系**（替换全部 emoji 与 Unicode 符号）
4. **界面主题自定义**（3 套主题 + 动画开关）
5. **本地战绩**（localStorage）

不做：玩法/卡牌/事件内容改动、音频、部署（M7）。

## 2. 动效打磨

- 出牌：卡牌从手牌飞出缩小，永久卡区新条目高亮脉冲一次
- 回合流：事件弹窗/结算摘要滑入（替代现有生硬显隐）
- 资源数值变化：滚动计数动画 + 变色闪烁（涨 #A7F3D0、降 #FF9B06）
- 结局：胜利 CSS 金色彩带粒子（box-shadow 技法，复用星空方案）；失败画面渐暗
- 统一缓动 `cubic-bezier(0.4, 0, 0.2, 1)`
- 全局动画开关 + 尊重 `prefers-reduced-motion`（见 §4）

## 3. 程序化卡面

- 每张卡顶部 ~56px 生成图案带：7 类别各一个 SVG 母题（经济=弧线金币、环境=云层、治理=立柱、社会=人形、科技=电路、福祉=十字、金星=浮空气泡）
- `card.id` 为种子做位置/密度轻微变化；成熟度决定描边色
- `cardArt(card)` 内联 SVG 生成函数（js/icons.js 或 ui.js 内，以计划为准），挂入 renderHand 模板
- handSig 脏标记已含 uid/语言，卡面为纯函数输出，不破坏缓存逻辑

## 4. 界面主题自定义

- 主题机制：`<html data-theme="venus|glacier|abyss">`，CSS 变量换肤；localStorage `cr_theme` 持久化；默认 venus（现有橙黄）
- 三套主题：
  - **venus 金星橙**（当前色板，默认）
  - **glacier 冰川蓝**（#7EA6FF 主强调的青蓝渐变）
  - **abyss 深空黑**（深底 + 原玻璃面板）
- 主题选择器：开始界面（难度按钮旁）+ 游戏内 header 小按钮循环切换
- 动画开关：`<html data-anim="off">` 时所有过渡/动画禁用；自动尊重 `prefers-reduced-motion: reduce`
- 语言/主题/动画三设置互不干扰，均 localStorage 持久化

## 5. SVG 图标体系

- 新建 `js/icons.js`：约 15 个描边风 SVG（6 资源 + 7 类别 + 5 成熟度 + 修理/建造/回合），`currentColor` 着色
- 替换：成本 emoji（💰🧱⚡🔬）、面板标题 emoji、成熟度 Unicode 符号（★▶▲◐☁）、按钮符号
- 加载顺序：data → i18n → icons → state → engine → ui
- 日志/规则说明等纯文本处的 emoji 可保留（内文符号不算 UI 图标，避免过度工程）

## 6. 本地战绩

- localStorage `cr_stats`：`{ games, wins: {easy, medium, hard, sandbox}, bestContribution, bestPurification }`
- 记录时机：`endGame` 结算时（ui 层写，engine 不动）
- 展示：开始界面小型玻璃战绩面板（场次/各难度胜场/最高贡献分）；结局画面若破纪录显示「新纪录」徽标
- 数据结构带版本字段 `v: 1`，读写 try/catch（隐私模式容错）

## 7. 结构与验收

- 新增：`js/icons.js`；改动：styles.css（追加动效/主题/卡面样式）、js/ui.js（卡面/图标/动效钩子/战绩/主题切换）、index.html（主题选择器/战绩面板/icons.js script 标签）
- 不新增任何外部资源/依赖/网络请求（保持完全离线）
- 验收：
  - `node test/simulate.js` 78/78 不回归（逻辑零改动）
  - `node --check` 全部 js 通过
  - 首屏 DOM 节点 ≤ 400（SVG 图标会增加节点，放宽自 165 基线，报告中实测）
  - 无任何 http(s) 外链资源（grep 验证）
  - 手工目检：三主题观感、动效流畅、卡面图案、图标统一、战绩记录/新纪录、动画开关生效、双语不破版
