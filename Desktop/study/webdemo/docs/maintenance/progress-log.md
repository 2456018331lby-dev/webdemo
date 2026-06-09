# Progress Log

## 2026-06-09 (设置中心本机备份恢复预览)

### 本机恢复逻辑
- `apps/web/src/lib/local-app-backup.ts` 增加备份文本解析、schema 校验、恢复计划生成和计划应用
- 恢复计划按状态拆分为 `restore / overwrite / missing / redacted / invalid / unknown`
- 实际写回只允许 `restore` 和 `overwrite` 的非敏感 JSON 状态；缺失项不删除当前本机状态
- Push subscription 原始订阅始终跳过，只允许保留当前浏览器订阅，避免把脱敏摘要误当成可恢复密钥
- 坏 JSON、旧 schema 和导出时已标记 `parseError` 的条目会被拒绝或跳过

### 设置中心 UI
- `/settings` 的本机备份卡片升级为“导出与恢复本机操作状态”
- 新增隐藏文件输入和“选择备份文件”动作，读取 JSON 后展示恢复预览
- 预览展示备份文件名、生成时间、可恢复/覆盖/跳过数量，以及每个状态项的恢复原因
- 点击“恢复可恢复项”后立即同步当前页面的偏好、通知队列、通知筛选视图和推送同步快照状态
- 移动端恢复预览自动单列，长文件名和 storage key 使用换行保护，避免 393px 视口横向溢出

### 测试与验证
- `npm test -- --run apps/web/src/lib/local-app-backup.test.ts`：4 个测试通过，覆盖备份解析、恢复计划、Push subscription 跳过和坏数据拒绝
- `npm run lint`：通过
- `npm test`：23 个文件 / 98 个测试全部通过
- `npm run build`：通过，`/settings` page size 约 17.6 kB
- `npx playwright test --reporter=list`：15 个 production e2e 测试通过
- 新增 e2e 覆盖：
  - `/settings` 上传本机备份 JSON 后显示恢复预览
  - 断言可恢复 2 项、覆盖 1 项、跳过 1 项，并显示 Push subscription “脱敏跳过”
  - 点击恢复后 UI 默认入口/密度同步为备份值
  - 断言本机收藏写入，同时当前浏览器 Push subscription endpoint 没有被备份摘要覆盖
- Playwright MCP 手动渲染验证：
  - Browser Node 控制路径未暴露；本轮按前端测试约定回退到 Playwright MCP
  - `/settings` 桌面 `1366x900`：恢复预览可见，`scrollWidth=1366`，无 Next.js overlay
  - 点击恢复后 `role="status"` 显示“已恢复 2 项本机状态”，默认入口为 `devices`，密度为 `compact`，Push subscription 仍保留当前浏览器 endpoint
  - `/settings` 移动端 `393x852`：`scrollWidth=393`，恢复面板宽 319px，恢复按钮宽 285px，三条恢复项均在视口内
  - Console errors / page errors: 0
- 截图证据：
  - `C:\Users\24560\Desktop\study\webdemo\output\qa-settings-local-backup-restore-chromium.png`

### GitHub 状态
- 本轮本地 commit 已完成：`80875f4` (`Make local backups recoverable without restoring secrets`)
- 按用户要求优先尝试 GitHub MCP：`mcp__github.list_commits` 返回 `Bad credentials`，当前 MCP 凭据仍不可用
- GitHub CLI 认证有效，已通过 GitHub Git Data API fallback 发布远程 commit：`de46cbd4d94972afea51fe0a6f7ae6e14d542ab5`
- 发布目标为远程默认分支 `hermeswork` 的 `Desktop/study/webdemo/` 子树，本轮更新 8 个文件；远程 sibling 目录未触碰
- 远程核验通过：已能读取更新后的 `Desktop/study/webdemo/apps/web/src/lib/local-app-backup.ts` 和 `Desktop/study/webdemo/tests/e2e/prod-shell.spec.ts`

---

## 2026-06-09 (设置中心本机备份导出)

### 本机备份逻辑
- 新增 `apps/web/src/lib/local-app-backup.ts`，统一枚举当前本机已知 `localStorage` 状态项
- 备份内容覆盖用户偏好、设备收藏、设备/活动日志/通知筛选视图、通知收件箱、推送同步快照和 Push subscription 摘要
- Push subscription 使用脱敏读取路径，只导出 schema、创建时间、过期时间、端点指纹和 key 是否存在，不导出 endpoint / p256dh / auth 原文
- 文件名复用导出 helper，生成 `smart-home-local-state-YYYY-MM-DD.json`

### 设置中心 UI
- `/settings` 新增“导出本机操作状态”卡片，说明备份范围和敏感字段处理方式
- 卡片展示覆盖状态项、敏感处理和后续迁移用途，保持与设置中心已有深色卡片系统一致
- 移动端将导出按钮和三项指标改为单列满宽布局，避免 393px 视口横向溢出

### 测试与验证
- `npm test -- --run apps/web/src/lib/local-app-backup.test.ts`：2 个测试通过，覆盖文件名/状态收集和 Push subscription 脱敏
- `npm run lint`：通过
- `npm test`：23 个文件 / 96 个测试全部通过
- `npm run build`：通过，`/settings` page size 约 16.2 kB
- `npx playwright test --reporter=list`：14 个 production e2e 测试通过
- 新增 e2e 覆盖：
  - `/settings` 写入本机偏好、收藏和 Push subscription 测试数据后点击“导出本机备份”
  - 断言下载文件名为 `smart-home-local-state-YYYY-MM-DD.json`
  - 断言备份 JSON 包含偏好和脱敏 Push subscription 摘要
  - 断言下载内容不包含 endpoint、p256dh 和 auth 原文
- Playwright MCP 手动渲染验证：
  - Browser Node 控制路径未暴露；本轮按前端测试约定回退到 Playwright MCP / CLI screenshot
  - `/settings` 桌面约 `1280x900`：备份卡片可见，点击后 `role="status"` 显示“已导出本机数据备份”，无横向溢出
  - `/settings` 移动端 `393x852`：`scrollWidth=393`，导出按钮满宽，三项指标单列收拢
  - Console errors / page errors: 0；浏览器安装提示信息为非错误日志
- 截图证据：
  - `C:\Users\24560\Desktop\study\webdemo\output\qa-settings-local-backup-chromium.png`
  - `C:\Users\24560\AppData\Local\Temp\webdemo-settings-local-backup-desktop.png`
  - `C:\Users\24560\AppData\Local\Temp\webdemo-settings-local-backup-mobile.png`

