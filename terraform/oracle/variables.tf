# =============================================================================
# OCI Provider Variables
# =============================================================================
# Note: Using session token authentication (oci session authenticate)
# User/fingerprint/key read from ~/.oci/config automatically

variable "tenancy_ocid" {
  description = "OCID of the tenancy (read from ~/.oci/config if not set)"
  type        = string
  default     = ""
}

variable "region" {
  description = "OCI region"
  type        = string
  default     = "ap-osaka-1"
}

variable "compartment_ocid" {
  description = "OCID of the compartment (defaults to tenancy root)"
  type        = string
  default     = ""
}

# =============================================================================
# Compute Variables
# =============================================================================

variable "ssh_public_key" {
  description = "SSH public key for VM access"
  type        = string
}

variable "admin_cidr_blocks" {
  description = "CIDR blocks allowed for SSH and k8s API access (e.g., your IP/32)"
  type        = list(string)
  default     = ["131.147.163.106/32"]
}

variable "vm_ocpus" {
  description = "Number of OCPUs for the ARM VM (max 4 for free tier)"
  type        = number
  default     = 4
}

variable "vm_memory_gb" {
  description = "Memory in GB for the ARM VM (max 24 for free tier)"
  type        = number
  default     = 24
}

variable "vm_boot_volume_gb" {
  description = "Boot volume size in GB"
  type        = number
  default     = 100
}

# =============================================================================
# Database Variables
# =============================================================================

variable "db_admin_password" {
  description = "Admin password for Autonomous Database (min 12 chars, 1 upper, 1 lower, 1 number)"
  type        = string
  sensitive   = true
}

variable "db_display_name" {
  description = "Display name for the Autonomous Database"
  type        = string
  default     = "ourchat-db"
}

# =============================================================================
# Application Variables
# =============================================================================

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "ourchat"
}

variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
  default     = "staging"
}

# =============================================================================
# GitHub Variables (for Flux)
# =============================================================================

variable "github_owner" {
  description = "GitHub repository owner"
  type        = string
  default     = "daodejing"
}

variable "github_repository" {
  description = "GitHub repository name"
  type        = string
  default     = "chamo"
}

variable "github_token" {
  description = "GitHub personal access token for Flux (needs repo scope)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "flux_enabled" {
  description = "Enable Flux bootstrap (requires kubeconfig at ~/.kube/ourchat-oracle.yaml)"
  type        = bool
  default     = false
}
