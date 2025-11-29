#!/bin/bash
# Manage OurChat local development environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
LOG_FILE="/tmp/ourchat-frontend.log"
DOCKER_COMPOSE="docker-compose -f $PROJECT_ROOT/apps/backend/docker-compose.yml"

usage() {
    echo "Usage: $0 <action> [component]"
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
    echo "Examples:"
    echo "  $0 start              # Start all services"
    echo "  $0 restart frontend   # Restart only frontend"
    echo "  $0 restart backend    # Restart all backend services"
    echo "  $0 restart api        # Restart only the backend API"
    echo "  $0 status             # Show status"
    exit 1
}

start_frontend() {
    if lsof -i :3002 -t >/dev/null 2>&1; then
        echo "Frontend already running on port 3002"
    else
        echo "Starting frontend dev server..."
        cd "$PROJECT_ROOT"
        pnpm dev > "$LOG_FILE" 2>&1 &
        sleep 3
        if lsof -i :3002 -t >/dev/null 2>&1; then
            echo "Frontend started: http://localhost:3002"
            echo "Logs: $LOG_FILE"
        else
            echo "Warning: Frontend may still be starting. Check $LOG_FILE"
        fi
    fi
}

stop_frontend() {
    if lsof -i :3002 -t >/dev/null 2>&1; then
        echo "Stopping frontend..."
        pkill -f "next dev" || true
        sleep 1
        echo "Frontend stopped"
    else
        echo "Frontend not running"
    fi
}

start_backend() {
    echo "Starting backend docker services..."
    $DOCKER_COMPOSE up -d
    echo "Backend services started"
}

stop_backend() {
    echo "Stopping backend docker services..."
    $DOCKER_COMPOSE stop
    echo "Backend services stopped"
}

restart_service() {
    local service=$1
    echo "Restarting $service..."
    $DOCKER_COMPOSE restart "$service" 2>&1
    sleep 2
    echo "$service restarted"
}

status() {
    echo "=== Frontend ==="
    if lsof -i :3002 -t >/dev/null 2>&1; then
        echo "Running: http://localhost:3002"
    else
        echo "Not running"
    fi
    echo ""
    echo "=== Backend Services ==="
    $DOCKER_COMPOSE ps
}

ACTION=${1:-start}
COMPONENT=${2:-all}

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
                $DOCKER_COMPOSE up -d "$COMPONENT"
                ;;
            api)
                $DOCKER_COMPOSE up -d backend
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
                $DOCKER_COMPOSE stop "$COMPONENT"
                ;;
            api)
                $DOCKER_COMPOSE stop backend
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
                $DOCKER_COMPOSE restart 2>&1
                sleep 2
                start_frontend
                ;;
            frontend)
                stop_frontend
                start_frontend
                ;;
            backend)
                $DOCKER_COMPOSE restart 2>&1
                sleep 2
                ;;
            mysql|postgres|minio|seo-api)
                restart_service "$COMPONENT"
                ;;
            api)
                restart_service backend
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
