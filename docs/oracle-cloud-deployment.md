# Oracle Cloud Free Tier Deployment

Deploy OurChat to Oracle Cloud's Always Free tier as a staging environment, complementing the existing local k3d development setup.

## Architecture

- **Compute**: k3s on ARM VM (4 OCPU, 24GB RAM)
- **Database**: Oracle Autonomous Database (free managed PostgreSQL-compatible)
- **Registry**: Oracle Container Image Registry (OCIR)
- **Load Balancer**: Flexible Load Balancer (10 Mbps)
- **DNS**: nip.io (no domain required)
- **IaC**: OpenTofu for infrastructure provisioning
- **GitOps**: Flux CD (same pattern as local)

## Oracle Cloud Free Tier Resources

| Resource | Specification | Purpose |
|----------|--------------|---------|
| ARM VM (A1.Flex) | 4 OCPU, 24GB RAM | k3s cluster |
| Autonomous DB | 1 OCPU, 20GB | PostgreSQL database |
| Block Storage | ~100GB (from 200GB quota) | Boot + data volumes |
| Load Balancer | Flexible 10 Mbps | Ingress |
| OCIR | Unlimited | Container images |
| Vault | 150 secrets | Secret management |
| Object Storage | 20GB | Backups (optional) |

## Directory Structure

```
ourchat/
├── terraform/
│   └── oracle/
│       ├── main.tf              # Provider config, backend
│       ├── variables.tf         # Input variables
│       ├── outputs.tf           # Output values (IP, DB connection)
│       ├── versions.tf          # Provider versions
│       ├── network.tf           # VCN, subnet, security lists
│       ├── compute.tf           # ARM VM for k3s
│       ├── database.tf          # Autonomous Database
│       ├── loadbalancer.tf      # Flexible LB
│       ├── registry.tf          # OCIR repository
│       └── terraform.tfvars.example
├── scripts/
│   └── oracle-lab.sh            # Oracle deployment automation
├── clusters/
│   └── oracle/                  # Flux cluster config
│       ├── kustomization.yaml
│       ├── sources.yaml
│       ├── infrastructure.yaml
│       └── apps.yaml
├── infrastructure/
│   └── oracle/                  # Oracle infra overlay
│       ├── kustomization.yaml
│       ├── namespaces.yaml
│       └── ingress-patches/
│           └── gateway-hosts.yaml
└── apps/
    └── oracle/                  # Oracle apps overlay
        ├── kustomization.yaml
        ├── image-patches/
        │   ├── backend-image.yaml
        │   └── frontend-image.yaml
        └── secrets/
            └── ocir-pull-secret.yaml
```

## Prerequisites

1. **Oracle Cloud account** with Always Free tier
2. **OCI CLI configured** (`~/.oci/config`)
3. **OpenTofu installed** (`brew install opentofu`)
4. **SSH key pair** for VM access
5. **Docker with buildx** for ARM image builds

## Quick Start

```bash
# 1. Initialize OpenTofu
./scripts/oracle-lab.sh init

# 2. Configure variables
cp terraform/oracle/terraform.tfvars.example terraform/oracle/terraform.tfvars
# Edit terraform.tfvars with your OCI credentials

# 3. Provision infrastructure
./scripts/oracle-lab.sh plan
./scripts/oracle-lab.sh apply

# 4. Fetch kubeconfig
./scripts/oracle-lab.sh kubeconfig

# 5. Bootstrap Flux
./scripts/oracle-lab.sh flux-bootstrap

# 6. Create secrets
./scripts/oracle-lab.sh secrets

# 7. Build and push images
./scripts/oracle-lab.sh build-push
```

## Script Commands

| Command | Description |
|---------|-------------|
| `./scripts/oracle-lab.sh init` | Initialize OpenTofu |
| `./scripts/oracle-lab.sh plan` | Preview changes |
| `./scripts/oracle-lab.sh apply` | Provision infrastructure |
| `./scripts/oracle-lab.sh destroy` | Tear down everything |
| `./scripts/oracle-lab.sh status` | Show resource status |
| `./scripts/oracle-lab.sh ssh` | SSH to k3s node |
| `./scripts/oracle-lab.sh kubeconfig` | Fetch kubeconfig |
| `./scripts/oracle-lab.sh flux-bootstrap` | Install Flux on cluster |
| `./scripts/oracle-lab.sh build-push` | Build & push to OCIR |
| `./scripts/oracle-lab.sh secrets` | Create k8s secrets |

