# NebulaIM Web Bridge

NebulaIM Web Bridge is a lightweight Node.js TCP proxy for the NebulaIM browser client.

Browsers cannot open native TCP connections to the C++ Gateway on port `9000`, so the bridge exposes:

- WebSocket JSON protocol at `/ws`
- HTTP health endpoints at `/health` and `/info`
- HTTP UserService auth proxy endpoints at `/api/auth/*`
- HTTP AdminService proxy endpoints at `/api/admin/*`
- Native TCP binary Packet protocol to NebulaIM Gateway

## Architecture

```text
Browser Web Client
  -> WebSocket JSON
NebulaIM Web Bridge
  -> TCP PacketHeader + Protobuf body
NebulaIM Gateway
  -> gRPC services
UserService / MessageService / PushService / RelationService

Browser Admin Console
  -> HTTP JSON /api/admin/*
NebulaIM Web Bridge
  -> gRPC metadata + protobuf
AdminService

Browser Register / Token Refresh
  -> HTTP JSON /api/auth/*
NebulaIM Web Bridge
  -> gRPC protobuf
UserService
```

One browser WebSocket session owns one TCP Gateway connection. Do not share a TCP connection across browser users because Gateway session identity is connection-scoped.

## Environment

```env
BRIDGE_HOST=0.0.0.0
BRIDGE_PORT=8080
GATEWAY_TCP_HOST=127.0.0.1
GATEWAY_TCP_PORT=9000
USER_SERVICE_HOST=127.0.0.1
USER_SERVICE_PORT=50051
ADMIN_SERVICE_HOST=127.0.0.1
ADMIN_SERVICE_PORT=50057
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=info
HEARTBEAT_INTERVAL_MS=15000
GATEWAY_REQUEST_TIMEOUT_MS=5000
PROTO_DIR=../proto
```

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

## Auth HTTP API

The bridge exposes browser-safe HTTP endpoints for UserService operations that are not long-lived Gateway packets:

- `POST /api/auth/register`
- `POST /api/auth/refresh`

Register request:

```json
{
  "username": "alice",
  "password": "password123",
  "nickname": "Alice"
}
```

Register response:

```json
{
  "ok": true,
  "userId": "10001",
  "username": "alice",
  "nickname": "Alice"
}
```

The bridge forwards registration to `nebula.proto.UserService.Register` on `USER_SERVICE_HOST:USER_SERVICE_PORT`. The inspected backend validates empty username, empty password, duplicate username and password length, then returns `RegisterResponse { response, user_id }`.

Refresh request:

```json
{
  "token": "current-token"
}
```

## Admin HTTP API

The bridge exposes a small browser-safe HTTP proxy for NebulaIM AdminService:

- `GET /api/admin/health`
- `GET /api/admin/system-stats`
- `GET /api/admin/outbox-stats`
- `GET /api/admin/kafka-lag`
- `POST /api/admin/cleanup` with `{ "dryRun": true }`

Clients must send the raw AdminService token in:

```text
X-Nebula-Admin-Token: <token>
```

The bridge forwards that value to the backend gRPC call as metadata key `x-nebula-admin-token`. The token is not part of the protobuf request body and must not be logged.

The inspected backend config uses scoped tokens in `admin_service.admin_tokens`. Bundled development raw tokens are:

- `nebula-ops-local`: `health`, `stats`, `outbox`
- `nebula-kafka-local`: `health`, `kafka`
- `nebula-maint-local`: `health`, `cleanup`

## WebSocket Events

Client to Bridge:

- `auth.login`
- `connection.heartbeat`
- `message.send_single`
- `message.send_group`
- `message.ack`
- `message.pull_offline`

Bridge to Client:

- `auth.login_result`
- `connection.heartbeat_result`
- `message.send_single_result`
- `message.send_group_result`
- `message.ack_result`
- `message.pull_offline_result`
- `message.push`
- `connection.status`
- `error`

All server events use:

```ts
type ServerEvent = {
  id: string;
  type: string;
  ok: boolean;
  timestamp: number;
  payload?: unknown;
  error?: { code: number; message: string };
};
```

## TCP Packet Protocol

The bridge sends binary packets to the C++ Gateway. It never sends JSON to the TCP Gateway.

Header is fixed 16 bytes, big-endian:

