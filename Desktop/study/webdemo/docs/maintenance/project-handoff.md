# Smart Home System Handoff

Last updated: `2026-06-09`

## Project goal

Build a web-first smart home management system: web dashboard → ESP32S3 → STM32H743 control loop with full command lifecycle tracking.

Stack: Next.js App Router · InMemoryDeviceBackend (默认) · Supabase (计划) · ESP32S3 · STM32H743

## Canonical source documents

Read these first:

1. `AGENTS.md`
2. `docs/maintenance/project-handoff.md` (this file)
3. `docs/maintenance/task-board.md`
4. `docs/maintenance/progress-log.md`
5. `docs/hardware/integration-guide.md` — **硬件集成入口**
6. `docs/protocols/smart-home-mvp-device-contract.md` — UART 协议定义

## Current tranche summary (2026-06-09)

本轮在 2026-06-01 已完成的 PWA / 移动端生产化基础上继续推进可用性和逻辑完善：

1. 设备控制按钮接入真实命令冷却窗口：控制面板不再只展示冷却秒数，而是在命令确认后短暂锁定按钮并显示冷却提示，降低继电器短时间重复下发风险
2. 首页动态数据读取优化：同一房间内的设备状态和命令历史改为并行读取，减少动态首页首屏等待
3. 控制卡片视觉收敛：新增统一的控制卡片、继电器状态标签、冷却提示和移动端满宽按钮样式，减少新增内联样式扩散
4. 补充回归测试：`DeviceControlPanel` 覆盖命令冷却锁定和恢复路径，单测总数更新为 59
5. 设备详情页样式继续组件化：页头、面包屑、态势面板、遥测卡片、命令历史列表改为 class / `data-*` 驱动，相关组件只剩冷却进度条宽度这一处动态 inline style
6. Production e2e 增补“冷却结束后二次控制”路径，确认按钮可从冷却状态恢复并再次发送命令
7. 设备列表新增本机收藏工作流：收藏按钮、收藏设备区、只看收藏筛选、收藏优先排序，并用 `localStorage` 持久化常用设备入口
8. `/activity` 和 `/devices` 新增当前筛选结果导出：支持 CSV / JSON 下载，活动日志和设备清单共用 `export-data` 序列化 helper，避免页面内重复标签映射和 CSV 转义逻辑
9. `/settings` 升级为设置中心：新增本机用户偏好、通知渠道/触发规则、安静时段和通知策略预览；设备维护编辑/新增/重启/恢复出厂改为真实更新当前页面状态
10. PWA 推送前端接入：`sw.js` 支持 `push` / `notificationclick`，设置中心新增通知权限、Service Worker、PushManager、VAPID 公钥和订阅端点就绪检测；配置 `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY` 后可通过 PushManager 创建订阅
11. 通知收件箱 / 投递历史：设置中心新增本机通知队列，支持规则过滤、关键未读统计、安静时段延后统计、标记已读、归档、清除归档和本地测试通知写入历史
12. 通知收件箱高级筛选：支持关键词搜索、按设备、优先级和来源筛选，结果计数实时更新，移动端筛选面板不横向溢出
13. 推送订阅同步健康状态：设置中心新增订阅端点同步快照、端点指纹、订阅年龄、过期/陈旧重订阅提示，为后续后端保存 push subscription 做好前端状态边界
14. 通知筛选视图持久化：设置中心可保存、恢复和清除通知收件箱筛选视图，刷新后自动恢复常用未读/设备/关键词组合
15. 活动日志筛选视图持久化：`/activity` 可保存、恢复和清除日志排障筛选视图，刷新后自动恢复关键词/类型/级别组合
16. 设备筛选视图持久化：`/devices` 可保存、恢复和清除设备筛选视图，刷新后自动恢复关键词/类型/在线状态/只看收藏组合
17. 全局健康快照刷新反馈：`/homes` 新增手动刷新、最近更新时间、失败保留旧快照提示，并收敛剩余内联样式；hero 装饰层改为不可滚动裁剪，避免刷新交互后内容被隐藏横向滚动偏移
18. 首页操作摘要优化：`/` 首屏统计/房间焦点/优先处理队列抽到 `landing-dashboard` helper；首页优先处理项现在提供直接 CTA，hero 三个主操作在桌面和移动端都保持清晰按钮形态
19. 离线恢复面板：`/offline` 从静态兜底页升级为可操作恢复面板，检测浏览器在线状态、监听 `online/offline` 事件，并通过 `role="status"` 公告“网络已恢复 / 仍处于离线状态”
20. 离线页移动端兜底优化：`/offline` 使用双栏恢复布局，移动端自动单列；PWA 安装提示在离线路由压缩为 compact 形态，保留安装入口但不遮挡“回到控制台 / 查看最近日志”恢复动作
21. 设置中心本机备份导出：`/settings` 新增本机操作状态 JSON 备份卡片，汇总偏好、收藏、筛选视图、通知队列和推送同步快照；Push subscription 只导出端点指纹和 key 存在状态，不导出 endpoint / p256dh / auth 原文
22. 设置中心本机备份恢复：`/settings` 支持选择备份 JSON、预览可恢复/覆盖/跳过项，并只写回非敏感本机状态；Push subscription 脱敏摘要明确跳过，避免误恢复浏览器推送密钥
23. 本地生成产物瘦身：清理 ignored 的 Playwright/MCP 快照、e2e 输出、Next build 产物、旧本地 SQLite 数据和运行日志；维护文档删除本地截图逐条路径与重复 push 失败日志
24. 设置中心本机状态刷新收敛：首次加载和备份恢复后刷新改为复用同一个 `refreshLocalStateFromStorage()` 路径，减少 `localStorage` 读取逻辑重复，降低后续新增本机状态项时漏同步风险
25. CSV 导出安全加固：统一 `toCsv()` 对以 `= + - @` 或控制字符开头的文本单元格添加前导 apostrophe，降低活动日志 / 设备清单导出被表格软件当成公式执行的风险；数字值仍保持数字语义
26. 设备上行 token 校验：`POST /api/devices/[deviceId]/ingest` 接入可配置 `X-Device-Token` 校验；配置 `SMART_HOME_DEVICE_TOKENS` 后缺失/错误 token 会在解析 payload 和写入状态前被拒绝，production 未配置 token 时返回 `503`

