#!/usr/bin/env bash
set -euo pipefail

BRIDGE_ENV_FILE="${BRIDGE_ENV_FILE:-${1:-/opt/nebulaim-web/bridge.env}}"
MINIO_DATA_DIR="${MINIO_DATA_DIR:-/opt/nebulaim-data/minio}"
MINIO_ENV_FILE="${MINIO_ENV_FILE:-/opt/nebulaim-data/minio.env}"
MINIO_CONTAINER_NAME="${MINIO_CONTAINER_NAME:-nebulaim-minio}"
MINIO_IMAGE="${MINIO_IMAGE:-quay.io/minio/minio@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e}"
MINIO_MC_IMAGE="${MINIO_MC_IMAGE:-quay.io/minio/mc@sha256:a7fe349ef4bd8521fb8497f55c6042871b2ae640607cf99d9bede5e9bdf11727}"
MINIO_API_PORT="${MINIO_API_PORT:-19000}"
MINIO_CONSOLE_PORT="${MINIO_CONSOLE_PORT:-19001}"

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

read_env_value_from() {
  local file="$1"
  local key="$2"
  if [ ! -f "${file}" ]; then
    return 0
  fi
  ${SUDO} awk -F= -v key="${key}" '$1 == key { sub(/^[^=]*=/, ""); value=$0 } END { if (value != "") print value }' "${file}"
}

read_env_value() {
  read_env_value_from "${BRIDGE_ENV_FILE}" "$1"
}

set_env_value_in() {
  local file="$1"
  local key="$2"
  local value="$3"
  local escaped
  escaped="$(printf '%s' "${value}" | sed 's/[&|]/\\&/g')"

  ${SUDO} touch "${file}"
  if ${SUDO} grep -q "^${key}=" "${file}"; then
    ${SUDO} sed -i "s|^${key}=.*|${key}=${escaped}|" "${file}"
  else
    printf '%s=%s\n' "${key}" "${value}" | ${SUDO} tee -a "${file}" >/dev/null
  fi
}

set_env_value() {
  set_env_value_in "${BRIDGE_ENV_FILE}" "$1" "$2"
}

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
    return
  fi
  date +%s%N | sha256sum | awk '{ print $1 }'
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
    -e "MINIO_ROOT_USER=${MINIO_ROOT_USER}" \
    -e "MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}" \
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
S3_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID:-nebulaim-media-app}"
S3_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:-$(read_env_value S3_SECRET_ACCESS_KEY)}"
S3_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:-$(generate_secret)}"
MEDIA_PUBLIC_BASE_URL="${MEDIA_PUBLIC_BASE_URL:-$(read_env_value MEDIA_PUBLIC_BASE_URL)}"
MEDIA_PUBLIC_BASE_URL="${MEDIA_PUBLIC_BASE_URL:-/media}"

${SUDO} mkdir -p "${MINIO_DATA_DIR}" "$(dirname "${MINIO_ENV_FILE}")"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-$(read_env_value_from "${MINIO_ENV_FILE}" MINIO_ROOT_USER)}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-$(read_env_value_from "${MINIO_ENV_FILE}" MINIO_ROOT_PASSWORD)}"

