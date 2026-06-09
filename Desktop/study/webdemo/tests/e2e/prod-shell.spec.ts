import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

function collectBrowserErrors(page: import("@playwright/test").Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  return { consoleErrors, pageErrors };
}

async function expectNoBrowserErrors(page: import("@playwright/test").Page) {
  await page.waitForLoadState("networkidle");
}

async function readDownloadText(download: import("@playwright/test").Download) {
  const downloadPath = await download.path();

  if (!downloadPath) {
    throw new Error(`Download path unavailable for ${download.suggestedFilename()}`);
  }

  return readFile(downloadPath, "utf8");
}

async function safeScreenshot(
  page: import("@playwright/test").Page,
  options: Parameters<import("@playwright/test").Page["screenshot"]>[0]
) {
  try {
    await page.screenshot(options);
  } catch {
    await page.waitForTimeout(500);
    await page.screenshot(options);
  }
}

async function mockNotificationPermission(
  page: import("@playwright/test").Page,
  initialPermission: "default" | "granted" | "denied"
) {
  await page.addInitScript((permission) => {
    class MockNotification {
      static permission = permission;

      static async requestPermission() {
        MockNotification.permission = "granted";
        return MockNotification.permission;
      }

      title: string;
      options?: NotificationOptions;

      constructor(title: string, options?: NotificationOptions) {
        this.title = title;
        this.options = options;
      }
    }

    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: MockNotification
    });
  }, initialPermission);
}

test("production homepage exposes app shell and PWA assets", async ({ page, request }, testInfo) => {
  const collected = collectBrowserErrors(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "把你的房间装进一块 随手可控的控制面板" })).toBeVisible();
  await expect(page.locator(".hero").getByRole("link", { name: "打开总览" })).toBeVisible();
  await expect(page.getByRole("link", { name: "安装到手机" })).toBeVisible();
  await expect(page.getByRole("banner").getByText("PWA Ready")).toBeVisible();

  const priorityCard = page.locator(".dashboard-band .card").filter({ hasText: "优先处理" });
  await expect(priorityCard.getByText("1 台设备离线")).toBeVisible();
  await expect(priorityCard.getByRole("link", { name: "打开总览" })).toBeVisible();

  await safeScreenshot(page, {
    path: `output/qa-home-desktop-${testInfo.project.name || "chromium"}.png`,
    fullPage: true
  });

  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.shortcuts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ url: "/homes" }),
      expect.objectContaining({ url: "/devices" })
    ])
  );

  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.getRegistration("/");
    return Boolean(registration?.active);
  });

  const serviceWorkerUrl = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration("/");
    return registration?.active?.scriptURL ?? null;
  });
  expect(serviceWorkerUrl).toContain("/sw.js");

  await expectNoBrowserErrors(page);
  expect(collected.consoleErrors, `console errors: ${collected.consoleErrors.join("\n")}`).toEqual([]);
  expect(collected.pageErrors, `page errors: ${collected.pageErrors.join("\n")}`).toEqual([]);
});

