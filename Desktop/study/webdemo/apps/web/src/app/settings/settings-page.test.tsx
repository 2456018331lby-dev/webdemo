import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "./page";

describe("SettingsPage", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("uses an in-app confirmation dialog for factory reset", async () => {
    vi.useFakeTimers();
    const confirmSpy = vi.spyOn(window, "confirm");

    render(<SettingsPage />);

    fireEvent.click(screen.getAllByRole("button", { name: "恢复出厂" })[0]);

    const cancelDialog = screen.getByRole("dialog", { name: "恢复出厂设置" });
    expect(cancelDialog).toBeVisible();
    expect(within(cancelDialog).getByText("设备")).toBeInTheDocument();
    expect(within(cancelDialog).getByText("当前位置")).toBeInTheDocument();
    expect(within(cancelDialog).getByText("温馨公寓 / 客厅")).toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();

    fireEvent.click(within(cancelDialog).getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("dialog", { name: "恢复出厂设置" })).not.toBeInTheDocument();
    expect(screen.getByText(/继电器 · 温馨公寓 · 客厅/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "恢复出厂" })[0]);
    const confirmDialog = screen.getByRole("dialog", { name: "恢复出厂设置" });
    fireEvent.click(within(confirmDialog).getByRole("button", { name: "确认恢复出厂" }));

    expect(screen.queryByRole("dialog", { name: "恢复出厂设置" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("正在恢复 主灯继电器 出厂设置");

    await act(async () => {
      vi.advanceTimersByTime(1200);
    });

    expect(screen.getByRole("status")).toHaveTextContent("主灯继电器 已恢复出厂设置");

    const deviceRow = screen
      .getAllByRole("article")
      .find((row) => within(row).queryByRole("heading", { name: "主灯继电器" }));
    if (!deviceRow) {
      throw new Error("Factory reset target row was not rendered");
    }

    expect(within(deviceRow).getByText(/继电器 · 温馨公寓 · 未分配/)).toBeInTheDocument();
    expect(within(deviceRow).getByText("离线")).toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
