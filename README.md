# NebulaIM Web

<p align="center">
  <img src="public/logo.png" alt="NebulaIM Logo" width="420" />
</p>

NebulaIM Web is a modern web client for NebulaIM, a distributed instant messaging system built with C++17, epoll, Reactor, gRPC, Kafka, Redis and MySQL.

NebulaIM Web 是 NebulaIM 分布式即时通信系统的现代化 Web 客户端，用于展示登录、会话、消息收发、在线状态、离线消息、消息 ACK 和系统监控等核心能力。

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Zustand
- React Router
- Axios
- Lucide React Icons
- Recharts
- Framer Motion

## Pages

- `/` Landing Page
- `/login` Real Bridge login through Gateway
- `/register` Real Bridge registration through UserService
- `/app/chat` IM client with conversation list, direct chat, group chat, ACK states and Gateway WebSocket bridge
- `/app/contacts` Friend list and relation actions
- `/app/groups` Group list, create, join, leave and members
- `/app/profile` Current user and Gateway metadata
- `/app/settings` Real Bridge URL, heartbeat, reconnect and local data controls
- `/dashboard` Bridge and runtime monitoring dashboard
- `/admin` AdminService console through the Web Bridge HTTP proxy

## Features

- Real Bridge API layer for UserService, AdminService and Gateway access
- Gateway abstraction under `src/services`
- Example-only mock data under `src/mocks`
- Zustand stores split by domain
- Local persistence for token and settings
- Frontend token expiry tracking and refresh lifecycle
- HTTP/WebSocket request IDs and trace IDs
- HTTP retry and WebSocket message retry with backoff
- Failed message retry action in chat bubbles
- Message states: `sending`, `sent`, `delivered`, `read`, `failed`
- Example-only simulated failures for offline demo mode
- Real Bridge Gateway connection, heartbeat and latency
- Dashboard metrics, service health and recent events
- AdminService console for health, system stats, outbox stats, Kafka lag and cleanup
- Bridge-side AdminService gRPC proxy using `x-nebula-admin-token` metadata
- Bridge-side UserService HTTP proxy for real registration and token refresh
- Playwright E2E smoke flow for client navigation and chat send

## Directory Structure

```text
nebulaim-web/
├── package.json
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tailwind.config.ts
├── postcss.config.js
├── eslint.config.js
├── README.md
├── public/
│   ├── logo.png
│   └── favicon.svg
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── routes/
    ├── components/
    ├── pages/
    ├── store/
    ├── api/
    ├── services/
    ├── mocks/
    ├── types/
    ├── utils/
    └── assets/
        └── nebula-logo.png
```

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

`npm run dev` defaults to Real Bridge mode. Start the NebulaIM backend and `nebulaim-web-bridge` first when exercising login and messaging. For an offline UI-only demo, use `npm run dev:example`.

## Build

```bash
npm run build
```

## Preview

```bash
npm run preview
```

## Example Mode

The production and normal development default is Real Bridge mode. Mock code remains only as an offline example/demo path and is not exposed as a normal Settings option.

To run the offline example client explicitly:

```bash
npm run dev:example
```

Example mode uses Mock API + Mock WebSocket:

- `src/api/authApi.ts`: login, register, token validation and user info.
- `src/api/chatApi.ts`: send single/group messages, ACK and offline messages.
- `src/api/relationApi.ts`: friends and groups.
- `src/api/dashboardApi.ts`: metrics, health and events.
- `src/services/mockSocket.ts`: connected, disconnected, heartbeat, latency, reconnect and received messages.
- `src/services/gatewayClient.ts`: browser-safe Gateway client interface.

Example users include Alice, Bob, Charlie and Diana. Example conversations include Alice, Bob, Charlie, Nebula Core Team and Backend Infra Group. Example metrics cover Gateway connections, online users, message QPS, push success rate, Kafka consume rate and P99 latency.

## Real NebulaIM Gateway Integration

Browsers cannot directly connect to NebulaIM native TCP Gateway on port `9000`. A browser client must use a browser-compatible bridge.

Recommended integration options:

- WebSocket Gateway: expose a WebSocket endpoint that maps browser messages to NebulaIM Gateway protocol.
- HTTP API Gateway: expose REST endpoints for auth, relation and message operations.
- gRPC-Web Gateway: bridge browser gRPC-Web calls to backend gRPC services.
- Node.js TCP Proxy: terminate WebSocket/HTTP in Node.js and proxy to the native TCP Gateway.
- C++ Gateway WebSocket Binary: NebulaIM Gateway also supports browser WebSocket upgrade where binary frame payloads are raw NebulaIM PacketCodec bytes.