test("homes page refreshes the global health snapshot on demand", async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:3000",
    serviceWorkers: "block"
  });
  const page = await context.newPage();
  const collected = collectBrowserErrors(page);

  await page.route("**/api/homes/snapshot", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        homes: [
          {
            id: "home-qa",
            name: "QA 复核空间",
            memberRole: "owner",
            deviceCount: 1,
            offlineCount: 0,
            timedOutCount: 1,
            failedCount: 0,
            retryingCount: 0,
            evaluatedAt: "2026-06-08T10:15:00.000Z",
            rooms: [
              {
                id: "room-qa",
                name: "刷新验证区",
                devices: [
                  {
                    id: "device-relay-01",
                    name: "刷新后继电器",
                    type: "relay-controller",
                    online: true,
                    relayOn: false,
                    lastTelemetry: "刷新快照 10:15",
                    latestCommandStatus: "timed_out",
                    attemptCount: 1,
                    nextRetryAt: null
                  }
                ]
              }
            ]
          }
        ]
      })
    });
  });

  try {
    await page.goto("/homes");
    await expect(page.getByRole("heading", { name: "全局健康度" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("最近更新");

    await page.getByRole("button", { name: "刷新状态" }).click();
    await expect(page.getByText("刷新后继电器")).toBeVisible();
    await expect(page.getByText("1 台设备 · 0 离线 · 1 超时 · 0 失败")).toBeVisible();
    await expect(page.getByText("已超时")).toBeVisible();
    await expect(page.getByRole("status")).toContainText("最近更新");

    const widthAudit = await page.evaluate(() => ({
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth
    }));
    expect(widthAudit.scrollWidth).toBeLessThanOrEqual(widthAudit.viewport);

    const heroAudit = await page.evaluate(() => {
      const hero = document.querySelector(".hero")?.getBoundingClientRect();
      const title = document.querySelector(".hero-title")?.getBoundingClientRect();
      const actions = document.querySelector(".home-hero-actions")?.getBoundingClientRect();
      const status = document.querySelector(".home-refresh-status")?.getBoundingClientRect();

      if (!hero || !title || !actions || !status) {
        return null;
      }

      return {
        viewport: window.innerWidth,
        heroLeft: hero.left,
        titleLeft: title.left,
        actionsLeft: actions.left,
        statusLeft: status.left,
        statusRight: status.right
      };
    });

    if (!heroAudit) {
      throw new Error("Homes hero geometry was unavailable");
    }

    expect(heroAudit.titleLeft).toBeGreaterThanOrEqual(heroAudit.heroLeft);
    expect(heroAudit.actionsLeft).toBeGreaterThanOrEqual(heroAudit.heroLeft);
    expect(heroAudit.statusLeft).toBeGreaterThanOrEqual(heroAudit.heroLeft);
    expect(heroAudit.statusRight).toBeLessThanOrEqual(heroAudit.viewport);

    await safeScreenshot(page, {
      path: `output/qa-homes-refresh-${testInfo.project.name || "chromium"}.png`,
      fullPage: false
    });

    expect(collected.consoleErrors, `console errors: ${collected.consoleErrors.join("\n")}`).toEqual([]);
    expect(collected.pageErrors, `page errors: ${collected.pageErrors.join("\n")}`).toEqual([]);
  } finally {
    await context.close();
  }
});

test("offline page renders and device detail stays usable on mobile", async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36"
  });
  const page = await context.newPage();
  const collected = collectBrowserErrors(page);

  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: "当前网络不可用" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("网络已恢复");
  await expect(page.getByRole("link", { name: "回到控制台" })).toBeVisible();
  await expect(page.getByRole("link", { name: "查看最近日志" })).toBeVisible();

  await page.goto("/devices/device-relay-01");
  await page.waitForLoadState("networkidle");

  const mobileNav = page.getByRole("navigation", { name: "移动端导航" });
  await expect(mobileNav).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "⌂ 首页" })).toBeVisible();
  await expect(page.getByText("控制态势")).toBeVisible();

  const widthAudit = await page.evaluate(() => ({
    viewport: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(widthAudit.scrollWidth).toBeLessThanOrEqual(widthAudit.viewport);

  await safeScreenshot(page, {
    path: `output/qa-device-mobile-${testInfo.project.name || "chromium"}.png`,
    fullPage: true
  });

  expect(collected.consoleErrors, `console errors: ${collected.consoleErrors.join("\n")}`).toEqual([]);
  expect(collected.pageErrors, `page errors: ${collected.pageErrors.join("\n")}`).toEqual([]);

  await context.close();
});

test("device control recovers after cooldown and accepts a second command", async ({ page }, testInfo) => {
  const collected = collectBrowserErrors(page);

  await page.goto("/devices/device-relay-01");
  await page.waitForLoadState("networkidle");

  const controlButton = page.locator(".command-toggle-button");
  await expect(controlButton).toBeVisible();
  await expect(controlButton).toBeEnabled();

  await controlButton.click();
  await expect(controlButton).toHaveText(/冷却/);
  await expect(controlButton).toBeDisabled();
  await expect(page.getByText(/控制冷却/)).toBeVisible();

  await expect(controlButton).not.toHaveText(/冷却/, { timeout: 6000 });
  await expect(controlButton).toBeEnabled();

  const recoveredLabel = (await controlButton.textContent())?.trim() ?? "";
  expect(recoveredLabel).toMatch(/开启|关闭/);

  await controlButton.click();
  await expect(controlButton).toHaveText(/冷却/);
  await expect(controlButton).toBeDisabled();
  await expect(page.getByRole("heading", { name: "命令历史" })).toBeVisible();

  await safeScreenshot(page, {
    path: `output/qa-device-cooldown-recovery-${testInfo.project.name || "chromium"}.png`,
    fullPage: false
  });

  expect(collected.consoleErrors, `console errors: ${collected.consoleErrors.join("\n")}`).toEqual([]);
  expect(collected.pageErrors, `page errors: ${collected.pageErrors.join("\n")}`).toEqual([]);
});

test("devices page persists favorites and filters to favorite devices", async ({ page }, testInfo) => {
  const collected = collectBrowserErrors(page);

  await page.goto("/devices");
  await page.evaluate(() => {
    window.localStorage.removeItem("smart-home-device-favorites-v1");
  });
  await page.reload({ waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "所有设备" })).toBeVisible();
  await page.getByRole("button", { name: "收藏 主灯继电器" }).click();

  await expect(page.getByRole("button", { name: "取消收藏 主灯继电器" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "⭐ 收藏设备" })).toBeVisible();

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "取消收藏 主灯继电器" })).toBeVisible();

  await page.getByRole("button", { name: "⭐ 只看收藏" }).click();
  await expect(page.getByText("显示 1 / 6 台设备")).toBeVisible();
  await expect(page.getByRole("button", { name: "取消收藏 主灯继电器" })).toBeVisible();
  await expect(page.getByText("温湿度传感器")).not.toBeVisible();

  await safeScreenshot(page, {
    path: `output/qa-devices-favorites-${testInfo.project.name || "chromium"}.png`,
    fullPage: false
  });

  expect(collected.consoleErrors, `console errors: ${collected.consoleErrors.join("\n")}`).toEqual([]);
  expect(collected.pageErrors, `page errors: ${collected.pageErrors.join("\n")}`).toEqual([]);
});

