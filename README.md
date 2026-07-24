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

The browser does not send JSON to the Gateway. Login, session resume, heartbeat, pushed messages and ACK use binary Packet + Protobuf over `/ws`. Message commands, history, relations, groups, devices and administration use authenticated Bridge HTTP routes.

### User Interface

- `/` product entry page.
- `/login` login through Gateway `LOGIN_REQ`; persisted sessions reconnect with `RESUME_SESSION_REQ`.
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

In GitHub, set **Settings -> Pages -> Build and deployment -> Source** to **GitHub Actions**. Then add `PAGES_BRIDGE_HTTP_URL` and `PAGES_GATEWAY_WS_URL` under **Settings -> Secrets and variables -> Actions -> Variables**. Add `PAGES_BASE_PATH` only when the repository path differs from `/NebulaIM-Web/`. The Bridge must allow the Pages origin in `CORS_ORIGIN`.

The app includes a `404.html` single-page fallback so direct links such as `/NebulaIM-Web/login` route correctly on GitHub Pages. Proto assets are loaded relative to `import.meta.env.BASE_URL`, so Pages sub-path deployment uses `/NebulaIM-Web/proto/*.proto`.

### Production Deployment Variables

Prepare the server once. Node.js 22, npm, Docker, systemd and a running NebulaIM backend are required:

```bash
sudo install -d -m 750 /opt/nebulaim-web
sudo install -m 640 deploy/production.env.example /opt/nebulaim-web/bridge.env
sudo editor /opt/nebulaim-web/bridge.env
```

Set `PUBLIC_BASE_URL` to the public HTTPS origin, `CORS_ORIGIN` to the frontend origin, all backend hosts/ports to reachable values, and `INTERNAL_RPC_TOKEN` to the same raw token used by the backend. Keep backend gRPC and Gateway on loopback when the Bridge runs on the same server. The deployment workflow provisions MinIO and writes the bucket-scoped S3 credential into this server-local file.

The server deployment workflow requires these GitHub environment secrets:

```text
DEPLOY_SSH_KEY   private key for the deployment account
DEPLOY_HOST_KEY  verified known_hosts line for the target host and port
DEPLOY_HOST      target DNS name or IP
```

Set `DEPLOY_USER` and optional `DEPLOY_PORT` as environment secrets or variables. `DEPLOY_SERVICE` is an optional repository variable. The deployment path is fixed at `/opt/nebulaim-web` to match the systemd unit. `DEPLOY_PORT` must be in `1..65535`, and the service name may contain only systemd unit-name characters. The deployment account must be a non-root SSH user with passwordless sudo for the deployment commands. The runtime process uses the dedicated `nebulaim-web` system account. Releases are prepared in a staging directory; if activation or health checks fail, the workflow restores the previous release.

Generate the verified host key on a trusted machine:

```bash
ssh-keyscan -p <ssh-port> <deploy-host>
```

Store the complete output as `DEPLOY_HOST_KEY`; store the private deployment key as `DEPLOY_SSH_KEY`. Never use an unverified keyscan result obtained inside the deployment job.

Terminate public TLS with Nginx and proxy the Bridge:

