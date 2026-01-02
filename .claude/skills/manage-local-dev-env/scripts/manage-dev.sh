#!/bin/bash
# Manage OurChat local development and test environments

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
DEV_LOG_FILE="/tmp/ourchat-frontend.log"
TEST_LOG_FILE="/tmp/ourchat-frontend-test.log"
DOCKER_COMPOSE="docker-compose -f $PROJECT_ROOT/apps/backend/docker-compose.yml"

# Default values
ENV="dev"
ACTION=""
COMPONENT="all"

usage() {
    echo "Usage: $0 <action> [component] [--env dev|test]"
    echo ""
    echo "Actions:"
    echo "  start    Start component(s)"
    echo "  stop     Stop component(s)"
    echo "  restart  Restart component(s)"
    echo "  status   Show status of all components"
    echo ""
    echo "Components:"
    echo "  all       All services (default)"
    echo "  frontend  Next.js dev server"
    echo "  backend   All backend docker services"
    echo "  mysql     MySQL database"
    echo "  postgres  PostgreSQL database"
    echo "  minio     MinIO object storage"
    echo "  api       Backend GraphQL API"
    echo ""
    echo "Options:"
    echo "  --env dev   Use development environment (default)"
    echo "              Frontend: 3002, Backend: 4000, Database: 5432"
    echo "  --env test  Use test environment (for E2E/Playwright testing)"
    echo "              Frontend: 3003, Backend: 4001, Database: 5433, MailHog: 8025"
    echo ""
    echo "Examples:"
    echo "  $0 start                    # Start dev environment"
    echo "  $0 start --env test         # Start test environment"
    echo "  $0 restart frontend         # Restart dev frontend"
    echo "  $0 restart backend --env test  # Restart test backend"
    echo "  $0 status --env test        # Show test environment status"
    exit 1
}

# Parse all arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --env)
            ENV="$2"
            shift 2
            ;;
        start|stop|restart|status)
            ACTION="$1"
            shift
            ;;
        all|frontend|backend|mysql|postgres|minio|api|seo-api)
            COMPONENT="$1"
            shift
            ;;
        --help|-h)
            usage
            ;;
        *)
            echo "Unknown argument: $1"
            usage
            ;;
    esac
done

# Require an action
if [[ -z "$ACTION" ]]; then
    echo "Error: No action specified"
    usage
fi

# Set environment-specific variables
if [[ "$ENV" == "test" ]]; then
    FRONTEND_PORT=3003
    BACKEND_PORT=4001
    LOG_FILE="$TEST_LOG_FILE"
    DOCKER_PROFILE="--profile test"
    GRAPHQL_HTTP_URL="http://localhost:4001/graphql"
    GRAPHQL_WS_URL="ws://localhost:4001/graphql"
    BACKEND_SERVICE="backend-test"
else
    FRONTEND_PORT=3002
    BACKEND_PORT=4000
    LOG_FILE="$DEV_LOG_FILE"
    DOCKER_PROFILE=""
    GRAPHQL_HTTP_URL=""
    GRAPHQL_WS_URL=""
    BACKEND_SERVICE="backend"
fi

start_frontend() {
    if lsof -i :$FRONTEND_PORT -t >/dev/null 2>&1; then
        echo "[$ENV] Frontend already running on port $FRONTEND_PORT"
    else
        echo "[$ENV] Starting frontend dev server on port $FRONTEND_PORT..."
        cd "$PROJECT_ROOT"
        if [[ "$ENV" == "test" ]]; then
            E2E_TEST=true \
            NEXT_PUBLIC_GRAPHQL_HTTP_URL="$GRAPHQL_HTTP_URL" \
            NEXT_PUBLIC_GRAPHQL_WS_URL="$GRAPHQL_WS_URL" \
            pnpm next dev --port $FRONTEND_PORT > "$LOG_FILE" 2>&1 &
        else
            pnpm dev > "$LOG_FILE" 2>&1 &
        fi
        sleep 3
        if lsof -i :$FRONTEND_PORT -t >/dev/null 2>&1; then
            echo "[$ENV] Frontend started: http://localhost:$FRONTEND_PORT"
            echo "[$ENV] Logs: $LOG_FILE"
        else
            echo "[$ENV] Warning: Frontend may still be starting. Check $LOG_FILE"
        fi
    fi
}