test("devices page persists saved device filter views", async ({ page }, testInfo) => {
  const collected = collectBrowserErrors(page);

  await page.goto("/devices");
  await page.evaluate(() => {
    window.localStorage.removeItem("smart-home-device-favorites-v1");
    window.localStorage.removeItem("smart-home-device-filter-view-v1");
  });
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "所有设备" })).toBeVisible();

  await page.getByRole("button", { name: "收藏 主灯继电器" }).click();
  await expect(page.getByRole("button", { name: "取消收藏 主灯继电器" })).toBeVisible();

  await page.getByLabel("搜索设备").fill("继电器");
  await page.getByLabel("设备类型").selectOption("relay-controller");
  await page.getByLabel("设备状态").selectOption("online");
  await page.getByRole("button", { name: "⭐ 只看收藏" }).click();
  await expect(page.getByText("显示 1 / 6 台设备")).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: "主灯继电器" })).toBeVisible();
  await expect(page.getByText("排风扇继电器")).not.toBeVisible();

  await page.getByRole("button", { name: "保存设备视图" }).click();
  await expect(page.getByRole("status")).toContainText("已保存设备筛选视图");
  await expect(page.getByText(/已保存视图：类型：继电器/)).toBeVisible();

  const savedView = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("smart-home-device-filter-view-v1") ?? "{}")
  );
  expect(savedView).toEqual(
    expect.objectContaining({
      schemaVersion: 1,
      filters: expect.objectContaining({
        searchQuery: "继电器",
        filterType: "relay-controller",
        filterStatus: "online",
        favoriteOnly: true
      })
    })
  );

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByLabel("搜索设备")).toHaveValue("继电器");
  await expect(page.getByLabel("设备类型")).toHaveValue("relay-controller");
  await expect(page.getByLabel("设备状态")).toHaveValue("online");
  await expect(page.getByRole("button", { name: "⭐ 显示全部" })).toBeVisible();
  await expect(page.getByText("显示 1 / 6 台设备")).toBeVisible();

  await page.getByRole("button", { name: "清除筛选" }).click();
  await expect(page.getByText("排风扇继电器")).toBeVisible();
  await page.getByRole("button", { name: "恢复视图" }).click();
  await expect(page.getByRole("status")).toContainText("已恢复设备筛选视图");
  await expect(page.getByLabel("搜索设备")).toHaveValue("继电器");
  await expect(page.getByText("排风扇继电器")).not.toBeVisible();

  await page.getByRole("button", { name: "清除保存" }).click();
  await expect(page.getByRole("status")).toContainText("已清除保存的设备筛选视图");
  await expect(page.getByText("未保存设备筛选视图")).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem("smart-home-device-filter-view-v1"))).toBeNull();

  await safeScreenshot(page, {
    path: `output/qa-devices-filter-view-${testInfo.project.name || "chromium"}.png`,
    fullPage: false
  });

  expect(collected.consoleErrors, `console errors: ${collected.consoleErrors.join("\n")}`).toEqual([]);
  expect(collected.pageErrors, `page errors: ${collected.pageErrors.join("\n")}`).toEqual([]);
});

