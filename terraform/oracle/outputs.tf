# =============================================================================
# Output Values
# =============================================================================

# -----------------------------------------------------------------------------
# Compute Outputs
# -----------------------------------------------------------------------------

output "k3s_public_ip" {
  description = "Public IP address of the k3s node"
  value       = data.oci_core_vnic.k3s.public_ip_address
}

output "k3s_private_ip" {
  description = "Private IP address of the k3s node"
  value       = data.oci_core_vnic.k3s.private_ip_address
}

output "ssh_command" {
  description = "SSH command to connect to k3s node"
  value       = "ssh ubuntu@${data.oci_core_vnic.k3s.public_ip_address}"
}

# -----------------------------------------------------------------------------
# Load Balancer Outputs
# -----------------------------------------------------------------------------

output "lb_public_ip" {
  description = "Public IP address of the load balancer"
  value       = oci_load_balancer_load_balancer.main.ip_address_details[0].ip_address
}

output "nip_io_domain" {
  description = "nip.io wildcard domain based on LB IP"
  value       = "${replace(oci_load_balancer_load_balancer.main.ip_address_details[0].ip_address, ".", "-")}.nip.io"
}

output "frontend_url" {
  description = "Frontend URL"
  value       = "http://ourchat.${replace(oci_load_balancer_load_balancer.main.ip_address_details[0].ip_address, ".", "-")}.nip.io"
}

output "backend_url" {
  description = "Backend API URL"
  value       = "http://api.ourchat.${replace(oci_load_balancer_load_balancer.main.ip_address_details[0].ip_address, ".", "-")}.nip.io"
}

output "graphql_url" {
  description = "GraphQL endpoint URL"
  value       = "http://api.ourchat.${replace(oci_load_balancer_load_balancer.main.ip_address_details[0].ip_address, ".", "-")}.nip.io/graphql"
}

# -----------------------------------------------------------------------------
# Database Outputs
# -----------------------------------------------------------------------------

output "db_connection_string" {
  description = "Database connection string for application"
  value       = "postgresql://ADMIN@${oci_database_autonomous_database.main.connection_urls[0].apex_url != null ? replace(oci_database_autonomous_database.main.connection_strings[0].profiles[0].value, "description=", "") : "pending"}?sslmode=require"
  sensitive   = true
}

output "db_name" {
  description = "Autonomous Database name"
  value       = oci_database_autonomous_database.main.db_name
}

output "db_apex_url" {
  description = "Database APEX URL (for web-based admin)"
  value       = oci_database_autonomous_database.main.connection_urls[0].apex_url
}

# Note: For Prisma/PostgreSQL connection, you may need to use the Oracle JDBC thin connection
# Format: oracle://ADMIN:<password>@<host>:1521/<service_name>
# Or use Oracle's PostgreSQL compatibility mode if available

# -----------------------------------------------------------------------------
# Container Registry Outputs
# -----------------------------------------------------------------------------

output "ocir_url" {
  description = "OCIR base URL"
  value       = local.ocir_url
}

output "ocir_namespace" {
  description = "OCIR namespace (tenancy namespace)"
  value       = local.ocir_namespace
}

output "frontend_image" {
  description = "Full OCIR path for frontend image"
  value       = local.frontend_image
}

output "backend_image" {
  description = "Full OCIR path for backend image"
  value       = local.backend_image
}

output "docker_login_command" {
  description = "Docker login command for OCIR (replace <auth-token> with your token)"
  value       = "docker login ${local.ocir_url} -u '${local.ocir_namespace}/oracleidentitycloudservice/<your-email>' -p '<auth-token>'"
}

# -----------------------------------------------------------------------------
# Networking Outputs
# -----------------------------------------------------------------------------

output "vcn_id" {
  description = "VCN OCID"
  value       = oci_core_vcn.main.id
}

output "subnet_id" {
  description = "Public subnet OCID"
  value       = oci_core_subnet.public.id
}

# -----------------------------------------------------------------------------
# Kubernetes Configuration
# -----------------------------------------------------------------------------

output "kubeconfig_command" {
  description = "Command to fetch kubeconfig from k3s node"
  value       = "ssh ubuntu@${data.oci_core_vnic.k3s.public_ip_address} 'sudo cat /etc/rancher/k3s/k3s.yaml' | sed 's/127.0.0.1/${data.oci_core_vnic.k3s.public_ip_address}/g' > ~/.kube/ourchat-oracle.yaml"
}

# -----------------------------------------------------------------------------
# Flux Bootstrap Info
# -----------------------------------------------------------------------------

output "flux_bootstrap_command" {
  description = "Flux bootstrap command (set GITHUB_TOKEN first)"
  value       = <<-EOT
    export KUBECONFIG=~/.kube/ourchat-oracle.yaml
    flux bootstrap github \
      --owner=${var.github_owner} \
      --repository=${var.github_repository} \
      --branch=main \
      --path=clusters/oracle \
      --personal
  EOT
}