### 2026-06-01 生产化基础

本轮完成了四件关键维护工作：

1. 为首页和壳层补齐 PWA 能力：manifest、service worker、离线页、安装提示、移动端底部导航
2. 定位并修复 production build / start 问题：`next/font` 中文字体 preload 配置错误，以及脏 `.next` 产物导致的运行时污染
3. 新增生产模式 e2e smoke test，补齐首页、PWA 资产、离线页、移动端设备详情的自动化证据
4. 修正设备详情页移动端视觉问题：命令历史暗色化、底部安全区补足、底部导航缩窄

### 具体完成

**本轮代码变更：**
- `layout.tsx` 新增 PWA metadata / viewport，并为 `Noto_Sans_SC` 关闭 preload，恢复 `next build`
- `app-shell.tsx` / `install-app-prompt.tsx` / `pwa-bootstrap.tsx` 提供移动端壳层、安装提示和生产模式 service worker 注册
- `manifest.ts` / `offline/page.tsx` / `public/sw.js` / 图标资源补齐安装与离线路径
- 新增 `tests/e2e/prod-shell.spec.ts`，覆盖首页、manifest、service worker、离线页和移动端设备详情
- `vitest.config.ts` 排除 `tests/e2e/**`，避免 Playwright 规格文件误入单测
- `command-history-list.tsx`、`globals.css`、`devices/[deviceId]/page.tsx` 修复移动端底部遮挡和命令历史浅色对比度问题

**本轮 QA：**
- 使用 `python ...with_server.py --server "npm run start" --port 3000 -- npx playwright test tests/e2e/prod-shell.spec.ts`
- 首页：验证主壳层加载、`/manifest.webmanifest` 可读、service worker 在 production 注册
- 离线页：`/offline` 可访问
- 移动端设备详情：`/devices/device-relay-01` 底部导航可见、无横向溢出、命令历史暗色面板显示正常

