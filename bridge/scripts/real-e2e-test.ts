import * as grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import WebSocket from "ws";
import path from "node:path";

const protoDir = path.resolve(process.cwd(), "../proto");
const userServiceAddr = process.env.USER_SERVICE_ADDR ?? "127.0.0.1:50051";
const bridgeWsUrl = process.env.BRIDGE_WS_URL ?? "ws://127.0.0.1:8080/ws";
const password = "password123";

type CommonResponse = {
  code: number;
  message: string;
  requestId: string;
};

type RegisterResponse = {
  response: CommonResponse;
  userId: string;
};

type UserGrpcClient = grpc.Client & {
  Register(
    request: Record<string, unknown>,
    callback: (error: grpc.ServiceError | null, response: RegisterResponse) => void
  ): void;
};

type ClientEvent = {
  id: string;
  type: string;
  timestamp: number;
  payload: Record<string, unknown>;
};

type ServerEvent = {
  id: string;
  type: string;
  ok: boolean;
  payload?: Record<string, unknown>;
  error?: { code: number; message: string };
};

type UserServiceConstructor = new (address: string, credentials: grpc.ChannelCredentials) => UserGrpcClient;

function loadUserClient(): UserGrpcClient {
  const packageDefinition = protoLoader.loadSync(path.join(protoDir, "user.proto"), {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [protoDir]
  });
  const loaded = grpc.loadPackageDefinition(packageDefinition);
  const nebula = loaded.nebula as grpc.GrpcObject | undefined;
  const proto = nebula?.proto as grpc.GrpcObject | undefined;
  const UserService = proto?.UserService as UserServiceConstructor | undefined;
  if (!UserService) throw new Error("Failed to load nebula.proto.UserService.");
  return new UserService(userServiceAddr, grpc.credentials.createInsecure());
}

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function registerUser(client: UserGrpcClient, username: string, nickname: string) {
  return new Promise<RegisterResponse>((resolve, reject) => {
    client.Register(
      {
        requestId: createId("register"),
        username,
        password,
        nickname
      },
      (error, response) => {
        if (error) {
          reject(error);
          return;
        }
        if (response.response.code !== 0) {
          reject(new Error(`Register failed for ${username}: ${response.response.message}`));
          return;
        }
        resolve(response);
      }
    );
  });
}

function createEvent(type: string, payload: Record<string, unknown>): ClientEvent {
  return {
    id: createId("event"),
    type,
    timestamp: Date.now(),
    payload
  };
}

async function openBridgeSocket() {
  const ws = new WebSocket(bridgeWsUrl);
  const pending = new Map<string, (event: ServerEvent) => void>();
  let gatewayReady = false;
  let markReady: (() => void) | undefined;
  let markFailed: ((error: Error) => void) | undefined;

  ws.on("message", (data) => {
    const event = JSON.parse(data.toString()) as ServerEvent;
    console.log("<-", event.type, event.ok, event.error?.message ?? event.payload?.message ?? "");
    if (event.type === "connection.status") {
      const payload = event.payload as { gatewayConnected?: boolean } | undefined;
      if (event.ok && payload?.gatewayConnected !== false) {
        gatewayReady = true;
        markReady?.();
      } else if (!event.ok) {
        markFailed?.(new Error(event.error?.message ?? "Bridge Gateway is not connected."));
      }
    }
    pending.get(event.id)?.(event);
  });

  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });

  await new Promise<void>((resolve, reject) => {
    if (gatewayReady) {
      resolve();
      return;
    }
    const timer = setTimeout(() => reject(new Error("Timeout waiting for Bridge Gateway connection.")), 10000);
    markReady = () => {
      clearTimeout(timer);
      resolve();
    };
    markFailed = (error) => {
      clearTimeout(timer);
      reject(error);
    };
  });

  function request(type: string, payload: Record<string, unknown>, expectedType: string) {
    const event = createEvent(type, payload);
    console.log("->", event.type);
    ws.send(JSON.stringify(event));
    return new Promise<ServerEvent>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(event.id);
        reject(new Error(`Timeout waiting for ${expectedType}`));
      }, 10000);

      pending.set(event.id, (response) => {
        clearTimeout(timeout);
        pending.delete(event.id);
        if (response.type !== expectedType || !response.ok) {
          reject(new Error(`${type} failed: ${response.error?.message ?? response.payload?.message ?? response.type}`));
          return;
        }
        resolve(response);
      });
    });
  }

  return { ws, request };
}

async function main() {
  const suffix = Date.now().toString(36);
  const senderUsername = `web_real_sender_${suffix}`;
  const receiverUsername = `web_real_receiver_${suffix}`;
  const userClient = loadUserClient();

  console.log("Registering users through UserService", userServiceAddr);
  const sender = await registerUser(userClient, senderUsername, "Web Real Sender");
  const receiver = await registerUser(userClient, receiverUsername, "Web Real Receiver");
  console.log("Registered", { sender: sender.userId, receiver: receiver.userId });

  const { ws, request } = await openBridgeSocket();
  await request(
    "auth.login",
    {
      username: senderUsername,
      password
    },
    "auth.login_result"
  );
  await request("connection.heartbeat", {}, "connection.heartbeat_result");
  await request(
    "message.pull_offline",
    {
      userId: sender.userId,
      page: 1,
      pageSize: 20
    },
    "message.pull_offline_result"
  );
  await request(
    "message.send_single",
    {
      fromUserId: sender.userId,
      toUserId: receiver.userId,
      content: `real bridge smoke ${new Date().toISOString()}`,
      contentType: "text",
      clientSequenceId: 1
    },
    "message.send_single_result"
  );

  ws.close();
  console.log("real bridge smoke passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
