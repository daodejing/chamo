#!/bin/bash
# Manage OurChat local development and test environments

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
DOCKER_COMPOSE="docker-compose -f $PROJECT_ROOT/docker-compose.yml"

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
    echo "  frontend  Next.js dev server (Docker)"
    echo "  backend   Backend services (postgres, mailhog, api)"
    echo "  postgres  PostgreSQL database"
    echo "  mailhog   MailHog email server"
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
        all|frontend|backend|postgres|mailhog|api)
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
    DOCKER_PROFILE="--profile test"
    FRONTEND_SERVICE="frontend-test"
    BACKEND_SERVICE="backend-test"
else
    FRONTEND_PORT=3002
    BACKEND_PORT=4000
    DOCKER_PROFILE=""
    FRONTEND_SERVICE="frontend"
    BACKEND_SERVICE="backend"
fi

start_frontend() {
    echo "[$ENV] Starting frontend dev server on port $FRONTEND_PORT..."
    if [[ "$ENV" == "test" ]]; then
        $DOCKER_COMPOSE $DOCKER_PROFILE up -d frontend-test
    else
        $DOCKER_COMPOSE up -d frontend
    fi
    echo "[$ENV] Frontend started: http://localhost:$FRONTEND_PORT"
    echo "[$ENV] Logs: docker-compose logs -f $FRONTEND_SERVICE"
}

stop_frontend() {
    echo "[$ENV] Stopping frontend..."
    if [[ "$ENV" == "test" ]]; then
        $DOCKER_COMPOSE $DOCKER_PROFILE stop frontend-test
    else
        $DOCKER_COMPOSE stop frontend
    fi
    echo "[$ENV] Frontend stopped"
}

start_backend() {
    echo "[$ENV] Starting backend docker services..."
    if [[ "$ENV" == "test" ]]; then
        $DOCKER_COMPOSE $DOCKER_PROFILE up -d postgres-test mailhog backend-test
    else
        $DOCKER_COMPOSE up -d postgres mailhog backend
    fi
    echo "[$ENV] Backend services started"
}

stop_backend() {
    echo "[$ENV] Stopping backend docker services..."
    if [[ "$ENV" == "test" ]]; then
        $DOCKER_COMPOSE $DOCKER_PROFILE stop postgres-test mailhog backend-test
    else
        $DOCKER_COMPOSE stop postgres mailhog backend
    fi
    echo "[$ENV] Backend services stopped"
}

start_all() {
    echo "[$ENV] Starting all services..."
    if [[ "$ENV" == "test" ]]; then
        $DOCKER_COMPOSE $DOCKER_PROFILE up -d
    else
        $DOCKER_COMPOSE up -d postgres mailhog backend frontend
    fi
    echo "[$ENV] All services started"
}

stop_all() {
    echo "[$ENV] Stopping all services..."
    if [[ "$ENV" == "test" ]]; then
        $DOCKER_COMPOSE $DOCKER_PROFILE stop
    else
        $DOCKER_COMPOSE stop
    fi
    echo "[$ENV] All services stopped"
}

restart_service() {
    local service=$1
    echo "[$ENV] Restarting $service..."
    $DOCKER_COMPOSE $DOCKER_PROFILE restart "$service" 2>&1
    sleep 2
    echo "[$ENV] $service restarted"
}

status() {
    echo "=== [$ENV] Services ==="
    if [[ "$ENV" == "test" ]]; then
        $DOCKER_COMPOSE $DOCKER_PROFILE ps 2>/dev/null || echo "Services not running"
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
        echo "MailHog UI:   http://localhost:8025"
    fi
}

case "$ACTION" in
    start)
        case "$COMPONENT" in
            all)
                start_all
                ;;
            frontend)
                start_frontend
                ;;
            backend)
                start_backend
                ;;
            postgres|mailhog)
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
                stop_all
                ;;
            frontend)
                stop_frontend
                ;;
            backend)
                stop_backend
                ;;
            postgres|mailhog)
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
                stop_all
                start_all
                ;;
            frontend)
                $DOCKER_COMPOSE $DOCKER_PROFILE restart $FRONTEND_SERVICE
                ;;
            backend)
                $DOCKER_COMPOSE $DOCKER_PROFILE restart $BACKEND_SERVICE
                ;;
            postgres|mailhog)
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
