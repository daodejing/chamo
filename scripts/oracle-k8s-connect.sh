#!/bin/bash
# =============================================================================
# Oracle k8s Connection Script
# =============================================================================
# Manages SSH tunnel and kubeconfig for Oracle Cloud k3s cluster.
# Integrates with standard kubectl config for use with k9s, lens, etc.
#
# Usage:
#   ./scripts/oracle-k8s-connect.sh          # Connect and switch context
#   ./scripts/oracle-k8s-connect.sh status   # Check connection status
#   ./scripts/oracle-k8s-connect.sh disconnect # Close tunnel
# =============================================================================

set -e

# Configuration
ORACLE_VM_IP="141.147.156.8"
ORACLE_VM_USER="ubuntu"
CONTEXT_NAME="oracle-ourchat"
CLUSTER_NAME="oracle-ourchat"
USER_NAME="oracle-ourchat-admin"
LOCAL_PORT="6443"
TEMP_KUBECONFIG="/tmp/oracle-k3s-kubeconfig-temp"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

# Check if SSH tunnel is running
tunnel_exists() {
    pgrep -f "ssh.*${LOCAL_PORT}:localhost:${LOCAL_PORT}.*${ORACLE_VM_IP}" > /dev/null 2>&1
}

# Check if we can connect to the k8s API
can_connect() {
    kubectl --context="${CONTEXT_NAME}" cluster-info > /dev/null 2>&1
}

# Create SSH tunnel
create_tunnel() {
    if tunnel_exists; then
        log_info "SSH tunnel already running"
        return 0
    fi

    log_info "Creating SSH tunnel to ${ORACLE_VM_IP}..."
    ssh -f -N -o ServerAliveInterval=60 -o ServerAliveCountMax=3 \
        -o ExitOnForwardFailure=yes \
        -L ${LOCAL_PORT}:localhost:${LOCAL_PORT} \
        ${ORACLE_VM_USER}@${ORACLE_VM_IP}

    # Wait for tunnel to establish
    sleep 2

    if tunnel_exists; then
        log_info "SSH tunnel established"
    else
        log_error "Failed to create SSH tunnel"
        return 1
    fi
}

# Kill SSH tunnel
kill_tunnel() {
    if tunnel_exists; then
        pkill -f "ssh.*${LOCAL_PORT}:localhost:${LOCAL_PORT}.*${ORACLE_VM_IP}"
        log_info "SSH tunnel closed"
    else
        log_warn "No tunnel running"
    fi
}

# Fetch kubeconfig from remote and merge into local config
setup_kubeconfig() {
    log_info "Fetching kubeconfig from k3s cluster..."

    # Fetch remote kubeconfig
    ssh ${ORACLE_VM_USER}@${ORACLE_VM_IP} "sudo cat /etc/rancher/k3s/k3s.yaml" > "${TEMP_KUBECONFIG}"

    # Extract certificate data
    local CA_DATA=$(grep 'certificate-authority-data' "${TEMP_KUBECONFIG}" | awk '{print $2}')
    local CLIENT_CERT=$(grep 'client-certificate-data' "${TEMP_KUBECONFIG}" | awk '{print $2}')
    local CLIENT_KEY=$(grep 'client-key-data' "${TEMP_KUBECONFIG}" | awk '{print $2}')

    # Ensure ~/.kube exists
    mkdir -p ~/.kube

    # Remove existing oracle context/cluster/user if present
    kubectl config delete-context "${CONTEXT_NAME}" 2>/dev/null || true
    kubectl config delete-cluster "${CLUSTER_NAME}" 2>/dev/null || true
    kubectl config delete-user "${USER_NAME}" 2>/dev/null || true

    # Add cluster (pointing to localhost through tunnel)
    kubectl config set-cluster "${CLUSTER_NAME}" \
        --server="https://127.0.0.1:${LOCAL_PORT}" \
        --certificate-authority-data="${CA_DATA}" \
        --embed-certs=true 2>/dev/null || \
    kubectl config set-cluster "${CLUSTER_NAME}" \
        --server="https://127.0.0.1:${LOCAL_PORT}"

    # Workaround: set certificate-authority-data directly
    kubectl config set "clusters.${CLUSTER_NAME}.certificate-authority-data" "${CA_DATA}"

    # Add user credentials
    kubectl config set "users.${USER_NAME}.client-certificate-data" "${CLIENT_CERT}"
    kubectl config set "users.${USER_NAME}.client-key-data" "${CLIENT_KEY}"

    # Add context
    kubectl config set-context "${CONTEXT_NAME}" \
        --cluster="${CLUSTER_NAME}" \
        --user="${USER_NAME}" \
        --namespace="ourchat"

    # Clean up temp file
    rm -f "${TEMP_KUBECONFIG}"

    log_info "Kubeconfig merged into ~/.kube/config"
    log_info "Context '${CONTEXT_NAME}' configured with default namespace 'ourchat'"
}

# Switch to oracle context
switch_context() {
    kubectl config use-context "${CONTEXT_NAME}"
    log_info "Switched to context '${CONTEXT_NAME}'"
}

# Show status
show_status() {
    echo "Oracle k8s Connection Status"
    echo "============================="
    echo ""

    # Tunnel status
    if tunnel_exists; then
        local PID=$(pgrep -f "ssh.*${LOCAL_PORT}:localhost:${LOCAL_PORT}.*${ORACLE_VM_IP}")
        log_info "SSH tunnel: running (PID: ${PID})"
    else
        log_error "SSH tunnel: not running"
    fi

    # Context status
    if kubectl config get-contexts "${CONTEXT_NAME}" > /dev/null 2>&1; then
        log_info "Context '${CONTEXT_NAME}': configured"
    else
        log_error "Context '${CONTEXT_NAME}': not configured"
    fi

    # Current context
    local CURRENT=$(kubectl config current-context 2>/dev/null || echo "none")
    echo ""
    echo "Current context: ${CURRENT}"

    # Connection test
    if tunnel_exists; then
        echo ""
        echo "Testing connection..."
        if can_connect; then
            log_info "Can connect to cluster"
            echo ""
            kubectl --context="${CONTEXT_NAME}" get nodes
        else
            log_error "Cannot connect to cluster (tunnel may need refresh)"
        fi
    fi
}

# Main
case "${1:-connect}" in
    connect)
        echo "Connecting to Oracle k8s cluster..."
        echo ""
        create_tunnel
        setup_kubeconfig
        switch_context
        echo ""
        echo "Ready! You can now use:"
        echo "  kubectl get pods"
        echo "  k9s"
        echo ""
        echo "To switch back to another context:"
        echo "  kubectl config use-context <other-context>"
        ;;
    status)
        show_status
        ;;
    disconnect)
        kill_tunnel
        ;;
    tunnel)
        # Just create tunnel, don't fetch kubeconfig
        create_tunnel
        ;;
    refresh)
        # Refresh kubeconfig without recreating tunnel
        if ! tunnel_exists; then
            create_tunnel
        fi
        setup_kubeconfig
        ;;
    *)
        echo "Usage: $0 [connect|status|disconnect|tunnel|refresh]"
        echo ""
        echo "Commands:"
        echo "  connect     - Create tunnel, setup kubeconfig, switch context (default)"
        echo "  status      - Show connection status"
        echo "  disconnect  - Close SSH tunnel"
        echo "  tunnel      - Create tunnel only (no kubeconfig update)"
        echo "  refresh     - Refresh kubeconfig (recreate tunnel if needed)"
        exit 1
        ;;
esac
