#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# OurChat Local Lab - k3d GitOps Environment
# =============================================================================
# Usage: ./scripts/local-lab.sh <command>
#
# Commands:
#   start         - Full stack: colima + cluster + flux + secrets
#   stop          - Stop colima (preserves data)
#   restart       - Restart cluster
#   status        - Check all components
#   build         - Build & push images to local registry
#   reconcile     - Force Flux reconciliation
#   secrets       - Create/update secrets
#   sync-branch   - Switch Flux to current git branch
#   logs <svc>    - Tail service logs
#   cluster-create - Create k3d cluster only
#   cluster-delete - Delete k3d cluster
#   colima-start  - Start colima only
#   colima-stop   - Stop colima only
#   flux          - Install and bootstrap Flux
#   charts        - Package and push Helm charts
# =============================================================================

# Configuration
CLUSTER_NAME="ourchat-local"
COLIMA_CPU=4
COLIMA_MEMORY=12
COLIMA_DISK=100
REGISTRY_NAME="k3d-registry.localhost"
REGISTRY_HOST_PORT=5001
REGISTRY_CLUSTER_PORT=5000
GITHUB_REPO="daodejing/chamo"
APP_NAMESPACE="ourchat"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    local deps=("colima" "k3d" "kubectl" "flux" "helm" "docker")
    local missing=()

    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing+=("$dep")
        fi
    done

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing dependencies: ${missing[*]}"
        exit 1
    fi
}

wait_for_pods() {
    local namespace=$1
    local timeout=${2:-300}
    log_info "Waiting for pods in namespace '$namespace' to be ready..."
    kubectl wait --for=condition=Ready pods --all -n "$namespace" --timeout="${timeout}s" 2>/dev/null || true
}

# =============================================================================
# Colima Management
# =============================================================================

colima_start() {
    log_info "Starting Colima with $COLIMA_CPU CPUs, ${COLIMA_MEMORY}GB RAM, ${COLIMA_DISK}GB disk..."

    if colima status 2>/dev/null | grep -q "Running"; then
        log_info "Colima is already running"
        return 0
    fi

    colima start \
        --cpu "$COLIMA_CPU" \
        --memory "$COLIMA_MEMORY" \
        --disk "$COLIMA_DISK" \
        --runtime docker \
        --network-address

    log_success "Colima started"
}

colima_stop() {
    log_info "Stopping Colima..."
    colima stop || true
    log_success "Colima stopped"
}

# =============================================================================
# Registry Management
# =============================================================================

registry_create() {
    log_info "Creating local registry..."

    if k3d registry list 2>/dev/null | grep -q "$REGISTRY_NAME"; then
        log_info "Registry '$REGISTRY_NAME' already exists"
        return 0
    fi

    k3d registry create "$REGISTRY_NAME" --port "$REGISTRY_HOST_PORT"
    log_success "Registry created at $REGISTRY_NAME:$REGISTRY_HOST_PORT"
}

registry_delete() {
    log_info "Deleting local registry..."
    k3d registry delete "$REGISTRY_NAME" 2>/dev/null || true
}

# =============================================================================
# Cluster Management
# =============================================================================

cluster_create() {
    log_info "Creating k3d cluster '$CLUSTER_NAME'..."

    if k3d cluster list 2>/dev/null | grep -q "$CLUSTER_NAME"; then
        log_info "Cluster '$CLUSTER_NAME' already exists"
        return 0
    fi

    # Ensure registry exists
    registry_create

    k3d cluster create "$CLUSTER_NAME" \
        --registry-use "$REGISTRY_NAME:$REGISTRY_HOST_PORT" \
        --port "80:80@loadbalancer" \
        --port "443:443@loadbalancer" \
        --k3s-arg "--disable=traefik@server:0" \
        --wait

    # Wait for cluster to be ready
    kubectl wait --for=condition=Ready nodes --all --timeout=120s

    log_success "Cluster '$CLUSTER_NAME' created"
}

