# NebulaIM Web Bridge

NebulaIM Web Bridge is the browser-facing service boundary for NebulaIM Web. It serves the built React app, exposes browser-safe HTTP APIs that proxy backend gRPC services, and provides the public `/ws` WebSocket entrypoint for Gateway traffic.

## Architecture

```text
Browser
  -> HTTP JSON
NebulaIM Web Bridge :8080
  -> gRPC protobuf
UserService / RelationService / ConversationService / AdminService

Browser
  -> WebSocket /ws
NebulaIM Web Bridge :8080
  -> transparent TCP proxy
NebulaIM Gateway 127.0.0.1:9000
  -> NebulaIM PacketHeader + Protobuf body
MessageService / PushService / UserService
```

The Bridge does not decode Gateway packets. It forwards the WebSocket upgrade and binary frame stream to `GATEWAY_TCP_HOST:GATEWAY_TCP_PORT`.

## Environment

```env
BRIDGE_HOST=0.0.0.0
BRIDGE_PORT=8080

GATEWAY_TCP_HOST=127.0.0.1
GATEWAY_TCP_PORT=9000

USER_SERVICE_HOST=127.0.0.1
USER_SERVICE_PORT=50051

RELATION_SERVICE_HOST=127.0.0.1
RELATION_SERVICE_PORT=50053

CONVERSATION_SERVICE_HOST=127.0.0.1
CONVERSATION_SERVICE_PORT=50056

ADMIN_SERVICE_HOST=127.0.0.1
ADMIN_SERVICE_PORT=50057

CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=info
HEARTBEAT_INTERVAL_MS=15000
GATEWAY_REQUEST_TIMEOUT_MS=5000
PROTO_DIR=../proto
WEB_STATIC_DIR=
```

`WEB_STATIC_DIR` can point to the built frontend directory, for example `/opt/nebulaim-web/web`, so the Bridge process can serve the SPA. When the Bridge serves the SPA, frontend routes fall back to `index.html` and `/api/*` routes remain API-only.

## Install

```bash
cd bridge
npm install
cp .env.example .env
```

## Development

```bash
npm run dev
```

## Production Build

```bash
npm run build
npm start
```

## HTTP And WebSocket Endpoints

```text
GET /health
GET /info
WS  /ws
```

`/health` returns:

```json
{
  "ok": true,
  "service": "nebulaim-web-bridge"
}
```

`/info` returns configured backend addresses and the public WebSocket route:

```json
{
  "name": "nebulaim-web-bridge",
  "gateway": "127.0.0.1:9000",
  "user": "127.0.0.1:50051",
  "relation": "127.0.0.1:50053",
  "conversation": "127.0.0.1:50056",
  "admin": "127.0.0.1:50057",
  "websocket": "/ws"
}
```

## Auth HTTP API

The Bridge exposes UserService endpoints needed by the browser outside the Gateway long connection:

```text
GET  /api/auth/users/:userId
POST /api/auth/refresh
```

Token refresh request:

```json
{
  "token": "current-token",
  "deviceId": "web"
}
```

## Relation HTTP API

```text
GET  /api/relation/friends?userId=<id>
GET  /api/relation/friend-requests?userId=<id>&incoming=true&status=0
POST /api/relation/friend-requests
POST /api/relation/friend-requests/:requestId/accept
POST /api/relation/friend-requests/:requestId/reject
DELETE /api/relation/friends/:friendId?userId=<id>
POST /api/relation/groups
POST /api/relation/groups/:groupId/join
POST /api/relation/groups/:groupId/leave
GET  /api/relation/groups/:groupId/members
```

The current frontend creates friendships through the RelationService friend request flow:

```json
{
  "fromUserId": "10001",
  "toUserId": "10002",
  "message": "hello"
}
```

Accept and reject use:

```json
{
  "userId": "10002"
}
```

The Bridge forwards these calls to `nebula.proto.RelationService` on `RELATION_SERVICE_HOST:RELATION_SERVICE_PORT`. IDs must be numeric backend IDs.

## Conversation HTTP API

```text
GET    /api/conversations?userId=<id>&page=1&pageSize=50
POST   /api/conversations/:conversationId/read
DELETE /api/conversations/:conversationId
POST   /api/conversations/:conversationId/pin
POST   /api/conversations/:conversationId/mute
```

The Bridge forwards these calls to `nebula.proto.ConversationService` on `CONVERSATION_SERVICE_HOST:CONVERSATION_SERVICE_PORT`.

## Admin HTTP API

```text
GET  /api/admin/health
GET  /api/admin/system-stats
GET  /api/admin/outbox-stats
GET  /api/admin/kafka-lag
POST /api/admin/cleanup
```

Clients send the raw AdminService token in:

```text
X-Nebula-Admin-Token: <token>
```

The Bridge forwards that value to AdminService as gRPC metadata key `x-nebula-admin-token`. The token is not written to logs.

## Protobuf

The Bridge loads backend service definitions from the root `proto/` directory with `@grpc/proto-loader`.

Keep these files synchronized with `~/NebulaIM/proto`:

```text
admin.proto
common.proto
conversation.proto
device.proto
gateway.proto
message.proto
push.proto
relation.proto
user.proto
```

## Gateway Proxy

The C++ Gateway owns long-lived messaging sessions. The Bridge only makes that Gateway reachable from browsers through `/ws`.

```text
WebSocket Binary Payload = NebulaIM PacketCodec bytes
```

The frontend implements Gateway packet handling in:

```text
src/services/browserPacketCodec.ts
src/services/browserProtoRegistry.ts
src/services/directGatewayClient.ts
```

## Gateway Integration Checklist

1. Start NebulaIM dependencies.
2. Start UserService, RelationService, ConversationService, MessageService, PushService, AdminService and Gateway.
3. Confirm Gateway listens at `GATEWAY_TCP_HOST:GATEWAY_TCP_PORT`, normally `127.0.0.1:9000`.
4. Confirm Bridge listens at `BRIDGE_HOST:BRIDGE_PORT`, normally `0.0.0.0:8080`.
5. Confirm `/health` and `/info` return OK and `/info.websocket` is `/ws`.
6. Confirm a browser can open `ws://<bridge-host>:8080/ws`.
7. Login through the frontend.
8. Send and accept a friend request before testing friend-dependent flows.
9. Send a direct message to a numeric backend `user_id`.
10. Open `/admin`, enter an AdminService token and call health/outbox/kafka/cleanup.

## Common Errors

- `USER_SERVICE_UNAVAILABLE`: UserService is not reachable at `USER_SERVICE_HOST:USER_SERVICE_PORT`.
- `RELATION_SERVICE_UNAVAILABLE`: RelationService is not reachable at `RELATION_SERVICE_HOST:RELATION_SERVICE_PORT`.
- `CONVERSATION_SERVICE_UNAVAILABLE`: ConversationService is not reachable at `CONVERSATION_SERVICE_HOST:CONVERSATION_SERVICE_PORT`.
- `/ws` returns `502 Bad Gateway`: Gateway is not reachable at `GATEWAY_TCP_HOST:GATEWAY_TCP_PORT`.
- `ADMIN_TOKEN_REQUIRED`: `/api/admin/*` request did not include `X-Nebula-Admin-Token`.
- `admin permission denied`: token exists but lacks the required scope.