### GitHub 状态
- 本轮本地 commit 已完成：`928da2c` (`Let operators export local app state safely`)
- 按用户要求优先尝试 GitHub MCP：`mcp__github.list_commits` 返回 `Bad credentials`，当前 MCP 凭据仍不可用
- GitHub CLI 认证有效，已通过 GitHub Git Data API fallback 发布远程 commit：`c12cf134941c9eb9ce47cded695dba8435f0637d`
- 发布目标为远程默认分支 `hermeswork` 的 `Desktop/study/webdemo/` 子树，本轮更新 8 个文件；远程 sibling 目录未触碰
- 远程核验通过：已能读取 `Desktop/study/webdemo/apps/web/src/lib/local-app-backup.ts` 和 `Desktop/study/webdemo/tests/e2e/prod-shell.spec.ts`

---

## 2026-06-09 (离线恢复面板与 PWA 兜底优化)

### 离线恢复逻辑
- 新增 `OfflineRecoveryPanel` client component，集中处理 `/offline` 的浏览器在线状态检测
- 面板初始化为 `checking`，挂载后读取 `navigator.onLine`，并监听 `online/offline` 事件同步状态
- 在线时提供“回到控制台”，离线时提供“重新检测”，同时保留“查看最近日志”排障入口
- 状态文案使用 `role="status"` / `aria-live="polite"`，方便恢复状态被读屏和自动化测试识别

### 离线页 UI
- `/offline` 从单列静态提示升级为 hero + 恢复面板双栏布局，移动端自动收敛为单列
- 恢复面板增加状态条、恢复检查清单和直接动作，减少用户在 PWA 离线兜底页的下一步不确定性
- 离线路由下安装提示改为 compact 形态，保留安装入口，但避免移动端固定提示遮挡恢复按钮
- 移除 `/offline` 页面内联 `gridTemplateColumns`，改用 `.offline-hero-layout` 和响应式 CSS

### 测试与验证
- `npm test -- --run apps/web/src/app/offline/offline-recovery-panel.test.tsx`：2 个测试通过，覆盖离线重试态和 `online` 事件后的回到控制台态
- `npm run lint`：通过
- `npm test`：22 个文件 / 94 个测试全部通过
- `npm run build`：通过，`/offline` 仍为静态 prerendered route，page size 约 986 B
- `npx playwright test --reporter=list`：13 个 production e2e 测试通过
- 新增 e2e 覆盖：
  - `/offline` 在移动端 smoke 中断言恢复状态显示“网络已恢复”
  - 断言恢复面板提供“回到控制台”和“查看最近日志”动作
- Playwright MCP 手动渲染验证：
  - Browser 控制路径未暴露 Node REPL 控制工具；本轮按前端测试技能回退到 Playwright MCP
  - `/offline` 桌面 `1366x900`：`scrollWidth=1366`，恢复面板可见，状态为“网络已恢复，可以返回控制台”
  - `/offline` 移动端 `393x852`：`scrollWidth=393`，恢复按钮可见，compact 安装提示未遮挡恢复动作
  - “查看最近日志”点击后导航到 `/activity`
  - Console errors / page errors: 0
- 截图证据：
  - `C:\Users\24560\AppData\Local\Temp\webdemo-offline-recovery-desktop.png`
  - `C:\Users\24560\AppData\Local\Temp\webdemo-offline-recovery-mobile.png`

### GitHub 状态
- 本轮本地 commit 已完成：`Make offline recovery actionable inside the PWA shell`
- 按用户要求尝试 GitHub MCP：`mcp__github.list_commits` 返回 `Bad credentials`，当前 MCP 凭据不可用
- GitHub CLI 认证有效，但 native git fetch/push 仍无法连接 `github.com:443`
- 已通过 GitHub Git Data API fallback 发布远程 commit：`80fbe5b5d059cfa3a83c40c329d91111806aa346`
- 发布目标为远程默认分支 `hermeswork` 的 `Desktop/study/webdemo/` 子树，本地 109 个 tracked 文件已同步；远程 sibling 目录未触碰
- 后续仍需要修复 GitHub MCP 凭据 / native git transport，并决定是否把远程仓库布局清理为干净的 webdemo 根目录

---

## 2026-06-08 (首页操作摘要与优先队列)

### 首页逻辑
- 新增 `apps/web/src/lib/landing-dashboard.ts`，把首页设备统计、房间焦点和优先处理项从页面 JSX 中抽出
- 首页聚合改为跨房间并行读取运行态和命令历史，保留 `applyLifecyclePolicies()` 后再生成首屏摘要
- 房间焦点现在使用运行态在线状态和最新遥测选择 featured device，避免使用过期 mock 在线字段
- 优先处理项改为结构化 action queue：离线设备进入总览，超时/失败命令进入日志；稳定状态进入设备墙

### 首页 UI
- 首页 stat 颜色改为语义 class，移除首页 stat 内联颜色样式
- “优先处理”卡片新增可点击 CTA，直接把用户带到对应排障页面
- hero 三个主操作统一成清晰按钮；移动端使用两列布局，“安装到手机”按钮跨整行，避免首屏像散落文本

### 测试与验证
- `node ./node_modules/vitest/vitest.mjs run apps/web/src/lib/landing-dashboard.test.ts`：2 个测试通过
- `npm run lint`：通过
- `npm test`：21 个文件 / 92 个测试全部通过
- `npm run build`：通过，`/` page size 约 163 B
- `npx playwright test`：13 个 production e2e 测试通过
- 新增 e2e 覆盖：
  - 首页 hero “打开总览”链接 scoped 到 hero，避免与优先队列 CTA 混淆
  - “优先处理”卡片显示 `1 台设备离线`，并提供“打开总览”CTA
- Playwright MCP 手动渲染验证：
  - Browser 插件已安装，但当前会话没有暴露其要求的浏览器控制工具；本轮按前端测试技能回退到 Playwright MCP
  - `/` 桌面 `1280x900`：`scrollWidth=1280`，hero 三个 CTA 均为按钮形态，优先处理 CTA 可见
  - `/` 移动端 `393x852`：`scrollWidth=393`，hero action 宽 327px，“安装到手机”按钮宽 327px 并跨整行
  - Console errors / page errors: 0

### GitHub 状态
- 本轮本地 commit 已完成：`Turn the homepage into an actionable command brief`
- `git push github main` 未成功：Git 返回 `Recv failure: Connection was reset`
- 真实远程推送仍需要更新/确认 GitHub token，并确认当前网络可以稳定访问 GitHub

---

## 2026-06-08 (/homes 全局健康快照刷新反馈)

### 全局健康逻辑
- `HomesClient` 新增 `fetchHomeSnapshots()`，手动刷新和轮询共用同一条 `/api/homes/snapshot` 读取路径
- 新增最近更新时间状态，成功刷新后取最新 `evaluatedAt`；刷新失败时保留上一份快照并显示“继续显示上次快照”
- 聚合统计改为 `useMemo`，避免刷新状态切换时重复无意义归约

