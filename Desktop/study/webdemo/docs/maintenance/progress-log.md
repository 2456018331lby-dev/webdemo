# Progress Log

## 2026-05-26 (续)

- DeviceCommandClient 消除闪白：新增 `initialHistory` / `initialTelemetry` props，SSR 数据通过 hydration 保留
- 组件挂载时不再显示 "Loading device state..."，直接用 SSR 传入的真实数据渲染
- 新增 5 秒自动轮询：独立 useEffect 定时 fetch API，生命周期状态实时更新
- 设备页 SSR 传入完整 commandHistory + telemetry 数据
- 删除死代码 `dashboard-state.ts`
- 回退 SQLite 方案（WSL 环境编译依赖问题），保持 InMemoryDeviceBackend 为默认后端

### 验证
- `npm run test`: 12 files / 52 tests 全部通过
- `npm run lint`: 0 errors, 0 warnings

## 2026-05-26 (续 II — 硬件对接基础设施)

- 创建 `docs/hardware/integration-guide.md`：完整硬件集成文档（架构图、UART帧格式、ESP32/STM32步骤清单、时序规则）
- 新增 `POST /api/devices/[deviceId]/ingest`：ESP32S3 上行端点，接收 ack 和 telemetry
- DeviceBackend 接口补 `applyAckByCorrelationId()` 方法（ESP32 只知道 correlationId）
- device-runtime 实现默认 correlationId→commandId 查找逻辑
- ingest route 测试 3/3 通过
- 更新 AGENTS.md / project-handoff.md / task-board.md 为最新状态

### 验证
- `npm run test`: 13 files / 55 tests 全部通过
- `npm run lint`: 0 errors, 0 warnings
- `npm run build`: 通过

---

## 2026-05-26

- 打通生命周期策略端到端：`applyLifecyclePolicies()` 从仅在测试中存在 → 接入 API route GET / lifecycle-tick 端点
- 在 device-runtime 中暴露 `applyLifecyclePolicies()` 供 route 调用
- 修改 `/api/devices/[deviceId]/commands` GET：每次查询前自动评估 timeout/retry 状态
- 新增 `/api/system/lifecycle-tick` POST 端点：全局生命周期轮询接口
- 新增 `/api/homes/snapshot` GET 端点：聚合所有设备的生命周期统计（超时/失败/重试计数）
- CommandHistoryList 增强：顶部 lifecycle summary 面板，根据不同状态展示不同颜色和文案
- 设备详情页重写为 SSR + 生命周期状态栏：首次 HTML 中就能看到命令状态
- Homes 页重写为 SSR + 客户端 hydrate：首屏数据直出，15 秒自动轮询
- Landing 页清理：去掉防御性文案，改为面向产品功能描述
- 修复 Supabase 类型和 SQL 迁移：补充 `attempt_count` 和 `next_retry_at` 列
- 修复 2 个 Supabase 测试时间戳硬编码问题
- 修复全部 lint warnings

## 2026-05-10

(历史记录同上)