## Configuration

### OpenTofu Variables (terraform.tfvars)

```hcl
tenancy_ocid      = "ocid1.tenancy.oc1..xxx"
user_ocid         = "ocid1.user.oc1..xxx"
compartment_ocid  = "ocid1.compartment.oc1..xxx"
region            = "us-phoenix-1"
fingerprint       = "xx:xx:xx..."
private_key_path  = "~/.oci/oci_api_key.pem"
ssh_public_key    = "ssh-rsa AAAA..."
db_admin_password = "SecurePassword123!"
```

### Kubernetes Secrets

Created in `ourchat` namespace:

```yaml
DATABASE_URL: <from OpenTofu output>
JWT_SECRET: <generated>
REFRESH_TOKEN_SECRET: <generated>
INVITE_SECRET: <generated>
```

## Environment Comparison

| Aspect | Local (k3d) | Oracle Cloud |
|--------|-------------|--------------|
| Cluster | k3d in Colima | k3s on ARM VM |
| Registry | k3d-registry.localhost:5000 | `<region>.ocir.io/<tenancy>/ourchat` |
| Database | In-cluster PostgreSQL | Oracle Autonomous DB |
| Domains | `*.localhost` | `*.<LB-IP>.nip.io` |
| TLS | None | Let's Encrypt (cert-manager) |
| Secrets | kubectl create | OpenTofu + kubectl |
| Load Balancer | k3d built-in | OCI Flexible LB |

## OpenTofu Infrastructure

### Network (network.tf)

- VCN with CIDR 10.0.0.0/16
- Public subnet 10.0.1.0/24
- Internet gateway
- Security list (22, 80, 443, 6443 ingress)

### Compute (compute.tf)

- Shape: VM.Standard.A1.Flex
- 4 OCPU, 24GB RAM
- Ubuntu 22.04 ARM image
- Cloud-init for k3s installation

### Database (database.tf)

- Oracle Autonomous Database
- Workload: OLTP (Transaction Processing)
- 1 OCPU, 20GB storage
- Auto-scaling disabled (free tier)

### Load Balancer (loadbalancer.tf)

- Flexible shape, 10 Mbps bandwidth
- HTTP (80) and HTTPS (443) listeners
- Backend set pointing to k3s node

### Container Registry (registry.tf)

- OCIR repositories for frontend/backend images
- Auth token for image push/pull

## Flux GitOps Overlays

### clusters/oracle/

Root Flux configuration pointing to oracle-specific overlays.

### infrastructure/oracle/

- References `../base` (shared ingress, observability)
- NO postgres.yaml (using Oracle Autonomous DB)
- Patches gateway hosts to use nip.io domain

### apps/oracle/

- References `../base/ourchat`
- Patches image repositories to OCIR URLs
- Image automation for OCIR registry
- OCIR pull secret

## Image Registry (OCIR)

**Registry URL**: `<region>.ocir.io/<tenancy-namespace>/ourchat`

**Images**:
- `frontend`
- `backend`

**Multi-arch builds** (ARM):
```bash
docker buildx build --platform linux/arm64 -t <registry>/frontend:tag .
```

## Verification

```bash
# 1. Check infrastructure
./scripts/oracle-lab.sh status

# 2. SSH to VM
./scripts/oracle-lab.sh ssh

# 3. Check k3s
kubectl get nodes

# 4. Check Flux
flux get kustomizations -A

# 5. Check pods
kubectl get pods -n ourchat

# 6. Test endpoints
curl http://ourchat.<IP>.nip.io
curl http://api.ourchat.<IP>.nip.io/health
```

## Notes

- **ARM images**: node:20-alpine and nginx:alpine both support arm64
- **Idle reclamation**: Keep VM active to avoid Oracle reclaiming it (they reclaim instances with <20% utilization over 7 days)
- **Database**: Oracle Autonomous DB is PostgreSQL wire-compatible
- **Cost**: $0 if staying within free tier limits
- **Region**: Resources must be in your home region for Always Free eligibility