### 页面路由

| 路由 | 说明 |
|------|------|
| `/` | 首页（快速导航 + 核心功能） |
| `/homes` | 全局健康度仪表盘 |
| `/devices` | 设备列表 + 收藏 + 筛选视图保存 |
| `/devices/[id]` | 设备详情 + 控制面板 |
| `/activity` | 活动日志 + 当前筛选结果导出 |
| `/settings` | 用户偏好 / 通知策略 / 本机备份导出恢复 / 设备维护 |
| `/offline` | PWA 离线兜底 + 网络恢复检查 |

### API 路由

| 路由 | 用途 | 调用方 |
|------|------|--------|
| `/api/devices/[id]/commands` | 命令 GET/POST | 网页前端 |
| `/api/devices/[id]/ingest` | 设备上行(ack+遥测) | ESP32S3 |
| `/api/system/lifecycle-tick` | 全局生命周期轮询 | 定时器 |
| `/api/homes/snapshot` | 聚合统计 | homes 页面轮询 |

## 数据流全景

```
用户点击 → POST /api/devices/[id]/commands
  → parseCommandRequest() 校验
  → queueDeviceCommand() 入队
  → [模拟器] simulateCommandDelivery() — 当前默认
  → [真实] ESP32S3 下发 → UART → STM32 → ack → POST /api/devices/[id]/ingest
  → applyAckByCorrelationId() → applyAckPayload() 更新状态
  → 前端收到 state + history

遥测: ESP32S3 每30s → POST /api/devices/[id]/ingest { messageType: "telemetry" }
  → seedDeviceState() 写入在线/遥测摘要
  → 前端轮询获取最新状态
```

## 关键架构决策

- web-first MVP
- UART: ESP32S3 ↔ STM32H743 首选桥接
- desired state ≠ reported state（严格分离）
- 后端接口可替换: InMemoryBackend(默认) → SupabaseBackend(计划)
- 模拟器路径先行，硬件对接通过 DeviceBackend 接口注入

## Verification

