# 硬件集成接入指南

> 面向后续 AI 智能体和硬件工程师。读完本文就能接手 ESP32S3 + STM32H743 的对接工作。

## 1. 系统架构全景

```
┌─────────────┐     HTTP      ┌──────────────┐    MQTT/HTTP    ┌───────────┐    UART    ┌───────────┐
│  Next.js Web │ ←─────────── │  Device       │ ←───────────── │  ESP32S3  │ ────────→ │ STM32H743 │
│  Dashboard   │ ───────────→ │  Runtime      │ ─────────────→ │  Bridge   │ ←──────── │  MCU      │
│  (浏览器)     │   JSON API  │  (server层)   │  command push  │  (WiFi)   │  ack/遥测  │  (控制)    │
└─────────────┘              └──────────────┘                └───────────┘           └───────────┘
                                    │                              │
                                    ▼                              ▼
                              ┌──────────┐                  ┌──────────────┐
                              │ InMemory │                  │ UART 帧编码   │
                              │ Backend  │                  │ 协议文档见    │
                              │ (默认)    │                  │ protocol.md  │
                              └──────────┘                  └──────────────┘
```

## 2. 已完成层（不用动）

### 2.1 消息契约 — `packages/device-contract/src/index.ts`

已定义并测试的类型：

| 类型 | 用途 |
|------|------|
| `CommandRequest` | 网页→后端命令 |
| `AckPayload` | 硬件→后端确认 |
| `TelemetryEvent` | 硬件→后端遥测 |

解析函数：`parseCommandRequest()` / `parseAckPayload()` / `parseTelemetryEvent()`

### 2.2 后端接口 — `apps/web/src/lib/server/device-backend.ts`

`DeviceBackend` 接口定义了 9 个方法，InMemoryDeviceBackend 已完整实现：

```
reset()                  — 清空所有状态
seedState(record)        — 注入设备初始状态
getState(deviceId)       — 读取设备状态
getCommandHistory(deviceId) — 读取命令历史
queueCommand(request)    — 排队命令，返回命令记录
markCommandDelivered(id) — 标记已送达
applyAckPayload(ack)     — 处理硬件 ack（含 busy→重试逻辑）
applyLifecyclePolicies() — 评估 timeout 状态
simulateCommandDelivery() — 模拟器投递
```

### 2.3 生命周期策略 — `apps/web/src/lib/control-lifecycle.ts`

| 函数 | 功能 |
|------|------|
| `classifyAckResult()` | ack结果 → acknowledged/retryable/failed |
| `shouldRetryCommand()` | 判断是否重试 |
| `computeRetryDelayMs()` | 退避延迟（1.2s + 1.8s/次） |
| `computeTimeoutTransition()` | 超时检测 |

### 2.4 已打通的数据流

```
用户点击按钮 → POST /api/devices/[deviceId]/commands
  → parseCommandRequest() 校验
  → queueDeviceCommand() 排队
  → [模拟器: simulateCommandDelivery()]
  → [真实: ESP32S3 dispatch → UART → STM32 → ack]
  → applyAckPayload() 更新状态
  → 返回 state + history 给前端
```

## 3. 待完成层（硬件端）

### 3.1 ESP32S3 固件 — 命令下行通道

ESP32S3 需要实现以下流程：

```
1. 连接到 WiFi
2. 订阅 MQTT 主题: smart-home/{deviceId}/commands
   （或轮询: GET /api/devices/{deviceId}/commands?pending=true）
3. 收到命令后：
   a. 解析 JSON payload
   b. 编码为 UART 帧发送给 STM32H743
   c. 等待 STM32 ack（1500ms 超时）
   d. POST ack 到 /api/devices/{deviceId}/ingest
4. 每 30 秒上报遥测到 /api/devices/{deviceId}/ingest
```

### 3.2 ESP32S3 → STM32H743 UART 协议

帧格式（来自 `docs/protocols/smart-home-mvp-device-contract.md`）：

```
SOF | version | message_type | command_code | correlation_id | payload_length | payload | crc
```

| 字段 | 字节 | 说明 |
|------|------|------|
| SOF | 1 | 帧头，固定 0xAA |
| version | 1 | 协议版本，当前 0x01 |
| message_type | 1 | 0x01=command, 0x02=ack, 0x03=telemetry, 0x04=error |
| command_code | 1 | 0x01=relay.set, 0x02=dimmer.set, 0x03=mode.set |
| correlation_id | 4 | uint32，匹配命令和 ack |
| payload_length | 2 | payload 字节数（大端） |
| payload | N | JSON 或二进制 payload |
| crc | 2 | CRC16-CCITT，覆盖 header + payload |