cluster_delete() {
    log_info "Deleting k3d cluster '$CLUSTER_NAME'..."
    k3d cluster delete "$CLUSTER_NAME" 2>/dev/null || true
    log_success "Cluster deleted"
}

# =============================================================================
# Flux Management
# =============================================================================

flux_install() {
    log_info "Installing Flux..."

    if kubectl get namespace flux-system &>/dev/null; then
        log_info "Flux namespace already exists"
    else
        flux install \
            --components-extra=image-reflector-controller,image-automation-controller
    fi

    # Wait for Flux to be ready
    kubectl wait --for=condition=Ready pods --all -n flux-system --timeout=120s

    log_success "Flux installed"
}

flux_bootstrap() {
    log_info "Bootstrapping Flux with GitOps configuration..."

    if [[ -z "${GH_TOKEN:-}" ]]; then
        log_error "GH_TOKEN environment variable is required for Flux bootstrap"
        log_info "Run 'gh auth login' or set GH_TOKEN manually"
        exit 1
    fi

    local current_branch
    current_branch=$(git rev-parse --abbrev-ref HEAD)
    log_info "Using branch: $current_branch"

    # Create GitHub secret for Flux
    kubectl create secret generic flux-system \
        --namespace flux-system \
        --from-literal=username=git \
        --from-literal=password="$GH_TOKEN" \
        --dry-run=client -o yaml | kubectl apply -f -

    # Generate GitRepository and Kustomization dynamically
    cat <<EOF | kubectl apply -f -
---
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: flux-system
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/${GITHUB_REPO}.git
  ref:
    branch: ${current_branch}
  secretRef:
    name: flux-system
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: flux-system
  namespace: flux-system
spec:
  interval: 10m
  path: ./clusters/local
  prune: true
  sourceRef:
    kind: GitRepository
    name: flux-system
EOF

    log_success "Flux bootstrapped for branch: $current_branch"
}

flux_sync_branch() {
    local current_branch
    current_branch=$(git rev-parse --abbrev-ref HEAD)
    log_info "Syncing Flux to branch: $current_branch"

    kubectl patch gitrepository flux-system -n flux-system \
        --type=merge \
        -p "{\"spec\":{\"ref\":{\"branch\":\"$current_branch\"}}}"

    flux reconcile source git flux-system
    flux reconcile kustomization flux-system

    log_success "Flux synced to branch: $current_branch"
}

# =============================================================================
# Image Automation
# =============================================================================

setup_image_automation() {
    log_info "Setting up image automation..."

    local current_branch
    current_branch=$(git rev-parse --abbrev-ref HEAD)

    cat <<EOF | kubectl apply -f -
---
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageUpdateAutomation
metadata:
  name: flux-system
  namespace: flux-system
spec:
  interval: 1m
  sourceRef:
    kind: GitRepository
    name: flux-system
  git:
    checkout:
      ref:
        branch: ${current_branch}
    commit:
      author:
        name: fluxcdbot
        email: fluxcdbot@users.noreply.github.com
      messageTemplate: |
        Auto-update images

        {{range .Changed.Changes}}
        - {{.OldValue}} -> {{.NewValue}}
        {{end}}
    push:
      branch: ${current_branch}
  update:
    path: ./apps/base
    strategy: Setters
EOF

    log_success "Image automation configured"
}

# =============================================================================
# Secrets Management
# =============================================================================