- `npm run lint`: 通过
- `node ./node_modules/vitest/vitest.mjs run`: 24 files / 104 tests 全部通过
- `npm run build`: 通过
- 2026-06-09 设置状态刷新收敛复核：`npm test -- --run apps/web/src/lib/local-app-backup.test.ts apps/web/src/lib/user-preferences.test.ts apps/web/src/lib/notification-inbox.test.ts apps/web/src/lib/push-notifications.test.ts` 通过，随后全量 `npm test -- --run` 23 files / 98 tests 通过；`npm run lint` 和 `npm run build` 通过，build 后已删除 `apps/web/.next/`
- 2026-06-09 CSV 导出安全复核：`npm test -- --run apps/web/src/lib/export-data.test.ts` 5 tests 通过；随后全量 `npm test -- --run` 23 files / 99 tests 通过；`npm run lint` 和 `npm run build` 通过，build 后已删除 `apps/web/.next/`
- 2026-06-09 设备上行 token 校验复核：`npm test -- --run apps/web/src/lib/server/device-token-auth.test.ts apps/web/src/app/api/devices/[deviceId]/ingest/route.test.ts` 2 files / 8 tests 通过；随后全量 `npm test -- --run` 24 files / 104 tests 通过；`npm run lint` 和 `npm run build` 通过，build 后已删除 `apps/web/.next/`
- Playwright QA:
  - `tests/e2e/prod-shell.spec.ts`: 15 passed
  - 首页 production PWA 资产通过；“优先处理”卡片显示 `1 台设备离线` 并提供“打开总览”CTA
  - `/offline` 通过：离线兜底页显示恢复状态，在线浏览器下 `role="status"` 提示“网络已恢复”，并提供“回到控制台 / 查看最近日志”动作
  - `/homes` 手动刷新快照通过：mock 聚合 API 更新到 `QA 复核空间`，最近更新时间、超时徽标、无横向溢出和 hero 几何未偏移均通过
  - `/devices/device-relay-01` 移动端通过，无横向溢出
  - `/devices/device-relay-01` 冷却恢复后二次控制通过
  - `/devices` 收藏设备持久化与只看收藏过滤通过
  - `/devices` 设备筛选视图通过：保存“继电器 + 在线 + 只看收藏 + 搜索‘继电器’”后刷新自动恢复；清除保存会移除本机视图记录
  - `/activity` CSV 下载通过：文件名 `activity-logs-YYYY-MM-DD.csv`，内容包含日志表头和主灯继电器记录
  - `/activity` 日志筛选视图通过：保存“排风扇 + 告警 + 警告”后刷新自动恢复；清除保存会移除本机视图记录
  - `/devices` JSON 下载通过：文件名 `devices-YYYY-MM-DD.json`，内容包含 UI 收藏后的 `device-relay-01` / `favorite: true`
  - `/settings` 偏好持久化通过：取消 PWA 推送写入 `localStorage["smart-home-user-preferences-v1"]`，刷新后保持；恢复默认后重新启用
  - `/settings` 设备维护编辑通过：编辑主灯继电器名称后列表即时更新为 `主灯继电器 Pro`
  - `/settings` 推送就绪通过：默认状态显示通知待授权；模拟已授权后显示等待 VAPID 公钥；本地测试通知动作可触发状态提示
  - `/settings` 通知收件箱通过：默认显示 2 条未读；全部标为已读、恢复未读、归档、清除归档和本地测试通知写入历史均可用
  - `/settings` 通知筛选通过：搜索“空气”、按设备、按关键优先级筛选均能正确收敛收件箱结果
  - `/settings` 通知筛选视图通过：保存未读 + 搜索“空气” + 设备筛选后刷新自动恢复；清除保存会移除本机视图记录
  - `/settings` 推送订阅同步通过：无同步快照时提示端点待同步；记录快照后显示有效；订阅超过 30 天后提示重新订阅
  - `/settings` 本机备份导出通过：下载文件名 `smart-home-local-state-YYYY-MM-DD.json`，JSON 包含本机偏好/收藏等已知状态项，Push subscription 条目被标记为 `redacted`，且不包含 endpoint / p256dh / auth 原文
  - `/settings` 本机备份恢复通过：上传备份后预览可恢复/覆盖/跳过项；恢复后偏好和收藏写回，Push subscription 保留当前浏览器订阅且不会被脱敏摘要覆盖
