# =============================================================================
# ARM Compute Instance with k3s
# =============================================================================

# Get latest Ubuntu 22.04 ARM image
data "oci_core_images" "ubuntu_arm" {
  compartment_id           = local.compartment_ocid
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "22.04"
  shape                    = "VM.Standard.A1.Flex"
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

# Cloud-init script for k3s installation
locals {
  cloud_init = <<-EOF
    #cloud-config
    package_update: true
    package_upgrade: true

    packages:
      - curl
      - git
      - jq
      - apt-transport-https
      - ca-certificates
      - gnupg
      - lsb-release

    runcmd:
      # Disable firewalld if present (Ubuntu uses ufw)
      - systemctl disable --now ufw || true

      # Install k3s
      - curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="server --disable traefik --disable servicelb --tls-san $(curl -s ifconfig.me)" sh -

      # Wait for k3s to be ready
      - sleep 30
      - until kubectl get nodes; do sleep 5; done

      # Set up kubeconfig for ubuntu user
      - mkdir -p /home/ubuntu/.kube
      - cp /etc/rancher/k3s/k3s.yaml /home/ubuntu/.kube/config
      - chown -R ubuntu:ubuntu /home/ubuntu/.kube
      - chmod 600 /home/ubuntu/.kube/config

      # Install Helm
      - curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

      # Install Flux CLI
      - curl -s https://fluxcd.io/install.sh | bash

      # Create keepalive cron job to prevent Oracle from reclaiming idle instance
      - echo "*/5 * * * * root dd if=/dev/zero of=/tmp/keepalive bs=1M count=10 && rm /tmp/keepalive" > /etc/cron.d/keepalive

    final_message: "k3s setup complete after $UPTIME seconds"
  EOF
}

# ARM VM Instance
resource "oci_core_instance" "k3s" {
  compartment_id      = local.compartment_ocid
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  display_name        = "${var.project_name}-k3s"
  shape               = "VM.Standard.A1.Flex"

  shape_config {
    ocpus         = var.vm_ocpus
    memory_in_gbs = var.vm_memory_gb
  }

  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.ubuntu_arm.images[0].id
    boot_volume_size_in_gbs = var.vm_boot_volume_gb
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.public.id
    display_name     = "${var.project_name}-k3s-vnic"
    assign_public_ip = true
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data           = base64encode(local.cloud_init)
  }

  freeform_tags = local.common_tags

  lifecycle {
    ignore_changes = [source_details[0].source_id]
  }
}

# Get the public IP
data "oci_core_vnic_attachments" "k3s" {
  compartment_id = local.compartment_ocid
  instance_id    = oci_core_instance.k3s.id
}

data "oci_core_vnic" "k3s" {
  vnic_id = data.oci_core_vnic_attachments.k3s.vnic_attachments[0].vnic_id
}
