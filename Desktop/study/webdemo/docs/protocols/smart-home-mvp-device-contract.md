# Smart Home MVP Device Contract

## Purpose

This document defines the MVP contract between:
- web dashboard
- backend command layer
- ESP32S3 connectivity bridge
- STM32H743 control firmware

The goal is to freeze message shape before implementation expands.

## Device Identity

Each device must have:
- `device_id`: public UUID used by app and backend
- `device_token`: private token sent only in `X-Device-Token` for ingest authentication
- `bridge_id`: unique ESP32S3 identity
- `controller_id`: STM32H743 logical identity
- `home_id`
- `room_id`
- `device_type`
- `firmware_version`

## Command Lifecycle

Command states:
- `queued`
- `delivered`
- `acknowledged`
- `failed`
- `timed_out`

Every command must include:
- `command_id`
- `device_id`
- `correlation_id`
- `command_type`
- `requested_by`
- `requested_at`
- `payload`

## App To Backend Command Payload

```json
{
  "deviceId": "3a4cb0f8-4a1b-4f0b-8f70-1b93f17d4cb0",
  "commandType": "relay.set",
  "correlationId": "9f2cb27c-b1d4-4978-bbfe-2fdbaf4a6f56",
  "payload": {
    "channel": 1,
    "value": true
  }
}
```

## Backend To ESP32 Normalized Payload

HTTP 轮询入口：

```text
GET /api/devices/{deviceId}/commands?pending=true
X-Device-Token: <device_token>
```

返回的 `commands[]` 使用以下 normalized payload。服务端返回后会把对应命令标记为 `delivered`，ESP32S3 执行后必须用相同 `correlationId` 上报 ack。

```json
{
  "commandId": "cmd_0001",
  "deviceId": "3a4cb0f8-4a1b-4f0b-8f70-1b93f17d4cb0",
  "correlationId": "9f2cb27c-b1d4-4978-bbfe-2fdbaf4a6f56",
  "messageType": "command",
  "commandType": "relay.set",
  "payload": {
    "channel": 1,
    "value": true
  },
  "issuedAt": "2026-05-10T09:00:00Z"
}
```

## UART Frame Structure

Use this layout:

```text
SOF | version | message_type | command_code | correlation_id | payload_length | payload | crc
```

Rules:
- `SOF` is a single byte start marker
- `version` is one byte
- `message_type` differentiates command, ack, telemetry, and error
- `command_code` maps to a fixed enum in both ESP32 and STM32
- `correlation_id` is a compact binary or integer form
- `payload_length` is fixed-width
- `crc` covers header and payload

## STM32 Ack Payload

```json
{
  "messageType": "ack",
  "correlationId": "9f2cb27c-b1d4-4978-bbfe-2fdbaf4a6f56",
  "result": "ok",
  "reportedState": {
    "relay": {
      "channel": 1,
      "value": true
    }
  },
  "reportedAt": "2026-05-10T09:00:01Z"
}
```

Possible `result` values:
- `ok`
- `rejected`
- `busy`
- `invalid_payload`
- `unsafe_operation`

## Telemetry Payload

```json
{
  "messageType": "telemetry",
  "deviceId": "3a4cb0f8-4a1b-4f0b-8f70-1b93f17d4cb0",
  "reportedAt": "2026-05-10T09:00:02Z",
  "metrics": {
    "temperatureC": 24.6,
    "humidityPct": 48.1,
    "signalRssi": -61,
    "supplyVoltage": 3.28
  },
  "reportedState": {
    "relay": {
      "channel": 1,
      "value": true
    }
  }
}
```

## Error Payload

```json
{
  "messageType": "error",
  "correlationId": "9f2cb27c-b1d4-4978-bbfe-2fdbaf4a6f56",
  "errorCode": "timeout_to_controller",
  "detail": "STM32 did not ack within 1500 ms"
}
```

## Timing Rules

- backend command timeout: 5 seconds
- ESP32 to STM32 ack timeout: 1500 milliseconds
- telemetry heartbeat: every 30 seconds
- device offline threshold: 90 seconds without heartbeat

## State Rules

- desired state updates immediately after a validated user command
- reported state updates only after device ack or telemetry confirms the hardware state
- UI must display pending or failed state if reported state lags desired state

## Versioning Rules

- every payload includes a protocol version
- breaking changes require a new version
- backend supports only one active MVP version at a time

## MVP Command Families

- `relay.set`
- `dimmer.set`
- `mode.set`
- `sensor.refresh`
- `device.restart`

Future command families should not be added until the shared contract package and tests are updated.
