import { NextRequest, NextResponse } from "next/server";
import { parseCommandRequest } from "@smart-home/device-contract";
import {
  applyLifecyclePolicies,
  getCommandHistory,
  getDeviceState,
  markCommandDelivered,
  queueDeviceCommand,
  seedDeviceState,
  simulateCommandDelivery
} from "@/lib/server/device-runtime";
import type { DeviceCommandRecord } from "@/lib/server/device-backend";
import { DEVICE_TOKEN_HEADER, authenticateDeviceToken } from "@/lib/server/device-token-auth";
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

function isPollingDeliveryMode() {
  return process.env.SMART_HOME_COMMAND_DELIVERY?.trim().toLowerCase() === "polling";
}

function isPendingPollRequest(request: NextRequest) {
  return request.nextUrl.searchParams.get("pending") === "true";
}

function isCommandDue(command: DeviceCommandRecord, now: string) {
  return (
    command.status === "queued" &&
    (!command.nextRetryAt || new Date(command.nextRetryAt).getTime() <= new Date(now).getTime())
  );
}

function toHardwareCommand(command: DeviceCommandRecord) {
  return {
    commandId: command.commandId,
    deviceId: command.deviceId,
    correlationId: command.correlationId,
    messageType: "command" as const,
    commandType: command.commandType,
    payload: command.payload,
    issuedAt: command.requestedAt,
    attemptCount: command.attemptCount ?? 1
  };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { deviceId } = await context.params;

  if (isPendingPollRequest(request)) {
    const auth = authenticateDeviceToken(deviceId, request.headers.get(DEVICE_TOKEN_HEADER));

    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
  }

  const state = await ensureDeviceSeeded(deviceId);

  if (!state) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  // Apply lifecycle policies so timeout / retry states are evaluated on every read
  applyLifecyclePolicies({ now: new Date().toISOString() });

  if (isPendingPollRequest(request)) {
    const now = new Date().toISOString();
    const dueCommands = (await getCommandHistory(deviceId))
      .filter((command) => isCommandDue(command, now))
      .sort((left, right) => new Date(left.requestedAt).getTime() - new Date(right.requestedAt).getTime());

    for (const command of dueCommands) {
      markCommandDelivered(deviceId, command.commandId);
    }

    return NextResponse.json({
      deviceId,
      polledAt: now,
      commands: dueCommands.map(toHardwareCommand),
      state: await getDeviceState(deviceId),
      commandHistory: await getCommandHistory(deviceId)
    });
  }

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

    if (isPollingDeliveryMode()) {
      return NextResponse.json(
        {
          command,
          state: await getDeviceState(deviceId),
          commandHistory: await getCommandHistory(deviceId),
          deliveryMode: "polling"
        },
        { status: 202 }
      );
    }

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
