# Task Board

Last updated: `2026-05-26`

## Completed

- [x] 生命周期策略端到端打通（API GET + lifecycle-tick + SSR 状态栏 + 客户端轮询）
- [x] DeviceCommandClient 精简重构：单个轮询 effect（SSR 数据直出无闪白 + 轮询错误提示）
- [x] 设备页 SSR 去除冗余状态栏（统一到 DeviceCommandClient 内部控制态势面板）
- [x] operatorMsg 文案统一 + 离线态/错误态覆盖
- [x] 测试更新：3 个新用例覆盖 SSR 数据渲染 / retry count / offline message
- [x] homes 页 SSR 首屏数据直出 + 客户端 15s 轮询
- [x] Landing 页产品化改写
- [x] 创建设备上行 ingest API: `POST /api/devices/[deviceId]/ingest`
- [x] DeviceBackend 接口补 applyAckByCorrelationId（ESP32 只知道 correlationId）
- [x] 创建 `docs/hardware/integration-guide.md` 硬件集成接入文档
- [x] Supabase schema/type 补 attempt_count / next_retry_at
- [x] 死代码清理 + lint 归零

## 硬件端（待 ESP32/STM32 固件开发）

- [ ] ESP32S3: WiFi 连接 + HTTP POST 上报 ack/遥测到 ingest 端点
- [ ] ESP32S3: 实现 UART 帧编码，发送命令到 STM32
- [ ] STM32H743: UART 中断接收 + 帧解析 + GPIO 控制 + ack 回传
- [ ] 命令下行通道（MQTT 或 HTTP 轮询）
- [ ] 设备 Token 认证

## Backend

- [ ] 接入 Supabase 项目，执行迁移
- [ ] SupabaseDeviceBackend 替换为真实读写
- [ ] Auth 流程

## Frontend

- [ ] 视觉重做（Figma → Tailwind/组件体系）

## Deferred

- [ ] Vercel/Netlify 部署
- [ ] Sentry 监控
- [ ] GitHub 发布