import { NextRequest, NextResponse } from "next/server";
import { parseAckPayload, parseTelemetryEvent } from "@smart-home/device-contract";
import {
  applyAckByCorrelationId,
  applyLifecyclePolicies,
  getCommandHistory,
  getDeviceState,
  seedDeviceState
} from "@/lib/server/device-runtime";
import { DEVICE_TOKEN_HEADER, authenticateDeviceToken } from "@/lib/server/device-token-auth";

type RouteContext = {
  params: Promise<{
    deviceId: string;
  }>;
};

/**
 * 设备上行入口 — ESP32S3 调用此端点上报 ack 和遥测。
 *
 * 认证：配置 SMART_HOME_DEVICE_TOKENS 后校验 X-Device-Token header。
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { deviceId } = await context.params;
  const auth = authenticateDeviceToken(deviceId, request.headers.get(DEVICE_TOKEN_HEADER));

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { messageType } = body;

    // 确保设备状态在运行时中存在
    const state = await getDeviceState(deviceId);
    if (!state) {
      seedDeviceState({
        deviceId,
        relayOn: false,
        lastTelemetry: "",
        online: false,
        updatedAt: new Date().toISOString()
      });
    }

    // 先跑生命周期策略（评估已有命令是否超时）
    applyLifecyclePolicies({ now: new Date().toISOString() });

    if (messageType === "ack") {
      const ack = parseAckPayload(body);
      await applyAckByCorrelationId(deviceId, ack.correlationId, ack);
    } else if (messageType === "telemetry") {
      const telemetry = parseTelemetryEvent(body);

      // 更新设备状态为在线，写入遥测摘要
      const current = await getDeviceState(deviceId);
      if (current) {
        const parts: string[] = [];
        if (typeof telemetry.metrics.temperatureC === "number")
          parts.push(`Temperature ${telemetry.metrics.temperatureC} C`);
        if (typeof telemetry.metrics.humidityPct === "number")
          parts.push(`Humidity ${telemetry.metrics.humidityPct}%`);
        if (typeof telemetry.metrics.signalRssi === "number")
          parts.push(`RSSI ${telemetry.metrics.signalRssi} dBm`);
        if (typeof telemetry.metrics.supplyVoltage === "number")
          parts.push(`Voltage ${telemetry.metrics.supplyVoltage} V`);

        seedDeviceState({
          ...current,
          online: true,
          lastTelemetry: parts.join(", ") || `Last reported at ${telemetry.reportedAt}`,
          updatedAt: telemetry.reportedAt
        });
      }
    } else {
      return NextResponse.json(
        { error: "Unknown messageType. Use 'ack' or 'telemetry'." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      state: await getDeviceState(deviceId),
      commandHistory: await getCommandHistory(deviceId)
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid ingest payload"
      },
      { status: 400 }
    );
  }
}