test("activity and devices pages export filtered data", async ({ page }, testInfo) => {
  const collected = collectBrowserErrors(page);

  await page.goto("/activity");
  await expect(page.getByRole("heading", { name: "活动记录" })).toBeVisible();

  const activityDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 CSV" }).click();
  const activityDownload = await activityDownloadPromise;
  const activityCsv = await readDownloadText(activityDownload);

  expect(activityDownload.suggestedFilename()).toMatch(/^activity-logs-\d{4}-\d{2}-\d{2}\.csv$/);
  expect(activityCsv).toContain("日志 ID,时间,类型,级别,标题,消息,设备 ID,设备名称");
  expect(activityCsv).toContain("log-001");
  expect(activityCsv).toContain("主灯继电器");

  await page.goto("/devices");
  await page.evaluate(() => {
    window.localStorage.removeItem("smart-home-device-favorites-v1");
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "收藏 主灯继电器" }).click();
  await expect(page.getByRole("button", { name: "取消收藏 主灯继电器" })).toBeVisible();

  const deviceDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON" }).click();
  const deviceDownload = await deviceDownloadPromise;
  const deviceJson = JSON.parse(await readDownloadText(deviceDownload));

  expect(deviceDownload.suggestedFilename()).toMatch(/^devices-\d{4}-\d{2}-\d{2}\.json$/);
  expect(deviceJson).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "device-relay-01",
        name: "主灯继电器",
        favorite: true
      })
    ])
  );

  await safeScreenshot(page, {
    path: `output/qa-export-actions-${testInfo.project.name || "chromium"}.png`,
    fullPage: false
  });

  expect(collected.consoleErrors, `console errors: ${collected.consoleErrors.join("\n")}`).toEqual([]);
  expect(collected.pageErrors, `page errors: ${collected.pageErrors.join("\n")}`).toEqual([]);
});

test("activity page persists saved log filter views", async ({ page }, testInfo) => {
  const collected = collectBrowserErrors(page);

  await page.goto("/activity");
  await page.evaluate(() => {
    window.localStorage.removeItem("smart-home-activity-log-view-v1");
  });
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "活动记录" })).toBeVisible();

  await page.getByLabel("搜索日志").fill("排风扇");
  await page.getByLabel("日志类型").selectOption("alert");
  await page.getByLabel("日志级别").selectOption("warning");
  await expect(page.getByText("设备离线")).toBeVisible();
  await expect(page.getByText("命令超时", { exact: true })).not.toBeVisible();
  await expect(page.getByText("显示 1 条日志")).toBeVisible();

  await page.getByRole("button", { name: "保存日志视图" }).click();
  await expect(page.getByRole("status")).toContainText("已保存日志筛选视图");
  await expect(page.getByText(/已保存视图：类型：告警/)).toBeVisible();

  const savedView = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("smart-home-activity-log-view-v1") ?? "{}")
  );
  expect(savedView).toEqual(
    expect.objectContaining({
      schemaVersion: 1,
      filters: expect.objectContaining({
        query: "排风扇",
        type: "alert",
        level: "warning"
      })
    })
  );

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByLabel("搜索日志")).toHaveValue("排风扇");
  await expect(page.getByLabel("日志类型")).toHaveValue("alert");
  await expect(page.getByLabel("日志级别")).toHaveValue("warning");
  await expect(page.getByText("设备离线")).toBeVisible();
  await expect(page.getByText("命令超时", { exact: true })).not.toBeVisible();

  await page.getByRole("button", { name: "清除筛选" }).click();
  await expect(page.getByText("命令超时", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "恢复视图" }).click();
  await expect(page.getByRole("status")).toContainText("已恢复日志筛选视图");
  await expect(page.getByLabel("搜索日志")).toHaveValue("排风扇");
  await expect(page.getByText("命令超时", { exact: true })).not.toBeVisible();

  await page.getByRole("button", { name: "清除保存" }).click();
  await expect(page.getByRole("status")).toContainText("已清除保存的日志筛选视图");
  await expect(page.getByText("未保存日志筛选视图")).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem("smart-home-activity-log-view-v1"))).toBeNull();

  await safeScreenshot(page, {
    path: `output/qa-activity-log-view-${testInfo.project.name || "chromium"}.png`,
    fullPage: false
  });

  expect(collected.consoleErrors, `console errors: ${collected.consoleErrors.join("\n")}`).toEqual([]);
  expect(collected.pageErrors, `page errors: ${collected.pageErrors.join("\n")}`).toEqual([]);
});