### 3.3 STM32H743 固件

STM32 端需要：
1. UART 中断接收帧，CRC 校验
2. 解析 command_code 分发到对应控制逻辑
3. 执行 GPIO/PWM/ADC 操作
4. 检查安全互锁条件
5. 构建 ack 帧通过 UART 发回

## 4. 设备上行 API

### 4.1 Ack 上报

```
POST /api/devices/[deviceId]/ingest
Content-Type: application/json
X-Device-Token: <device-auth-token>

{
  "messageType": "ack",
  "correlationId": "uuid",
  "result": "ok",
  "reportedState": {
    "relay": {
      "channel": 1,
      "value": true
    }
  },
  "reportedAt": "2026-05-26T10:00:00Z"
}
```

### 4.2 遥测上报

```
POST /api/devices/[deviceId]/ingest
Content-Type: application/json
X-Device-Token: <device-auth-token>

{
  "messageType": "telemetry",
  "deviceId": "device-relay-01",
  "reportedAt": "2026-05-26T10:00:00Z",
  "metrics": {
    "temperatureC": 24.6,
    "humidityPct": 48.1,
    "signalRssi": -61,
    "supplyVoltage": 3.28
  },
  "reportedState": {
    "relay": { "channel": 1, "value": true }
  }
}
```

## 5. 接入步骤清单

按顺序做，每步可独立验证：

### Step 1: 验证 ESP32S3 WiFi 连接
- 写简单 Arduino sketch，连 WiFi，打印 IP

### Step 2: 实现 UART 帧收发
- ESP32S3 侧：实现帧编码/解码函数库
- STM32H743 侧：实现 UART 中断接收 + 帧解析
- 验证：ESP32 发 relay.set 帧，STM32 GPIO 翻转，回 ack

### Step 3: 对接设备上行 API
- ESP32 用 HTTP POST 上报 ack 和遥测到 /api/devices/[deviceId]/ingest
- 后端 ingest route 调用 applyAckPayload() 更新状态
- 验证：网页按钮控制 → ESP32 → STM32 → ack → 网页状态更新

### Step 4: 命令下行（方向：后端→ESP32）
- 方案 A (MQTT): 后端发布到 smart-home/{deviceId}/commands，ESP32 订阅
- 方案 B (HTTP 轮询): ESP32 每 2 秒 GET /api/devices/{deviceId}/commands?pending=true
- MVP 推荐方案 B（简单），后续换 MQTT

### Step 5: 安全加固
- 设备 Token 认证（X-Device-Token header）
- HTTPS/TLS
- OTA 固件更新流程

## 6. 关键时序

| 操作 | 时限 |
|------|------|
| 后端命令总超时 | 5000ms |
| ESP32→STM32 ack 超时 | 1500ms |
| 遥测心跳间隔 | 30s |
| 设备离线判定 | 90s 无心跳 |
| 命令重试最大次数 | 3 次 |
| 重试退避延迟 | 1200ms + (N-1)×1800ms |

## 7. 文件索引

| 文件 | 职责 |
|------|------|
| `packages/device-contract/src/index.ts` | 消息类型 + 解析器 |
| `apps/web/src/lib/server/device-backend.ts` | 后端接口定义 |
| `apps/web/src/lib/server/in-memory-device-backend.ts` | 当前默认实现 |
| `apps/web/src/lib/server/device-runtime.ts` | 运行时单例入口 |
| `apps/web/src/lib/server/device-backend-factory.ts` | 后端选择工厂 |
| `apps/web/src/lib/control-lifecycle.ts` | 生命周期状态机 |
| `apps/web/src/lib/control-balance.ts` | 可靠度/风险评估 |
| `apps/web/src/app/api/devices/[deviceId]/commands/route.ts` | 网页命令 API |
| `apps/web/src/app/api/devices/[deviceId]/ingest/route.ts` | 设备上行 API |
| `docs/protocols/smart-home-mvp-device-contract.md` | UART 协议详细定义 |
| `docs/hardware/integration-guide.md` | 本文档 |
| `supabase/migrations/20260510180000_initial_schema.sql` | 数据库 schema |