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
            status: "online"
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

  await expect(page.getByLabel("Direct Gateway WebSocket URL")).toHaveValue("ws://127.0.0.1:8080/ws");
  await expect(page.getByLabel("Bridge HTTP URL")).toHaveValue("http://127.0.0.1:8080");
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

test("mobile chat layout shows the conversation list without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await authenticate(page);

  await page.goto("/app/chat");

  await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
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

test("browser protobuf registry loads and encodes Gateway messages", async ({ page }) => {
  const browserCompatibilityWarnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning" && message.text().includes('Module "fs"')) {
      browserCompatibilityWarnings.push(message.text());
    }
  });

  await page.goto("/login");
  const encodedLength = await page.evaluate(async () => {
    const registry = await import("/src/services/browserProtoRegistry.ts");
    const body = await registry.encodeProto("nebula.proto.ResumeSessionRequest", {
      requestId: "protobuf-browser-test",
      token: "test-token",
      deviceId: "test-device",
      platform: "web",
      deviceName: "Browser test"
    });
    return body.length;
  });

  expect(encodedLength).toBeGreaterThan(0);
  expect(browserCompatibilityWarnings).toEqual([]);
});

test("gateway connection rejects when the socket closes before opening", async ({ page }) => {
  await page.goto("/login");

  const result = await page.evaluate(async () => {
    const { DirectGatewayClient } = await import("/src/services/directGatewayClient.ts");
    const client = new DirectGatewayClient({
      wsUrl: "ws://127.0.0.1:65534/ws",
      autoReconnect: false,
      heartbeatIntervalMs: 15_000
    });
    return Promise.race([
      client.connect().then(
        () => "connected",
        () => "rejected"
      ),
      new Promise<string>((resolve) => window.setTimeout(() => resolve("timeout"), 2_000))
    ]);
  });

  expect(result).toBe("rejected");
});

test("automatic gateway reconnect does not create an unhandled rejection", async ({ page }) => {
  await page.goto("/login");

  const unhandledReason = await page.evaluate(async () => {
    let reason = "";
    const onUnhandled = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
    };
    window.addEventListener("unhandledrejection", onUnhandled);

    const { DirectGatewayClient } = await import("/src/services/directGatewayClient.ts");
    const client = new DirectGatewayClient({
      wsUrl: "ws://127.0.0.1:65534/ws",
      autoReconnect: true,
      heartbeatIntervalMs: 15_000
    });
    await client.connect().catch(() => undefined);
    await new Promise((resolve) => window.setTimeout(resolve, 1_500));
    client.disconnect();
    window.removeEventListener("unhandledrejection", onUnhandled);
    return reason;
  });

  expect(unhandledReason).toBe("");
});

test("chat loads older history with the composite cursor", async ({ page }) => {
  await authenticate(page);
  let requestedCursor = "";

  await page.route("http://127.0.0.1:8080/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/conversations") {
      await route.fulfill({
        json: {
          ok: true,
          conversations: [
            {
              conversationId: "50001",
              conversationType: 1,
              ownerUserId: "10001",
              peerUserId: "10002",
              groupId: "0",
              lastMessageId: "200",
              lastMessagePreview: "newer message",
              lastMessageAt: 2_000,
              unreadCount: 0,
              pinned: false,
              muted: false,
              deleted: false,
              updatedAt: 2_000
            }
          ]
        }
      });
      return;
    }
    if (url.pathname === "/api/messages/conversations/50001") {
      const before = url.searchParams.get("before");
      const beforeMessageId = url.searchParams.get("beforeMessageId");
      if (beforeMessageId === "200") {
        requestedCursor = `${before}:${beforeMessageId}`;
        await route.fulfill({
          json: {
            ok: true,
            messages: [
              {
                messageId: "100",
                conversationId: "50001",
                fromUserId: "10002",
                toUserId: "10001",
                groupId: "0",
                contentType: 1,
                content: "older message",
                status: 3,
                recalled: false,
                recalledAt: 0,
                createdAt: 1_000
              }
            ],
            nextCursor: null,
            hasMore: false
          }
        });
        return;
      }
      await route.fulfill({
        json: {
          ok: true,
          messages: [
            {
              messageId: "200",
              conversationId: "50001",
              fromUserId: "10002",
              toUserId: "10001",
              groupId: "0",
              contentType: 1,
              content: "newer message",
              status: 3,
              recalled: false,
              recalledAt: 0,
              createdAt: 2_000
            }
          ],
          nextCursor: { before: 2_000, beforeMessageId: "200" },
          hasMore: true
        }
      });
      return;
    }
    if (url.pathname === "/api/presence/users") {
      await route.fulfill({ json: { ok: true, users: [{ userId: "10002", online: false }] } });
      return;
    }
    if (url.pathname === "/api/auth/users/10002") {
      await route.fulfill({
        json: {
          ok: true,
          user: { userId: "10002", username: "peer", nickname: "Peer", createdAt: 0 }
        }
      });
      return;
    }
    if (url.pathname === "/api/conversations/50001/read") {
      await route.fulfill({ json: { ok: true } });
      return;
    }
    await route.fulfill({ status: 404, json: { error: { code: "NOT_FOUND", message: "Unexpected test route." } } });
  });

  await page.goto("/app/chat");
  await page.evaluate(async () => {
    const { useChatStore } = await import("/src/store/chatStore.ts");
    await useChatStore.getState().loadConversations();
    useChatStore.getState().setActiveConversationId("direct-10002");
  });

  await expect(page.locator("div.whitespace-pre-wrap", { hasText: /^newer message$/ })).toBeVisible();
  await page.getByRole("button", { name: "Load earlier messages" }).click();
  await expect(page.locator("div.whitespace-pre-wrap", { hasText: /^older message$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Load earlier messages" })).toHaveCount(0);
  expect(requestedCursor).toBe("2000:200");
});
