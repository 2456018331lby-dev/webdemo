import { NextRequest, NextResponse } from "next/server";
import { parseCommandRequest } from "@smart-home/device-contract";
import {
  applyLifecyclePolicies,
  getCommandHistory,
  getDeviceState,
  queueDeviceCommand,
  seedDeviceState,
  simulateCommandDelivery
} from "@/lib/server/device-runtime";
import { findDevice } from "@/lib/mock-data";

type RouteContext = {
  params: Promise<{
    deviceId: string;
  }>;
};

async function ensureDeviceSeeded(deviceId: string) {
  const existing = await getDeviceState(deviceId);

  if (existing) {
    return existing;
  }

  const found = findDevice(deviceId);

  if (!found) {
    return null;
  }

  seedDeviceState({
    deviceId: found.device.id,
    relayOn: found.device.relayOn,
    lastTelemetry: found.device.lastTelemetry,
    online: found.device.online,
    updatedAt: new Date().toISOString()
  });

  return await getDeviceState(deviceId);
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { deviceId } = await context.params;
  const state = await ensureDeviceSeeded(deviceId);

  if (!state) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  // Apply lifecycle policies so timeout / retry states are evaluated on every read
  applyLifecyclePolicies({ now: new Date().toISOString() });

  return NextResponse.json({
    state: await getDeviceState(deviceId),
    commandHistory: await getCommandHistory(deviceId)
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { deviceId } = await context.params;
  const found = findDevice(deviceId);
  const state = await ensureDeviceSeeded(deviceId);

  if (!found || !state) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  if (!state.online) {
    return NextResponse.json({ error: "Device is offline" }, { status: 409 });
  }

  try {
    const body = await request.json();
    const parsed = parseCommandRequest({
      ...body,
      deviceId
    });

    const command = queueDeviceCommand(parsed);
    const ack = await simulateCommandDelivery(deviceId, command.commandId);

    return NextResponse.json({
      command,
      ack,
      state: await getDeviceState(deviceId),
      commandHistory: await getCommandHistory(deviceId)
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid request"
      },
      { status: 400 }
    );
  }
}
