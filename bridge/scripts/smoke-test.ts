import WebSocket from "ws";

const wsUrl = process.env.BRIDGE_WS_URL ?? "ws://localhost:8080/ws";

type ServerEvent = {
  id: string;
  type: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: number; message: string };
};

function createEvent(type: string, payload: unknown) {
  return {
    id: `smoke_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    timestamp: Date.now(),
    payload
  };
}

async function main() {
  const ws = new WebSocket(wsUrl);
  const pending = new Map<string, (event: ServerEvent) => void>();

  ws.on("message", (data) => {
    const event = JSON.parse(data.toString()) as ServerEvent;
    console.log("<-", event.type, event.ok, event.error?.message ?? "");
    pending.get(event.id)?.(event);
  });

  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });

  async function request(type: string, payload: unknown) {
    const event = createEvent(type, payload);
    console.log("->", event.type);
    ws.send(JSON.stringify(event));
    return new Promise<ServerEvent>((resolve) => {
      pending.set(event.id, (response) => {
        pending.delete(event.id);
        resolve(response);
      });
      setTimeout(() => {
        pending.delete(event.id);
        resolve({ id: event.id, type: "timeout", ok: false, error: { code: 504, message: "Smoke request timeout" } });
      }, 8000);
    });
  }

  await request("auth.login", { username: "demo", password: "nebulaim" });
  await request("connection.heartbeat", {});
  await request("message.pull_offline", { userId: "u-current", page: 1, pageSize: 20 });

  ws.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