### 全局健康 UI
- `/homes` hero 新增“刷新状态”按钮和 `role="status"` 刷新反馈条
- 全局健康页剩余多处内联样式迁移到 CSS class，包括状态数值色、家庭告警面板、房间设备数、设备卡片底部和徽标行
- `.hero` 装饰层改为不可滚动裁剪，修复刷新交互后隐藏横向滚动导致 hero 标题/按钮被左移裁切的问题

### 测试与验证
- `node ./node_modules/vitest/vitest.mjs run apps/web/src/app/homes/homes-client.test.tsx`：2 个测试通过
- `npm run lint`：通过
- `npm test`：20 个文件 / 90 个测试全部通过
- `npm run build`：通过，`/homes` page size 约 2.52 kB
- `npx playwright test`：13 个 production e2e 测试通过
- 新增 e2e 覆盖：
  - `/homes` 手动刷新会使用 mock `/api/homes/snapshot` 更新家庭、设备、超时徽标和最近更新时间
  - 独立 Playwright context 阻断 service worker，避免 PWA 缓存拦截 mock API
  - 刷新后断言页面无横向溢出，hero 标题、操作区和最近更新时间保持在 hero 卡片内
- Playwright MCP 手动渲染验证：
  - Browser 插件已安装，但当前会话没有暴露其要求的 Node 控制工具；本轮按前端测试技能回退到 Playwright MCP
  - `/homes` 桌面 `1280x900`：刷新后 `scrollWidth=1280`，hero left 24px，标题/按钮/更新时间 left 57px，内容未裁切
  - `/homes` 移动端 `393x852`：刷新后 `scrollWidth=393`，hero left 16px，标题/按钮/更新时间 left 33px，底部导航未遮挡首屏控件
  - Console errors / page errors: 0；唯一 warning 为测试中有意阻断 service worker 以稳定 mock API

### GitHub 状态
- 本轮本地 commit 已完成：`Make home health snapshots visibly refreshable`
- `git push github main` 未成功：GitHub 返回 `Invalid username or token. Password authentication is not supported for Git operations.`
- 真实远程推送仍需要更新/确认 GitHub token，并确认当前网络可以稳定访问 GitHub

---

## 2026-06-08 (设备筛选视图持久化)

### 设备筛选逻辑
- `apps/web/src/lib/device-list.ts` 新增 `smart-home-device-filter-view-v1` 本机筛选视图 schema
- 新增保存视图解析、序列化、创建和防御归一化，坏数据会回退到默认设备筛选
- 新增设备筛选 active 判定，页面可统一禁用无效的“重置筛选 / 清除筛选”

### 设备页 UI
- `/devices` 新增“保存设备视图 / 恢复视图 / 清除保存”操作
- 保存视图会记录关键词、设备类型、在线状态和“只看收藏”，刷新后自动恢复常用排障/巡检组合
- 搜索框和下拉筛选补充 `aria-label`，方便自动化测试和键盘/读屏用户定位
- 复用活动日志的保存视图栏样式，避免为同类布局新增重复 CSS

### 测试与验证
- `node ./node_modules/vitest/vitest.mjs run apps/web/src/lib/device-list.test.ts`：6 个测试通过
- `npm run lint`：通过
- `npm test`：19 个文件 / 88 个测试全部通过
- `npm run build`：通过，`/devices` page size 约 5.51 kB
- 首次直接执行 `npx playwright test tests/e2e/prod-shell.spec.ts` 命中了旧 `next start` 进程，出现 stale build / 400 resource 噪声；替换为当前构建的 fresh production server 后重跑通过
- `npx playwright test tests/e2e/prod-shell.spec.ts -g "devices page persists saved device filter views"`：1 个 e2e 测试通过
- `npx playwright test tests/e2e/prod-shell.spec.ts`：12 个 production e2e 测试通过
- 新增 e2e 覆盖：
  - 收藏主灯继电器后保存“继电器 + 在线 + 只看收藏 + 搜索‘继电器’”设备视图
  - 刷新 `/devices` 后自动恢复筛选视图
  - 清除当前筛选后可恢复保存视图
  - 清除保存后移除 `smart-home-device-filter-view-v1`
- Playwright MCP 手动渲染验证：
  - Browser 插件已安装，但当前会话没有暴露其要求的 Node REPL 控制工具；本轮按前端测试技能回退到 Playwright MCP
  - `/devices` 桌面 `1280x900`：保存视图后 `scrollWidth=1280`，保存视图栏宽 1166px，刷新恢复筛选，清除保存移除本机记录
  - `/devices` 移动端 `393x852`：保存视图恢复后 `scrollWidth=393`，保存视图栏宽 319px，操作按钮均在视口内
  - Console errors / page errors: 0

### GitHub 状态
- 本轮未执行 `git push github main`
- 远程推送仍需要更新/确认 GitHub token，并确认当前网络可以稳定访问 GitHub

---

## 2026-06-08 (活动日志筛选视图持久化)

### 活动日志逻辑
- `apps/web/src/lib/activity-logs.ts` 新增 `smart-home-activity-log-view-v1` 本机筛选视图 schema
- 活动日志筛选规则收敛到 `getFilteredActivityLogs()`，页面、导出和测试共用同一套查询/类型/级别过滤逻辑
- 新增保存视图解析、序列化、创建和防御归一化，坏数据会回退到默认筛选

### 活动页 UI
- `/activity` 新增“保存日志视图 / 恢复视图 / 清除保存”操作
- 保存视图会记录关键词、日志类型和日志级别，刷新后自动恢复常用排障视图
- 筛选结果说明会显示是否应用筛选条件；无筛选时禁用“清除筛选”
- 搜索框和下拉筛选补充 `aria-label`，方便自动化测试和键盘/读屏用户定位

### 测试与验证
- `node ./node_modules/vitest/vitest.mjs run apps/web/src/lib/activity-logs.test.ts`：2 个测试通过
- `npm run lint`：通过
- `npm test`：19 个文件 / 87 个测试全部通过
- `npm run build`：通过，`/activity` page size 约 4.59 kB
- `npx playwright test tests/e2e/prod-shell.spec.ts`：11 个 production e2e 测试通过
- 新增 e2e 覆盖：
  - 保存“排风扇 + 告警 + 警告”的活动日志视图
  - 刷新 `/activity` 后自动恢复筛选视图
  - 清除当前筛选后可恢复保存视图
  - 清除保存后移除 `smart-home-activity-log-view-v1`
- Playwright MCP 手动渲染验证：
  - Browser 插件已安装，但当前会话没有暴露其要求的 Node REPL 控制工具；本轮按前端测试技能回退到 Playwright MCP
  - `/activity` 桌面 `1280x900`：保存视图恢复后 `scrollWidth=1280`，保存视图栏宽 1166px，按钮未越界
  - `/activity` 移动端 `393x852`：保存视图恢复后 `scrollWidth=393`，保存视图栏宽 319px，按钮均在视口内
  - Console errors / page errors: 0

