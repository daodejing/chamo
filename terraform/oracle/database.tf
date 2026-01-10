# =============================================================================
# Oracle Autonomous Database (Always Free)
# =============================================================================

resource "random_string" "db_name_suffix" {
  length  = 4
  special = false
  upper   = false
}

resource "oci_database_autonomous_database" "main" {
  compartment_id = local.compartment_ocid

  # Database configuration
  db_name                = "${var.project_name}${random_string.db_name_suffix.result}"
  display_name           = var.db_display_name
  admin_password         = var.db_admin_password

  # Always Free tier settings
  is_free_tier           = true
  cpu_core_count         = 1
  data_storage_size_in_tbs = 1  # Will be limited to 20GB for free tier

  # Workload type - OLTP for transactional workloads
  db_workload = "OLTP"

  # Network access - allow from anywhere (for simplicity in staging)
  is_mtls_connection_required = false
  whitelisted_ips            = ["0.0.0.0/0"]

  # Licensing
  license_model = "LICENSE_INCLUDED"

  # Auto-scaling disabled for free tier
  is_auto_scaling_enabled         = false
  is_auto_scaling_for_storage_enabled = false

  freeform_tags = local.common_tags

  lifecycle {
    ignore_changes = [
      # Ignore changes that Oracle may make automatically
      defined_tags,
    ]
  }
}

# Wait for database to be available and get connection details
data "oci_database_autonomous_database" "main" {
  autonomous_database_id = oci_database_autonomous_database.main.id
}