stop_frontend() {
    if lsof -i :$FRONTEND_PORT -t >/dev/null 2>&1; then
        echo "[$ENV] Stopping frontend on port $FRONTEND_PORT..."
        # Kill process on specific port
        lsof -i :$FRONTEND_PORT -t | xargs kill -9 2>/dev/null || true
        sleep 1
        echo "[$ENV] Frontend stopped"
    else
        echo "[$ENV] Frontend not running on port $FRONTEND_PORT"
    fi
}

start_backend() {
    echo "[$ENV] Starting backend docker services..."
    if [[ "$ENV" == "test" ]]; then
        $DOCKER_COMPOSE $DOCKER_PROFILE up -d postgres-test mailhog backend-test
    else
        $DOCKER_COMPOSE up -d
    fi
    echo "[$ENV] Backend services started"
}

stop_backend() {
    echo "[$ENV] Stopping backend docker services..."
    if [[ "$ENV" == "test" ]]; then
        $DOCKER_COMPOSE $DOCKER_PROFILE stop postgres-test mailhog backend-test
    else
        $DOCKER_COMPOSE stop
    fi
    echo "[$ENV] Backend services stopped"
}

restart_service() {
    local service=$1
    echo "[$ENV] Restarting $service..."
    $DOCKER_COMPOSE $DOCKER_PROFILE restart "$service" 2>&1
    sleep 2
    echo "[$ENV] $service restarted"
}

status() {
    echo "=== [$ENV] Frontend ==="
    if lsof -i :$FRONTEND_PORT -t >/dev/null 2>&1; then
        echo "Running: http://localhost:$FRONTEND_PORT"
    else
        echo "Not running"
    fi
    echo ""
    echo "=== [$ENV] Backend Services ==="
    if [[ "$ENV" == "test" ]]; then
        $DOCKER_COMPOSE $DOCKER_PROFILE ps postgres-test mailhog backend-test 2>/dev/null || echo "Test services not running"
        echo ""
        echo "=== Test Environment URLs ==="
        echo "Frontend:     http://localhost:3003"
        echo "GraphQL API:  http://localhost:4001/graphql"
        echo "MailHog UI:   http://localhost:8025"
    else
        $DOCKER_COMPOSE ps
        echo ""
        echo "=== Dev Environment URLs ==="
        echo "Frontend:     http://localhost:3002"
        echo "GraphQL API:  http://localhost:4000/graphql"
    fi
}

case "$ACTION" in
    start)
        case "$COMPONENT" in
            all)
                start_backend
                start_frontend
                ;;
            frontend)
                start_frontend
                ;;
            backend)
                start_backend
                ;;
            mysql|postgres|minio|seo-api)
                $DOCKER_COMPOSE $DOCKER_PROFILE up -d "$COMPONENT"
                ;;
            api)
                $DOCKER_COMPOSE $DOCKER_PROFILE up -d $BACKEND_SERVICE
                ;;
            *)
                echo "Unknown component: $COMPONENT"
                usage
                ;;
        esac
        echo ""
        status
        ;;
    stop)
        case "$COMPONENT" in
            all)
                stop_frontend
                stop_backend
                ;;
            frontend)
                stop_frontend
                ;;
            backend)
                stop_backend
                ;;
            mysql|postgres|minio|seo-api)
                $DOCKER_COMPOSE $DOCKER_PROFILE stop "$COMPONENT"
                ;;
            api)
                $DOCKER_COMPOSE $DOCKER_PROFILE stop $BACKEND_SERVICE
                ;;
            *)
                echo "Unknown component: $COMPONENT"
                usage
                ;;
        esac
        ;;
    restart)
        case "$COMPONENT" in
            all)
                stop_frontend
                if [[ "$ENV" == "test" ]]; then
                    $DOCKER_COMPOSE $DOCKER_PROFILE restart postgres-test mailhog backend-test 2>&1
                else
                    $DOCKER_COMPOSE restart 2>&1
                fi
                sleep 2
                start_frontend
                ;;
            frontend)
                stop_frontend
                start_frontend
                ;;
            backend)
                if [[ "$ENV" == "test" ]]; then
                    $DOCKER_COMPOSE $DOCKER_PROFILE restart postgres-test mailhog backend-test 2>&1
                else
                    $DOCKER_COMPOSE restart 2>&1
                fi
                sleep 2
                ;;
            mysql|postgres|minio|seo-api)
                restart_service "$COMPONENT"
                ;;
            api)
                restart_service $BACKEND_SERVICE
                ;;
            *)
                echo "Unknown component: $COMPONENT"
                usage
                ;;
        esac
        echo ""
        status
        ;;
    status)
        status
        ;;
    *)
        echo "Unknown action: $ACTION"
        usage
        ;;
esac
