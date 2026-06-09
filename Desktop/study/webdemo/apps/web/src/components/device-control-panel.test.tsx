import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeviceControlPanel, type RelayCommandSendResult } from "./device-control-panel";

function ControlledHarness({
  initialRelayOn,
  isOffline = false,
  onSendRelayCommand = vi.fn().mockResolvedValue(undefined),
  commandCooldownMs
}: {
  initialRelayOn: boolean;
  isOffline?: boolean;
  onSendRelayCommand?: (nextValue: boolean) => Promise<RelayCommandSendResult | void>;
  commandCooldownMs?: number;
}) {
  const [relayOn, setRelayOn] = React.useState(initialRelayOn);

  return (
    <DeviceControlPanel
      deviceName="客厅主灯"
      deviceType="relay-controller"
      relayOn={relayOn}
      isOffline={isOffline}
      commandCooldownMs={commandCooldownMs}
      onSendRelayCommand={async (nextValue) => {
        const result = await onSendRelayCommand(nextValue);
        if (!result || result.status === "acknowledged") {
          setRelayOn(nextValue);
        }
        return result;
      }}
    />
  );
}

describe("DeviceControlPanel", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a pending state while a relay command is in flight", async () => {
    let resolveCommand: (() => void) | undefined;

    const onSendRelayCommand = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCommand = resolve;
        })
    );

    render(
      <ControlledHarness initialRelayOn={false} onSendRelayCommand={onSendRelayCommand} />
    );

    fireEvent.click(screen.getByRole("button", { name: /开启/ }));

    expect(onSendRelayCommand).toHaveBeenCalledWith(true);
    // 有两个地方显示 "发送中"：按钮和状态卡片
    const sendingElements = screen.getAllByText(/发送中/);
    expect(sendingElements.length).toBeGreaterThanOrEqual(1);
    await act(async () => {
      resolveCommand?.();
    });
  });

  it("updates the status after the relay command resolves", async () => {
    render(
      <ControlledHarness initialRelayOn={false} />
    );

    fireEvent.click(screen.getByRole("button", { name: /开启/ }));

    await waitFor(() => {
      expect(screen.getByText(/已确认/)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /关闭/ })).toBeInTheDocument();
  });

  it("keeps queued commands pending instead of marking them confirmed", async () => {
    const onSendRelayCommand = vi.fn().mockResolvedValue({
      status: "queued",
      note: "命令已进入 ESP32S3 轮询队列，等待设备拉取并上报确认。"
    } satisfies RelayCommandSendResult);

    render(
      <ControlledHarness initialRelayOn={false} onSendRelayCommand={onSendRelayCommand} />
    );

    fireEvent.click(screen.getByRole("button", { name: /开启/ }));

    await waitFor(() => {
      expect(screen.getByText(/已排队/)).toBeInTheDocument();
    });

    expect(screen.queryByText(/已确认/)).not.toBeInTheDocument();
    expect(screen.getByText(/等待硬件确认/)).toBeInTheDocument();
    expect(screen.getByText(/ESP32S3 轮询队列/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /等待确认/ })).toBeDisabled();
    expect(screen.getByText("关")).toBeInTheDocument();
  });

  it("disables relay control when the device is offline", () => {
    render(
      <ControlledHarness initialRelayOn={true} isOffline />
    );

    const button = screen.getByRole("button", { name: /关闭/ });

    expect(button).toBeDisabled();
    expect(screen.getByText(/离线/)).toBeInTheDocument();
  });

  it("shows device type icon", () => {
    render(
      <ControlledHarness initialRelayOn={false} />
    );

    expect(screen.getByText("💡")).toBeInTheDocument();
  });

  it("locks the relay button during command cooldown", async () => {
    vi.useFakeTimers();

    render(
      <ControlledHarness initialRelayOn={false} commandCooldownMs={2200} />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /开启/ }));
    });

    const cooldownButton = screen.getByRole("button", { name: /冷却/ });
    expect(cooldownButton).toBeDisabled();
    expect(screen.getByText(/控制冷却/)).toBeInTheDocument();

    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    }

    expect(screen.getByRole("button", { name: /关闭/ })).not.toBeDisabled();
  });
});