create_secrets() {
    log_info "Creating secrets..."

    # Ensure namespace exists
    kubectl create namespace "$APP_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

    # Generate secrets if not provided
    local jwt_secret="${JWT_SECRET:-$(openssl rand -base64 32)}"
    local refresh_token_secret="${REFRESH_TOKEN_SECRET:-$(openssl rand -base64 32)}"
    local invite_secret="${INVITE_SECRET:-$(openssl rand -hex 32)}"
    local database_url="postgresql://postgres:dev@postgres.${APP_NAMESPACE}.svc.cluster.local:5432/ourchat"

    kubectl create secret generic ourchat-secrets \
        --namespace "$APP_NAMESPACE" \
        --from-literal=DATABASE_URL="$database_url" \
        --from-literal=JWT_SECRET="$jwt_secret" \
        --from-literal=REFRESH_TOKEN_SECRET="$refresh_token_secret" \
        --from-literal=INVITE_SECRET="$invite_secret" \
        --dry-run=client -o yaml | kubectl apply -f -

    log_success "Secrets created in namespace '$APP_NAMESPACE'"
}

# =============================================================================
# Helm Charts
# =============================================================================

charts_package_push() {
    log_info "Packaging and pushing Helm charts..."

    local chart_dir="$PROJECT_ROOT/charts/generic-service"

    if [[ ! -d "$chart_dir" ]]; then
        log_error "Chart directory not found: $chart_dir"
        exit 1
    fi

    # Package chart
    helm package "$chart_dir" -d /tmp

    # Push to local registry
    local chart_version
    chart_version=$(helm show chart "$chart_dir" | grep "^version:" | awk '{print $2}')

    helm push "/tmp/generic-service-${chart_version}.tgz" \
        "oci://${REGISTRY_NAME}:${REGISTRY_HOST_PORT}/charts" \
        --plain-http

    log_success "Chart pushed to registry"
}

# =============================================================================
# Image Building
# =============================================================================

build_images() {
    log_info "Building and pushing images..."

    local git_sha
    local timestamp
    local image_tag

    git_sha=$(git rev-parse --short HEAD)
    timestamp=$(date +%s)
    image_tag="${git_sha}-${timestamp}"

    log_info "Using image tag: $image_tag"

    # Build frontend
    log_info "Building frontend..."
    docker build \
        -f "$PROJECT_ROOT/docker/frontend/Dockerfile" \
        -t "${REGISTRY_NAME}:${REGISTRY_HOST_PORT}/ourchat/frontend:${image_tag}" \
        "$PROJECT_ROOT"
    docker push "${REGISTRY_NAME}:${REGISTRY_HOST_PORT}/ourchat/frontend:${image_tag}"

    # Build backend
    log_info "Building backend..."
    docker build \
        -f "$PROJECT_ROOT/docker/backend/Dockerfile" \
        -t "${REGISTRY_NAME}:${REGISTRY_HOST_PORT}/ourchat/backend:${image_tag}" \
        "$PROJECT_ROOT"
    docker push "${REGISTRY_NAME}:${REGISTRY_HOST_PORT}/ourchat/backend:${image_tag}"

    log_success "Images built and pushed with tag: $image_tag"
    log_info "Flux will automatically detect and deploy the new images"
}

# =============================================================================
# Status & Logs
# =============================================================================

show_status() {
    echo ""
    log_info "=== Colima Status ==="
    colima status 2>/dev/null || echo "Colima not running"

    echo ""
    log_info "=== k3d Cluster Status ==="
    k3d cluster list 2>/dev/null || echo "No clusters"

    echo ""
    log_info "=== k3d Registry Status ==="
    k3d registry list 2>/dev/null || echo "No registries"

    echo ""
    log_info "=== Flux Status ==="
    if kubectl get namespace flux-system &>/dev/null; then
        flux get all -A 2>/dev/null || echo "Flux not ready"
    else
        echo "Flux not installed"
    fi

    echo ""
    log_info "=== Application Pods ==="
    kubectl get pods -n "$APP_NAMESPACE" 2>/dev/null || echo "Namespace not found"

    echo ""
    log_info "=== Services ==="
    kubectl get svc -n "$APP_NAMESPACE" 2>/dev/null || echo "Namespace not found"

    echo ""
    log_info "=== Access URLs ==="
    echo "  Frontend:    http://ourchat.localhost"
    echo "  GraphQL API: http://api.ourchat.localhost/graphql"
    echo "  MailHog:     http://mail.ourchat.localhost"
    echo "  Grafana:     http://grafana.localhost"
}

