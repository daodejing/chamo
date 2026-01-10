#!/usr/bin/env bash
# =============================================================================
# OurChat - Oracle Cloud Lab Management Script
# =============================================================================
# Usage: ./scripts/oracle-lab.sh <command>
#
# Commands:
#   init          - Initialize OpenTofu
#   plan          - Preview infrastructure changes
#   apply         - Provision infrastructure
#   destroy       - Tear down all resources
#   status        - Show resource status
#   ssh           - SSH to k3s node
#   kubeconfig    - Fetch kubeconfig from k3s node
#   flux-bootstrap - Bootstrap Flux on the cluster
#   build-push    - Build and push images to OCIR
#   secrets       - Create Kubernetes secrets
#   logs          - Tail application logs
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TERRAFORM_DIR="${PROJECT_ROOT}/terraform/oracle"
KUBECONFIG_PATH="${HOME}/.kube/ourchat-oracle.yaml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------
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

check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 is not installed. Please install it first."
        exit 1
    fi
}

get_tf_output() {
    local output_name="$1"
    cd "${TERRAFORM_DIR}"
    tofu output -raw "${output_name}" 2>/dev/null || terraform output -raw "${output_name}" 2>/dev/null || echo ""
}

# Use tofu if available, otherwise terraform
TF_CMD="tofu"
if ! command -v tofu &> /dev/null; then
    if command -v terraform &> /dev/null; then
        TF_CMD="terraform"
        log_warn "OpenTofu not found, using Terraform instead"
    else
        log_error "Neither OpenTofu nor Terraform is installed"
        exit 1
    fi
fi

# -----------------------------------------------------------------------------
# Commands
# -----------------------------------------------------------------------------

cmd_init() {
    log_info "Initializing OpenTofu..."
    cd "${TERRAFORM_DIR}"

    if [[ ! -f "terraform.tfvars" ]]; then
        log_warn "terraform.tfvars not found!"
        log_info "Copy terraform.tfvars.example to terraform.tfvars and fill in your values"
        exit 1
    fi

    ${TF_CMD} init
    log_success "OpenTofu initialized"
}

cmd_plan() {
    log_info "Planning infrastructure changes..."
    cd "${TERRAFORM_DIR}"
    ${TF_CMD} plan
}

cmd_apply() {
    log_info "Applying infrastructure changes..."
    cd "${TERRAFORM_DIR}"
    ${TF_CMD} apply

    log_success "Infrastructure provisioned!"
    log_info ""
    log_info "Next steps:"
    log_info "  1. Wait 2-3 minutes for k3s to initialize"
    log_info "  2. Run: ./scripts/oracle-lab.sh kubeconfig"
    log_info "  3. Run: ./scripts/oracle-lab.sh flux-bootstrap"
}

cmd_destroy() {
    log_warn "This will destroy ALL Oracle Cloud resources!"
    read -p "Are you sure? (yes/no): " confirm
    if [[ "${confirm}" != "yes" ]]; then
        log_info "Cancelled"
        exit 0
    fi

    log_info "Destroying infrastructure..."
    cd "${TERRAFORM_DIR}"
    ${TF_CMD} destroy
    log_success "Infrastructure destroyed"
}

cmd_status() {
    log_info "=== OpenTofu State ==="
    cd "${TERRAFORM_DIR}"
    ${TF_CMD} show -no-color 2>/dev/null | head -50 || log_warn "No state found. Run 'apply' first."

    echo ""
    log_info "=== Key Outputs ==="
    local k3s_ip=$(get_tf_output "k3s_public_ip")
    local lb_ip=$(get_tf_output "lb_public_ip")
    local frontend_url=$(get_tf_output "frontend_url")
    local backend_url=$(get_tf_output "backend_url")

    if [[ -n "${k3s_ip}" ]]; then
        echo "  k3s Node IP:   ${k3s_ip}"
        echo "  Load Balancer: ${lb_ip}"
        echo "  Frontend:      ${frontend_url}"
        echo "  Backend API:   ${backend_url}/health"
    else
        log_warn "No outputs available. Run 'apply' first."
    fi

    if [[ -f "${KUBECONFIG_PATH}" ]]; then
        echo ""
        log_info "=== Kubernetes Status ==="
        KUBECONFIG="${KUBECONFIG_PATH}" kubectl get nodes 2>/dev/null || log_warn "Cannot connect to cluster"
    fi
}

