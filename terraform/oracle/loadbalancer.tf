# =============================================================================
# Flexible Load Balancer (Always Free - 10 Mbps)
# =============================================================================

resource "oci_load_balancer_load_balancer" "main" {
  compartment_id = local.compartment_ocid
  display_name   = "${var.project_name}-lb"
  shape          = "flexible"

  shape_details {
    minimum_bandwidth_in_mbps = 10
    maximum_bandwidth_in_mbps = 10
  }

  subnet_ids = [oci_core_subnet.public.id]

  is_private = false

  freeform_tags = local.common_tags
}

# Backend Set for k3s Istio Ingress (HTTP)
resource "oci_load_balancer_backend_set" "http" {
  load_balancer_id = oci_load_balancer_load_balancer.main.id
  name             = "http-backend"
  policy           = "ROUND_ROBIN"

  health_checker {
    protocol          = "TCP"
    port              = 80
    interval_ms       = 10000
    timeout_in_millis = 3000
    retries           = 3
  }
}

# Backend Set for HTTPS
resource "oci_load_balancer_backend_set" "https" {
  load_balancer_id = oci_load_balancer_load_balancer.main.id
  name             = "https-backend"
  policy           = "ROUND_ROBIN"

  health_checker {
    protocol          = "TCP"
    port              = 443
    interval_ms       = 10000
    timeout_in_millis = 3000
    retries           = 3
  }
}

# Backend - k3s node for HTTP
resource "oci_load_balancer_backend" "k3s_http" {
  load_balancer_id = oci_load_balancer_load_balancer.main.id
  backendset_name  = oci_load_balancer_backend_set.http.name
  ip_address       = data.oci_core_vnic.k3s.private_ip_address
  port             = 80
  weight           = 1
}

# Backend - k3s node for HTTPS
resource "oci_load_balancer_backend" "k3s_https" {
  load_balancer_id = oci_load_balancer_load_balancer.main.id
  backendset_name  = oci_load_balancer_backend_set.https.name
  ip_address       = data.oci_core_vnic.k3s.private_ip_address
  port             = 443
  weight           = 1
}

# HTTP Listener
resource "oci_load_balancer_listener" "http" {
  load_balancer_id         = oci_load_balancer_load_balancer.main.id
  name                     = "http-listener"
  default_backend_set_name = oci_load_balancer_backend_set.http.name
  port                     = 80
  protocol                 = "TCP"
}

# HTTPS Listener
resource "oci_load_balancer_listener" "https" {
  load_balancer_id         = oci_load_balancer_load_balancer.main.id
  name                     = "https-listener"
  default_backend_set_name = oci_load_balancer_backend_set.https.name
  port                     = 443
  protocol                 = "TCP"
}