The code is structured so this can be replaced without rewriting UI components:

- Replace or extend `src/services/gatewayClient.ts`.
- Keep the Real Bridge APIs in `src/api` as the primary integration surface.
- Keep stores and components consuming typed domain APIs.

## Backend Ports

```text
Gateway TCP Long Connection: 9000
Gateway RPC: 50055
UserService: 50051
RelationService: 50053
MessageService: 50052
PushService: 50054
AdminService: 50057
Prometheus: 9090
Grafana: 3000
```

## Screenshots

Screenshots can be added after running the app:

- Landing Page
- Login Page
- Chat Client
- Contacts
- Groups
- Dashboard
- Admin Console

## Roadmap

- Connect to a real WebSocket Gateway.
- Add real authentication token validation.
- Add Prometheus HTTP query integration.
- Add file/image message types.
- Add message retry and resend queue.
- Add E2E tests for the chat flow.

## Phase 2: WebSocket Bridge / Node TCP Proxy

The second phase adds `nebulaim-web-bridge`, a lightweight Node.js bridge that solves the browser TCP limitation.

```text
Browser Web Frontend
  -> WebSocket / HTTP
NebulaIM Web Bridge
  -> Native TCP PacketHeader + Protobuf
NebulaIM Gateway
  -> gRPC
UserService / MessageService / PushService / RelationService
```

Browsers cannot directly connect to the native NebulaIM TCP Gateway on `9000`. The frontend connects to the bridge over WebSocket JSON. The bridge converts JSON events to NebulaIM binary packets and Protobuf bodies, then forwards Gateway PUSH messages back to the browser.

After inspecting the local backend at `~/NebulaIM`, this project now aligns the bridge with the real backend protocol:

- `common/protocol/PacketHeader.*`
- `common/protocol/PacketCodec.*`
- `common/protocol/MessageType.*`
- `common/gateway/GatewayRouter.cpp`
- `proto/*.proto`

Important backend detail: NebulaIM Gateway also supports WebSocket binary frames directly:

```text
WebSocket Binary Payload = NebulaIM PacketCodec bytes
```

That gives two real integration routes:

- Current implemented route: Browser JSON WebSocket -> Node Bridge -> TCP Gateway.
- Future direct route: Browser Binary WebSocket -> C++ Gateway, with PacketCodec + Protobuf implemented in the frontend.

## Admin Console

The `/admin` page connects to NebulaIM AdminService through the bridge HTTP API:

```text
Browser /admin
  -> HTTP JSON /api/admin/*
NebulaIM Web Bridge
  -> gRPC nebula.proto.AdminService
NebulaIM AdminService :50057
```

The browser never calls AdminService gRPC directly. The frontend sends the token to the bridge as `X-Nebula-Admin-Token`; the bridge forwards it to AdminService as gRPC metadata `x-nebula-admin-token`.

Bridge Admin endpoints:

- `GET /api/admin/health`
- `GET /api/admin/system-stats`
- `GET /api/admin/outbox-stats`
- `GET /api/admin/kafka-lag`
- `POST /api/admin/cleanup` with `{ "dryRun": true }`

The local backend config uses scoped admin tokens. In the inspected `~/NebulaIM/config/nebula.conf`, the bundled development raw tokens are:

- `nebula-ops-local`: `health`, `stats`, `outbox`
- `nebula-kafka-local`: `health`, `kafka`
- `nebula-maint-local`: `health`, `cleanup`

## Real Auth Bridge

In Real Bridge mode, browser-safe auth requests are split by backend contract:

- Login uses `WebSocket /ws -> Gateway TCP :9000`, because Gateway owns the long-lived session.
- Register uses `POST /api/auth/register -> UserService.Register :50051`.
- Token refresh uses `POST /api/auth/refresh -> UserService.RefreshToken :50051`.

The browser never calls gRPC directly. The bridge forwards HTTP JSON to UserService gRPC and returns JSON errors such as `USER_ALREADY_EXISTS`, `PASSWORD_TOO_SHORT`, `USERNAME_EMPTY` and `PASSWORD_EMPTY`.

## Example Mode

Example mode does not require a backend and is intended only for UI demos:

