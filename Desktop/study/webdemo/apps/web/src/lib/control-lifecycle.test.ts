import { describe, expect, it } from "vitest";
import {
  classifyAckResult,
  computeRetryDelayMs,
  computeTimeoutTransition,
  shouldRetryCommand
} from "./control-lifecycle";

describe("control lifecycle", () => {
  it("classifies a successful ack as acknowledged", () => {
    expect(classifyAckResult("ok")).toBe("acknowledged");
  });

  it("classifies busy as retryable instead of terminal failure", () => {
    expect(classifyAckResult("busy")).toBe("retryable");
  });

  it("classifies invalid payload as terminal failure", () => {
    expect(classifyAckResult("invalid_payload")).toBe("failed");
  });

  it("retries busy commands while attempts remain", () => {
    expect(
      shouldRetryCommand({
        ackResult: "busy",
        attemptsUsed: 1,
        maxAttempts: 3,
        deviceOnline: true
      })
    ).toBe(true);
  });

  it("does not retry unsafe operations", () => {
    expect(
      shouldRetryCommand({
        ackResult: "unsafe_operation",
        attemptsUsed: 1,
        maxAttempts: 3,
        deviceOnline: true
      })
    ).toBe(false);
  });

  it("does not retry once the device is offline", () => {
    expect(
      shouldRetryCommand({
        ackResult: "busy",
        attemptsUsed: 1,
        maxAttempts: 3,
        deviceOnline: false
      })
    ).toBe(false);
  });

  it("computes increasing retry delay by attempt", () => {
    expect(computeRetryDelayMs(1)).toBeLessThan(computeRetryDelayMs(2));
    expect(computeRetryDelayMs(2)).toBeLessThan(computeRetryDelayMs(3));
  });

  it("marks a delivered command as timed out after timeout budget is exceeded", () => {
    const transition = computeTimeoutTransition({
      status: "delivered",
      requestedAt: "2026-05-10T09:00:00.000Z",
      now: "2026-05-10T09:00:07.000Z",
      timeoutMs: 5000
    });

    expect(transition).toBe("timed_out");
  });

  it("keeps a delivered command active before timeout budget is exceeded", () => {
    const transition = computeTimeoutTransition({
      status: "delivered",
      requestedAt: "2026-05-10T09:00:00.000Z",
      now: "2026-05-10T09:00:03.000Z",
      timeoutMs: 5000
    });

    expect(transition).toBe("delivered");
  });
});
