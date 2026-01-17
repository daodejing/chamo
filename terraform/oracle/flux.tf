# =============================================================================
# Flux GitOps Bootstrap Configuration
# =============================================================================
# Bootstraps Flux on the k3s cluster with image automation support.
# This replaces the manual `flux bootstrap github` command.
#
# Prerequisites:
#   - kubeconfig at ~/.kube/ourchat-oracle.yaml
#   - GitHub personal access token with repo scope
#
# Usage:
#   1. First run: tofu apply (creates infra, outputs kubeconfig_command)
#   2. Run the kubeconfig_command to fetch kubeconfig
#   3. Set TF_VAR_github_token=<your-token>
#   4. Set TF_VAR_flux_enabled=true
#   5. Run: tofu apply (bootstraps Flux)
# =============================================================================

# -----------------------------------------------------------------------------
# Provider Configuration (conditional on flux_enabled)
# -----------------------------------------------------------------------------

provider "kubernetes" {
  config_path = "~/.kube/ourchat-oracle.yaml"
}

provider "github" {
  owner = var.github_owner
  token = var.github_token
}

# -----------------------------------------------------------------------------
# SSH Key for Flux (deploy key)
# -----------------------------------------------------------------------------

resource "tls_private_key" "flux" {
  count     = var.flux_enabled ? 1 : 0
  algorithm = "ECDSA"
  ecdsa_curve = "P256"
}

# -----------------------------------------------------------------------------
# GitHub Deploy Key (read-write for image automation)
# -----------------------------------------------------------------------------

resource "github_repository_deploy_key" "flux" {
  count      = var.flux_enabled ? 1 : 0
  title      = "flux-${var.environment}"
  repository = var.github_repository
  key        = tls_private_key.flux[0].public_key_openssh
  read_only  = false  # Required for image automation to commit changes
}

# -----------------------------------------------------------------------------
# Flux Bootstrap
# -----------------------------------------------------------------------------

resource "flux_bootstrap_git" "this" {
  count = var.flux_enabled ? 1 : 0

  embedded_manifests = true
  path               = "clusters/oracle"

  # Include image automation controllers for automatic image updates
  components_extra = [
    "image-reflector-controller",
    "image-automation-controller"
  ]

  depends_on = [github_repository_deploy_key.flux]
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------

output "flux_deploy_key_fingerprint" {
  description = "Fingerprint of the Flux deploy key"
  value       = var.flux_enabled ? tls_private_key.flux[0].public_key_fingerprint_sha256 : null
}

output "flux_status" {
  description = "Flux bootstrap status"
  value       = var.flux_enabled ? "Flux bootstrapped with image automation" : "Flux not enabled (set flux_enabled=true)"
}