### GitHub 状态
- 本轮本地 commit 已完成
- `git push github main` 未成功：Git 返回 `Recv failure: Connection was reset`
- amend 后再次执行 `git push github main` 仍未成功：Git 返回 `Recv failure: Connection was reset`
- 最终重试 `git push github main` 仍未成功：Git 返回 `Failed to connect to github.com port 443 after 21053 ms: Could not connect to server`
- 再次最终重试 `git push github main` 仍未成功：GitHub 返回 `Invalid username or token. Password authentication is not supported for Git operations.`
- 真实远程推送仍需要更新/确认 GitHub token，并确认当前网络可以稳定访问 GitHub

---

## 2026-06-08 (通知筛选视图持久化)

### 筛选视图逻辑
- `apps/web/src/lib/notification-inbox.ts` 新增 `smart-home-notification-inbox-view-v1` 本机筛选视图 schema
- 新增保存视图解析、序列化、创建和防御归一化，坏数据会回退到默认筛选而不破坏设置页
- 高级筛选 active 判定下沉到通知 helper，避免页面和测试重复维护筛选默认值

### 设置中心 UI
- `/settings` 通知收件箱新增“保存当前视图 / 恢复视图 / 清除保存”操作
- 保存视图会记录当前 tab、关键词、设备、优先级和来源筛选，并在刷新后自动恢复
- 新增保存视图摘要，例如 `已保存视图：未读 / 搜索“空气” / 设备：空气质量传感器`
- 移动端保存视图栏自动换行，按钮保持在 393px 视口内
- `.gitignore` 新增 `.playwright-mcp/`，避免本地渲染 QA 控制台日志污染工作区

### 测试与验证
- `node ./node_modules/vitest/vitest.mjs run apps/web/src/lib/notification-inbox.test.ts`：7 个测试通过
- `npm run lint`：通过
- `npm test`：18 个文件 / 85 个测试全部通过
- `npm run build`：通过；第一次构建在旧生产进程退出期间出现 Windows worker 中断，重试后通过
- `npx playwright test tests/e2e/prod-shell.spec.ts`：10 个 production e2e 测试通过
- 新增 e2e 覆盖：
  - 保存未读 + 搜索“空气” + 设备筛选视图
  - 刷新 `/settings` 后自动恢复筛选视图
  - 清除当前筛选后可恢复保存视图
  - 清除保存后移除 `smart-home-notification-inbox-view-v1`
- Playwright MCP 手动渲染验证：
  - Browser 插件已安装，但当前会话没有暴露其要求的 Node REPL 控制工具；本轮按前端测试技能回退到 Playwright MCP
  - `/settings` 桌面 `1280x900`：保存视图恢复后 `scrollWidth=1280`，保存视图栏宽 1166px，按钮未越界
  - `/settings` 移动端 `393x852`：保存视图恢复后 `scrollWidth=393`，保存视图栏宽 319px，按钮均在视口内
  - Console errors / page errors: 0

### GitHub 状态
- 本轮本地 commit 已完成
- `git push github main` 未成功：GitHub 返回 `Invalid username or token. Password authentication is not supported for Git operations.`
- amend 后再次执行 `git push github main` 仍未成功：GitHub 返回 `Invalid username or token. Password authentication is not supported for Git operations.`
- 真实远程推送仍需要更新 GitHub token，并确认当前网络可以稳定访问 GitHub

---

## 2026-06-07 (PWA 推送订阅同步状态与失效提示)

### 推送同步逻辑
- `apps/web/src/lib/push-notifications.ts` 新增 push subscription 同步快照 schema，保存端点指纹、同步时间和后续可替换的同步目标
- 新增订阅同步健康判断：缺少订阅、端点待同步、端点变更、订阅过期、订阅超过 30 天和快照有效
- 端点指纹只保存本地短 hash + endpoint tail，避免在本机同步状态中重复展示完整 endpoint

### 设置中心 UI
- `/settings` PWA 推送卡新增“订阅同步状态”面板，展示健康标题、状态标签、端点指纹、订阅年龄、过期时间和上次同步时间
- 新增“记录同步快照 / 清除快照 / 重新订阅”动作；无 VAPID 公钥时会阻止重新订阅并显示阻塞原因
- 移动端同步面板和按钮改为单列满宽，避免 393px 视口横向溢出

### 测试与验证
- `node ./node_modules/vitest/vitest.mjs run apps/web/src/lib/push-notifications.test.ts`：6 个测试通过
- `npm run lint`：通过
- `npm test`：18 个文件 / 84 个测试全部通过
- `npm run build`：通过，`/settings` page size 约 12.3 kB
- `npx playwright test tests/e2e/prod-shell.spec.ts`：9 个 production e2e 测试通过
- 新增 e2e 覆盖：
  - `/settings` 已有浏览器订阅但无同步快照时提示“端点待同步”
  - 点击“记录同步快照”后写入 `smart-home-push-subscription-sync-v1` 并显示“端点同步快照有效”
  - 订阅创建时间超过 30 天后显示“建议重新订阅”和阻塞原因
- Playwright MCP 手动渲染验证：
  - Browser 插件已安装，但当前会话没有暴露其要求的 Node REPL 控制工具；本轮按前端测试技能回退到 Playwright MCP
  - `/settings` 桌面 `1280x900`：记录同步快照后 `scrollWidth=1280`，同步面板宽 1166px，按钮未越界
  - `/settings` 移动端 `393x852`：陈旧订阅状态 `scrollWidth=393`，同步面板宽 319px，按钮宽 289px 且均在视口内
  - Console errors / page errors: 0

### GitHub 状态
- 本轮本地 commit 已完成
- `git push github main` 未成功：第一次 Git 返回 `Recv failure: Connection was reset`
- amend 后再次执行 `git push github main` 仍未成功：Git 返回 `Failed to connect to github.com port 443 after 21082 ms: Could not connect to server`
- 最终提交后再次执行 `git push github main` 仍未成功：GitHub 返回 `Invalid username or token. Password authentication is not supported for Git operations.`
- 真实远程推送仍需要更新/确认 GitHub token，并确认当前网络可以稳定访问 GitHub

---

## 2026-06-07 (通知收件箱高级筛选)

### 筛选逻辑
- `apps/web/src/lib/notification-inbox.ts` 新增高级筛选结构：关键词、设备、优先级、来源
- `getVisibleNotificationInboxItems()` 现在在原有全部/未读/关键/归档 tab 基础上继续应用高级筛选
- 新增 `getNotificationInboxDeviceOptions()`，按当前通知策略生成设备筛选选项和数量，避免页面重复统计逻辑

