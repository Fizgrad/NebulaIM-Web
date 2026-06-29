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
- `/login` Real Gateway login through C++ Gateway WebSocket or Node Bridge fallback
- `/register` Real Gateway registration through `REGISTER_REQ` or Bridge fallback
- `/app/chat` IM client with real conversation list, direct chat, group chat, ACK states and Gateway WebSocket transport
- `/app/contacts` Friend list and relation actions
- `/app/groups` Group list, create, join, leave and members
- `/app/profile` Current user and Gateway metadata
- `/app/settings` Real Bridge URL, heartbeat, reconnect and local data controls
- `/dashboard` Bridge and runtime monitoring dashboard
- `/admin` AdminService console through the Web Bridge HTTP proxy

## Features

- Direct C++ Gateway WebSocket binary transport for login, register, message send, ACK and offline pull
- Real Bridge HTTP API layer for ConversationService, RelationService, UserService and AdminService access
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
- Real Gateway connection, heartbeat and latency
- Dashboard Bridge health and AdminService live metrics
- AdminService console for health, system stats, outbox stats, Kafka lag and cleanup
- Bridge-side AdminService gRPC proxy using `x-nebula-admin-token` metadata
- Bridge-side UserService HTTP proxy for real registration and token refresh
- Bridge-side RelationService HTTP proxy for friends, groups and group members
- Bridge-side ConversationService HTTP proxy for real conversation lists and read state
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

`npm run dev` defaults to Real mode with direct C++ Gateway WebSocket transport. Start the NebulaIM backend and `nebulaim-web-bridge` first when exercising login, messaging, relation APIs and conversation lists. For an offline UI-only demo, use `npm run dev:example`.

## Build

```bash
npm run build
```

## Preview

```bash
npm run preview
```

## Example Mode

The production and normal development default is Real mode. Mock code remains only as an offline example/demo path and is not exposed as a normal Settings option. In Real mode, the app does not preload example conversations, contacts or groups.

To run the offline example client explicitly:

```bash
npm run dev:example
```

Example mode uses Mock API + Mock WebSocket for the client interaction surface:

- `src/api/authApi.ts`: login, register, token validation and user info.
- `src/api/chatApi.ts`: send single/group messages, ACK and offline messages.
- `src/api/relationApi.ts`: friends and groups.
- `src/services/mockSocket.ts`: connected, disconnected, heartbeat, latency, reconnect and received messages.
- `src/services/gatewayClient.ts`: browser-safe Gateway client interface.

Example users include Alice, Bob, Charlie and Diana. Example conversations include Alice, Bob, Charlie, Nebula Core Team and Backend Infra Group. These records are loaded only when `VITE_CONNECTION_MODE=mock`. Dashboard metrics are never mocked by default; they require a real AdminService token.

## Real NebulaIM Gateway Integration

Browsers cannot open raw TCP sockets, but the latest NebulaIM Gateway supports browser WebSocket upgrade on the same `9000` listener. The browser can now send binary WebSocket frames whose payload is a NebulaIM Packet.

Current integration options:

- Direct C++ Gateway WebSocket: browser sends PacketHeader + Protobuf bytes directly to `ws://localhost:9000/`.
- Node Web Bridge JSON fallback: browser sends JSON to `/ws`, Bridge converts to TCP Packet + Protobuf.
- HTTP API Gateway: Bridge exposes REST endpoints for relation, conversation, auth refresh and admin operations.
- gRPC-Web Gateway: bridge browser gRPC-Web calls to backend gRPC services.
- Node.js TCP Proxy: terminate WebSocket/HTTP in Node.js and proxy to the native TCP Gateway.

The code is structured so this can be replaced without rewriting UI components:

- Replace or extend `src/services/gatewayClient.ts`.
- Keep the Bridge HTTP APIs in `src/api` as the primary service-query surface.
- Keep stores and components consuming typed domain APIs.

## Backend Ports

```text
Gateway TCP Long Connection: 9000
Gateway RPC: 50055
UserService: 50051
RelationService: 50053
MessageService: 50052
PushService: 50054
ConversationService: 50056
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

- Add direct device-management UI when DeviceService is implemented as a running service.
- Add real authentication token validation.
- Add Prometheus HTTP query integration.
- Add file/image message types.
- Add message retry and resend queue.
- Add E2E tests for the chat flow.

## Phase 2/3: WebSocket Bridge And Direct Gateway

The second phase added `nebulaim-web-bridge`, a lightweight Node.js bridge. The latest backend also supports browser WebSocket binary frames directly in the C++ Gateway.

```text
Browser Web Frontend
  -> WebSocket Binary Packet
NebulaIM Gateway :9000
  -> gRPC
UserService / MessageService / PushService / RelationService / ConversationService

Browser Web Frontend
  -> HTTP JSON
NebulaIM Web Bridge
  -> gRPC
