# =============================================================================
# OurChat - Oracle Cloud Infrastructure
# =============================================================================

provider "oci" {
  # Use API key authentication (doesn't expire)
  config_file_profile = "DEFAULT"
  region              = var.region
}

# Read tenancy OCID from OCI config file
data "external" "oci_config" {
  program = ["bash", "-c", "echo '{\"tenancy\": \"'$(grep tenancy ~/.oci/config | cut -d= -f2)'\"}'"]
}

# Use tenancy as compartment if not specified
locals {
  tenancy_ocid     = var.tenancy_ocid != "" ? var.tenancy_ocid : data.external.oci_config.result.tenancy
  compartment_ocid = var.compartment_ocid != "" ? var.compartment_ocid : local.tenancy_ocid

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "opentofu"
  }
}

# Get availability domains
data "oci_identity_availability_domains" "ads" {
  compartment_id = local.tenancy_ocid
}

# Get tenancy namespace for OCIR
data "oci_objectstorage_namespace" "ns" {
  compartment_id = local.tenancy_ocid
}