```bash
npm install
npm run dev:example
```

Open:

```text
http://localhost:5173
```

The Settings page does not expose Example mode as a normal product option. Use `VITE_CONNECTION_MODE=mock` or `npm run dev:example` when an offline demonstration is required.

## Real Bridge Mode

Start the bridge:

```bash
cd bridge
npm install
cp .env.example .env
npm run dev
```

Start the frontend:

```bash
npm install
npm run dev
```

In Settings, confirm the Bridge endpoints if needed:

```text
Bridge WebSocket URL = ws://localhost:8080/ws
Bridge HTTP URL = http://localhost:8080
```

Use **Test Bridge** to call `/health` and `/info`.

## End-to-End NebulaIM Integration

1. Start NebulaIM backend dependencies:

```bash
cd NebulaIM
./scripts/start_deps.sh
./scripts/init_topics.sh
```

2. Start backend services:

```bash
./scripts/start_services.sh
```

Or start services separately:

```bash
./build/user_service/user_service --config ../config/nebula.conf
./build/message_service/message_service --config ../config/nebula.conf
./build/push_service/push_service --config ../config/nebula.conf
./build/admin_service/admin_service --config ../config/nebula.conf
./build/gateway/gateway --config ../config/nebula.conf
```

3. Start Web Bridge:

```bash
cd nebulaim-web/bridge
npm install
cp .env.example .env
npm run dev
```

4. Start Web frontend:

```bash
cd nebulaim-web
npm install
npm run dev
```

5. Open browser:

```text
http://localhost:5173
```

6. Confirm the Real Bridge endpoints:

```text
Settings -> Bridge WebSocket URL = ws://localhost:8080/ws
```

7. Login and send a message:

- Register or prepare test users.
- Login in Real Bridge mode.
- Open `/app/chat`.
- Send a single chat or group chat message.
- Check Gateway / MessageService / PushService logs.
- Confirm the frontend receives response events and `PUSH_MSG`.
- Open `/admin`, enter an AdminService token, then verify health, outbox and cleanup responses.

## Bridge Protocol Summary

Client events:

- `auth.login`
- `connection.heartbeat`
- `message.send_single`
- `message.send_group`
- `message.ack`
- `message.pull_offline`

Server events:

- `auth.login_result`
- `connection.heartbeat_result`
- `message.send_single_result`
- `message.send_group_result`
- `message.ack_result`
- `message.pull_offline_result`
- `message.push`
- `connection.status`
- `error`

TCP Packet header:

```text
uint32 magic       0x4E494D42
uint16 version     1
uint16 type
uint32 sequence_id
uint32 body_length
```

All TCP bodies are Protobuf encoded. MessageType and proto fields must stay synchronized with the C++ backend.

The root `proto/` directory is synchronized from `~/NebulaIM/proto` and uses the real backend shape: nested `CommonResponse response`, `uint64 user_id`, enum `MessageContentType`, and `PageRequest`.

## Build Verification

Frontend:

```bash
npm run build
```

Frontend lint:

```bash
npm run lint
```

Frontend E2E:

```bash
npx playwright install chromium
npx playwright install-deps chromium
npm run test:e2e
```

Bridge:

```bash
cd bridge
npm run build
```

Bridge smoke test:

```bash
cd bridge
npm run smoke
```

## Docker Compose

```bash
docker compose -f docker-compose.web.yml up --build
```

Local startup is recommended during backend protocol development because MessageType and proto files may change frequently.

## Common Issues

- Browser cannot connect to TCP `9000`: expected. Use WebSocket Bridge.
- `GATEWAY_NOT_CONNECTED`: start NebulaIM Gateway or update `GATEWAY_TCP_HOST` / `GATEWAY_TCP_PORT`.
- `PROTO_DECODE_FAILED`: bridge proto files do not match backend proto files.
- `GATEWAY_TIMEOUT`: backend accepted TCP but did not send a response packet with matching `sequence_id`.
- Login fails in Real Bridge mode: verify UserService, Gateway auth protocol and `/ws` Bridge connectivity.
- Sending to sample users in Real Bridge mode fails: Real mode requires numeric backend `user_id` / `group_id`. Use the User ID field in Messages before opening a real direct chat.
- Admin health works but cleanup fails: the token likely lacks `cleanup` scope.
- Admin Kafka lag returns permission denied: use a token with `kafka` scope.
