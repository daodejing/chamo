# =============================================================================
# Oracle Container Image Registry (OCIR)
# =============================================================================

# OCIR repositories for application images
resource "oci_artifacts_container_repository" "frontend" {
  compartment_id = local.compartment_ocid
  display_name   = "${var.project_name}/frontend"
  is_public      = false
}

resource "oci_artifacts_container_repository" "backend" {
  compartment_id = local.compartment_ocid
  display_name   = "${var.project_name}/backend"
  is_public      = false
}

# Note: OCIR authentication uses OCI auth tokens
# Generate token: OCI Console > User Settings > Auth Tokens > Generate Token
# Username format: <tenancy-namespace>/<username>
# Registry: <region>.ocir.io

locals {
  ocir_url = "${var.region}.ocir.io"
  ocir_namespace = data.oci_objectstorage_namespace.ns.namespace

  frontend_image = "${local.ocir_url}/${local.ocir_namespace}/${var.project_name}/frontend"
  backend_image  = "${local.ocir_url}/${local.ocir_namespace}/${var.project_name}/backend"
}