```nginx
server {
    listen 443 ssl http2;
    server_name im.example.com;

    location /ws {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

After the first workflow run:

```bash
sudo systemctl status nebulaim-web-bridge.service
curl -fsS http://127.0.0.1:8080/health
curl -fsS https://im.example.com/health
```

### Bridge HTTP API

The Bridge exposes HTTP routes over backend gRPC services. Except for `GET /health`, `GET /info`, `WS /ws`, `POST /api/auth/register`, and `POST /api/auth/refresh`, browser API calls require `Authorization: Bearer <NebulaIM token>`. User-owned routes derive the current user from that token.

AdminService tokens are entered only on the Dashboard or Admin pages and remain in page memory. They are cleared by a reload and are not persisted to browser storage.

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
POST /api/conversations/:conversationId/read  body: {"upToMessageId":"..."}
DELETE /api/conversations/:conversationId
POST /api/conversations/:conversationId/pin   body: {"value":true}
POST /api/conversations/:conversationId/mute  body: {"value":true}

GET  /api/devices
POST /api/devices/:deviceId/kick
POST /api/devices/kick-all

POST /api/uploads/images
POST /api/messages/single
POST /api/messages/group
GET  /api/messages/conversations/:conversationId?limit=50&before=<timestamp>&beforeMessageId=<id>
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

Device routes call DeviceService for the signed-in user's device list and revocation actions. Message, relation, group, conversation, device and upload routes use the authenticated token identity. Message history, group membership and read-state authorization are enforced by their owning backend services; the Bridge does not query backend tables. History pages use a `(timestamp, message ID)` cursor, and the chat view exposes earlier pages without changing the user's scroll position. Read-state is visible only to the message sender. Marking a conversation read requires the last visible message ID, so concurrently arriving messages are not cleared accidentally. Bridge-to-backend calls use `INTERNAL_RPC_TOKEN` and support TLS/mTLS through `GRPC_TLS_*`; a non-loopback backend requires TLS. Admin routes require `X-Nebula-Admin-Token`. Do not commit raw tokens or private keys.

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

GitHub Actions calls this script during deployment. The script uses digest-pinned MinIO images, stores root credentials in `/opt/nebulaim-data/minio.env`, creates a separate `nebulaim-media-app` user with access only to the media bucket, and writes only that application credential to `/opt/nebulaim-web/bridge.env`. Both files remain server-local.

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

浏览器不会向 Gateway 发送 JSON。登录、会话恢复、心跳、推送消息和 ACK 通过 `/ws` 使用二进制 Packet + Protobuf；消息命令、历史记录、关系、群组、设备和管理功能使用鉴权后的 Bridge HTTP 路由。

### 用户界面

- `/` 产品入口页。
- `/login` 通过 Gateway `LOGIN_REQ` 登录；持久化会话重连时使用 `RESUME_SESSION_REQ`。
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

在 GitHub 的 **Settings -> Pages -> Build and deployment -> Source** 中选择 **GitHub Actions**，再到 **Settings -> Secrets and variables -> Actions -> Variables** 添加 `PAGES_BRIDGE_HTTP_URL` 和 `PAGES_GATEWAY_WS_URL`。只有仓库路径不是 `/NebulaIM-Web/` 时才需要设置 `PAGES_BASE_PATH`。Bridge 的 `CORS_ORIGIN` 必须允许 Pages 的来源。

应用包含 `404.html` 单页 fallback，因此 `/NebulaIM-Web/login` 这种直接访问链接可以在 GitHub Pages 上正确路由。Proto 资源基于 `import.meta.env.BASE_URL` 加载，所以 Pages 子路径部署会请求 `/NebulaIM-Web/proto/*.proto`。

### 生产部署变量

服务器需要先完成一次初始化，并准备 Node.js 22、npm、Docker、systemd 和已运行的 NebulaIM 后端：

```bash
sudo install -d -m 750 /opt/nebulaim-web
sudo install -m 640 deploy/production.env.example /opt/nebulaim-web/bridge.env
sudo editor /opt/nebulaim-web/bridge.env
```

将 `PUBLIC_BASE_URL` 设置为公网 HTTPS 源，将 `CORS_ORIGIN` 设置为前端源；后端地址和端口必须可达，`INTERNAL_RPC_TOKEN` 必须与后端使用的原始 token 相同。Bridge 与后端位于同一台服务器时，后端 gRPC 和 Gateway 应保持回环监听。部署 workflow 会准备 MinIO，并把仅有媒体 Bucket 权限的 S3 凭据写入这个服务器本地文件。

服务器部署 workflow 需要以下 GitHub environment secrets：

```text
DEPLOY_SSH_KEY   部署账号的私钥
DEPLOY_HOST_KEY  已核验的目标主机和端口 known_hosts 记录
DEPLOY_HOST      目标域名或 IP
```

`DEPLOY_USER` 和可选的 `DEPLOY_PORT` 可以配置为 environment secret 或 variable；`DEPLOY_SERVICE` 是可选的 repository variable。部署目录固定为 `/opt/nebulaim-web`，与 systemd 单元一致。`DEPLOY_PORT` 必须位于 `1..65535`，服务名只能使用 systemd unit 名称允许的字符。SSH 部署账号应是具备部署命令免密 sudo 权限的非 root 用户，运行时进程固定使用专用的 `nebulaim-web` 系统账号。发布先写入暂存目录；激活或健康检查失败时会恢复上一份版本。

在可信机器上生成已核验的主机公钥记录：

```bash
ssh-keyscan -p <SSH-端口> <部署主机>
```

把完整输出保存为 `DEPLOY_HOST_KEY`，把部署私钥保存为 `DEPLOY_SSH_KEY`。不要在部署任务中临时获取并直接信任主机公钥。

使用 Nginx 终止公网 TLS，并代理 Bridge：

```nginx
server {
    listen 443 ssl http2;
    server_name im.example.com;

    location /ws {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

首次 workflow 完成后验证：

```bash
sudo systemctl status nebulaim-web-bridge.service
curl -fsS http://127.0.0.1:8080/health
curl -fsS https://im.example.com/health
```

### Bridge HTTP API

Bridge 通过 HTTP 路由暴露后端 gRPC 服务。除了 `GET /health`、`GET /info`、`WS /ws`、`POST /api/auth/register` 和 `POST /api/auth/refresh`，浏览器业务 API 都需要 `Authorization: Bearer <NebulaIM token>`。用户相关路由会从 token 解析当前用户。

AdminService Token 只在 Dashboard 或 Admin 页面输入，并且只保存在当前页面内存中；刷新页面后会清除，不会持久化到浏览器存储。

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
POST /api/conversations/:conversationId/read  body: {"upToMessageId":"..."}
DELETE /api/conversations/:conversationId
POST /api/conversations/:conversationId/pin   body: {"value":true}
POST /api/conversations/:conversationId/mute  body: {"value":true}

GET  /api/devices
POST /api/devices/:deviceId/kick
POST /api/devices/kick-all

POST /api/uploads/images
POST /api/messages/single
POST /api/messages/group
GET  /api/messages/conversations/:conversationId?limit=50&before=<timestamp>&beforeMessageId=<id>
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

设备路由调用 DeviceService 获取设备列表和踢出设备。消息、关系、群组、会话、设备和上传路由统一使用 token 解析出的身份。消息历史、群成员权限和回执权限由对应后端服务校验，Bridge 不直接查询后端数据表。历史分页使用“时间戳 + 消息 ID”复合游标，聊天区可以继续加载更早消息且不会改变当前滚动位置。消息回执只允许发送者查看；标记会话已读必须提交当前最后可见消息 ID，避免把并发到达的新消息误清零。Bridge 到后端的调用使用 `INTERNAL_RPC_TOKEN`，并通过 `GRPC_TLS_*` 支持 TLS/mTLS；后端地址不是本机回环地址时必须启用 TLS。Admin 路由需要 `X-Nebula-Admin-Token`。不要提交 token 或私钥。

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

GitHub Actions 部署时会调用这个脚本。脚本使用固定摘要的 MinIO 镜像，把 root 凭据保存在 `/opt/nebulaim-data/minio.env`，并创建只能访问媒体 Bucket 的 `nebulaim-media-app` 用户。Bridge 环境文件只保存这个应用用户的凭据，两个凭据文件都只存在于服务器。
