# NebulaIM Web

<p align="center">
  <img src="public/logo.png" alt="NebulaIM Logo" width="420" />
</p>

NebulaIM Web is a modern web client for NebulaIM, a distributed instant messaging system built with C++17, epoll, Reactor, gRPC, Kafka, Redis and MySQL.

NebulaIM Web 是 NebulaIM 分布式即时通信系统的现代化 Web 客户端，用于展示登录、会话、消息收发、在线状态、离线消息、消息 ACK、后台管理和系统监控等核心能力。

## Current Architecture

```text
Browser Web Client
  -> WebSocket binary frame
  -> NebulaIM PacketHeader + Protobuf body
NebulaIM Gateway :9000
  -> gRPC
UserService / MessageService / PushService / RelationService / ConversationService

Browser Web Client
  -> HTTP JSON
NebulaIM Web Bridge :8080
  -> gRPC
UserService / RelationService / ConversationService / AdminService
```

The browser does not send JSON messages to Gateway. Gateway traffic uses the same NebulaIM packet protocol as native TCP clients, wrapped in WebSocket binary frames.

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
- protobufjs

## Pages

- `/` Landing page
- `/login` Gateway `LOGIN_REQ`
- `/register` Gateway `REGISTER_REQ`
- `/app/chat` conversation list, direct chat, group chat, Gateway heartbeat, ACK state and PUSH messages
- `/app/contacts` RelationService friends
- `/app/groups` RelationService groups
- `/app/profile` current user and Gateway metadata
- `/app/settings` Gateway WebSocket and Bridge HTTP endpoints
- `/dashboard` Bridge health and AdminService live metrics
- `/admin` AdminService console

## Features

- Direct C++ Gateway WebSocket binary transport for register, login, heartbeat, message send, ACK and offline pull.
- Browser-side PacketHeader encoder/decoder in `src/services/browserPacketCodec.ts`.
- Browser-side Protobuf loading in `src/services/browserProtoRegistry.ts`.
- Gateway client implementation in `src/services/directGatewayClient.ts`.
- Bridge HTTP API layer for UserService, RelationService, ConversationService and AdminService.
- Zustand stores split by domain.
- Local persistence for token and settings.
- Token expiry tracking and refresh through UserService.
- HTTP request IDs and trace IDs.
- HTTP retry and message retry actions.
- Dashboard metrics loaded from AdminService.
- Admin console for health, system stats, outbox stats, Kafka lag and cleanup.

## Directory Structure

```text
nebulaim-web/
├── bridge/
│   ├── package.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── config.ts
│   │   └── server/
│   │       ├── httpServer.ts
│   │       ├── authRoutes.ts
│   │       ├── relationRoutes.ts
│   │       ├── conversationRoutes.ts
│   │       └── adminRoutes.ts
├── proto/
├── public/
│   ├── logo.png
│   ├── favicon.svg
│   └── proto/
└── src/
    ├── api/
    ├── components/
    ├── pages/
    ├── routes/
    ├── services/
    ├── store/
    ├── types/
    └── utils/
```

## Install

```bash
npm install
cd bridge && npm install
```

## Development

Start NebulaIM backend first, then start the Bridge and frontend:

```bash
cd bridge
cp .env.example .env
npm run dev
```

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

Default endpoints:

```text
Gateway WebSocket: ws://localhost:9000/
Bridge HTTP:       http://localhost:8080
```

## Build

```bash
npm run build
cd bridge && npm run build
```

## Preview

```bash
npm run preview
```

## Backend Ports

```text
Gateway TCP/WebSocket: 9000
Gateway RPC: 50055
UserService: 50051
MessageService: 50052
RelationService: 50053
PushService: 50054
ConversationService: 50056
AdminService: 50057
Prometheus: 9090
Grafana: 3000
```

## Gateway Protocol

NebulaIM Gateway accepts browser WebSocket upgrade on the same `9000` listener as native TCP clients.

```text
WebSocket Binary Payload = NebulaIM PacketCodec bytes
```

Packet header:

```text
uint32 magic       0x4E494D42
uint16 version     1
uint16 type
uint32 sequence_id
uint32 body_length
```

Important message types:

```text
REGISTER_REQ=1003
REGISTER_RESP=1004
LOGIN_REQ=1001
LOGIN_RESP=1002
HEARTBEAT_REQ=1101
HEARTBEAT_RESP=1102
SEND_SINGLE_MSG_REQ=2001
SEND_SINGLE_MSG_RESP=2002
SEND_GROUP_MSG_REQ=2101
SEND_GROUP_MSG_RESP=2102
PUSH_MSG=3001
ACK_REQ=4001
ACK_RESP=4002
PULL_OFFLINE_MSG_REQ=5001
PULL_OFFLINE_MSG_RESP=5002
ERROR_RESP=9001
```

All packet bodies are Protobuf encoded. Proto files are synchronized from `~/NebulaIM/proto` into `proto/` and `public/proto/`.

## Bridge HTTP API

The Bridge exposes browser-safe HTTP endpoints for backend gRPC services:

```text
GET  /health
GET  /info

POST /api/auth/refresh
GET  /api/auth/users/:userId

GET    /api/relation/friends?userId=<id>
POST   /api/relation/friends
DELETE /api/relation/friends/:friendId?userId=<id>
POST   /api/relation/groups
POST   /api/relation/groups/:groupId/join
POST   /api/relation/groups/:groupId/leave
GET    /api/relation/groups/:groupId/members

GET    /api/conversations?userId=<id>&page=1&pageSize=50
POST   /api/conversations/:conversationId/read
DELETE /api/conversations/:conversationId
POST   /api/conversations/:conversationId/pin
POST   /api/conversations/:conversationId/mute

GET  /api/admin/health
GET  /api/admin/system-stats
GET  /api/admin/outbox-stats
GET  /api/admin/kafka-lag
POST /api/admin/cleanup
```

Admin requests send the raw AdminService token as:

```text
X-Nebula-Admin-Token: <token>
```

The Bridge forwards it to AdminService as gRPC metadata key `x-nebula-admin-token`.

## End-to-End Integration

1. Start NebulaIM dependencies:

```bash
cd ~/NebulaIM
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

5. Open:

```text
http://localhost:5173
```

6. Login and send messages:

- Register two users.
- Login both users in separate browser contexts.
- Open a direct chat by numeric backend `user_id`.
- Send a message.
- Confirm sender status reaches `delivered`.
- Confirm recipient receives `PUSH_MSG`.
- Check ConversationService via `/api/conversations`.
- Open `/admin`, enter an AdminService token, then check health/outbox/kafka/cleanup.

## Admin Tokens

The local backend config contains scoped development tokens:

```text
nebula-ops-local    health, stats, outbox
nebula-kafka-local  health, kafka
nebula-maint-local  health, cleanup
```

Replace these before exposing the system.

## Docker Compose

```bash
docker compose -f docker-compose.web.yml up --build
```

## Verification

```bash
npm run lint
npm run build
cd bridge && npm run lint
cd bridge && npm run build
```

## Common Issues

- Browser login fails: verify Gateway is listening on `ws://localhost:9000/`.
- Gateway closes the socket: verify the frontend is sending binary WebSocket frames, not JSON/text frames.
- Message send fails: use numeric backend `user_id` / `group_id`.
- Message does not reach MessageService: confirm the send uses the same WebSocket connection that logged in.
- Conversation list is empty: send a message first or verify `ConversationService :50056`.
- Admin health works but cleanup fails: the token likely lacks `cleanup` scope.
- Admin Kafka lag returns permission denied: use a token with `kafka` scope.