### 设置中心 UI
- `/settings` 通知收件箱新增搜索框，可搜索标题、消息、设备 ID、设备名称和投递渠道
- 新增“按设备 / 按优先级 / 按来源”下拉筛选，支持批量缩小通知历史
- 新增“清除筛选”和实时结果说明，例如 `当前显示 1 条通知，已应用搜索条件`
- 移动端筛选面板改为单列，避免 393px 视口横向溢出

### 测试与验证
- `node ./node_modules/vitest/vitest.mjs run apps/web/src/lib/notification-inbox.test.ts`：6 个测试通过
- `npm run lint`：通过
- `npm test`：18 个文件 / 82 个测试全部通过
- `npm run build`：通过，`/settings` page size 约 11 kB
- `npx playwright test tests/e2e/prod-shell.spec.ts`：8 个 production e2e 测试通过
- 新增 e2e 覆盖：
  - 搜索“空气”只显示空气质量通知
  - 按设备筛选 `device-sensor-02` 只显示对应设备通知
  - 按关键优先级筛选只显示离线关键告警
- Playwright MCP 手动渲染验证：
  - Browser 插件已安装，但当前会话没有暴露其要求的 Node REPL 控制工具；本轮按前端测试技能回退到 Playwright MCP
  - `/settings` 桌面 `1280x900`：搜索“空气”后 `scrollWidth=1280`，结果说明显示 1 条通知
  - `/settings` 移动端 `393x852`：搜索“空气”后 `scrollWidth=393`，筛选面板宽 319px，控件未越界
  - Console errors / page errors: 0

### GitHub 状态
- 本轮本地 commit 已完成
- `git push github main` 未成功：GitHub 返回当前 remote token 无效
- 真实远程推送仍需要更新 GitHub token，并确认当前网络可以稳定访问 GitHub

---

## 2026-06-07 (通知收件箱与投递历史)

### 收件箱逻辑
- 新增 `apps/web/src/lib/notification-inbox.ts`，提供本机通知队列 schema、seed 数据、解析/序列化、规则过滤、关键优先级过滤、未读/归档状态更新和收件箱摘要
- 通知收件箱保存到 `localStorage["smart-home-notification-inbox-v1"]`，后续可替换为账号或 Supabase 同步
- 当前通知规则会影响收件箱可见项；启用“仅关键事件”时只保留关键通知，关闭对应触发规则会从收件箱视图隐藏该类通知

### 设置中心 UI
- `/settings` 顶部统计新增“通知收件箱”，显示未读数量和关键未读数量
- 设置中心新增“投递历史与待处理提醒”区块，包含策略内通知、未读、关键未读、安静时段延后四个指标
- 新增收件箱筛选：全部 / 未读 / 关键 / 归档
- 新增通知操作：全部标为已读、单条恢复未读、单条归档、清除归档
- “发送本地测试通知”现在会把投递结果写入收件箱，形成可追踪的应用内历史

### 测试与验证
- `node ./node_modules/vitest/vitest.mjs run apps/web/src/lib/notification-inbox.test.ts`：5 个测试通过
- `npm run lint`：通过
- `npm test`：18 个文件 / 81 个测试全部通过
- `npm run build`：通过，`/settings` page size 约 10.2 kB
- `npx playwright test tests/e2e/prod-shell.spec.ts`：8 个 production e2e 测试通过
- 新增 e2e 覆盖：
  - `/settings` 默认收件箱显示离线告警
  - 全部标为已读后未读数归零
  - 恢复未读、归档、清除归档完整路径
  - 本地测试通知写入 `smart-home-notification-inbox-v1`
- Playwright MCP 手动渲染验证：
  - Browser 插件已安装，但当前会话没有暴露其要求的 Node REPL 控制工具；本轮按前端测试技能回退到 Playwright MCP
  - `/settings` 桌面 `1280x900`：`scrollWidth=1280`，收件箱显示 `未读 2`，操作按钮未越界
  - `/settings` 移动端 `393x852`：`scrollWidth=393`，收件箱卡宽 361px，首条通知宽 319px，按钮未越界
  - Console errors / page errors: 0

### GitHub 状态
- 本轮本地 commit 已完成
- `git push github main` 未成功：GitHub 返回当前 remote token 无效
- 真实远程推送仍需要更新 GitHub token，并确认当前网络可以稳定访问 GitHub

---

## 2026-06-07 (PWA 推送权限与订阅就绪接入)

### 推送接入
- `/settings` 新增 PWA 推送接入卡片，展示通知权限、Service Worker、PushManager、VAPID 公钥和订阅端点的真实就绪状态
- 新增通知权限申请、PushManager 订阅创建和本地测试通知动作；订阅记录缓存到 `localStorage["smart-home-push-subscription-v1"]`
- 新增 `apps/web/src/lib/push-notifications.ts`，集中处理推送就绪状态机、订阅记录序列化和 VAPID base64url 转换
- `public/sw.js` 新增 `push` 和 `notificationclick` 处理器，支持展示推送通知、聚焦已有窗口或打开通知目标 URL

### 测试与验证维护
- `tests/e2e/prod-shell.spec.ts` 新增 deterministic `Notification` mock，避免本机浏览器权限状态污染 production e2e
- Playwright 截图增加一次重试，降低偶发 protocol capture 失败对 QA 的影响
- 新增 e2e 覆盖：
  - `/settings` 默认通知权限状态显示“等待用户授权通知”和“尚未授权通知权限”阻塞项
  - `/settings` 模拟已授权后显示“等待 VAPID 公钥”，并可触发本地测试通知状态提示

### 测试与验证
- `node ./node_modules/vitest/vitest.mjs run apps/web/src/lib/push-notifications.test.ts`：4 个测试通过
- `npm run lint`：通过
- `npm test`：17 个文件 / 76 个测试全部通过
- `npm run build`：通过，`/settings` page size 约 7.87 kB
- `npx playwright test tests/e2e/prod-shell.spec.ts`：7 个 production e2e 测试通过
- Playwright MCP 手动渲染验证：
  - `/settings` 桌面 `1280x900`：PWA 推送卡显示“等待 VAPID 公钥 / 待公钥”，`scrollWidth=1280`
  - `/settings` 移动端 `393x852`：PWA 推送卡宽度 361px，动作按钮不溢出，`scrollWidth=393`
  - Console errors / page errors: 0

### GitHub 状态
- 本轮本地 commit 已完成
- `git push github main` 未成功：GitHub 返回当前 remote token 无效
- 真实远程推送仍需要更新 GitHub token，并确认当前网络可以稳定访问 GitHub

---

## 2026-06-07 (设置中心：用户偏好与通知策略)

### 用户偏好 / 通知设置
- `/settings` 从单纯设备配置页升级为设置中心：个人偏好、通知策略预览、通知渠道、触发规则、设备维护合并到同一入口
- 新增本机持久化偏好：默认入口、控制台密度、安静时段、通知渠道、通知触发规则
- 偏好保存到 `localStorage["smart-home-user-preferences-v1"]`，带 schema 版本和容错解析
- 通知策略预览会根据渠道、关键事件模式和安静时段实时更新

