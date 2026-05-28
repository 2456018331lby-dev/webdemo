# Smart Home System Handoff

Last updated: `2026-05-26`

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
7. `docs/superpowers/specs/2026-05-10-smart-home-system-design.md`
8. `docs/superpowers/plans/2026-05-10-smart-home-system-mvp.md`

## Current tranche summary (2026-05-26)

打通了生命周期策略端到端，消除了前端闪白，创建了硬件集成文档和设备上行API。

### 具体完成

**生命周期端到端：**
- `applyLifecyclePolicies()` 接入 API route GET / lifecycle-tick，不再是测试专属
- device-runtime 暴露 `applyAckByCorrelationId()` — ESP32S3 不知道 commandId，只知道 correlationId

**前端体验：**
- DeviceCommandClient 接受 `initialHistory`/`initialTelemetry` props — SSR 数据 hydration 保留，不闪白
- 设备页 SSR 直接渲染生命周期状态栏（含颜色 + 文案），首次 HTML 可见
- 客户端 5s 自动轮询 API 更新生命周期状态
- homes 页 SSR 首屏数据直出（不闪"加载中"）+ 客户端 15s 轮询

**硬件对接基础设施：**
- `docs/hardware/integration-guide.md` — 完整接入文档（架构图、接入步骤清单、时序、UART帧格式）
- `POST /api/devices/[deviceId]/ingest` — ESP32S3 上行端点（接收 ack + telemetry）
- `DeviceBackend` 接口补 `applyAckByCorrelationId()` 方法
- ingest route 测试 3/3 通过

**修复/清理：**
- Supabase type/SQL 补 attempt_count / next_retry_at 列
- 死代码 `dashboard-state.ts` 删除
- lint 0 errors 0 warnings
- 全部测试 55/55 通过

### 当前 API 路由

| 路由 | 用途 | 调用方 |
|------|------|--------|
| `/` | Landing | 浏览器 |
| `/homes` | 全局健康度 | 浏览器 + 15s轮询 |
| `/devices/[deviceId]` | 设备详情(SSR) | 浏览器 + 5s轮询 |
| `/api/devices/[deviceId]/commands` | 命令 GET/POST | 网页前端 |
| `/api/devices/[deviceId]/ingest` | 设备上行(ack+遥测) | ESP32S3 |
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

- `npm run test`: 13 files / 55 tests 全部通过
- `npm run lint`: 0 errors, 0 warnings
- `npm run build`: 通过

## 下一步推荐

1. ESP32S3 固件：WiFi 连接 → ingest API 上报 → UART 帧编码（见 `docs/hardware/integration-guide.md` Step 1-2）
2. Supabase 项目接入 → 执行迁移 → SupabaseDeviceBackend 替换为真实读写
3. Auth
4. 前端视觉重做