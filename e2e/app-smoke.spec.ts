import { expect, test } from "@playwright/test";

test("login page renders real backend form without mock credentials", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Launch Web Client" }).click();

  await expect(page.getByRole("heading", { name: /sign in to nebulaim/i })).toBeVisible();
  await expect(page.getByLabel("Username")).toHaveValue("");
  await expect(page.getByLabel("Password")).toHaveValue("");
  await expect(page.getByRole("link", { name: /create an account/i })).toBeVisible();
});

test("settings page shows Bridge HTTP and Gateway WebSocket defaults", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "nebulaim-auth",
      JSON.stringify({
        state: {
          user: {
            id: "10001",
            username: "e2e",
            nickname: "E2E",
            avatarColor: "from-violet-500 to-cyan-400",
            status: "online",
            registeredAt: 0,
            gateway: "ws://example.invalid:8080/ws",
            connectionId: "gateway-10001"
          },
          token: "e2e-token",
          tokenExpireAt: Date.now() + 3600_000,
          lastRefreshAt: Date.now(),
          isAuthenticated: true
        },
        version: 0
      })
    );
  });

  await page.goto("/app/settings");

  await expect(page.getByLabel("Direct Gateway WebSocket URL")).toHaveValue("ws://example.invalid:8080/ws");
  await expect(page.getByLabel("Bridge HTTP URL")).toHaveValue("http://example.invalid:8080");
});

test("dashboard stays inside app navigation", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "nebulaim-auth",
      JSON.stringify({
        state: {
          user: {
            id: "10001",
            username: "e2e",
            nickname: "E2E",
            avatarColor: "from-violet-500 to-cyan-400",
            status: "online",
            registeredAt: 0,
            gateway: "ws://example.invalid:8080/ws",
            connectionId: "gateway-10001"
          },
          token: "e2e-token",
          tokenExpireAt: Date.now() + 3600_000,
          lastRefreshAt: Date.now(),
          isAuthenticated: true
        },
        version: 0
      })
    );
  });

  await page.goto("/app/chat");
  await page.getByRole("link", { name: "Dashboard" }).click();

  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await expect(page.getByRole("link", { name: "Contacts" })).toBeVisible();
});
