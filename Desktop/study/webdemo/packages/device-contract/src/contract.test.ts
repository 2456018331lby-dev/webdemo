import { describe, expect, it } from "vitest";
import { parseAckPayload, parseCommandRequest, parseTelemetryEvent } from "./index";

describe("device contract", () => {
  it("accepts a valid relay command", () => {
    const result = parseCommandRequest({
      deviceId: "3a4cb0f8-4a1b-4f0b-8f70-1b93f17d4cb0",
      commandType: "relay.set",
      correlationId: "9f2cb27c-b1d4-4978-bbfe-2fdbaf4a6f56",
      payload: { channel: 1, value: true }
    });

    expect(result.commandType).toBe("relay.set");
    expect(result.payload).toEqual({ channel: 1, value: true });
  });

  it("rejects malformed telemetry payloads", () => {
    expect(() =>
      parseTelemetryEvent({
        messageType: "telemetry",
        deviceId: "3a4cb0f8-4a1b-4f0b-8f70-1b93f17d4cb0",
        reportedAt: "2026-05-10T09:00:02Z",
        metrics: { temperatureC: "bad" }
      })
    ).toThrow("Invalid telemetry event");
  });

  it("accepts a valid ack payload", () => {
    const ack = parseAckPayload({
      messageType: "ack",
      correlationId: "9f2cb27c-b1d-4978-bbfe-2fdbaf4a6f56",
      result: "ok",
      reportedState: {
        relay: {
          channel: 1,
          value: true
        }
      },
      reportedAt: "2026-05-10T09:00:01Z"
    });

    expect(ack.result).toBe("ok");
    expect(ack.reportedState).toEqual({
      relay: {
        channel: 1,
        value: true
      }
    });
  });
});
