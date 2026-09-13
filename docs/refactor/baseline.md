# 重构基线

冻结日期：2026-09-12
基准提交：d61d3da 之上的当前工作树
冻结策略：现有未提交改动整体视为重构输入，不拆分、不覆盖。

## 当前未提交改动归属

- index.html、styles.css、js/ui.js、各 feature UI、js/icons.js：现有 UI/UX、动效、响应式与可访问性改进。
- js/engine.js、test/simulate.js：非有限数值保护与净化进度下限回归修正。
- test/architecture.js：安全文本节点与结算弹窗 Escape 行为回归测试。

## 可执行基线

- node test/simulate.js：171 passed，0 failed。
- node test/architecture.js：脚本顺序、功能页、动作分发、语言、回合、存储和确定性续局通过。
- npm run test:unit：23 个新架构契约与新旧对照测试通过；包含 easy/medium/hard 三组完整回合重放。
- npm run test:e2e：系统 Chrome 下桌面、Pixel 7 与减少动效共 9 个基线测试通过。
- git diff --check：通过。
- 旧存档样本：test/fixtures/legacy-active-game-v1.json。
- 视觉样本：test/e2e/baseline.spec.ts-snapshots/（开始页、事件弹窗、行动面板）。

## 产品约束

- 当前 index.html 必须保持可直接打开和离线运行。
- 本次平衡调整已获明确授权：可调整难度参数、扩建成本和卡牌数值；胜负条件与页面流程保持不变。
- 新旧内核并行期间，旧 UI 仍由 js/ 目录驱动；新实现位于 src/，只有通过对照测试的能力才允许切换。
- 存档迁移失败必须返回明确原因，禁止静默写坏或覆盖旧存档。

## 已知基线风险

- 旧引擎的开局洗牌仍有模块级 RNG 边界；新 reducer 的结算、抽牌与弃牌堆洗回已经由状态内 RNG 驱动并完成三组种子对照。
- 内容数据中存在重复键和若干基于卡牌 ID 的效果分支；迁移前先补内容 schema 与行为对照，避免顺手改变平衡。
- 视觉截图由 Playwright 在桌面、移动端与减少动效三种配置下维护。
