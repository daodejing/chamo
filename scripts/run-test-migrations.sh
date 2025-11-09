#!/usr/bin/env zsh

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
ENV_FILE="${ROOT_DIR}/.env.test"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing .env.test file at ${ENV_FILE}" >&2
  exit 1
fi

echo "Loading test environment variables from ${ENV_FILE}" >&2
set -a
source "${ENV_FILE}"
set +a

cd "${ROOT_DIR}/apps/backend"

echo "Running Prisma migrations against test database..." >&2
pnpm prisma migrate deploy

echo "Current migration status:" >&2
pnpm prisma migrate status