cmd_ssh() {
    local k3s_ip=$(get_tf_output "k3s_public_ip")
    if [[ -z "${k3s_ip}" ]]; then
        log_error "k3s IP not found. Run 'apply' first."
        exit 1
    fi

    log_info "Connecting to k3s node at ${k3s_ip}..."
    ssh -o StrictHostKeyChecking=no ubuntu@"${k3s_ip}"
}

cmd_kubeconfig() {
    local k3s_ip=$(get_tf_output "k3s_public_ip")
    if [[ -z "${k3s_ip}" ]]; then
        log_error "k3s IP not found. Run 'apply' first."
        exit 1
    fi

    log_info "Fetching kubeconfig from k3s node..."
    mkdir -p "$(dirname "${KUBECONFIG_PATH}")"

    ssh -o StrictHostKeyChecking=no ubuntu@"${k3s_ip}" \
        'sudo cat /etc/rancher/k3s/k3s.yaml' | \
        sed "s/127.0.0.1/${k3s_ip}/g" > "${KUBECONFIG_PATH}"

    chmod 600 "${KUBECONFIG_PATH}"
    log_success "Kubeconfig saved to ${KUBECONFIG_PATH}"
    log_info ""
    log_info "To use this cluster:"
    log_info "  export KUBECONFIG=${KUBECONFIG_PATH}"
    log_info "  kubectl get nodes"
}

cmd_flux_bootstrap() {
    if [[ -z "${GH_TOKEN:-}" ]]; then
        log_error "GH_TOKEN environment variable is required"
        log_info "Run 'gh auth token' or set GH_TOKEN manually"
        exit 1
    fi

    if [[ ! -f "${KUBECONFIG_PATH}" ]]; then
        log_error "Kubeconfig not found. Run 'kubeconfig' first."
        exit 1
    fi

    local github_owner=$(get_tf_output "github_owner" 2>/dev/null || echo "daodejing")
    local github_repo=$(get_tf_output "github_repository" 2>/dev/null || echo "chamo")

    log_info "Bootstrapping Flux on Oracle cluster..."
    export KUBECONFIG="${KUBECONFIG_PATH}"
    export GITHUB_TOKEN="${GH_TOKEN}"

    flux bootstrap github \
        --owner="${github_owner}" \
        --repository="${github_repo}" \
        --branch=main \
        --path=clusters/oracle \
        --personal

    log_success "Flux bootstrapped successfully!"
}

cmd_build_push() {
    check_command docker

    local ocir_url=$(get_tf_output "ocir_url")
    local ocir_namespace=$(get_tf_output "ocir_namespace")

    if [[ -z "${ocir_url}" ]]; then
        log_error "OCIR URL not found. Run 'apply' first."
        exit 1
    fi

    local frontend_image="${ocir_url}/${ocir_namespace}/ourchat/frontend"
    local backend_image="${ocir_url}/${ocir_namespace}/ourchat/backend"
    local tag="$(git rev-parse --short HEAD)-$(date +%s)"

    log_info "Building images for ARM64..."
    log_info "Tag: ${tag}"

    # Check if logged into OCIR
    if ! docker manifest inspect "${frontend_image}:latest" &>/dev/null 2>&1; then
        log_warn "You may need to login to OCIR first:"
        log_info "  docker login ${ocir_url}"
        log_info "  Username: ${ocir_namespace}/oracleidentitycloudservice/<your-email>"
        log_info "  Password: <auth-token from OCI Console>"
    fi

    # Build frontend
    log_info "Building frontend..."
    docker buildx build \
        --platform linux/arm64 \
        -f docker/frontend/Dockerfile \
        -t "${frontend_image}:${tag}" \
        -t "${frontend_image}:latest" \
        --push \
        "${PROJECT_ROOT}"

    # Build backend
    log_info "Building backend..."
    docker buildx build \
        --platform linux/arm64 \
        -f docker/backend/Dockerfile \
        -t "${backend_image}:${tag}" \
        -t "${backend_image}:latest" \
        --push \
        "${PROJECT_ROOT}"

    log_success "Images built and pushed:"
    log_info "  ${frontend_image}:${tag}"
    log_info "  ${backend_image}:${tag}"
}

