export const contractVersion = "0.1.0";

export type CommandType =
  | "relay.set"
  | "dimmer.set"
  | "mode.set"
  | "sensor.refresh"
  | "device.restart";

export type CommandRequest = {
  deviceId: string;
  commandType: CommandType;
  correlationId: string;
  payload: Record<string, unknown>;
};

export type TelemetryEvent = {
  messageType: "telemetry";
  deviceId: string;
  reportedAt: string;
  metrics: {
    temperatureC?: number;
    humidityPct?: number;
    signalRssi?: number;
    supplyVoltage?: number;
  };
  reportedState?: Record<string, unknown>;
};

export type AckPayload = {
  messageType: "ack";
  correlationId: string;
  result: "ok" | "rejected" | "busy" | "invalid_payload" | "unsafe_operation";
  reportedState: Record<string, unknown>;
  reportedAt: string;
};

const commandTypes: CommandType[] = [
  "relay.set",
  "dimmer.set",
  "mode.set",
  "sensor.refresh",
  "device.restart"
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function parseCommandRequest(value: unknown): CommandRequest {
  if (!isRecord(value)) {
    throw new Error("Invalid command request");
  }

  const { deviceId, commandType, correlationId, payload } = value;

  if (!isString(deviceId) || !isString(correlationId) || !isRecord(payload)) {
    throw new Error("Invalid command request");
  }

  if (!isString(commandType) || !commandTypes.includes(commandType as CommandType)) {
    throw new Error("Invalid command request");
  }

  if (commandType === "relay.set") {
    const channel = payload.channel;
    const relayValue = payload.value;

    if (
      typeof channel !== "number" ||
      !Number.isInteger(channel) ||
      typeof relayValue !== "boolean"
    ) {
      throw new Error("Invalid command request");
    }
  }

  return {
    deviceId,
    commandType: commandType as CommandType,
    correlationId,
    payload
  };
}

export function parseTelemetryEvent(value: unknown): TelemetryEvent {
  if (!isRecord(value)) {
    throw new Error("Invalid telemetry event");
  }

  const { messageType, deviceId, reportedAt, metrics, reportedState } = value;

  if (messageType !== "telemetry" || !isString(deviceId) || !isString(reportedAt) || !isRecord(metrics)) {
    throw new Error("Invalid telemetry event");
  }

  const { temperatureC, humidityPct, signalRssi, supplyVoltage } = metrics;

  if (
    (temperatureC !== undefined && !isFiniteNumber(temperatureC)) ||
    (humidityPct !== undefined && !isFiniteNumber(humidityPct)) ||
    (signalRssi !== undefined && !isFiniteNumber(signalRssi)) ||
    (supplyVoltage !== undefined && !isFiniteNumber(supplyVoltage))
  ) {
    throw new Error("Invalid telemetry event");
  }

  if (reportedState !== undefined && !isRecord(reportedState)) {
    throw new Error("Invalid telemetry event");
  }

  return {
    messageType,
    deviceId,
    reportedAt,
    metrics: {
      ...(temperatureC !== undefined ? { temperatureC } : {}),
      ...(humidityPct !== undefined ? { humidityPct } : {}),
      ...(signalRssi !== undefined ? { signalRssi } : {}),
      ...(supplyVoltage !== undefined ? { supplyVoltage } : {})
    },
    ...(reportedState !== undefined ? { reportedState } : {})
  };
}

export function parseAckPayload(value: unknown): AckPayload {
  if (!isRecord(value)) {
    throw new Error("Invalid ack payload");
  }

  const { messageType, correlationId, result, reportedState, reportedAt } = value;
  const validResults = ["ok", "rejected", "busy", "invalid_payload", "unsafe_operation"];

  if (
    messageType !== "ack" ||
    !isString(correlationId) ||
    !isString(reportedAt) ||
    !isRecord(reportedState) ||
    !isString(result) ||
    !validResults.includes(result)
  ) {
    throw new Error("Invalid ack payload");
  }

  return {
    messageType,
    correlationId,
    result: result as AckPayload["result"],
    reportedState,
    reportedAt
  };
}
