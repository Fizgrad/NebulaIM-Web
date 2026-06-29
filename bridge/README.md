# NebulaIM Web Bridge

NebulaIM Web Bridge is the HTTP service boundary for NebulaIM Web. It serves the built React app and exposes browser-safe HTTP APIs that proxy backend gRPC services.

Gateway long-connection traffic does not go through this Bridge. Browser clients connect directly to the C++ Gateway WebSocket endpoint and send NebulaIM binary Packet + Protobuf frames.

## Architecture

```text
Browser Web Client
  -> WebSocket binary frame
NebulaIM Gateway :9000
  -> gRPC
MessageService / PushService / UserService

Browser Web Client
  -> HTTP JSON
NebulaIM Web Bridge :8080
  -> gRPC protobuf
UserService / RelationService / ConversationService / AdminService
```

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
PROTO_DIR=../proto
WEB_STATIC_DIR=
```

`WEB_STATIC_DIR` can point to the built frontend directory, for example `/opt/nebulaim-web/web`, so the Bridge process can serve the SPA.

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

## HTTP Endpoints

```text
GET /health
GET /info
```

`/health` returns:

```json
{
  "ok": true,
  "service": "nebulaim-web-bridge"
}
```

`/info` returns the configured backend service addresses.

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
GET    /api/relation/friends?userId=<id>
POST   /api/relation/friends
DELETE /api/relation/friends/:friendId?userId=<id>
POST   /api/relation/groups
POST   /api/relation/groups/:groupId/join
POST   /api/relation/groups/:groupId/leave
GET    /api/relation/groups/:groupId/members
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

## Gateway Note

The C++ Gateway owns browser long connections:

```text
WebSocket Binary Payload = NebulaIM PacketCodec bytes
```

The frontend implements this in:

```text
src/services/browserPacketCodec.ts
src/services/browserProtoRegistry.ts
src/services/directGatewayClient.ts
```

## Gateway Integration Checklist

1. Start NebulaIM dependencies.
2. Start UserService, RelationService, ConversationService, MessageService, PushService, AdminService and Gateway.
3. Confirm Gateway WebSocket listens on `127.0.0.1:9000`.
4. Confirm Bridge listens on `127.0.0.1:8080`.
5. Confirm `/health` and `/info` return OK.
6. Login through the frontend.
7. Send a direct message to a numeric backend `user_id`.
8. Open `/admin`, enter an AdminService token and call health/outbox/kafka/cleanup.

## Common Errors

- `USER_SERVICE_UNAVAILABLE`: UserService is not reachable at `USER_SERVICE_HOST:USER_SERVICE_PORT`.
- `RELATION_SERVICE_UNAVAILABLE`: RelationService is not reachable.
- `CONVERSATION_SERVICE_UNAVAILABLE`: ConversationService is not reachable.
- `ADMIN_TOKEN_REQUIRED`: `/api/admin/*` request did not include `X-Nebula-Admin-Token`.
- `admin permission denied`: token exists but lacks the required scope.