test("settings page persists notification preferences and edits device metadata", async ({ page }, testInfo) => {
  const collected = collectBrowserErrors(page);

  await mockNotificationPermission(page, "default");
  await page.goto("/settings");
  await page.evaluate(() => {
    window.localStorage.removeItem("smart-home-user-preferences-v1");
    window.localStorage.removeItem("smart-home-notification-inbox-v1");
  });
  await page.reload({ waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "偏好、通知与设备维护" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "等待用户授权通知" })).toBeVisible();
  await expect(page.getByText("尚未授权通知权限")).toBeVisible();
  await expect(page.getByRole("heading", { name: "投递历史与待处理提醒" })).toBeVisible();
  await expect(page.getByText("厨房排风扇继电器离线")).toBeVisible();

  const pushToggle = page.getByRole("checkbox", { name: /PWA 推送通知/ });
  await expect(pushToggle).toBeChecked();
  await pushToggle.uncheck();
  await expect(page.getByRole("status")).toContainText("已自动保存本机偏好");

  const persistedPreferences = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("smart-home-user-preferences-v1") ?? "{}")
  );
  expect(persistedPreferences.notificationChannels.push).toBe(false);

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("checkbox", { name: /PWA 推送通知/ })).not.toBeChecked();

  await page.getByRole("button", { name: "恢复默认偏好" }).click();
  await expect(page.getByRole("checkbox", { name: /PWA 推送通知/ })).toBeChecked();

  await page.getByRole("button", { name: "编辑配置" }).first().click();
  await expect(page.getByRole("dialog", { name: "编辑设备配置" })).toBeVisible();
  await page.getByLabel("设备名称").fill("主灯继电器 Pro");
  await page.getByRole("button", { name: "保存配置" }).click();

  await expect(page.getByRole("status")).toContainText("已保存 主灯继电器 Pro 的配置");
  await expect(page.getByRole("heading", { name: "主灯继电器 Pro" })).toBeVisible();

  await safeScreenshot(page, {
    path: `output/qa-settings-preferences-${testInfo.project.name || "chromium"}.png`,
    fullPage: false
  });

  expect(collected.consoleErrors, `console errors: ${collected.consoleErrors.join("\n")}`).toEqual([]);
  expect(collected.pageErrors, `page errors: ${collected.pageErrors.join("\n")}`).toEqual([]);
});

