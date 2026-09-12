# Cloud Republic 架构

当前采用原生 JavaScript 分层与功能控制器，继续支持 `file://` 双击运行。普通脚本按 `index.html` 的顺序加载，所有模块挂载在唯一命名空间 `CR`；无需构建工具。

## 边界

- `data` 定义内容和参数；`state` 构造单局状态；`engine` 执行规则；`progression` 计算局外奖励。规则代码不依赖 DOM 或持久化。
- `storage` 负责浏览器存储访问、旧版本兼容和配置校验。现有键名保持兼容：`cr_stats` v1→v2，`cr_meta`、`cr_sandbox`、`cr_deck` v1，以及语言、主题、动画、阵营偏好。
- `meta-ui`、`sandbox-ui`、`deck-ui`、`tech-ui` 是工厂函数，分别拥有对应功能状态。`ui.js` 在启动时组装它们，传入翻译、图标、动作注册表及所需回调；科技树通过 `getState()` 读取当前对局。
- `game-session` 是对局的命令边界：它创建/恢复单局状态，并处理 `selectCard`、`acknowledgeEvent`、`beginNextTurn`、出牌、修理、建造、结算和科技解锁等命令。它没有 DOM 依赖；`ui.js` 只调用该控制器、渲染状态并处理动画/弹窗。HTML 使用 `data-action` 和 JSON `data-args`，由文档级点击监听器分发至私有注册表。卡牌使用元素级事件监听。没有 `window.startGame` 等全局操作函数。

存储异常时同一页面会话使用内存备用值；刷新后无法保证保留。偏好、统计、传承与开局配置继续使用原有键名。进行中对局以 `cr_active_game` v1 自动保存：快照包含完整状态、命令历史和可序列化随机数状态；恢复时会检查版本、基础资源、牌库 ID 和状态形状。结束对局会清除该快照。存档只保证同一内容版本内恢复；不兼容的未来版本会安全忽略。

## 引擎事件

```js
const unsubscribe = CR.engine.subscribe(({ key, params }) => {
  // 观察规则事件，例如 log.tech_unlocked；由消费者负责翻译和展示。
});
unsubscribe();
```

同步通知按订阅顺序执行，事件及参数对象浅冻结。订阅者应只观察、不修改状态，且不应抛错；错误会向调用方传播。旧 `onLog(key, params)` 回调保留兼容，界面已改用订阅。事件是现有规则日志的结构化通知，尚非完整的操作记录或可回放事件流。

## 验证与演进

运行 `node test/simulate.js` 和 `node test/architecture.js`。前者检查规则与确定性平衡指标，后者在 DOM 替身中检查模块组合和主要操作流程。

真实浏览器验收还应覆盖：开局、弹窗关闭、动态构筑按钮、科技购买、语言切换、下一回合、结局统计、刷新后偏好恢复，以及事件、行动、结算三个阶段的刷新恢复。本次工具环境禁止访问 `file://` 页面，未完成真实浏览器验收。

保留 `RES-REPBLIC.html` 作为历史原型，并在页面顶部标记归档，避免与主入口混淆。若未来接受本地服务/构建步骤，再迁移 ES Modules；当前控制器边界可直接用于该迁移。
