import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEVICE_FAVORITES_STORAGE_KEY } from "@/lib/device-list";
import { PUSH_SUBSCRIPTION_STORAGE_KEY } from "@/lib/push-notifications";
import { SETTINGS_DEVICES_STORAGE_KEY } from "@/lib/settings-devices";
import { USER_PREFERENCES_STORAGE_KEY } from "@/lib/user-preferences";
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

  it("persists device maintenance edits across remounts", () => {
    const { unmount } = render(<SettingsPage />);

    fireEvent.click(screen.getAllByRole("button", { name: "编辑配置" })[0]);
    const editDialog = screen.getByRole("dialog", { name: "编辑设备配置" });
    fireEvent.change(within(editDialog).getByLabelText("设备名称"), {
      target: { value: "主灯继电器 Pro" }
    });
    fireEvent.change(within(editDialog).getByLabelText("所属房间"), {
      target: { value: "书房" }
    });
    fireEvent.click(within(editDialog).getByRole("button", { name: "保存配置" }));

    const persisted = JSON.parse(window.localStorage.getItem(SETTINGS_DEVICES_STORAGE_KEY) ?? "{}");
    expect(persisted.devices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "device-relay-01",
          name: "主灯继电器 Pro",
          room: "书房"
        })
      ])
    );

    unmount();
    render(<SettingsPage />);

    expect(screen.getByRole("heading", { name: "主灯继电器 Pro" })).toBeVisible();
    expect(screen.getByText(/继电器 · 温馨公寓 · 书房/)).toBeInTheDocument();
  });

  it("clears local device maintenance overrides back to seed devices", () => {
    render(<SettingsPage />);

    const resetButton = screen.getByRole("button", { name: "恢复默认清单" });
    expect(resetButton).toBeDisabled();

    fireEvent.click(screen.getAllByRole("button", { name: "编辑配置" })[0]);
    const editDialog = screen.getByRole("dialog", { name: "编辑设备配置" });
    fireEvent.change(within(editDialog).getByLabelText("设备名称"), {
      target: { value: "主灯继电器 Pro" }
    });
    fireEvent.click(within(editDialog).getByRole("button", { name: "保存配置" }));

    expect(window.localStorage.getItem(SETTINGS_DEVICES_STORAGE_KEY)).not.toBeNull();
    expect(screen.getByRole("button", { name: "恢复默认清单" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "恢复默认清单" }));
    const resetDialog = screen.getByRole("dialog", { name: "恢复默认设备清单" });
    expect(within(resetDialog).getByText("当前来源")).toBeInTheDocument();
    expect(within(resetDialog).getByText("本机覆盖")).toBeInTheDocument();

    fireEvent.click(within(resetDialog).getByRole("button", { name: "确认恢复默认" }));

    expect(screen.queryByRole("dialog", { name: "恢复默认设备清单" })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(SETTINGS_DEVICES_STORAGE_KEY)).toBeNull();
    expect(screen.queryByRole("heading", { name: "主灯继电器 Pro" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "主灯继电器" })).toBeVisible();
    expect(screen.getByRole("button", { name: "恢复默认清单" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("已恢复默认设备维护清单");
  });

  it("summarizes local backup restore risks before applying a backup", async () => {
    window.localStorage.setItem(USER_PREFERENCES_STORAGE_KEY, JSON.stringify({ schemaVersion: 1 }));
    const backup = {
      schemaVersion: 1,
      app: "smart-home-web",
      generatedAt: "2026-06-09T10:00:00.000Z",
      entries: [
        {
          key: USER_PREFERENCES_STORAGE_KEY,
          label: "本机偏好",
          present: true,
          value: {
            schemaVersion: 1,
            defaultLanding: "activity"
          }
        },
        {
          key: DEVICE_FAVORITES_STORAGE_KEY,
          label: "收藏设备",
          present: true,
          value: ["device-relay-01", 42]
        },
        {
          key: PUSH_SUBSCRIPTION_STORAGE_KEY,
          label: "推送订阅摘要",
          present: true,
          redacted: true,
          value: {
            endpointFingerprint: "psh-redacted"
          }
        },
        {
          key: SETTINGS_DEVICES_STORAGE_KEY,
          label: "设备维护状态",
          present: false,
          value: null
        },
        {
          key: "smart-home-unknown-state-v1",
          label: "未知状态",
          present: true,
          value: {
            enabled: true
          }
        }
      ]
    };
    const file = new File([JSON.stringify(backup)], "restore-risk.json", { type: "application/json" });
    Object.defineProperty(file, "text", {
      value: () => Promise.resolve(JSON.stringify(backup))
    });

    render(<SettingsPage />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText("选择本机备份 JSON 文件"), {
        target: { files: [file] }
      });
    });

    expect(await screen.findByText("restore-risk.json")).toBeVisible();
    expect(screen.getByText("可恢复 1 项")).toBeInTheDocument();
    expect(screen.getByText("覆盖 1 项")).toBeInTheDocument();
    expect(screen.getByText("无效 1 项")).toBeInTheDocument();
    expect(screen.getByText("脱敏 1 项")).toBeInTheDocument();
    expect(screen.getByText("未知 1 项")).toBeInTheDocument();
    expect(screen.getByText("存在需人工核对项")).toBeInTheDocument();
    expect(screen.getByText("1 项会覆盖当前状态")).toBeInTheDocument();
    expect(screen.getByText("无效 1 · 未知 1 · 缺失 1")).toBeInTheDocument();
    expect(screen.getByText("4 项不会恢复")).toBeInTheDocument();
  });
});