### 设备维护逻辑
- 设备编辑现在会真实更新当前页面列表，不再只是模拟保存提示
- 添加新设备会真实插入维护列表，默认处于待配网/离线状态
- 重启设备会刷新本地状态和最近在线时间
- 恢复出厂会将设备标记为离线并归入“未分配”

### 样式维护
- 新增设置中心 CSS：双栏偏好布局、通知开关、策略预览、维护设备卡片、编辑模态框和移动端降栏
- `/settings` 大量固定 inline style 收敛为 class，保留设备维护列表入场动画延迟这一处动态 inline style
- 移动端 `393px` 下设置开关和设备维护卡片无横向溢出

### 测试与验证
- `node ./node_modules/vitest/vitest.mjs run apps/web/src/lib/user-preferences.test.ts`：4 个测试通过
- `npm run lint`：通过
- `npm test`：16 个文件 / 72 个测试全部通过
- `npm run build`：通过，`/settings` page size 约 5.54 kB
- `npx playwright test tests/e2e/prod-shell.spec.ts`：6 个 production e2e 测试通过
- 新增 e2e 覆盖：
  - `/settings` 取消 PWA 推送后写入本机偏好，刷新后保持关闭
  - 恢复默认偏好后 PWA 推送重新启用
  - 编辑设备名称后设备维护列表即时更新
- Playwright MCP 手动渲染验证：
  - `/settings` 桌面 `1280x900`：`scrollWidth=1280`，偏好保存/恢复默认可见，localStorage 已写入默认偏好
  - `/settings` 移动端 `393x852`：`scrollWidth=393`，设置开关和设备维护卡片无横向溢出
  - Console errors / page errors: 0

### GitHub 状态
- 本轮本地 commit 已完成
- `git push github main` 未成功：Git 返回连接被重置
- 远程推送仍需要更新/确认 GitHub token，并确认当前网络可以稳定访问 GitHub

---

## 2026-06-07 (活动/设备数据导出)

### 导出功能
- `/activity` 新增“导出 CSV / 导出 JSON”，导出内容与当前日志筛选结果一致
- `/devices` 新增“导出 CSV / 导出 JSON”，导出内容与当前设备筛选/收藏状态一致
- 下载文件名使用 `activity-logs-YYYY-MM-DD.*` / `devices-YYYY-MM-DD.*`

### 逻辑与样式维护
- 新增 `apps/web/src/lib/export-data.ts`，集中处理 CSV 转义、JSON 序列化、日期文件名、活动日志/设备导出行映射和浏览器下载
- 活动日志页面复用已有 `form-control`、`devices-filter-grid`、`badge`、`devices-empty-state` 等样式类，删除大段固定 inline style
- 设备类型/活动类型/日志级别标签改为共享 helper，避免页面内重复 switch 逻辑
- 新增导出控件响应式样式，保证桌面和移动端按钮不重叠、不横向溢出

### 测试与验证
- `npm run lint`：通过
- `npm test`：15 个文件 / 68 个测试全部通过
- `npm run build`：通过，`/activity` page size 约 3.67 kB，`/devices` page size 约 4.67 kB
- `npx playwright test tests/e2e/prod-shell.spec.ts`：5 个 production e2e 测试通过
- 新增 e2e 覆盖：
  - `/activity` CSV 下载文件名与内容
  - `/devices` JSON 下载文件名与 UI 收藏后的 `favorite: true`
- Playwright MCP 手动渲染验证：
  - `/activity` 桌面 `1280x900`：`scrollWidth=1280`，导出按钮无重叠
  - `/activity` 移动端 `393x852`：`scrollWidth=393`，导出按钮正常换行
  - `/devices` 桌面 `1280x900`：`scrollWidth=1280`，全局健康 + 导出按钮无重叠
  - `/devices` 移动端 `393x852`：`scrollWidth=393`，动作按钮正常排列
  - Console errors / page errors: 0

### GitHub 状态
- 本轮本地 commit 已完成
- `git push github main` 未成功：GitHub 返回当前 remote token 无效
- 远程推送仍需要先更新 GitHub token

---

## 2026-06-07 (设备收藏与只看收藏筛选)

### 设备列表功能
- `/devices` 新增本机设备收藏：每张设备卡片右上角可收藏 / 取消收藏
- 新增收藏设备区，常用设备会形成快捷入口
- 新增“只看收藏”筛选，收藏设备在完整列表中优先排序
- 收藏状态持久化到 `localStorage["smart-home-device-favorites-v1"]`

### 逻辑与样式维护
- 新增 `apps/web/src/lib/device-list.ts`，集中处理设备扁平化、筛选排序、收藏解析/序列化/切换
- `/devices` 页面明显的固定 inline style 收敛到 CSS class，页面只保留卡片入场延迟这一处动态 inline style
- 设备卡片从整张 `Link` 改为 `article + 收藏按钮 + 查看与控制 Link`，避免按钮嵌套在链接中

### 测试与验证
- `node ./node_modules/vitest/vitest.mjs run apps/web/src/lib/device-list.test.ts`：5 个测试通过
- `npm run lint`：通过
- `npm test`：14 个文件 / 64 个测试全部通过
- `npm run build`：通过，`/devices` page size 约 3.58 kB
- `npx playwright test tests/e2e/prod-shell.spec.ts`：4 个 production e2e 测试通过
- Playwright MCP 手动渲染验证：
  - 桌面 `1280x900`：收藏主灯继电器后出现收藏区，只看收藏显示 `1 / 6` 台设备，`localStorage` 写入 `["device-relay-01"]`
  - 移动端 `393x852`：无横向溢出，收藏按钮和底部导航可见
  - Console errors / page errors: 0

### GitHub 状态
- 本轮本地 commit 已完成
- `git push github main` 未成功：GitHub 返回当前 remote token 无效
- 远程推送仍需要先更新 GitHub token

---

## 2026-06-07 (设备详情样式组件化 + 冷却恢复 e2e)

### 样式维护优化
- `DeviceCommandClient` 的设备页头、在线状态、面包屑、态势建议、遥测卡片改为 class / `data-*` 样式驱动
- `CommandHistoryList` 的生命周期摘要、命令条目、状态标签改为 class / `data-status-tone` 驱动
- `DeviceControlPanel` 的指标字号、在线/离线状态、错误提示改为 CSS class
- 设备详情相关组件当前只剩冷却进度条宽度这一处动态 inline style

### e2e 覆盖
- `tests/e2e/prod-shell.spec.ts` 新增“device control recovers after cooldown and accepts a second command”
- 覆盖：首次控制 → 进入冷却并禁用 → 冷却结束恢复可点击 → 第二次控制再次进入冷却

