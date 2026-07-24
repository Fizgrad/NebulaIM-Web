import { expect, test } from "@playwright/test";

test("admin console renders token-gated controls", async ({ page }) => {
  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: "NebulaIM Admin" })).toBeVisible();
  await expect(page.getByLabel("Admin Token")).toBeVisible();
  await expect(page.getByRole("button", { name: /connect/i })).toBeVisible();
  await expect(page.getByText("Connect AdminService")).toHaveCount(0);
  await expect(page.getByText("Dependency Health")).toHaveCount(0);

  await page.getByLabel("Admin Token").fill("test-admin-token");
  await page.getByRole("button", { name: /connect/i }).click();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("nebulaim-admin"))).toBeNull();
});
