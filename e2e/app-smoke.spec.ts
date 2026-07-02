import { expect, test, type Page } from "@playwright/test";

async function authenticate(page: Page) {
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
            gateway: "ws://173.231.53.23:8080/ws",
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
}

test("login page renders real backend form without mock credentials", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Launch Web Client" }).click();

  await expect(page.getByRole("heading", { name: /sign in to nebulaim/i })).toBeVisible();
  await expect(page.getByLabel("Username")).toHaveValue("");
  await expect(page.getByLabel("Password")).toHaveValue("");
  await expect(page.getByRole("link", { name: /create an account/i })).toBeVisible();
});

test("settings page shows Bridge HTTP and Gateway WebSocket defaults", async ({ page }) => {
  await authenticate(page);

  await page.goto("/app/settings");

  await expect(page.getByLabel("Direct Gateway WebSocket URL")).toHaveValue("ws://173.231.53.23:8080/ws");
  await expect(page.getByLabel("Bridge HTTP URL")).toHaveValue("http://173.231.53.23:8080");
});

test("system tools stay out of the primary client navigation", async ({ page }) => {
  await authenticate(page);

  await page.goto("/app/chat");
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "System Tools" })).toBeVisible();
  await page.getByRole("button", { name: "Dashboard" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
});

test("theme controls apply dark light and system modes", async ({ page }) => {
  await authenticate(page);
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/app/settings");

  await page.getByRole("button", { name: /light/i }).click();
  await expect(page.locator("html")).toHaveClass(/light/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.getByRole("button", { name: /dark/i }).click();
  await expect(page.locator("html")).not.toHaveClass(/light/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: /system/i }).click();
  await expect(page.locator("html")).toHaveClass(/light/);

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).not.toHaveClass(/light/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
