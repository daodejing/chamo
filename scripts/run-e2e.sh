#!/bin/bash
# Run E2E tests with automatic test environment management
# Starts the test environment, runs tests, and shuts down on exit

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Use docker compose v2 if available, otherwise fall back to docker-compose v1
if docker compose version &>/dev/null; then
    DC="docker compose"
else
    DC="docker-compose"
fi

# Cleanup function to stop test environment
cleanup() {
    echo ""
    echo "Stopping test environment..."
    $DC --profile test stop postgres-test backend-test frontend-test 2>/dev/null || true
    echo "Test environment stopped"
}

# Register cleanup on script exit (success or failure)
trap cleanup EXIT

echo "Starting test environment..."
$DC --profile test up -d postgres-test mailhog backend-test frontend-test

echo "Waiting for services to be ready..."

# Wait for backend-test to be healthy (max 2 minutes)
echo -n "  Backend (port 4001): "
for i in {1..120}; do
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:4001/health | grep -q "200"; then
        echo "ready"
        break
    fi
    if [ $i -eq 120 ]; then
        echo "timeout"
        echo "Error: Backend failed to start"
        $DC --profile test logs --tail=50 backend-test
        exit 1
    fi
    sleep 1
done

# Wait for frontend-test to be ready (max 2 minutes)
echo -n "  Frontend (port 3003): "
for i in {1..120}; do
    if curl -s -o /dev/null http://localhost:3003 2>/dev/null; then
        echo "ready"
        break
    fi
    if [ $i -eq 120 ]; then
        echo "timeout"
        echo "Error: Frontend failed to start"
        $DC --profile test logs --tail=50 frontend-test
        exit 1
    fi
    sleep 1
done

echo ""
echo "Running E2E tests..."
echo ""

# Run Playwright tests, passing through all arguments
pnpm exec playwright test "$@"