RelationService / ConversationService / UserService / AdminService
```

Browsers cannot open raw TCP sockets, but they can connect to the Gateway's WebSocket upgrade path. The default frontend transport now uses binary WebSocket PacketCodec frames for Gateway operations. The bridge remains responsible for HTTP proxies to UserService, RelationService, ConversationService and AdminService.

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

- Default route: Browser Binary WebSocket -> C++ Gateway, with PacketCodec + Protobuf implemented in `src/services/directGatewayClient.ts`.
- Fallback route: Browser JSON WebSocket -> Node Bridge -> TCP Gateway.

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

## Real Auth And Gateway Transport

In Real mode, Gateway-owned operations use the selected Gateway transport:

- Direct transport uses `ws://localhost:9000/` and sends `REGISTER_REQ`, `LOGIN_REQ`, `SEND_SINGLE_MSG_REQ`, `ACK_REQ` and `PULL_OFFLINE_MSG_REQ` as binary Packets.
- Bridge transport uses `ws://localhost:8080/ws` JSON events and the Node Bridge converts them to Gateway TCP Packets.
- Token refresh uses `POST /api/auth/refresh -> UserService.RefreshToken :50051`.

The browser never calls gRPC directly. The bridge forwards HTTP JSON to backend gRPC services and returns JSON errors such as `USER_ALREADY_EXISTS`, `PASSWORD_TOO_SHORT`, `USERNAME_EMPTY` and `PASSWORD_EMPTY`.

## Real Conversation Bridge

The chat page loads real conversations from ConversationService:

- `GET /api/conversations?userId=<id>&page=1&pageSize=50` -> `ConversationService.ListConversations :50056`
- `POST /api/conversations/:conversationId/read` -> `ConversationService.MarkConversationRead :50056`

The UI maps `conversation_type=1` to single chat using `peer_user_id` and `conversation_type=2` to group chat using `group_id`.

## Real Relation Bridge

Contacts and groups no longer use mock data in the default Real mode. The frontend calls:

- `GET /api/relation/friends?userId=<id>` -> `RelationService.ListFriends :50053`
- `POST /api/relation/friends` -> `RelationService.AddFriend :50053`
- `DELETE /api/relation/friends/:friendId?userId=<id>` -> `RelationService.DeleteFriend :50053`
- `POST /api/relation/groups` -> `RelationService.CreateGroup :50053`
- `POST /api/relation/groups/:groupId/join` -> `RelationService.JoinGroup :50053`
- `POST /api/relation/groups/:groupId/leave` -> `RelationService.LeaveGroup :50053`
- `GET /api/relation/groups/:groupId/members` -> `RelationService.ListGroupMembers :50053`

`RelationService` currently has no "list all groups for user" RPC, so the Real Groups page starts empty and adds groups after create or join. Direct chat creation requires a numeric backend `user_id`; the app does not send usernames as message recipients.

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

## Real Direct / Bridge Mode

Start the bridge for HTTP service proxies and optional JSON WebSocket fallback:

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
Gateway Transport = Direct
Direct Gateway WebSocket URL = ws://localhost:9000/
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
./build/user_service/nebula_user_service --config config/nebula.conf
./build/message_service/nebula_message_service --config config/nebula.conf
./build/push_service/nebula_push_service --config config/nebula.conf
./build/relation_service/nebula_relation_service --config config/nebula.conf
./build/conversation_service/nebula_conversation_service --config config/nebula.conf
./build/admin_service/nebula_admin_service --config config/nebula.conf
./build/gateway/nebula_gateway --config config/nebula.conf
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

6. Confirm the Real transport endpoints:

```text
Settings -> Gateway Transport = Direct
Settings -> Direct Gateway WebSocket URL = ws://localhost:9000/
Settings -> Bridge HTTP URL = http://localhost:8080
```

7. Login and send a message:

- Register or prepare test users.
- Login in Real mode.
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

- Browser cannot open raw TCP `9000`, but it can connect to the Gateway WebSocket upgrade endpoint, for example `ws://localhost:9000/`.
- `GATEWAY_NOT_CONNECTED`: start NebulaIM Gateway or update `GATEWAY_TCP_HOST` / `GATEWAY_TCP_PORT`.
- `PROTO_DECODE_FAILED`: bridge proto files do not match backend proto files.
- `GATEWAY_TIMEOUT`: backend accepted TCP but did not send a response packet with matching `sequence_id`.
- Login fails in Direct mode: verify the C++ Gateway WebSocket endpoint and that `REGISTER_REQ` / `LOGIN_REQ` use binary Packet + Protobuf, not JSON.
- Login fails in Bridge mode: verify UserService, Gateway auth protocol and `/ws` Bridge connectivity.
- Sending to sample users in Real mode fails: Real mode requires numeric backend `user_id` / `group_id`. Use the User ID field in Messages before opening a real direct chat.
- Admin health works but cleanup fails: the token likely lacks `cleanup` scope.
- Admin Kafka lag returns permission denied: use a token with `kafka` scope.