test("settings page manages notification inbox read and archive state", async ({ page }, testInfo) => {
  const collected = collectBrowserErrors(page);

  await mockNotificationPermission(page, "granted");
  await page.goto("/settings");
  await page.evaluate(() => {
    window.localStorage.removeItem("smart-home-notification-inbox-v1");
  });
  await page.reload({ waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "投递历史与待处理提醒" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /未读 2/ })).toBeVisible();

  await page.getByLabel("搜索通知").fill("空气");
  await expect(page.getByText("卧室空气质量需要关注")).toBeVisible();
  await expect(page.getByText("厨房排风扇继电器离线")).not.toBeVisible();
  await expect(page.getByText("当前显示 1 条通知")).toBeVisible();

  await page.getByRole("button", { name: "清除筛选" }).click();
  await expect(page.getByText("厨房排风扇继电器离线")).toBeVisible();

  await page.getByLabel("按设备").selectOption("device-sensor-02");
  await expect(page.getByText("卧室空气质量需要关注")).toBeVisible();
  await expect(page.getByText("厨房排风扇继电器离线")).not.toBeVisible();

  await page.getByRole("button", { name: "清除筛选" }).click();
  await page.getByLabel("按优先级").selectOption("critical");
  await expect(page.getByText("厨房排风扇继电器离线")).toBeVisible();
  await expect(page.getByText("卧室空气质量需要关注")).not.toBeVisible();

  await page.getByRole("button", { name: "清除筛选" }).click();

  await page.getByRole("button", { name: "全部标为已读" }).click();
  await expect(page.getByRole("status")).toContainText("已将通知收件箱标记为已读");
  await expect(page.getByRole("tab", { name: /未读 0/ })).toBeVisible();

  await page.getByRole("tab", { name: /未读 0/ }).click();
  await expect(page.getByText("当前筛选下没有通知")).toBeVisible();

  await page.getByRole("tab", { name: /全部/ }).click();
  await page.getByRole("button", { name: "恢复未读" }).first().click();
  await expect(page.getByRole("tab", { name: /未读 1/ })).toBeVisible();

  await page.getByRole("button", { name: /^归档$/ }).first().click();
  await expect(page.getByRole("tab", { name: /归档 1/ })).toBeVisible();
  await page.getByRole("tab", { name: /归档 1/ }).click();
  await expect(page.getByText("厨房排风扇继电器离线")).toBeVisible();

  await page.getByRole("button", { name: "清除归档" }).click();
  await expect(page.getByRole("status")).toContainText("已清除已归档通知");
  await expect(page.getByRole("tab", { name: /归档 0/ })).toBeVisible();

  await safeScreenshot(page, {
    path: `output/qa-settings-notification-inbox-${testInfo.project.name || "chromium"}.png`,
    fullPage: false
  });

  expect(collected.consoleErrors, `console errors: ${collected.consoleErrors.join("\n")}`).toEqual([]);
  expect(collected.pageErrors, `page errors: ${collected.pageErrors.join("\n")}`).toEqual([]);
});

test("settings page persists saved notification inbox views", async ({ page }, testInfo) => {
  const collected = collectBrowserErrors(page);

  await mockNotificationPermission(page, "granted");
  await page.goto("/settings");
  await page.evaluate(() => {
    window.localStorage.removeItem("smart-home-notification-inbox-v1");
    window.localStorage.removeItem("smart-home-notification-inbox-view-v1");
  });
  await page.reload({ waitUntil: "networkidle" });

  await page.getByRole("tab", { name: /未读 2/ }).click();
  await page.getByLabel("搜索通知").fill("空气");
  await page.getByLabel("按设备").selectOption("device-sensor-02");
  await expect(page.getByText("卧室空气质量需要关注")).toBeVisible();
  await expect(page.getByText("厨房排风扇继电器离线")).not.toBeVisible();

  await page.getByRole("button", { name: "保存当前视图" }).click();
  await expect(page.getByRole("status")).toContainText("已保存通知筛选视图");
  await expect(page.getByText(/已保存视图：未读/)).toBeVisible();

  const savedView = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("smart-home-notification-inbox-view-v1") ?? "{}")
  );
  expect(savedView).toEqual(
    expect.objectContaining({
      schemaVersion: 1,
      filter: "unread",
      advancedFilters: expect.objectContaining({
        query: "空气",
        deviceId: "device-sensor-02"
      })
    })
  );

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("tab", { name: /未读 2/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("搜索通知")).toHaveValue("空气");
  await expect(page.getByLabel("按设备")).toHaveValue("device-sensor-02");
  await expect(page.getByText("卧室空气质量需要关注")).toBeVisible();
  await expect(page.getByText("厨房排风扇继电器离线")).not.toBeVisible();

  await page.getByRole("button", { name: "清除筛选" }).click();
  await expect(page.getByText("厨房排风扇继电器离线")).toBeVisible();
  await page.getByRole("button", { name: "恢复视图" }).click();
  await expect(page.getByRole("status")).toContainText("已恢复通知筛选视图");
  await expect(page.getByLabel("搜索通知")).toHaveValue("空气");
  await expect(page.getByText("厨房排风扇继电器离线")).not.toBeVisible();

  await page.getByRole("button", { name: "清除保存" }).click();
  await expect(page.getByRole("status")).toContainText("已清除保存的通知筛选视图");
  await expect(page.getByText("未保存通知筛选视图")).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem("smart-home-notification-inbox-view-v1"))).toBeNull();

  await safeScreenshot(page, {
    path: `output/qa-settings-notification-view-${testInfo.project.name || "chromium"}.png`,
    fullPage: false
  });

  expect(collected.consoleErrors, `console errors: ${collected.consoleErrors.join("\n")}`).toEqual([]);
  expect(collected.pageErrors, `page errors: ${collected.pageErrors.join("\n")}`).toEqual([]);
});