- Rendered interaction QA (Playwright fallback):
  - Browser 插件已安装，但当前会话没有暴露其要求的 Node 控制面工具，因此按前端测试技能回退到 Playwright MCP
  - `/devices/device-relay-01` 桌面端点击继电器控制后出现 `冷却 2s`，按钮禁用，冷却提示可见
  - 移动端 `393x852` 视口验证：`scrollWidth=393`，底部导航和控制按钮可见，无横向溢出
  - 样式迁移后桌面 / 移动端 smoke：设备 hero、命令历史、状态标签 class 生效；桌面 `scrollWidth=1280`，移动端 `scrollWidth=393`
  - 设备收藏 smoke：`localStorage["smart-home-device-favorites-v1"]=["device-relay-01"]`，只看收藏显示 `1 / 6` 台设备；桌面 / 移动端均无横向溢出
  - 设备筛选视图 smoke：保存“继电器 + 在线 + 只看收藏 + 搜索‘继电器’”后桌面 `scrollWidth=1280`、移动端 `scrollWidth=393`；刷新恢复筛选，清除保存移除 `smart-home-device-filter-view-v1`
  - 首页操作摘要 smoke：`/` 桌面 `1280x900` 和移动端 `393x852` 均显示优先处理 CTA；移动端 hero action 宽 327px，“安装到手机”按钮跨整行，无横向溢出
  - 离线恢复 smoke：`/offline` 桌面 `1366x900` 和移动端 `393x852` 均显示“网络已恢复，可以返回控制台”；桌面 `scrollWidth=1366`、移动端 `scrollWidth=393`；“查看最近日志”可导航到 `/activity`
  - 离线安装提示 smoke：`/offline` 的 PWA 安装提示使用 compact 形态；移动端恢复按钮 bottom 约 `683.5px`、安装提示 top 约 `709px`，`actionsCovered=false`，没有遮挡恢复动作
  - 全局健康刷新 smoke：`/homes` 桌面 `1280x900` 和移动端 `393x852` 均可点击“刷新状态”并渲染 mock 快照；桌面 `scrollWidth=1280`、移动端 `scrollWidth=393`，hero 标题/按钮/最近更新时间均在卡片内
  - 导出控件 smoke：`/activity` 与 `/devices` 在桌面 `1280x900`、移动端 `393x852` 均无横向溢出，导出按钮/全局健康按钮不重叠
  - 活动日志筛选视图 smoke：保存视图恢复后桌面 `scrollWidth=1280`、移动端 `scrollWidth=393`；保存视图栏和操作按钮均未越界
  - 设置中心 smoke：`/settings` 桌面 `1280x900`、移动端 `393x852` 均无横向溢出；偏好保存、恢复默认、通知摘要和设备维护卡片可见
  - 推送接入 smoke：`/settings` 桌面 `1280x900`、移动端 `393x852` 均无横向溢出；PWA 推送卡显示 `等待 VAPID 公钥 / 待公钥`
  - 通知收件箱 smoke：`/settings` 桌面 `1280x900` `scrollWidth=1280`；移动端 `393x852` `scrollWidth=393`，收件箱卡宽 361px，按钮均未越界
  - 通知筛选 smoke：搜索“空气”后桌面 `scrollWidth=1280`、移动端 `scrollWidth=393`；移动端筛选面板宽 319px，控件均未越界
  - 通知筛选视图 smoke：保存视图恢复后桌面 `scrollWidth=1280`、移动端 `scrollWidth=393`；保存视图栏和操作按钮均未越界
  - 推送订阅同步 smoke：记录同步快照后桌面 `scrollWidth=1280`、移动端陈旧订阅 `scrollWidth=393`；同步面板和操作按钮均未越界
  - 设置中心本机备份 smoke：`/settings` 桌面约 `1280x900`、移动端 `393x852` 均无横向溢出；备份卡片按钮可触发下载状态提示，移动端按钮和三项指标单列收拢
  - 设置中心本机备份恢复 smoke：桌面 `1366x900` 恢复预览 `scrollWidth=1366`；移动端 `393x852` 恢复面板宽 319px、恢复按钮宽 285px、恢复项均在视口内；恢复后默认入口/密度和收藏状态同步，Push subscription endpoint 未被备份覆盖
  - Console errors / page errors: 0

## Browser QA evidence

- Browser / Playwright screenshots and MCP console snapshots are temporary local artifacts, not project source.
- 2026-06-09 cleanup removed generated evidence directories: `output/`, `.playwright-mcp/`, and `test-results/`.
- Current durable verification evidence is the command history summarized in `## Verification`; regenerate screenshots only when a new rendered UI change needs visual QA.

## Android status (2026-06-01)

- 当前已验证的“可直接开始使用”路径是：Android Chrome 安装 PWA 到主屏
- 当前尚未完成 APK 构建或安卓真机/模拟器安装验证，**不能声称 APK 已可用**
- 本机现状：Java 17 可用，但没有 Android SDK / Gradle toolchain，因此缺少 APK 打包前提

## Supabase status (2026-06-01)

- 本地没有全局 `supabase` CLI，但 `npx supabase` 可用，版本为 `2.102.0`
- `npx supabase projects list --output json` 当前失败：缺少 `SUPABASE_ACCESS_TOKEN`
- 仓库内没有 `.mcp.json`，Supabase MCP 尚未接到这个 workspace
- `.env.example` 现已补充 `SMART_HOME_BACKEND=memory`，但真实切换到 Supabase 仍需要：
  1. `npx supabase login` 或配置 `SUPABASE_ACCESS_TOKEN`
  2. `npx supabase link --project-ref <project-ref> -p <db-password>`
  3. `npx supabase db push --linked --include-all`
  4. `.env.local` 写入真实 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## 下一步推荐