### 测试与验证
- `node ./node_modules/vitest/vitest.mjs run apps/web/src/components/device-command-client.test.tsx apps/web/src/components/device-control-panel.test.tsx apps/web/src/components/command-history-list.test.tsx`：11 个测试通过
- `npm run lint`：通过
- `npm test`：13 个文件 / 59 个测试全部通过
- `npm run build`：通过，`/devices/[deviceId]` First Load JS 约 112 kB，页面自身 size 从约 6.48 kB 降到 5.8 kB
- `npx playwright test tests/e2e/prod-shell.spec.ts`：3 个 production e2e 测试通过
- Playwright MCP 手动渲染验证：
  - 桌面 `1280x900`：设备 hero、命令历史、状态标签 class 生效，`scrollWidth=1280`
  - 移动端 `393x852`：`scrollWidth=393`，底部导航可见，控制按钮宽度稳定
  - Console errors / page errors: 0

### GitHub 状态
- 本轮本地 commit 已完成
- `git push github main` 未成功：最新错误为无法连接 `github.com:443`
- 远程推送仍需要先修复 GitHub remote token，并确认网络可以访问 GitHub

---

## 2026-06-07 (命令冷却执行 + 首页读取优化)

### 控制逻辑优化
- `DeviceControlPanel` 新增真实命令冷却锁定：命令确认后按照 `commandCooldownMs` 显示冷却倒计时，并禁用继电器按钮
- `DeviceCommandClient` 将 `getDeviceControlSnapshot()` 计算出的 `cooldownMs` 传入控制面板，避免“只展示冷却、不执行冷却”的逻辑落差
- 冷却提示加入独立视觉样式和进度条，移动端按钮/状态标签改为满宽，降低小屏误触和拥挤感

### 首页性能优化
- 首页按房间并行读取设备状态与命令历史，减少动态首屏在多设备房间中的串行等待
- 保持原有首页统计、房间焦点、最近动态和 PWA 安装入口不变

### 测试与验证
- `node ./node_modules/vitest/vitest.mjs run apps/web/src/components/device-control-panel.test.tsx`：5 个测试通过
- `node ./node_modules/vitest/vitest.mjs run apps/web/src/components/device-command-client.test.tsx apps/web/src/components/command-history-list.test.tsx`：6 个测试通过
- `npm run lint`：通过
- `npm test`：13 个文件 / 59 个测试全部通过
- `npm run build`：通过
- `npx playwright test tests/e2e/prod-shell.spec.ts`：2 个 production e2e smoke 测试通过
- Playwright MCP 手动渲染验证：
  - `/devices/device-relay-01` 桌面端点击控制后出现 `冷却 2s`，按钮禁用，冷却提示可见
  - `393x852` 移动端设备详情无横向溢出，底部导航和控制按钮可见
  - Console errors / page errors: 0

### 注意
- Browser 插件可用，但当前会话未暴露其要求的 Node 控制面工具；本轮渲染验证按规则回退到 Playwright MCP
- 本轮已完成本地 commit；`git push github main` 失败，原因是当前 GitHub remote token 无效，需要更新 token 后再推送

---

## 2026-06-01 (production 构建稳定化 + PWA / 移动端 QA)

### Production 构建与运行时修复
- 修复 `next/font` 中文字体配置问题：`Noto_Sans_SC` 关闭 preload，`npm run build` 恢复可用
- 发现 `apps/web/.next` 被旧产物污染后会导致 `next start` 运行时 chunk 异常；已通过停掉旧进程 + 清理 `.next` + 干净重建解决
- 验证当前 production server 可正常服务首页、离线页和设备详情页

### 自动化 QA
- 新增 `tests/e2e/prod-shell.spec.ts`
- 覆盖项：
  - 首页 production 壳层
  - `/manifest.webmanifest`
  - service worker 注册
  - `/offline`
  - `/devices/device-relay-01` 移动端底部导航与无横向溢出
- `vitest.config.ts` 新增 `exclude: ["tests/e2e/**", ...]`，避免 Playwright 规格文件误入 Vitest

### 移动端视觉修复
- 设备详情页底部安全区加大，避免固定底部导航过度压住底部内容
- 命令历史组件移除浅色硬编码面板，统一切回深色壳层主题
- 移动端底部导航缩窄、变薄、下沉，减少首屏遮挡感
- 命令历史列表卡片和状态标签改为深色主题配色

### 测试与验证
- `npm run build`：通过
- `node ./node_modules/vitest/vitest.mjs run`：13 个文件 / 58 个测试全部通过
- `npx playwright test tests/e2e/prod-shell.spec.ts`：2 个测试全部通过

### 证据
- 截图：
  - `C:\Users\24560\Desktop\study\webdemo\output\qa-home-desktop-chromium.png`
  - `C:\Users\24560\Desktop\study\webdemo\output\qa-device-mobile-chromium.png`

### Android 现状
- 已验证 Android Chrome 安装 PWA 路径可作为当前移动端直接使用方案
- 尚未完成 APK 打包或安卓真机/模拟器安装验证
- 当前阻塞仍是：本机无 Android SDK / Gradle toolchain

---

## 2026-06-01 (localhost QA + 设备详情状态同步修复)

### 浏览器级 QA
- 使用 `mcp__playwright` 验证 `/homes` 和 `/devices/device-relay-01`
- 当前会话未暴露可直接控制 localhost 的 in-app Browser 工具，因此按约定使用 Playwright 回退
- `/homes` 桌面端通过：无空白页、无错误 overlay、无相关 console/page error
- `/devices/device-relay-01` 桌面端通过：真实点击继电器控制，命令状态进入“已确认”
- `/devices/device-relay-01` 移动端通过：无横向溢出

### 修复内容
- 修复设备详情页 hero 摘要状态不随客户端控制结果更新的问题
- `DeviceCommandClient` 接管页头摘要渲染，统一使用客户端实时状态
- `DeviceControlPanel` 改为受控组件，避免父子组件各自缓存 relay 状态

### 测试与验证
- 新增回归测试：点击控制后 hero 摘要必须与控制面板同步
- `node ./node_modules/vitest/vitest.mjs run`：13 个文件 / 58 个测试全部通过
- `npm run lint`：通过
- `npm run build`：通过

### Supabase 现状
- 本机无全局 `supabase` CLI，但 `npx supabase --version` 可用，版本 `2.102.0`
- `npx supabase projects list --output json` 失败，原因是缺少 `SUPABASE_ACCESS_TOKEN`
- 已补充 `.env.example` 的 `SMART_HOME_BACKEND=memory`
- 已在 `supabase/README.md` 记录真实接入所需命令和当前阻塞点

---

## 2026-05-28 (设备配置/设置页面)

