import { expect, test } from "@playwright/test";

test("example mode login and send message", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Launch Web Client" }).click();

  await expect(page.getByRole("heading", { name: /sign in to nebulaim/i })).toBeVisible();
  await page.getByRole("button", { name: /^login$/i }).click();

  await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Alice/ })).toBeVisible();

  const editor = page.getByPlaceholder("Type a message...");
  await editor.fill("E2E example message");
  await page.getByRole("button", { name: /send message/i }).click();

  await expect(page.locator("div").filter({ hasText: /^E2E example message$/ }).last()).toBeVisible();
  await expect(page.locator("span").filter({ hasText: /^(sent|delivered|read|failed)$/ }).last()).toBeVisible();
});
