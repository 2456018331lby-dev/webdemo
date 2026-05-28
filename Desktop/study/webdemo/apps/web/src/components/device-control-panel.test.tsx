import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeviceControlPanel } from "./device-control-panel";

describe("DeviceControlPanel", () => {
  it("shows a pending state while a relay command is in flight", async () => {
    let resolveCommand: (() => void) | undefined;

    const onSendRelayCommand = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCommand = resolve;
        })
    );

    render(
      <DeviceControlPanel
        deviceName="Living Room Relay"
        initialRelayOn={false}
        isOffline={false}
        onSendRelayCommand={onSendRelayCommand}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "开启" }));

    expect(onSendRelayCommand).toHaveBeenCalledWith(true);
    expect(screen.getByText("发送中")).toBeInTheDocument();
    await act(async () => {
      resolveCommand?.();
    });
  });

  it("updates the status after the relay command resolves", async () => {
    render(
      <DeviceControlPanel
        deviceName="Living Room Relay"
        initialRelayOn={false}
        isOffline={false}
        onSendRelayCommand={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "开启" }));

    await waitFor(() => {
      expect(screen.getByText("已确认")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "关闭" })).toBeInTheDocument();
  });

  it("disables relay control when the device is offline", () => {
    render(
      <DeviceControlPanel
        deviceName="Living Room Relay"
        initialRelayOn={true}
        isOffline={true}
        onSendRelayCommand={vi.fn()}
      />
    );

    const button = screen.getByRole("button", { name: "关闭" });

    expect(button).toBeDisabled();
  });
});
