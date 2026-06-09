# Task Board

Last updated: `2026-06-09`

## Completed

### 核心功能
- [x] 生命周期策略端到端打通
- [x] DeviceCommandClient 精简重构（SSR 数据直出无闪白）
- [x] homes 页 SSR 首屏数据直出 + 客户端轮询
- [x] Landing 页产品化改写
- [x] 创建设备上行 ingest API
- [x] DeviceBackend 接口补完
- [x] 创建硬件集成文档

### UI/UX
- [x] 添加顶部导航栏（sticky + 毛玻璃效果）
- [x] 全面中文化（状态标签、命令类型、时间格式）
- [x] CSS 增强（动画、hover 效果、响应式）
- [x] 面包屑导航
- [x] 设备列表页面（/devices）+ 搜索筛选 + 批量控制
- [x] 设备图标（💡🌡️🔌📷🔒）
- [x] 首页快速导航 + 核心功能介绍
- [x] 活动日志页面（/activity）
- [x] 设备配置/设置页面（/settings）
- [x] 遥测数据可视化（温度/湿度/信号强度/电压/CO2/PM2.5）
- [x] 修复设备详情页页头摘要 / 控制面板状态不同步
- [x] PWA 安装流（manifest / service worker / 离线页 / 安装提示）
- [x] 移动端底部导航 + App 壳层
- [x] 设备详情页移动端视觉修复（命令历史暗色化、底部安全区、导航缩窄）
- [x] 设备控制命令冷却实际执行（确认后短暂锁定按钮，避免重复下发）
- [x] 设备控制卡片视觉收敛（状态标签、冷却提示、移动端满宽操作）
- [x] 设备详情页剩余内联样式组件化（页头/面包屑/态势/遥测/命令历史）
- [x] 设备收藏/常用设备入口（本机持久化 + 只看收藏筛选）
- [x] 活动日志 / 设备列表当前筛选结果导出（CSV / JSON）
- [x] 用户设置页面（本机偏好、通知渠道、触发规则、安静时段、设备维护逻辑）
- [x] 通知权限申请与 PWA 推送订阅前端接入（权限检测 / VAPID 就绪 / SW push handler）
- [x] 通知收件箱 / 推送投递历史视图（未读 / 关键 / 归档 / 本地测试通知历史）
- [x] 通知收件箱批量筛选与搜索（按关键词、设备、优先级、来源）
- [x] 推送订阅端点同步状态和失效重订阅提示
- [x] 通知筛选条件持久化 / 保存视图
- [x] 活动日志筛选条件持久化 / 保存视图
- [x] 设备筛选条件持久化 / 保存视图
- [x] 全局健康页快照手动刷新、最近更新时间和失败保留旧快照反馈
- [x] 全局健康页剩余内联样式收敛，并修复 hero 隐藏横向滚动裁切
- [x] 首页首屏操作摘要 / 优先处理 CTA 优化
- [x] 首页 hero 操作按钮移动端布局收敛
- [x] 离线恢复面板（网络状态检测、恢复动作、日志入口、读屏 status）
- [x] 离线页 PWA 安装提示 compact 化，避免移动端遮挡恢复动作
- [x] 设置中心本机数据备份导出卡片（偏好/收藏/筛选视图/通知队列/推送摘要）
- [x] 设置中心本机备份恢复预览与安全恢复（覆盖预览 / 脱敏订阅跳过 / 移动端适配）
- [x] 设置中心本机状态刷新逻辑收敛（首次加载 / 备份恢复复用同一刷新路径）

