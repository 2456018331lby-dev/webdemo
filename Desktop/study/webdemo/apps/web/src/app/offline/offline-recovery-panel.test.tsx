import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OfflineRecoveryPanel } from "./offline-recovery-panel";

let online = false;

function setNavigatorOnline(value: boolean) {
  online = value;
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => online
  });
}

describe("OfflineRecoveryPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows a manual retry path while the browser is offline", async () => {
    setNavigatorOnline(false);

    render(<OfflineRecoveryPanel />);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("仍处于离线状态，实时控制已暂停");
    });
    expect(screen.getByRole("button", { name: "重新检测" })).toBeVisible();
    expect(screen.getByRole("link", { name: "查看最近日志" })).toHaveAttribute("href", "/activity");
  });

  it("switches to the return-home path when the browser reports online", async () => {
    setNavigatorOnline(false);

    render(<OfflineRecoveryPanel />);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("仍处于离线状态，实时控制已暂停");
    });

    setNavigatorOnline(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("网络已恢复，可以返回控制台");
    });
    expect(screen.getByRole("link", { name: "回到控制台" })).toHaveAttribute("href", "/");
  });
});
