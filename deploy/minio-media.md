# NebulaIM MinIO Media Storage

**Language / 语言:** [English](#english) | [中文](#中文)

## English

NebulaIM Web stores chat image files in MinIO for production. Message rows keep the returned URL, while object bytes stay outside the deployable application directory.

### Runtime Layout

```text
MinIO container:      nebulaim-minio
MinIO API:            http://127.0.0.1:19000
MinIO console:        http://127.0.0.1:19001
Data directory:       /opt/nebulaim-data/minio
Bucket:               nebulaim-media
Bridge media route:   /media/<object-key>
Bridge upload route:  POST /api/uploads/images
```

The Bridge uploads through the S3-compatible API and serves `/media/...` by reading objects back from MinIO. The existing Nginx site can keep proxying all paths to the Bridge.

### One-command Setup

Run this on the production server:

```bash
BRIDGE_ENV_FILE=/opt/nebulaim-web/bridge.env \
MINIO_DATA_DIR=/opt/nebulaim-data/minio \
bash /opt/nebulaim-web/deploy/setup-minio-media.sh
```

GitHub Actions runs the same script automatically during production deployment.

### Environment Written By The Script

The script creates missing values in `/opt/nebulaim-web/bridge.env`:

```env
MEDIA_STORAGE_DRIVER=s3
MEDIA_PUBLIC_BASE_URL=/media
S3_ENDPOINT=http://127.0.0.1:19000
S3_REGION=us-east-1
S3_BUCKET=nebulaim-media
S3_ACCESS_KEY_ID=<server-local value>
S3_SECRET_ACCESS_KEY=<server-local generated secret>
S3_FORCE_PATH_STYLE=true
```

Do not commit the generated access key or secret key.

MinIO administrative credentials are generated separately in `/opt/nebulaim-data/minio.env` with mode `0600`. The Bridge user is attached to a bucket-scoped policy that permits listing, reading and writing only `nebulaim-media`; it is not a MinIO root user. Container images are pinned by digest.

### Backups

Back up both:

```text
/opt/nebulaim-data/minio
MySQL message tables
```

The database contains message metadata and the image URL. MinIO contains the image bytes.

### Optional Direct Nginx Proxy

The default deployment keeps `/media/...` behind the Bridge. A direct Nginx-to-MinIO proxy is possible later, but then the bucket policy or signed URL strategy must be designed explicitly. Do not expose the MinIO console to the public internet.

## 中文

NebulaIM Web 生产环境使用 MinIO 保存聊天图片文件。消息表只保存返回的 URL，图片二进制内容放在应用发布目录之外。

### 运行结构

```text
MinIO 容器：       nebulaim-minio
MinIO API：        http://127.0.0.1:19000
MinIO 控制台：     http://127.0.0.1:19001
数据目录：         /opt/nebulaim-data/minio
Bucket：           nebulaim-media
Bridge 媒体路由：  /media/<object-key>
Bridge 上传路由：  POST /api/uploads/images
```

Bridge 通过 S3 兼容 API 上传图片，并通过 `/media/...` 从 MinIO 读取对象返回给浏览器。现有 Nginx 站点继续把所有路径代理到 Bridge 即可。

### 一键配置

在生产服务器执行：

```bash
BRIDGE_ENV_FILE=/opt/nebulaim-web/bridge.env \
MINIO_DATA_DIR=/opt/nebulaim-data/minio \
bash /opt/nebulaim-web/deploy/setup-minio-media.sh
```

GitHub Actions 生产部署时也会自动执行同一个脚本。

### 脚本写入的环境变量

脚本会在 `/opt/nebulaim-web/bridge.env` 中补齐缺失项：

```env
MEDIA_STORAGE_DRIVER=s3
MEDIA_PUBLIC_BASE_URL=/media
S3_ENDPOINT=http://127.0.0.1:19000
S3_REGION=us-east-1
S3_BUCKET=nebulaim-media
S3_ACCESS_KEY_ID=<服务器本地值>
S3_SECRET_ACCESS_KEY=<服务器本地生成的密钥>
S3_FORCE_PATH_STYLE=true
```

不要把生成的 access key 或 secret key 提交到仓库。

MinIO 管理凭据单独生成在 `/opt/nebulaim-data/minio.env`，文件权限为 `0600`。Bridge 使用的用户只拥有 `nebulaim-media` Bucket 的列举、读取和写入权限，不是 MinIO root 用户。容器镜像通过摘要固定版本。

### 备份

需要同时备份：

```text
/opt/nebulaim-data/minio
MySQL 消息表
```

数据库保存消息元数据和图片 URL。MinIO 保存图片内容。

### 可选 Nginx 直连代理

默认部署让 `/media/...` 经过 Bridge。后续可以改成 Nginx 直接代理 MinIO，但必须同时设计 bucket 公开策略或签名 URL 策略。不要把 MinIO 控制台暴露到公网。
