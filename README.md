# NebulaIM Web

**Language / 语言:** [English](#english) | [中文](#中文)

## English

NebulaIM Web is the React + TypeScript client for NebulaIM. It connects browser users to the C++ Gateway through the Web Bridge and keeps Gateway traffic on the NebulaIM binary Packet + Protobuf protocol.

### Architecture

```text
Browser
  -> HTTP
  -> Web Bridge
  -> gRPC
UserService / RelationService / ConversationService / MessageService / DeviceService / AdminService

Browser
  -> WebSocket /ws
  -> Web Bridge TCP proxy
  -> C++ Gateway
  -> NebulaIM PacketHeader + Protobuf body
MessageService / PushService / UserService
```

The browser does not send JSON to the Gateway. Browser-safe HTTP routes are exposed by the Bridge, while `/ws` forwards binary Gateway frames.

### User Interface

- `/` product entry page.
- `/login` login through Gateway `LOGIN_REQ`.
- `/register` registration through Gateway `REGISTER_REQ`.
- `/app/chat` friend chat, group chat, image messages, Gateway heartbeat, ACK status and pushed messages.
- `/app/contacts` friends, username or user ID friend requests, incoming requests and outgoing requests.
- `/app/groups` joined group search, group creation, group name or ID search, join, leave and member list.
- `/app/profile` current account and Gateway connection metadata.
- `/app/settings` theme, language, endpoint, device and local action settings.
- `/dashboard` Bridge health and AdminService runtime metrics.
- `/admin` AdminService operations for health, service overview, audit events, outbox, Kafka lag and cleanup.

### Language Support

The client supports English and Chinese display modes. The selected language is stored in `nebulaim-settings` and can be changed from `/app/settings`.

Implementation files:

- `src/i18n.ts`: translation dictionary and `useI18n()` hook.
- `src/store/settingsStore.ts`: persisted `language` setting.
- `src/App.tsx`: keeps `<html lang>` synchronized with the selected language.

### Runtime Endpoints

Endpoint values are deployment-specific and must stay in environment variables, GitHub Actions variables/secrets or server-side config.

```text
Bridge HTTP:        https://<bridge-host>
Gateway WebSocket:  wss://<bridge-host>/ws
Gateway TCP label:  tcp://<gateway-host>:9000
```

When the built app is served by the Bridge, the frontend uses same-origin defaults:

```text
Bridge HTTP:        window.location.origin
Gateway WebSocket:  ws(s)://window.location.host/ws
```

### Development

Install dependencies:

```bash
npm install
cd bridge && npm install
```

Start the Bridge after the backend services are running:

```bash
cd bridge
cp .env.example .env
npm run dev
```

Start Vite in another shell:

```bash
npm run dev
```

Default local endpoints point to a Bridge on `127.0.0.1:8080`. Override them only when the browser must use a different Bridge:

```bash
VITE_BRIDGE_HTTP_URL=http://<bridge-host>:8080 \
VITE_GATEWAY_WS_URL=ws://<bridge-host>:8080/ws \
npm run dev
```

### Build

```bash
npm run build
cd bridge && npm run build
```

### GitHub Pages Build

The Pages workflow builds the static client with:

```text
PAGES_BASE_PATH=/NebulaIM-Web/
PAGES_BRIDGE_HTTP_URL=https://<bridge-host>
PAGES_GATEWAY_WS_URL=wss://<bridge-host>/ws
```

The app includes a `404.html` single-page fallback so direct links such as `/NebulaIM-Web/login` route correctly on GitHub Pages. Proto assets are loaded relative to `import.meta.env.BASE_URL`, so Pages sub-path deployment uses `/NebulaIM-Web/proto/*.proto`.

### Bridge HTTP API

The Bridge exposes HTTP routes over backend gRPC services. Except for `GET /health`, `GET /info`, `WS /ws`, `POST /api/auth/register`, and `POST /api/auth/refresh`, browser API calls require `Authorization: Bearer <NebulaIM token>`. User-owned routes derive the current user from that token.

```text
GET  /health
GET  /info
WS   /ws

POST /api/auth/refresh
POST /api/auth/register
GET  /api/auth/users/:userId
GET  /api/auth/users/by-username/:username

GET  /api/relation/friends
GET  /api/relation/friend-requests
POST /api/relation/friend-requests
POST /api/relation/friend-requests/:requestId/accept
POST /api/relation/friend-requests/:requestId/reject
DELETE /api/relation/friends/:friendId
GET  /api/relation/groups
GET  /api/relation/groups/search
POST /api/relation/groups
POST /api/relation/groups/:groupId/join
POST /api/relation/groups/:groupId/leave
GET  /api/relation/groups/:groupId
GET  /api/relation/groups/:groupId/members

GET  /api/conversations
POST /api/conversations/:conversationId/read

GET  /api/devices
POST /api/devices/:deviceId/kick
POST /api/devices/kick-all

POST /api/uploads/images
POST /api/messages/single
POST /api/messages/group
GET  /api/messages/conversations/:conversationId
GET  /api/messages/read-state?messageIds=10001,10002
GET  /media/<object-key>

GET  /api/presence/users

GET  /api/admin/health
GET  /api/admin/system-stats
GET  /api/admin/outbox-stats
GET  /api/admin/kafka-lag
GET  /api/admin/service-overview
GET  /api/admin/audit-events
POST /api/admin/cleanup
```

Device routes call DeviceService for the signed-in user's device list and revocation actions. Message, relation, group, conversation, device and upload routes ignore client-supplied current-user IDs and use the authenticated token identity. Message read-state only returns receipt data for messages in conversations owned by the signed-in user. Bridge-to-backend gRPC calls include `INTERNAL_RPC_TOKEN` when configured. Admin routes require `X-Nebula-Admin-Token`. Do not commit raw AdminService tokens.

Image messages use `POST /api/uploads/images` first. Development can keep files under `UPLOAD_DIR` and serve them from `/uploads/...`. Production uses MinIO through the S3-compatible Bridge storage adapter, stores objects in the `nebulaim-media` bucket, and serves returned URLs from `/media/...`. The frontend sends the returned URL as a `contentType: "image"` message. When a user selects an image and also enters text, one send action sends the image message first and then sends the text message; the current protocol does not create a combined image-plus-text payload.

### Production Media Storage

Production deploys are prepared by `deploy/setup-minio-media.sh`:

```text
MinIO data directory: /opt/nebulaim-data/minio
MinIO API:            http://127.0.0.1:19000
MinIO container:      nebulaim-minio
Bucket:               nebulaim-media
Bridge storage:       MEDIA_STORAGE_DRIVER=s3
Public media path:    /media
```

GitHub Actions calls this script during deployment. The script starts the MinIO container, creates the bucket, generates missing S3 credentials in `/opt/nebulaim-web/bridge.env`, and leaves credentials out of git. The existing `/uploads` route remains available for local files that were already written before the MinIO migration.

## 中文

NebulaIM Web 是 NebulaIM 的 React + TypeScript 前端客户端。它通过 Web Bridge 连接浏览器和 C++ Gateway，并保持 Gateway 流量使用 NebulaIM 二进制 Packet + Protobuf 协议。

### 架构

```text
浏览器
  -> HTTP
  -> Web Bridge
  -> gRPC
UserService / RelationService / ConversationService / MessageService / DeviceService / AdminService

浏览器
  -> WebSocket /ws
  -> Web Bridge TCP 代理
  -> C++ Gateway
  -> NebulaIM PacketHeader + Protobuf body
MessageService / PushService / UserService
```

浏览器不会向 Gateway 发送 JSON。浏览器安全的 HTTP 路由由 Bridge 提供，`/ws` 负责转发二进制 Gateway 帧。

### 用户界面

- `/` 产品入口页。
- `/login` 通过 Gateway `LOGIN_REQ` 登录。
- `/register` 通过 Gateway `REGISTER_REQ` 注册。
- `/app/chat` 好友聊天、群聊、图片消息、Gateway 心跳、ACK 状态和推送消息。
- `/app/contacts` 好友、按用户名或用户 ID 发送好友请求、收到的请求和发出的请求。
- `/app/groups` 已加入群组搜索、创建群组、按群名称或 ID 搜索加入、退出和成员列表。
- `/app/profile` 当前账号和 Gateway 连接信息。
- `/app/settings` 主题、语言、端点、设备和本地操作设置。
- `/dashboard` Bridge 健康状态和 AdminService 运行指标。
- `/admin` AdminService 的健康检查、服务概览、审计事件、Outbox、Kafka 滞后和清理操作。

### 语言支持

客户端支持英文和中文两种显示模式。语言设置保存在 `nebulaim-settings` 中，可以在 `/app/settings` 切换。

实现文件：

- `src/i18n.ts`：翻译字典和 `useI18n()` hook。
- `src/store/settingsStore.ts`：持久化的 `language` 设置。
- `src/App.tsx`：根据当前语言同步 `<html lang>`。

### 运行端点

端点值属于部署环境配置，应保存在环境变量、GitHub Actions variables/secrets 或服务端配置中。

```text
Bridge HTTP:        https://<bridge-host>
Gateway WebSocket:  wss://<bridge-host>/ws
Gateway TCP label:  tcp://<gateway-host>:9000
```

当构建后的前端由 Bridge 自身托管时，前端使用同源默认值：

```text
Bridge HTTP:        window.location.origin
Gateway WebSocket:  ws(s)://window.location.host/ws
```

### 本地开发

安装依赖：

```bash
npm install
cd bridge && npm install
```

后端服务启动后启动 Bridge：

```bash
cd bridge
cp .env.example .env
npm run dev
```

另开一个终端启动 Vite：

```bash
npm run dev
```

本地默认端点指向 `127.0.0.1:8080` 上的 Bridge。只有浏览器需要连接其他 Bridge 时才覆盖：

```bash
VITE_BRIDGE_HTTP_URL=http://<bridge-host>:8080 \
VITE_GATEWAY_WS_URL=ws://<bridge-host>:8080/ws \
npm run dev
```

### 构建

```bash
npm run build
cd bridge && npm run build
```

### GitHub Pages 构建

Pages workflow 使用以下变量构建静态客户端：

```text
PAGES_BASE_PATH=/NebulaIM-Web/
PAGES_BRIDGE_HTTP_URL=https://<bridge-host>
PAGES_GATEWAY_WS_URL=wss://<bridge-host>/ws
```

应用包含 `404.html` 单页 fallback，因此 `/NebulaIM-Web/login` 这种直接访问链接可以在 GitHub Pages 上正确路由。Proto 资源基于 `import.meta.env.BASE_URL` 加载，所以 Pages 子路径部署会请求 `/NebulaIM-Web/proto/*.proto`。

### Bridge HTTP API

Bridge 通过 HTTP 路由暴露后端 gRPC 服务。除了 `GET /health`、`GET /info`、`WS /ws`、`POST /api/auth/register` 和 `POST /api/auth/refresh`，浏览器业务 API 都需要 `Authorization: Bearer <NebulaIM token>`。用户相关路由会从 token 解析当前用户。

```text
GET  /health
GET  /info
WS   /ws

POST /api/auth/refresh
POST /api/auth/register
GET  /api/auth/users/:userId
GET  /api/auth/users/by-username/:username

GET  /api/relation/friends
GET  /api/relation/friend-requests
POST /api/relation/friend-requests
POST /api/relation/friend-requests/:requestId/accept
POST /api/relation/friend-requests/:requestId/reject
DELETE /api/relation/friends/:friendId
GET  /api/relation/groups
GET  /api/relation/groups/search
POST /api/relation/groups
POST /api/relation/groups/:groupId/join
POST /api/relation/groups/:groupId/leave
GET  /api/relation/groups/:groupId
GET  /api/relation/groups/:groupId/members

GET  /api/conversations
POST /api/conversations/:conversationId/read

GET  /api/devices
POST /api/devices/:deviceId/kick
POST /api/devices/kick-all

POST /api/uploads/images
POST /api/messages/single
POST /api/messages/group
GET  /api/messages/conversations/:conversationId
GET  /api/messages/read-state?messageIds=10001,10002
GET  /media/<object-key>

GET  /api/presence/users

GET  /api/admin/health
GET  /api/admin/system-stats
GET  /api/admin/outbox-stats
GET  /api/admin/kafka-lag
GET  /api/admin/service-overview
GET  /api/admin/audit-events
POST /api/admin/cleanup
```

设备路由调用 DeviceService 获取设备列表和踢出设备。消息、关系、群组、会话、设备和上传路由会忽略客户端传来的当前用户 ID，统一使用 token 解析出的身份。消息 read-state 只返回当前登录用户拥有的会话中的消息回执。Bridge 到后端的 gRPC 调用会在配置后携带 `INTERNAL_RPC_TOKEN`。Admin 路由需要 `X-Nebula-Admin-Token`。不要提交明文 AdminService token。

图片消息会先调用 `POST /api/uploads/images`。开发环境可以继续把文件保存到 `UPLOAD_DIR` 并通过 `/uploads/...` 访问。生产环境通过 Bridge 的 S3 兼容存储适配器上传到 MinIO，图片对象保存在 `nebulaim-media` bucket 中，并通过 `/media/...` 返回给前端。前端再把返回的 URL 作为 `contentType: "image"` 消息发送。当用户选择图片并输入文字时，一次发送动作会先发送图片消息，再发送文字消息；当前协议不生成图片加文字的复合消息体。

### 生产媒体存储

生产部署由 `deploy/setup-minio-media.sh` 准备媒体存储：

```text
MinIO 数据目录： /opt/nebulaim-data/minio
MinIO API：      http://127.0.0.1:19000
MinIO 容器：     nebulaim-minio
Bucket：         nebulaim-media
Bridge 存储：    MEDIA_STORAGE_DRIVER=s3
媒体访问路径：   /media
```

GitHub Actions 部署时会调用这个脚本。脚本会启动 MinIO 容器、创建 bucket、在 `/opt/nebulaim-web/bridge.env` 中生成缺失的 S3 凭据，并且不会把凭据写入 git。已有的 `/uploads` 路由会继续保留，用来访问迁移到 MinIO 前仍存在的本地文件。