### 新增功能
- `/settings` 设备配置页面
- 设备列表：显示 IP/MAC/固件版本/设备 ID 等详细信息
- 添加新设备：表单输入设备名称、类型、房间、家庭
- 编辑设备配置：模态框编辑设备名称和房间
- 重启设备：模拟重启操作
- 恢复出厂设置：带确认对话框的危险操作

### 设备信息展示
- IP 地址（等宽字体）
- MAC 地址（等宽字体）
- 固件版本
- 设备 ID
- 在线状态
- 最后活动时间

### 操作功能
- 查看详情：跳转到设备详情页
- 编辑配置：修改设备名称和房间
- 重启设备：模拟重启操作
- 恢复出厂设置：带确认的危险操作

### UI 特性
- 模态框编辑界面
- 操作结果反馈（成功/进行中/失败）
- 背景遮罩
- 响应式布局

### 测试
- 57 个测试全部通过

---

## 2026-05-28 (活动日志页面)

### 新增功能
- `/activity` 活动日志页面
- 日志数据模型：命令/告警/系统/设备 四种类型
- 日志级别：成功/信息/警告/错误
- 搜索功能：按标题、消息、设备名搜索
- 筛选功能：按类型和级别筛选
- 相对时间显示：刚刚/x分钟前/x小时前
- 设备关联：点击设备名跳转到设备详情

### 数据结构
```typescript
type ActivityLog = {
  id: string;
  timestamp: string;
  type: "command" | "alert" | "system" | "device";
  level: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  deviceId?: string;
  deviceName?: string;
};
```

### UI 特性
- 日志图标：⚡命令 🔔告警 🖥️系统 📡设备
- 级别颜色：成功(绿) 警告(黄) 错误(红) 信息(蓝)
- 类型标签和级别标签
- 设备链接可点击跳转
- 空状态提示

### 测试
- 57 个测试全部通过

---

## 2026-05-28 (设备列表搜索筛选 + 批量控制)

### 新增功能
- 搜索框：支持按设备名称、房间、家庭搜索
- 类型筛选：按设备类型过滤（继电器/传感器等）
- 状态筛选：按在线/离线状态过滤
- 批量控制：一键开启/关闭所有在线继电器
- 筛选结果统计：显示 x/y 台设备
- 清除筛选按钮

### UI 改进
- 搜索框带图标
- 下拉选择器样式统一
- 快捷操作按钮组
- 控制结果反馈（成功/失败提示）
- 设备卡片显示位置信息（家庭 > 房间）
- 空状态提示

### 测试
- 57 个测试全部通过

---

## 2026-05-28 (遥测数据可视化 + 全局健康度升级)

### 新增功能
- 遥测数据面板：温度/湿度/信号强度/电压/CO2/PM2.5 实时显示
- 数据状态指示：正常/警告/危险 颜色标识
- 中文遥测数据解析（支持中英文格式）
- formatTelemetryCN() 结构化遥测数据函数

### control-balance.ts 改进
- 新增 parseTemperature() - 支持 "温度 24.6°C" 格式
- 新增 parseCO2() - 支持 "CO2 450ppm" 格式
- 新增 parsePM25() - 支持 "PM2.5 15μg/m³" 格式
- 新增 formatTelemetryCN() - 结构化遥测数据
- 所有解析函数支持中英文格式

### 全局健康度页面改进
- 使用新设计系统（card/stat-grid/badge）
- 设备卡片增加图标和状态指示
- 统计卡片增加在线率显示
- 超时警告区域改进
- 房间分组显示设备数量

### 测试
- 57 个测试全部通过

---

## 2026-05-28 (全新视觉设计系统)

### 设计系统
- 全新深色主题设计系统
- 紫色主色调（#6366f1）+ 渐变效果
- 语义化颜色系统（success/warning/danger/info）
- 毛玻璃效果导航栏（backdrop-filter）
- 统一的阴影和圆角系统

### 组件样式
- `.card` - 卡片组件（悬浮动画、边框高亮）
- `.stat-card` - 统计卡片（渐变背景）
- `.device-card` - 设备卡片（图标 + 状态）
- `.quick-nav-item` - 快速导航卡片
- `.btn` - 按钮系统（primary/secondary/ghost）
- `.badge` - 状态标签
- `.command-item` - 命令历史项

### 动画效果
- `fadeInUp` - 页面加载动画
- `slideIn` - 滑入动画
- 延迟动画类（delay-1 到 delay-4）
- 悬浮上浮效果
- 边框高亮过渡

### 响应式
- 移动端适配（768px 断点）
- 小屏幕适配（480px 断点）
- 导航栏移动端隐藏

### 测试
- 57 个测试全部通过

---

## 2026-05-28 (设备列表页面 + UI 全面升级)

### 新增功能
- `/devices` 设备列表页面：按家庭/房间分组显示所有设备
- 设备图标：继电器💡、传感器🌡️等
- 面包屑导航：首页 > 全局健康 > 设备名称

### UI 改进
- 设备控制面板：增加设备图标、设备类型显示
- 控制态势面板：增加风险建议文案、可靠度分数更醒目
- 首页重新设计：快速导航卡片 + 核心功能介绍 + 开始使用区域
- 导航栏：增加「所有设备」链接
- 设备详情页：显示设备图标和类型中文名称

### 测试
- 所有 57 个测试通过
- 测试适配新的 UI 元素（设备图标、多个匹配文本）

---

## 2026-05-28 (全面中文化 + UI 改进)

### 导航栏
- 添加顶部 sticky 导航栏
- 毛玻璃效果背景
- 包含首页、全局健康、设备控制链接

### 中文化改进
- 全局健康度页面完全中文化
- 命令历史列表状态标签：排队中/已送达/已确认/失败/已超时
- 命令类型显示中文：继电器控制/传感器读取/设备重启
- 时间格式使用 zh-CN locale
- 设备控制面板风险等级显示：高/中/低
- 遥测数据显示中文标签

### 测试更新
- command-history-list 测试适配中文状态标签
- device-command-client 测试适配中文文案
- 所有 56 个测试通过

---

## 2026-05-28 (hermeswork 分支)

### 测试修复
- 修复 device-control-panel 测试：适配中文 UI
- 所有 56 个测试通过

### 中文化改进
- mock-data 设备名称改为中文
- 新增卧室和办公室房间及设备
- 首页添加快速导航区域

### 维护改进
- 更新 .gitignore：排除临时文件
- 创建独立 Git 仓库（从用户目录分离）

---

## 2026-05-26 (续)

- DeviceCommandClient 消除闪白
- 新增 5 秒自动轮询
- 删除死代码

## 2026-05-26 (续 II — 硬件对接基础设施)

- 创建硬件集成文档
- 新增 ingest API 端点
- DeviceBackend 接口补完

## 2026-05-26

- 打通生命周期策略端到端
- Homes 页 SSR 首屏数据直出
- Landing 页产品化改写

## 2026-05-10

(历史记录同上)
