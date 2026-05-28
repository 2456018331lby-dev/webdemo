type ControlTelemetryInput = {
  online: boolean;
  relayOn: boolean;
  telemetryText: string;
};

type RelayRiskInput = ControlTelemetryInput & {
  nextValue: boolean;
};

type CooldownInput = {
  online: boolean;
  telemetryText: string;
};

export const CONTROL_BALANCE = {
  reliability: {
    offlineBaseScore: 22,
    onlineBaseScore: 78,
    rssiStrongBonus: 8,
    rssiWeakPenalty: 14,
    staleHeartbeatPenalty: 26,
    humidityWarningPenalty: 8,
    voltageWarningPenalty: 10,
    relayOnBonus: 4
  },
  risk: {
    baseToggleRisk: 18,
    turnOnPenalty: 12,
    offlinePenalty: 48,
    staleTelemetryPenalty: 18,
    weakSignalPenalty: 12,
    lowVoltagePenalty: 14
  },
  cooldownMs: {
    base: 1200,
    offlinePenalty: 2400,
    staleTelemetryPenalty: 1200,
    weakSignalPenalty: 800
  }
} as const;

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function parseRssi(telemetryText: string) {
  const match = telemetryText.match(/RSSI\s*(-?\d+)/i);
  return match ? Number(match[1]) : null;
}

function parseVoltage(telemetryText: string) {
  const match = telemetryText.match(/Voltage\s*([0-9.]+)/i);
  return match ? Number(match[1]) : null;
}

function parseHumidity(telemetryText: string) {
  const match = telemetryText.match(/Humidity\s*([0-9.]+)/i);
  return match ? Number(match[1]) : null;
}

function isTelemetryStale(telemetryText: string) {
  return /heartbeat\s+[0-9]+\s+minutes\s+ago/i.test(telemetryText);
}

function hasWeakSignal(telemetryText: string) {
  const rssi = parseRssi(telemetryText);
  return typeof rssi === "number" && rssi <= -72;
}

function hasLowVoltage(telemetryText: string) {
  const voltage = parseVoltage(telemetryText);
  return typeof voltage === "number" && voltage < 3.2;
}

export function computeDeviceReliability(input: ControlTelemetryInput) {
  let score = input.online
    ? CONTROL_BALANCE.reliability.onlineBaseScore
    : CONTROL_BALANCE.reliability.offlineBaseScore;

  if (input.relayOn) {
    score += CONTROL_BALANCE.reliability.relayOnBonus;
  }

  const rssi = parseRssi(input.telemetryText);
  if (typeof rssi === "number") {
    if (rssi >= -65) {
      score += CONTROL_BALANCE.reliability.rssiStrongBonus;
    } else if (rssi <= -72) {
      score -= CONTROL_BALANCE.reliability.rssiWeakPenalty;
    }
  }

  if (isTelemetryStale(input.telemetryText)) {
    score -= CONTROL_BALANCE.reliability.staleHeartbeatPenalty;
  }

  const humidity = parseHumidity(input.telemetryText);
  if (typeof humidity === "number" && humidity >= 65) {
    score -= CONTROL_BALANCE.reliability.humidityWarningPenalty;
  }

  if (hasLowVoltage(input.telemetryText)) {
    score -= CONTROL_BALANCE.reliability.voltageWarningPenalty;
  }

  return clamp(score);
}

export function formatReliabilityBand(score: number) {
  if (score >= 80) {
    return "stable";
  }
  if (score >= 55) {
    return "watch";
  }
  return "degraded";
}

export function computeRelayCommandRisk(input: RelayRiskInput) {
  let risk = CONTROL_BALANCE.risk.baseToggleRisk;

  if (input.nextValue) {
    risk += CONTROL_BALANCE.risk.turnOnPenalty;
  }

  if (!input.online) {
    risk += CONTROL_BALANCE.risk.offlinePenalty;
  }

  if (isTelemetryStale(input.telemetryText)) {
    risk += CONTROL_BALANCE.risk.staleTelemetryPenalty;
  }

  if (hasWeakSignal(input.telemetryText)) {
    risk += CONTROL_BALANCE.risk.weakSignalPenalty;
  }

  if (hasLowVoltage(input.telemetryText)) {
    risk += CONTROL_BALANCE.risk.lowVoltagePenalty;
  }

  return clamp(risk);
}

export function formatRiskLabel(score: number) {
  if (score >= 75) {
    return "high";
  }
  if (score >= 45) {
    return "medium";
  }
  return "low";
}

export function computeRelayCommandCooldownMs(input: CooldownInput) {
  let cooldown = CONTROL_BALANCE.cooldownMs.base;

  if (!input.online) {
    cooldown += CONTROL_BALANCE.cooldownMs.offlinePenalty;
  }

  if (isTelemetryStale(input.telemetryText)) {
    cooldown += CONTROL_BALANCE.cooldownMs.staleTelemetryPenalty;
  }

  if (hasWeakSignal(input.telemetryText)) {
    cooldown += CONTROL_BALANCE.cooldownMs.weakSignalPenalty;
  }

  return cooldown;
}

export function getDeviceControlSnapshot(input: ControlTelemetryInput) {
  const reliabilityScore = computeDeviceReliability(input);
  const recommendedNextValue = input.relayOn ? false : true;
  const riskScore = computeRelayCommandRisk({
    ...input,
    nextValue: recommendedNextValue
  });

  return {
    reliabilityScore,
    reliabilityBand: formatReliabilityBand(reliabilityScore),
    riskScore,
    riskLabel: formatRiskLabel(riskScore),
    cooldownMs: computeRelayCommandCooldownMs(input),
    recommendedAction: riskScore >= 75 ? "inspect_before_toggle" : "safe_to_toggle",
    offlinePenaltyApplied: !input.online
  } as const;
}

export function getHomeControlSummary(devices: ControlTelemetryInput[]) {
  const deviceCount = devices.length;
  const offlineCount = devices.filter((device) => !device.online).length;
  const averageReliability =
    deviceCount === 0
      ? 0
      : Math.round(
          devices.reduce((sum, device) => sum + computeDeviceReliability(device), 0) / deviceCount
        );

  return {
    deviceCount,
    offlineCount,
    averageReliability,
    systemPosture:
      offlineCount > 0 || averageReliability < 55
        ? "degraded"
        : averageReliability >= 80
          ? "stable"
          : "watch"
  } as const;
}