### 数据/测试
- [x] 中文化 mock 数据
- [x] Supabase schema/type 补完
- [x] 死代码清理 + lint 归零
- [x] 更新 .gitignore
- [x] localhost 浏览器级 QA（Playwright 回退）
- [x] production 模式 e2e smoke tests（首页 / PWA 资产 / 离线页 / 移动端设备详情）
- [x] Vitest 排除 Playwright e2e，单测职责边界修复
- [x] 首页设备状态 / 命令历史并行读取优化
- [x] 设备上行 API 可配置 `X-Device-Token` 校验（`SMART_HOME_DEVICE_TOKENS`）
- [x] ESP32S3 HTTP 轮询命令下行入口（`SMART_HOME_COMMAND_DELIVERY=polling` + `GET /commands?pending=true`）
- [x] Playwright 覆盖“冷却结束后二次控制”完整交互回归
- [x] Playwright 覆盖设备收藏持久化与只看收藏筛选
- [x] Playwright 覆盖活动日志 CSV 与设备列表 JSON 下载
- [x] Playwright 覆盖用户偏好持久化与设备维护编辑
- [x] Playwright 覆盖 PWA 推送权限默认态、已授权待 VAPID 态和本地测试通知
- [x] Playwright 覆盖通知收件箱已读、恢复未读、归档、清除归档和本地测试通知写入历史
- [x] Playwright 覆盖通知收件箱关键词、设备和优先级筛选
- [x] Playwright 覆盖推送订阅同步快照、端点待同步和陈旧订阅重订阅提示
- [x] Playwright 覆盖通知筛选保存视图、刷新恢复、恢复视图和清除保存
- [x] Playwright 覆盖活动日志筛选保存视图、刷新恢复、恢复视图和清除保存
- [x] Playwright 覆盖设备筛选保存视图、刷新恢复、恢复视图和清除保存
- [x] Playwright 覆盖全局健康页快照手动刷新和 hero 几何防偏移
- [x] Playwright 覆盖首页优先处理 CTA 和 scoped hero 主操作
- [x] 首页摘要模型单元测试覆盖运行态统计、房间焦点和稳定态 action
- [x] OfflineRecoveryPanel 单元测试覆盖离线重试态和在线恢复态
- [x] Playwright 覆盖离线恢复状态和恢复面板动作
- [x] 本机备份 helper 单元测试覆盖已知状态收集、日期文件名和 Push subscription 脱敏
- [x] Playwright 覆盖设置中心本机备份下载和敏感字段不落盘
- [x] 本机备份恢复 helper 单元测试覆盖 schema 校验、恢复计划、坏数据跳过和脱敏订阅不恢复
- [x] Playwright 覆盖设置中心本机备份上传预览、恢复写回和 Push subscription 保留当前订阅
- [x] CSV 导出公式注入防护（文本单元格前导危险字符 neutralize，数字值保持数字语义）
- [x] 所有 107 个测试通过
- [x] GitHub API fallback 已将设置中心本机备份恢复发布到远程 `hermeswork` / `Desktop/study/webdemo/`，MCP 凭据仍待修复
- [x] 清理 ignored 生成产物与冗长本地 QA 路径记录（`.next` / `output` / `.playwright-mcp` / `test-results` / 旧 SQLite 本地数据）
- [x] 设置中心状态刷新 refactor 已通过相关本机状态单测、全量 Vitest、lint 和 build

## Android / App Packaging

- [ ] 安装 Android SDK / Gradle 工具链
- [ ] 选定 APK 封装路线（Capacitor 或 TWA/PWABuilder）
- [ ] 构建安卓安装包并完成真机或模拟器 smoke test
- [ ] 明确 PWA 与 APK 的交付边界和发布流程

## 硬件端（待 ESP32/STM32 固件开发）

- [ ] ESP32S3: WiFi 连接 + HTTP POST 上报
- [ ] ESP32S3: UART 帧编码
- [ ] STM32H743: UART 中断接收 + GPIO 控制
- [ ] ESP32S3: 调用 HTTP 轮询下行并把命令编码到 UART（后端 pending API 已接入）
- [ ] ESP32S3: 配置并发送 `X-Device-Token`（后端 ingest 校验已接入）

## Backend

- [ ] Supabase CLI / MCP 完成认证（当前阻塞：缺少 `SUPABASE_ACCESS_TOKEN`）
- [ ] 接入 Supabase 项目，执行迁移
- [ ] `SMART_HOME_BACKEND=supabase` 真实数据库 smoke test
- [ ] SupabaseDeviceBackend 替换为真实读写
- [ ] Auth 流程
- [ ] 用户偏好/通知策略接入账号或 Supabase 后端同步
- [ ] 配置 Web Push VAPID key，并暴露 `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY`
- [ ] 将 Push subscription endpoint 保存到用户账号或 Supabase 后端
- [ ] 用真实后端同步状态替换本机推送同步快照
- [ ] 将通知收件箱 / 投递历史同步到用户账号或 Supabase 后端
- [ ] 将本机备份恢复扩展到 Supabase 迁移映射、逐项勾选和账号级冲突处理
- [ ] 创建服务端推送发送 API / 定时任务，完成真实 Web Push 投递 smoke test

## Deferred

- [ ] Vercel/Netlify 部署
- [ ] Sentry 监控
- [ ] 修复 GitHub MCP 凭据，恢复 MCP 读写能力
- [ ] 修复 native git transport / remote 凭据，恢复常规 `git push`
- [ ] 清理远程分支布局：确认默认分支 `hermeswork` 与 `main`、以及 `Desktop/study/webdemo/` 子树是否需要归并为仓库根目录