1. 如果目标必须包含 APK：先安装 Android SDK / Gradle，再选择官方封装路线（Capacitor 或 TWA/PWABuilder），之后做真机或模拟器 smoke test
2. 完成 Supabase 登录态或 MCP 认证，拿到 `project-ref` 和远程 DB password
3. 执行 `npx supabase link` + `npx supabase db push --linked --include-all`
4. 用 `SMART_HOME_BACKEND=supabase` 做一次真实数据库 smoke test
5. 之后再继续 Auth / ESP32S3 真链路接入
6. 配置 Web Push VAPID 公钥，并把 PWA push subscription endpoint 保存到账号或 Supabase 后端
7. 将本机用户偏好、通知策略和通知收件箱接入账号或 Supabase 后端同步
8. 用真实后端同步状态替换当前本机 push subscription 同步快照，并保留端点变更/过期/陈旧重订阅提示
9. 将本机备份恢复扩展为更细的迁移工具：逐项勾选、恢复前自动导出现状、Supabase 字段映射和账号级冲突处理

## GitHub 推送说明

本地 Git 仓库已初始化。2026-06-09 已通过 GitHub CLI 的 Git Data API fallback 将当前 `webdemo` tracked tree 发布到远程默认分支 `hermeswork` 的 `Desktop/study/webdemo/` 子树。

GitHub API 发布记录：
- 按用户要求尝试 GitHub MCP：`mcp__github.list_commits` 返回 `Bad credentials`，当前 GitHub MCP 凭据不可用
- 本地 `gh auth status` 有可用 `repo` 权限；但 native git fetch/push 仍无法连接 `github.com:443`
- 首个 full-tree Git Data API sync commit：`80fbe5b5d059cfa3a83c40c329d91111806aa346`
- 设置中心本机备份导出本地 commit：`928da2c` (`Let operators export local app state safely`)
- 设置中心本机备份导出 Git Data API fallback commit：`c12cf134941c9eb9ce47cded695dba8435f0637d`
- 本机备份导出发布范围：8 个变更文件，均位于远程 `Desktop/study/webdemo/` 子树；已核验远程存在 `local-app-backup.ts` 与更新后的 production e2e 规格文件
- 设置中心本机备份恢复本地 commit：`80875f4` (`Make local backups recoverable without restoring secrets`)
- 设置中心本机备份恢复 Git Data API fallback commit：`de46cbd4d94972afea51fe0a6f7ae6e14d542ab5`
- 本机备份恢复发布范围：8 个变更文件，均位于远程 `Desktop/study/webdemo/` 子树；已核验远程存在更新后的 `local-app-backup.ts` 与 production e2e 规格文件
- 远程目标：`2456018331lby-dev/webdemo` / `hermeswork`
- 远程路径：`Desktop/study/webdemo/`
- 发布范围：本地 109 个 tracked 文件；未触碰远程 sibling 目录 `Desktop/study/boss/`、`Desktop/study/ccdemo/`

当前 GitHub 连接状态：
- GitHub MCP 仍返回 `Bad credentials`，不能作为发布通道。
- Native `git push` 历史失败归为两类：token/password auth 无效，以及 `github.com:443` 连接重置/超时。
- `gh auth status` 有可用 `repo` 权限；截至 2026-06-09，Git Data API fallback 是唯一已验证可用的远程发布通道。

仍需要修复 GitHub MCP 凭据和 native git transport，之后再决定是否清理远程分支布局（当前默认分支是 `hermeswork`，且 workspace 位于 `Desktop/study/webdemo/` 子树）。如果继续使用 native git 推送，建议先保持 remote URL 不嵌入 token，并让 `gh auth setup-git` 管理凭据：
```bash
git remote set-url github https://github.com/2456018331lby-dev/webdemo.git
gh auth setup-git
git push github main
```