```text
uint32 magic       0x4E494D42
uint16 version     1
uint16 type
uint32 sequence_id
uint32 body_length
```

Body is a Protobuf encoded message. `PacketCodec` handles sticky packets and half packets with an internal receive buffer. Default body limit is 1MB.

## MessageType

`bridge/src/gateway/MessageType.ts` must stay aligned with the C++ backend:

```text
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

If the C++ backend changes MessageType values, update the bridge enum and rebuild.

## Protobuf

Proto files live in the root `proto/` directory and are loaded once at startup with `protobufjs`.

The root `proto/` files are synchronized from `~/NebulaIM/proto`. Keep them aligned with backend changes.

The bridge currently expects these fully qualified names:

- `nebula.proto.LoginRequest`
- `nebula.proto.LoginResponse`
- `nebula.proto.SendSingleMessageRequest`
- `nebula.proto.SendSingleMessageResponse`
- `nebula.proto.SendGroupMessageRequest`
- `nebula.proto.SendGroupMessageResponse`
- `nebula.proto.AckMessageRequest`
- `nebula.proto.AckMessageResponse`
- `nebula.proto.PullOfflineMessagesRequest`
- `nebula.proto.PullOfflineMessagesResponse`
- `nebula.proto.MessageData`
- `nebula.proto.CommonResponse`
- `nebula.proto.AdminService`
- `nebula.proto.HealthCheckRequest`
- `nebula.proto.HealthCheckResponse`
- `nebula.proto.GetSystemStatsRequest`
- `nebula.proto.GetSystemStatsResponse`
- `nebula.proto.GetOutboxStatsRequest`
- `nebula.proto.GetOutboxStatsResponse`
- `nebula.proto.GetKafkaLagInfoRequest`
- `nebula.proto.GetKafkaLagInfoResponse`
- `nebula.proto.RunCleanupRequest`
- `nebula.proto.RunCleanupResponse`

These files must be synchronized with the real NebulaIM backend proto definitions before production use.

The inspected backend returns `HEARTBEAT_RESP` as `nebula.proto.CommonResponse`; the heartbeat request body is empty and is ignored by `GatewayRouter::handleHeartbeat`.

The bridge expects the real backend response shape: nested `CommonResponse response`, numeric uint64 IDs, enum `MessageContentType`, and `PageRequest` for offline message pull.

## Backend WebSocket Note

The inspected `~/NebulaIM` backend also supports WebSocket upgrade directly inside the C++ Gateway. Its contract is:

```text
WebSocket Binary Payload = NebulaIM PacketCodec bytes
```

This bridge remains useful when the frontend wants a JSON WebSocket API and HTTP health endpoints. A future frontend direct mode can connect to the C++ Gateway WebSocket endpoint and send binary PacketCodec frames directly.

## Manual Smoke Test

```bash
cd bridge
npm run smoke
```

The smoke test connects to `ws://localhost:8080/ws`, sends `auth.login`, `connection.heartbeat`, and `message.pull_offline`, then prints server events.

## Gateway Integration Checklist

1. Start NebulaIM dependencies.
2. Start UserService, MessageService, PushService, RelationService, AdminService and Gateway.
3. Confirm Gateway TCP listens on `127.0.0.1:9000`.
4. Confirm AdminService listens on `127.0.0.1:50057`.
5. Start this bridge.
6. Switch the frontend Settings page to Real Bridge.
7. Login and send a message.
8. Open `/admin`, enter an AdminService token and call health/outbox/cleanup.
9. Check Gateway, MessageService, PushService and AdminService logs.

## Common Errors

- `GATEWAY_NOT_CONNECTED`: Gateway TCP port is not reachable.
- `GATEWAY_TIMEOUT`: Gateway did not respond before `GATEWAY_REQUEST_TIMEOUT_MS`.
- `GATEWAY_PACKET_ERROR`: packet magic, version or body length is invalid.
- `PROTO_ENCODE_FAILED`: frontend event payload does not match proto schema.
- `PROTO_DECODE_FAILED`: Gateway response body does not match proto schema.
- `AUTH_FAILED`: backend rejected login.
- `ADMIN_TOKEN_REQUIRED`: `/api/admin/*` request did not include `X-Nebula-Admin-Token`.
- Admin RPC response says `admin permission denied`: token exists but lacks the required scope.
