# =============================================================================
# OCI Provider Variables
# =============================================================================

variable "tenancy_ocid" {
  description = "OCID of the tenancy"
  type        = string
}

variable "user_ocid" {
  description = "OCID of the user"
  type        = string
}

variable "fingerprint" {
  description = "Fingerprint of the API key"
  type        = string
}

variable "private_key_path" {
  description = "Path to the private key file"
  type        = string
  default     = "~/.oci/oci_api_key.pem"
}

variable "region" {
  description = "OCI region"
  type        = string
  default     = "us-phoenix-1"
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
