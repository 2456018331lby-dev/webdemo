import type { AckPayload } from "@smart-home/device-contract";
import type { DeviceCommandStatus } from "@/lib/server/device-backend";

type RetryDecisionInput = {
  ackResult: AckPayload["result"];
  attemptsUsed: number;
  maxAttempts: number;
  deviceOnline: boolean;
};

type TimeoutTransitionInput = {
  status: DeviceCommandStatus;
  requestedAt: string;
  now: string;
  timeoutMs: number;
};

export function classifyAckResult(result: AckPayload["result"]) {
  if (result === "ok") {
    return "acknowledged" as const;
  }

  if (result === "busy") {
    return "retryable" as const;
  }

  return "failed" as const;
}

export function shouldRetryCommand(input: RetryDecisionInput) {
  return (
    input.deviceOnline &&
    input.ackResult === "busy" &&
    input.attemptsUsed < input.maxAttempts
  );
}

export function computeRetryDelayMs(attemptNumber: number) {
  const normalizedAttempt = Math.max(1, attemptNumber);
  return 1200 + (normalizedAttempt - 1) * 1800;
}

export function computeTimeoutTransition(input: TimeoutTransitionInput): DeviceCommandStatus {
  if (input.status !== "delivered") {
    return input.status;
  }

  const elapsedMs = new Date(input.now).getTime() - new Date(input.requestedAt).getTime();

  if (elapsedMs >= input.timeoutMs) {
    return "timed_out";
  }

  return input.status;
}
