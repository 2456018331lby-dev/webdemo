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

// 支持中英文格式的解析函数
function parseRssi(telemetryText: string) {
  // 支持 "RSSI -61 dBm" 或 "信号强度 -61 dBm"
  const match = telemetryText.match(/(?:RSSI|信号强度)\s*(-?\d+)/i);
  return match ? Number(match[1]) : null;
}

function parseVoltage(telemetryText: string) {
  // 支持 "Voltage 3.28 V" 或 "电压 3.28 V"
  const match = telemetryText.match(/(?:Voltage|电压)\s*([0-9.]+)/i);
  return match ? Number(match[1]) : null;
}

function parseHumidity(telemetryText: string) {
  // 支持 "Humidity 48.1%" 或 "湿度 48.1%"
  const match = telemetryText.match(/(?:Humidity|湿度)\s*([0-9.]+)/i);
  return match ? Number(match[1]) : null;
}

function parseTemperature(telemetryText: string) {
  // 支持 "Temperature 24.6 C" 或 "温度 24.6°C"
  const match = telemetryText.match(/(?:Temperature|温度)\s*([0-9.]+)/i);
  return match ? Number(match[1]) : null;
}

function parseCO2(telemetryText: string) {
  // 支持 "CO2 450ppm"
  const match = telemetryText.match(/CO2\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

function parsePM25(telemetryText: string) {
  // 支持 "PM2.5 15μg/m³"
  const match = telemetryText.match(/PM2\.?\s*5?\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

function isTelemetryStale(telemetryText: string) {
  // 支持 "Last heartbeat 2 minutes ago" 或 "最后心跳 2 分钟前"
  return /(?:heartbeat|心跳)\s*\d+\s*(?:minutes?|分钟)/i.test(telemetryText);
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

export function formatReliabilityBandCN(score: number): string {
  if (score >= 80) return "稳定";
  if (score >= 55) return "关注";
  return "异常";
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

export function formatRiskLabelCN(score: number): string {
  if (score >= 75) return "高";
  if (score >= 45) return "中";
  return "低";
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

// 解析遥测数据为结构化对象
export function parseTelemetryData(telemetryText: string) {
  return {
    temperature: parseTemperature(telemetryText),
    humidity: parseHumidity(telemetryText),
    rssi: parseRssi(telemetryText),
    voltage: parseVoltage(telemetryText),
    co2: parseCO2(telemetryText),
    pm25: parsePM25(telemetryText),
    isStale: isTelemetryStale(telemetryText)
  };
}

// 格式化遥测数据为中文显示
export function formatTelemetryCN(telemetryText: string): Array<{ label: string; value: string; unit: string; status?: "normal" | "warning" | "danger" }> {
  const data = parseTelemetryData(telemetryText);
  const result: Array<{ label: string; value: string; unit: string; status?: "normal" | "warning" | "danger" }> = [];

  if (data.temperature !== null) {
    const status = data.temperature > 30 ? "warning" : data.temperature < 10 ? "warning" : "normal";
    result.push({ label: "温度", value: data.temperature.toFixed(1), unit: "°C", status });
  }

  if (data.humidity !== null) {
    const status = data.humidity > 65 ? "warning" : data.humidity < 30 ? "warning" : "normal";
    result.push({ label: "湿度", value: data.humidity.toFixed(1), unit: "%", status });
  }

  if (data.rssi !== null) {
    const status = data.rssi <= -72 ? "danger" : data.rssi <= -65 ? "warning" : "normal";
    result.push({ label: "信号强度", value: data.rssi.toString(), unit: "dBm", status });
  }

  if (data.voltage !== null) {
    const status = data.voltage < 3.2 ? "danger" : data.voltage < 3.5 ? "warning" : "normal";
    result.push({ label: "电压", value: data.voltage.toFixed(2), unit: "V", status });
  }

  if (data.co2 !== null) {
    const status = data.co2 > 1000 ? "warning" : "normal";
    result.push({ label: "CO2", value: data.co2.toString(), unit: "ppm", status });
  }

  if (data.pm25 !== null) {
    const status = data.pm25 > 35 ? "warning" : "normal";
    result.push({ label: "PM2.5", value: data.pm25.toString(), unit: "μg/m³", status });
  }

  return result;
}
