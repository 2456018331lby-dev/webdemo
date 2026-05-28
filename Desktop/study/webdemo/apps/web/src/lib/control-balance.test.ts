import { describe, expect, it } from "vitest";
import {
  CONTROL_BALANCE,
  computeDeviceReliability,
  computeRelayCommandCooldownMs,
  computeRelayCommandRisk,
  formatReliabilityBand,
  formatRiskLabel,
  getDeviceControlSnapshot,
  getHomeControlSummary
} from "./control-balance";

describe("control balance", () => {
  it("computes lower reliability for offline devices with stale telemetry", () => {
    const reliability = computeDeviceReliability({
      online: false,
      relayOn: false,
      telemetryText: "Last heartbeat 2 minutes ago"
    });

    expect(reliability).toBeLessThanOrEqual(CONTROL_BALANCE.reliability.offlineBaseScore);
    expect(formatReliabilityBand(reliability)).toBe("degraded");
  });

  it("computes higher reliability for online devices with healthy telemetry", () => {
    const reliability = computeDeviceReliability({
      online: true,
      relayOn: true,
      telemetryText: "Temperature 24.6 C, RSSI -61 dBm"
    });

    expect(reliability).toBeGreaterThanOrEqual(80);
    expect(formatReliabilityBand(reliability)).toBe("stable");
  });

  it("assigns higher risk to toggling an offline relay", () => {
    const risk = computeRelayCommandRisk({
      online: false,
      relayOn: false,
      telemetryText: "Last heartbeat 2 minutes ago",
      nextValue: true
    });

    expect(risk).toBeGreaterThanOrEqual(80);
    expect(formatRiskLabel(risk)).toBe("high");
  });

  it("assigns lower risk to toggling an online relay off", () => {
    const risk = computeRelayCommandRisk({
      online: true,
      relayOn: true,
      telemetryText: "Temperature 24.6 C, RSSI -61 dBm",
      nextValue: false
    });

    expect(risk).toBeLessThan(50);
    expect(formatRiskLabel(risk)).toBe("low");
  });

  it("returns a richer control snapshot for device detail pages", () => {
    const snapshot = getDeviceControlSnapshot({
      online: true,
      relayOn: false,
      telemetryText: "Temperature 24.6 C, RSSI -61 dBm"
    });

    expect(snapshot).toMatchObject({
      reliabilityBand: "stable",
      recommendedAction: "safe_to_toggle",
      offlinePenaltyApplied: false
    });
    expect(snapshot.cooldownMs).toBeGreaterThan(0);
  });

  it("builds a home-level summary for dashboard planning", () => {
    const summary = getHomeControlSummary([
      {
        online: true,
        relayOn: true,
        telemetryText: "Temperature 24.6 C, RSSI -61 dBm"
      },
      {
        online: false,
        relayOn: false,
        telemetryText: "Last heartbeat 2 minutes ago"
      }
    ]);

    expect(summary.deviceCount).toBe(2);
    expect(summary.offlineCount).toBe(1);
    expect(summary.averageReliability).toBeGreaterThan(0);
    expect(summary.systemPosture).toBe("degraded");
  });

  it("increases cooldown when telemetry health is weak", () => {
    const healthy = computeRelayCommandCooldownMs({
      online: true,
      telemetryText: "Temperature 24.6 C, RSSI -61 dBm"
    });
    const weak = computeRelayCommandCooldownMs({
      online: false,
      telemetryText: "Last heartbeat 2 minutes ago"
    });

    expect(weak).toBeGreaterThan(healthy);
  });
});