show_logs() {
    local service=${1:-}

    if [[ -z "$service" ]]; then
        log_error "Usage: $0 logs <service>"
        log_info "Available services: frontend, backend, postgres, mailhog"
        exit 1
    fi

    local pod_name
    pod_name=$(kubectl get pods -n "$APP_NAMESPACE" -l "app.kubernetes.io/name=ourchat-$service" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

    if [[ -z "$pod_name" ]]; then
        # Try without ourchat- prefix
        pod_name=$(kubectl get pods -n "$APP_NAMESPACE" -l "app.kubernetes.io/name=$service" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    fi

    if [[ -z "$pod_name" ]]; then
        log_error "Pod not found for service: $service"
        kubectl get pods -n "$APP_NAMESPACE"
        exit 1
    fi

    kubectl logs -f -n "$APP_NAMESPACE" "$pod_name"
}

reconcile() {
    log_info "Forcing Flux reconciliation..."
    flux reconcile source git flux-system
    flux reconcile kustomization flux-system
    flux reconcile kustomization infrastructure-controllers -n flux-system || true
    flux reconcile kustomization infrastructure -n flux-system || true
    flux reconcile kustomization apps -n flux-system || true
    log_success "Reconciliation triggered"
}

# =============================================================================
# Full Stack Commands
# =============================================================================

start() {
    log_info "Starting full OurChat local lab..."

    check_dependencies
    colima_start
    cluster_create
    flux_install
    charts_package_push
    create_secrets
    flux_bootstrap
    setup_image_automation

    log_success "Local lab started!"
    log_info "Run '$0 build' to build and deploy your application images"
    log_info "Run '$0 status' to check the status of all components"
}

stop() {
    log_info "Stopping OurChat local lab..."
    colima_stop
    log_success "Local lab stopped"
}

restart() {
    log_info "Restarting OurChat local lab..."
    cluster_delete
    cluster_create
    flux_install
    charts_package_push
    create_secrets
    flux_bootstrap
    setup_image_automation
    log_success "Local lab restarted"
}

# =============================================================================
# Main
# =============================================================================

main() {
    local command=${1:-}
    shift || true

    case "$command" in
        start)
            start
            ;;
        stop)
            stop
            ;;
        restart)
            restart
            ;;
        status)
            show_status
            ;;
        build)
            build_images
            ;;
        reconcile)
            reconcile
            ;;
        secrets)
            create_secrets
            ;;
        sync-branch)
            flux_sync_branch
            ;;
        logs)
            show_logs "$@"
            ;;
        cluster-create)
            cluster_create
            ;;
        cluster-delete)
            cluster_delete
            ;;
        colima-start)
            colima_start
            ;;
        colima-stop)
            colima_stop
            ;;
        flux)
            flux_install
            flux_bootstrap
            setup_image_automation
            ;;
        charts)
            charts_package_push
            ;;
        *)
            echo "Usage: $0 <command>"
            echo ""
            echo "Commands:"
            echo "  start         - Full stack: colima + cluster + flux + secrets"
            echo "  stop          - Stop colima (preserves data)"
            echo "  restart       - Restart cluster"
            echo "  status        - Check all components"
            echo "  build         - Build & push images to local registry"
            echo "  reconcile     - Force Flux reconciliation"
            echo "  secrets       - Create/update secrets"
            echo "  sync-branch   - Switch Flux to current git branch"
            echo "  logs <svc>    - Tail service logs"
            echo "  cluster-create - Create k3d cluster only"
            echo "  cluster-delete - Delete k3d cluster"
            echo "  colima-start  - Start colima only"
            echo "  colima-stop   - Stop colima only"
            echo "  flux          - Install and bootstrap Flux"
            echo "  charts        - Package and push Helm charts"
            exit 1
            ;;
    esac
}

main "$@"