if ${SUDO} docker inspect "${MINIO_CONTAINER_NAME}" >/dev/null 2>&1; then
  MINIO_ROOT_USER="${MINIO_ROOT_USER:-$(${SUDO} docker inspect "${MINIO_CONTAINER_NAME}" --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1 == "MINIO_ROOT_USER" {print substr($0, index($0, "=") + 1)}' | tail -n 1)}"
  MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-$(${SUDO} docker inspect "${MINIO_CONTAINER_NAME}" --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1 == "MINIO_ROOT_PASSWORD" {print substr($0, index($0, "=") + 1)}' | tail -n 1)}"
fi

MINIO_ROOT_USER="${MINIO_ROOT_USER:-nebulaim-root}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-$(generate_secret)}"
if [ "${S3_ACCESS_KEY_ID}" = "${MINIO_ROOT_USER}" ]; then
  S3_ACCESS_KEY_ID="nebulaim-media-app"
  S3_SECRET_ACCESS_KEY="$(generate_secret)"
fi

set_env_value_in "${MINIO_ENV_FILE}" MINIO_ROOT_USER "${MINIO_ROOT_USER}"
set_env_value_in "${MINIO_ENV_FILE}" MINIO_ROOT_PASSWORD "${MINIO_ROOT_PASSWORD}"
${SUDO} chmod 600 "${MINIO_ENV_FILE}"

set_env_value MEDIA_STORAGE_DRIVER s3
set_env_value MEDIA_PUBLIC_BASE_URL "${MEDIA_PUBLIC_BASE_URL}"
set_env_value S3_ENDPOINT "${S3_ENDPOINT}"
set_env_value S3_REGION "${S3_REGION}"
set_env_value S3_BUCKET "${S3_BUCKET}"
set_env_value S3_ACCESS_KEY_ID "${S3_ACCESS_KEY_ID}"
set_env_value S3_SECRET_ACCESS_KEY "${S3_SECRET_ACCESS_KEY}"
set_env_value S3_FORCE_PATH_STYLE true
${SUDO} chmod 640 "${BRIDGE_ENV_FILE}"

if ${SUDO} docker inspect "${MINIO_CONTAINER_NAME}" >/dev/null 2>&1; then
  current_image="$(${SUDO} docker inspect "${MINIO_CONTAINER_NAME}" --format '{{.Config.Image}}')"
  if [ "${current_image}" != "${MINIO_IMAGE}" ]; then
    ${SUDO} docker rm -f "${MINIO_CONTAINER_NAME}" >/dev/null
  else
    ${SUDO} docker start "${MINIO_CONTAINER_NAME}" >/dev/null
  fi
fi

if ! ${SUDO} docker inspect "${MINIO_CONTAINER_NAME}" >/dev/null 2>&1; then
  ${SUDO} docker run \
    -d \
    --name "${MINIO_CONTAINER_NAME}" \
    --restart unless-stopped \
    -p "127.0.0.1:${MINIO_API_PORT}:9000" \
    -p "127.0.0.1:${MINIO_CONSOLE_PORT}:9001" \
    -v "${MINIO_DATA_DIR}:/data" \
    -e "MINIO_ROOT_USER=${MINIO_ROOT_USER}" \
    -e "MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}" \
    "${MINIO_IMAGE}" \
    server /data --console-address ":9001" >/dev/null
fi

ready=0
for _ in $(seq 1 60); do
  if run_mc_script 'mc alias set local "$S3_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"' >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done

if [ "${ready}" != "1" ]; then
  echo "MinIO did not become ready at ${S3_ENDPOINT}." >&2
  exit 1
fi

run_mc_script '
  set -eu
  mc alias set local "$S3_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
  mc mb --ignore-existing "local/$S3_BUCKET" >/dev/null
  printf "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"s3:GetBucketLocation\",\"s3:ListBucket\"],\"Resource\":[\"arn:aws:s3:::%s\"]},{\"Effect\":\"Allow\",\"Action\":[\"s3:GetObject\",\"s3:PutObject\"],\"Resource\":[\"arn:aws:s3:::%s/*\"]}]}" "$S3_BUCKET" "$S3_BUCKET" > /tmp/nebulaim-media-policy.json
  if ! mc admin policy info local nebulaim-media-rw >/dev/null 2>&1; then
    mc admin policy create local nebulaim-media-rw /tmp/nebulaim-media-policy.json >/dev/null
  fi
  if ! mc admin user info local "$S3_ACCESS_KEY_ID" >/dev/null 2>&1; then
    mc admin user add local "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" >/dev/null
  fi
  mc admin policy attach local nebulaim-media-rw --user "$S3_ACCESS_KEY_ID" >/dev/null
  mc anonymous set none "local/$S3_BUCKET" >/dev/null
' >/dev/null

echo "MinIO media storage is ready."
echo "  container: ${MINIO_CONTAINER_NAME}"
echo "  data:      ${MINIO_DATA_DIR}"
echo "  bucket:    ${S3_BUCKET}"
echo "  endpoint:  ${S3_ENDPOINT}"