test("settings page surfaces granted notification readiness", async ({ page }, testInfo) => {
  const collected = collectBrowserErrors(page);

  await mockNotificationPermission(page, "granted");
  await page.goto("/settings");
  await page.evaluate(() => {
    window.localStorage.removeItem("smart-home-notification-inbox-v1");
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { name: "等待 VAPID 公钥" })).toBeVisible();
  await expect(page.getByText("已授权")).toBeVisible();
  await expect(page.getByText("缺少 NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY")).toBeVisible();

  await page.getByRole("button", { name: "发送本地测试通知" }).click();
  await expect(page.getByRole("status")).toContainText("已发送本地测试通知");
  await expect(page.getByRole("heading", { name: "本地测试通知已发送" })).toBeVisible();

  const persistedInboxTitles = await page.evaluate(() => {
    const payload = JSON.parse(window.localStorage.getItem("smart-home-notification-inbox-v1") ?? "{}");
    return Array.isArray(payload.items) ? payload.items.map((item: { title?: string }) => item.title) : [];
  });
  expect(persistedInboxTitles).toContain("本地测试通知已发送");

  await safeScreenshot(page, {
    path: `output/qa-settings-push-readiness-${testInfo.project.name || "chromium"}.png`,
    fullPage: false
  });

  expect(collected.consoleErrors, `console errors: ${collected.consoleErrors.join("\n")}`).toEqual([]);
  expect(collected.pageErrors, `page errors: ${collected.pageErrors.join("\n")}`).toEqual([]);
});

test("settings page surfaces push subscription sync and resubscribe health", async ({ page }, testInfo) => {
  const collected = collectBrowserErrors(page);

  await mockNotificationPermission(page, "granted");
  await page.goto("/settings");
  await page.evaluate(() => {
    window.localStorage.setItem(
      "smart-home-push-subscription-v1",
      JSON.stringify({
        schemaVersion: 1,
        endpoint: "https://push.example/subscriptions/fresh-sync-endpoint",
        createdAt: "2026-06-07T08:00:00.000Z",
        expirationTime: null,
        keys: {
          auth: "auth-secret"
        }
      })
    );
    window.localStorage.removeItem("smart-home-push-subscription-sync-v1");
  });
  await page.reload({ waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "订阅同步状态" })).toBeVisible();
  await expect(page.getByText("端点待同步")).toBeVisible();
  await expect(page.getByText("订阅端点尚未同步到后端")).toBeVisible();

  await page.getByRole("button", { name: "记录同步快照" }).click();
  await expect(page.getByRole("status")).toContainText("已记录订阅端点同步快照");
  await expect(page.getByText("端点同步快照有效")).toBeVisible();

  const persistedSyncRecord = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("smart-home-push-subscription-sync-v1") ?? "{}")
  );
  expect(persistedSyncRecord.endpointFingerprint).toMatch(/^psh-/);

  await page.evaluate(() => {
    window.localStorage.setItem(
      "smart-home-push-subscription-v1",
      JSON.stringify({
        schemaVersion: 1,
        endpoint: "https://push.example/subscriptions/fresh-sync-endpoint",
        createdAt: "2026-04-01T08:00:00.000Z",
        expirationTime: null,
        keys: {
          auth: "auth-secret"
        }
      })
    );
  });
  await page.reload({ waitUntil: "networkidle" });

  await expect(page.getByText("建议重新订阅")).toBeVisible();
  await expect(page.getByText("订阅已超过 30 天")).toBeVisible();

  await safeScreenshot(page, {
    path: `output/qa-settings-push-sync-${testInfo.project.name || "chromium"}.png`,
    fullPage: false
  });

  expect(collected.consoleErrors, `console errors: ${collected.consoleErrors.join("\n")}`).toEqual([]);
  expect(collected.pageErrors, `page errors: ${collected.pageErrors.join("\n")}`).toEqual([]);
});
