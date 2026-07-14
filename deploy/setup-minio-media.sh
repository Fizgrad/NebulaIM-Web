#!/usr/bin/env bash
set -euo pipefail

BRIDGE_ENV_FILE="${BRIDGE_ENV_FILE:-${1:-/opt/nebulaim-web/bridge.env}}"
MINIO_DATA_DIR="${MINIO_DATA_DIR:-/opt/nebulaim-data/minio}"
MINIO_CONTAINER_NAME="${MINIO_CONTAINER_NAME:-nebulaim-minio}"
MINIO_IMAGE="${MINIO_IMAGE:-quay.io/minio/minio:latest}"
MINIO_MC_IMAGE="${MINIO_MC_IMAGE:-quay.io/minio/mc:latest}"
MINIO_API_PORT="${MINIO_API_PORT:-19000}"
MINIO_CONSOLE_PORT="${MINIO_CONSOLE_PORT:-19001}"

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

read_env_value() {
  local key="$1"
  if [ ! -f "${BRIDGE_ENV_FILE}" ]; then
    return 0
  fi
  ${SUDO} awk -F= -v key="${key}" '$1 == key { sub(/^[^=]*=/, ""); value=$0 } END { if (value != "") print value }' "${BRIDGE_ENV_FILE}"
}

set_env_value() {
  local key="$1"
  local value="$2"
  local escaped
  escaped="$(printf '%s' "${value}" | sed 's/[&|]/\\&/g')"

  ${SUDO} touch "${BRIDGE_ENV_FILE}"
  if ${SUDO} grep -q "^${key}=" "${BRIDGE_ENV_FILE}"; then
    ${SUDO} sed -i "s|^${key}=.*|${key}=${escaped}|" "${BRIDGE_ENV_FILE}"
  else
    printf '%s=%s\n' "${key}" "${value}" | ${SUDO} tee -a "${BRIDGE_ENV_FILE}" >/dev/null
  fi
}

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 36 | tr -dc 'A-Za-z0-9' | head -c 32
    return
  fi
  date +%s%N | sha256sum | awk '{ print substr($1, 1, 32) }'
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

run_mc_script() {
  ${SUDO} docker run \
    --rm \
    --network host \
    -e "S3_ENDPOINT=${S3_ENDPOINT}" \
    -e "S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}" \
    -e "S3_SECRET_ACCESS_KEY=${S3_SECRET_ACCESS_KEY}" \
    -e "S3_BUCKET=${S3_BUCKET}" \
    --entrypoint /bin/sh \
    "${MINIO_MC_IMAGE}" \
    -c "$1"
}

require_command docker

S3_ENDPOINT="${S3_ENDPOINT:-$(read_env_value S3_ENDPOINT)}"
S3_ENDPOINT="${S3_ENDPOINT:-http://127.0.0.1:${MINIO_API_PORT}}"
if [ "${S3_ENDPOINT}" = "http://127.0.0.1:9000" ] || [ "${S3_ENDPOINT}" = "http://localhost:9000" ]; then
  S3_ENDPOINT="http://127.0.0.1:${MINIO_API_PORT}"
fi
S3_REGION="${S3_REGION:-$(read_env_value S3_REGION)}"
S3_REGION="${S3_REGION:-us-east-1}"
S3_BUCKET="${S3_BUCKET:-$(read_env_value S3_BUCKET)}"
S3_BUCKET="${S3_BUCKET:-nebulaim-media}"
S3_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID:-$(read_env_value S3_ACCESS_KEY_ID)}"
S3_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID:-nebulaim}"
S3_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:-$(read_env_value S3_SECRET_ACCESS_KEY)}"
S3_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:-$(generate_secret)}"
MEDIA_PUBLIC_BASE_URL="${MEDIA_PUBLIC_BASE_URL:-$(read_env_value MEDIA_PUBLIC_BASE_URL)}"
MEDIA_PUBLIC_BASE_URL="${MEDIA_PUBLIC_BASE_URL:-/media}"

set_env_value MEDIA_STORAGE_DRIVER s3
set_env_value MEDIA_PUBLIC_BASE_URL "${MEDIA_PUBLIC_BASE_URL}"
set_env_value S3_ENDPOINT "${S3_ENDPOINT}"
set_env_value S3_REGION "${S3_REGION}"
set_env_value S3_BUCKET "${S3_BUCKET}"
set_env_value S3_ACCESS_KEY_ID "${S3_ACCESS_KEY_ID}"
set_env_value S3_SECRET_ACCESS_KEY "${S3_SECRET_ACCESS_KEY}"
set_env_value S3_FORCE_PATH_STYLE true

${SUDO} mkdir -p "${MINIO_DATA_DIR}"

if ${SUDO} docker inspect "${MINIO_CONTAINER_NAME}" >/dev/null 2>&1; then
  ${SUDO} docker start "${MINIO_CONTAINER_NAME}" >/dev/null
else
  ${SUDO} docker run \
    -d \
    --name "${MINIO_CONTAINER_NAME}" \
    --restart unless-stopped \
    -p "127.0.0.1:${MINIO_API_PORT}:9000" \
    -p "127.0.0.1:${MINIO_CONSOLE_PORT}:9001" \
    -v "${MINIO_DATA_DIR}:/data" \
    -e "MINIO_ROOT_USER=${S3_ACCESS_KEY_ID}" \
    -e "MINIO_ROOT_PASSWORD=${S3_SECRET_ACCESS_KEY}" \
    "${MINIO_IMAGE}" \
    server /data --console-address ":9001" >/dev/null
fi

ready=0
for _ in $(seq 1 60); do
  if run_mc_script 'mc alias set local "$S3_ENDPOINT" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY"' >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done

if [ "${ready}" != "1" ]; then
  echo "MinIO did not become ready at ${S3_ENDPOINT}." >&2
  exit 1
fi

run_mc_script 'mc alias set local "$S3_ENDPOINT" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" >/dev/null && mc mb --ignore-existing "local/$S3_BUCKET"' >/dev/null

echo "MinIO media storage is ready."
echo "  container: ${MINIO_CONTAINER_NAME}"
echo "  data:      ${MINIO_DATA_DIR}"
echo "  bucket:    ${S3_BUCKET}"
echo "  endpoint:  ${S3_ENDPOINT}"
