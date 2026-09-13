# Cloud Republic 第三轮迭代 · Glassmorphism UI 重设计 + 手牌重叠修复

日期：2026-07-23
项目目录：`~/Downloads/RES_REP/`（用户已将项目从 cloud-republic/ 移入此目录，78/78 断言绿）

## 1. 需求（已与用户确认）

1. **Bug 修复**：卡牌上「永久/合同」类型徽标（`.card-type-badge`，绝对定位 top-left）与卡片顶部文档流文本重叠。
2. **UI/UX 重设计**：采用 Glassmorphism 玻璃拟态风格，并以清晰排版与网格纪律作为设计原则。
   - 主色：`#FFFFFF`、`#FFCD70`、`#A7F3D0`、`#7EA6FF`
   - 主字体：SF Pro / 萍方（PingFang SC）
   - 背景：**橙黄色渐变**（用户拍板，Venus 云层风）

## 2. 设计令牌

- 背景：橙黄系 CSS 渐变 + 径向光晕；星空保留但减淡（纯 CSS，无图片资源）
- 玻璃面板（项目设计参数）：
  - `background: rgba(255,255,255,0.15)`
  - `backdrop-filter: blur(20px)`（带 `-webkit-` 前缀）
  - `border: 1px solid rgba(255,255,255,0.25)`
  - `box-shadow: 0 8px 32px rgba(31,38,135,0.37)`
  - 顶部高光 `inset 0 1px 0 rgba(255,255,255,0.4)`
- 色板映射：
  - `#FFFFFF` 主文字；`#FFCD70` 主强调/选中/资金；`#A7F3D0` 成功/净化/完整度；`#7EA6FF` 科研/信息
  - 辅色 `#A78BFA`（治理紫）、`#FF9B06`（警示/腐蚀橙）；中性 `#E2E6F0 / #CBD5E1 / #94A3B8`
- 字体栈：`-apple-system, 'SF Pro Display', 'PingFang SC', 'Helvetica Neue', sans-serif`；删除 Orbitron 的 Google Fonts `@import`（顺带实现完全离线）

## 3. 范围与方案

- **styles.css 全文重写**：所有组件（面板/卡牌/按钮/弹窗/结局画面/开始界面/进度条/日志/资源条）玻璃化；三栏布局结构不变；类别色条保留（颜色映射到新色板）。
- **卡牌头部修复**：`renderHand`（js/ui.js）卡牌头部由「绝对定位徽标 + 文档流类别名」改为正常文档流 header 行：左侧类型徽标（永久/合同）、右侧类别名，成熟度圆点保留右上角 absolute 但卡片 padding 预留空间。三者不再可能重叠。
- **JS 改动仅限** ui.js 的 renderHand 卡牌模板（结构调整，无逻辑变化；handSig 脏标记不受影响）。
- **index.html**：仅在需要时微调（如删除 Google Fonts 相关的 preconnect——实际只有 styles.css 内的 @import，HTML 无改动则不动）。

## 4. 不做（YAGNI）

- 不改布局结构（三栏）、不改交互逻辑、不动 engine/state/data/i18n。
- 不引入任何 CSS 框架/预处理器/图片资源/网络字体。

## 5. 验收

- `node test/simulate.js` 78/78 不回归；`node --check js/ui.js` 通过。
- 首屏 DOM 节点数不高于 165（基线）。
- 浏览器目检清单：玻璃模糊质感可见（橙黄渐变背景上）、卡牌「永久/合同」徽标与任何文字无重叠、中英文切换下均不破版、三个难度按钮/弹窗/结局画面风格统一、无网络字体请求（离线可玩）。