cmd_secrets() {
    if [[ ! -f "${KUBECONFIG_PATH}" ]]; then
        log_error "Kubeconfig not found. Run 'kubeconfig' first."
        exit 1
    fi

    export KUBECONFIG="${KUBECONFIG_PATH}"

    log_info "Creating Kubernetes secrets..."

    # Create namespace if not exists
    kubectl create namespace ourchat --dry-run=client -o yaml | kubectl apply -f -

    # Get database info from terraform
    local db_password
    read -sp "Enter database admin password: " db_password
    echo ""

    # Note: Oracle Autonomous DB connection string format varies
    # This is a placeholder - actual connection string comes from OCI console
    local db_host=$(get_tf_output "db_apex_url" | sed 's|https://||' | cut -d'/' -f1 || echo "pending")

    # Generate secrets
    local jwt_secret=$(openssl rand -hex 32)
    local refresh_secret=$(openssl rand -hex 32)
    local invite_secret=$(openssl rand -hex 64)

    # Create secret
    kubectl create secret generic ourchat-secrets \
        --namespace=ourchat \
        --from-literal=DATABASE_URL="postgresql://ADMIN:${db_password}@${db_host}:1521/ourchatdb?sslmode=require" \
        --from-literal=JWT_SECRET="${jwt_secret}" \
        --from-literal=REFRESH_TOKEN_SECRET="${refresh_secret}" \
        --from-literal=INVITE_SECRET="${invite_secret}" \
        --dry-run=client -o yaml | kubectl apply -f -

    log_success "Secrets created in ourchat namespace"
    log_warn "Note: You may need to update DATABASE_URL with the actual Oracle connection string from OCI Console"
}

cmd_logs() {
    local service="${1:-}"
    if [[ -z "${service}" ]]; then
        log_info "Usage: ./scripts/oracle-lab.sh logs <service>"
        log_info "Services: frontend, backend, all"
        exit 1
    fi

    if [[ ! -f "${KUBECONFIG_PATH}" ]]; then
        log_error "Kubeconfig not found. Run 'kubeconfig' first."
        exit 1
    fi

    export KUBECONFIG="${KUBECONFIG_PATH}"

    case "${service}" in
        frontend)
            kubectl logs -n ourchat -l app.kubernetes.io/name=ourchat-frontend -f --tail=100
            ;;
        backend)
            kubectl logs -n ourchat -l app.kubernetes.io/name=ourchat-backend -f --tail=100
            ;;
        all)
            kubectl logs -n ourchat -l app.kubernetes.io/part-of=ourchat -f --tail=100
            ;;
        *)
            log_error "Unknown service: ${service}"
            exit 1
            ;;
    esac
}

cmd_help() {
    echo "OurChat Oracle Cloud Lab Management"
    echo ""
    echo "Usage: ./scripts/oracle-lab.sh <command>"
    echo ""
    echo "Commands:"
    echo "  init           Initialize OpenTofu"
    echo "  plan           Preview infrastructure changes"
    echo "  apply          Provision infrastructure"
    echo "  destroy        Tear down all resources"
    echo "  status         Show resource status and outputs"
    echo "  ssh            SSH to k3s node"
    echo "  kubeconfig     Fetch kubeconfig from k3s node"
    echo "  flux-bootstrap Bootstrap Flux on the cluster"
    echo "  build-push     Build and push images to OCIR"
    echo "  secrets        Create Kubernetes secrets"
    echo "  logs <svc>     Tail application logs (frontend|backend|all)"
    echo "  help           Show this help message"
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
    local command="${1:-help}"
    shift || true

    case "${command}" in
        init)           cmd_init ;;
        plan)           cmd_plan ;;
        apply)          cmd_apply ;;
        destroy)        cmd_destroy ;;
        status)         cmd_status ;;
        ssh)            cmd_ssh ;;
        kubeconfig)     cmd_kubeconfig ;;
        flux-bootstrap) cmd_flux_bootstrap ;;
        build-push)     cmd_build_push ;;
        secrets)        cmd_secrets ;;
        logs)           cmd_logs "$@" ;;
        help|--help|-h) cmd_help ;;
        *)
            log_error "Unknown command: ${command}"
            cmd_help
            exit 1
            ;;
    esac
}

main "$@"
