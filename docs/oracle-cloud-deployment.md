# Oracle Cloud Free Tier Deployment

Deploy OurChat to Oracle Cloud's Always Free tier as a staging environment, complementing the existing local k3d development setup.

## Architecture

- **Compute**: k3s on ARM VM (4 OCPU, 24GB RAM)
- **Database**: In-cluster PostgreSQL (Oracle ADB not compatible with Prisma)
- **Registry**: Oracle Container Image Registry (OCIR)
- **Load Balancer**: Flexible Load Balancer (10 Mbps)
- **DNS**: nip.io (no domain required)
- **IaC**: OpenTofu for infrastructure provisioning
- **GitOps**: Flux CD (same pattern as local)

## Live URLs (Current Deployment)

| Service | URL |
|---------|-----|
| Frontend | https://ourchat.138-2-48-165.nip.io |
| Backend API | https://api.ourchat.138-2-48-165.nip.io |
| Health Check | https://api.ourchat.138-2-48-165.nip.io/health |

> **TLS**: Valid Let's Encrypt certificate auto-renewed by cert-manager.

## Oracle Cloud Free Tier Resources

| Resource | Specification | Purpose |
|----------|--------------|---------|
| ARM VM (A1.Flex) | 4 OCPU, 24GB RAM | k3s cluster |
| Block Storage | ~100GB (from 200GB quota) | Boot + data volumes |
| Load Balancer | Flexible 10 Mbps | Ingress |
| OCIR | Unlimited | Container images |

> **Note**: Oracle Autonomous DB is NOT used due to Prisma incompatibility. We use in-cluster PostgreSQL instead.

## Directory Structure

```
ourchat/
├── terraform/oracle/           # Infrastructure as code
│   ├── main.tf
│   ├── variables.tf
│   ├── network.tf              # Security lists (IP restrictions)
│   ├── compute.tf
│   ├── loadbalancer.tf
│   └── outputs.tf
├── scripts/
│   ├── oracle-lab.sh           # Deployment automation (build-push, etc.)
│   └── oracle-k8s-connect.sh   # SSH tunnel & kubeconfig management
├── docker/frontend/
│   ├── Dockerfile
│   ├── .env.local              # Build args for local k3d
│   └── .env.oracle             # Build args for Oracle Cloud
├── clusters/oracle/            # Flux cluster config
│   ├── kustomization.yaml
│   ├── sources.yaml            # HelmRepositories (including OCI)
│   ├── infrastructure.yaml
│   └── apps.yaml               # SOPS decryption config
├── infrastructure/oracle/      # Infrastructure overlay
│   ├── kustomization.yaml
│   ├── namespaces.yaml
│   ├── postgres.yaml           # In-cluster PostgreSQL
│   ├── gateway-service.yaml    # Fixed NodePorts for LB
│   ├── cert-manager.yaml       # TLS Gateway + Certificate
│   └── httproutes.yaml         # Frontend/Backend routes
├── apps/oracle/                # Application overlay
│   ├── kustomization.yaml
│   ├── mailhog-patch.yaml      # Disabled (using real SMTP)
│   ├── image-patches/
│   │   ├── backend-image.yaml
│   │   └── frontend-image.yaml
│   └── secrets/
│       └── ourchat-secrets.yaml  # SOPS encrypted
└── charts/generic-service/     # Helm chart (pushed to OCIR)
```

## Prerequisites

1. **Oracle Cloud account** with Always Free tier
2. **OCI CLI configured** (`~/.oci/config`)
3. **OpenTofu installed** (`brew install opentofu`)
4. **SSH key pair** for VM access
5. **Docker with ARM64 support** (Colima on macOS)
6. **OCIR auth token** generated from OCI Console

---

## Deployment Knowledge Base

### 1. ARM64 Architecture (Critical)

The Oracle Free Tier VM uses **ARM64 (aarch64)** architecture. This affects all container images.

**Building ARM64 images with Colima:**
```bash
# Ensure Colima is running with ARM support
colima start --arch aarch64

# Build ARM64 images
docker buildx build --platform linux/arm64 \
  --provenance=false --sbom=false \
  -t ap-osaka-1.ocir.io/<namespace>/ourchat/backend:latest \
  -f apps/backend/Dockerfile \
  --push .
```

> **Important**: Use `--provenance=false --sbom=false` to avoid 409 Conflict errors on OCIR.

**MailHog ARM64 Issue:**
The standard `mailhog/mailhog` image doesn't support ARM64.

**Solution**: Use `axllent/mailpit` (drop-in replacement):
```yaml
# apps/oracle/mailhog-patch.yaml
spec:
  template:
    spec:
      containers:
        - name: mailhog
          image: axllent/mailpit:latest
```

### 2. OCIR Authentication

OCIR requires specific username format:

```
Server: <region>.ocir.io
Username: <tenancy-namespace>/<username>
Password: <auth-token-from-oci-console>
```

**Username format varies:**
- Regular OCI: `<namespace>/<email>`
- Federated (IDCS): `<namespace>/oracleidentitycloudservice/<email>`

**Check your working Docker credentials:**
```bash
echo "<region>.ocir.io" | docker-credential-osxkeychain get
```

**Create Kubernetes secrets in BOTH namespaces:**
```bash
# For Flux (to pull Helm charts)
kubectl create secret docker-registry ocir-secret \
  --namespace=flux-system \
  --docker-server=ap-osaka-1.ocir.io \
  --docker-username='<namespace>/<user>' \
  --docker-password='<auth-token>' \
  --docker-email='<email>'

# For pods (to pull container images)
kubectl create secret docker-registry ocir-secret \
  --namespace=ourchat \
  --docker-server=ap-osaka-1.ocir.io \
  --docker-username='<namespace>/<user>' \
  --docker-password='<auth-token>' \
  --docker-email='<email>'
```

### 3. Flux OCI HelmRepository

For Helm charts stored in OCI registries:

```yaml
# clusters/oracle/sources.yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: HelmRepository
metadata:
  name: platform-charts
  namespace: flux-system
spec:
  type: oci              # CRITICAL: must specify type: oci
  interval: 10m
  url: oci://ap-osaka-1.ocir.io/<namespace>/ourchat/charts
  secretRef:
    name: ocir-secret    # Required for private registries
```

**Pushing Helm charts to OCIR:**
```bash
cd charts/generic-service
helm package .
helm push generic-service-0.1.1.tgz oci://ap-osaka-1.ocir.io/<namespace>/ourchat/charts
```

### 4. Generic Service Chart - imagePullSecrets

The chart needs `imagePullSecrets` support in the deployment template:

```yaml
# charts/generic-service/templates/deployment.yaml
spec:
  {{- with .Values.imagePullSecrets }}
  imagePullSecrets:
    {{- toYaml . | nindent 8 }}
  {{- end }}
  containers:
    ...
```

Usage in HelmRelease values:
```yaml
values:
  imagePullSecrets:
    - name: ocir-secret
```

### 5. Oracle Autonomous Database - NOT Compatible

Oracle ADB uses Oracle-native connection format, **not** PostgreSQL wire protocol. Prisma cannot connect.

**Solution**: Deploy in-cluster PostgreSQL:
```yaml
# infrastructure/oracle/postgres.yaml
# Copy from infrastructure/base or local setup
```

### 6. Required Environment Variables

The backend **will crash** without these:

| Variable | Requirement | How to Generate |
|----------|-------------|-----------------|
| `CORS_ALLOWED_ORIGINS` | Comma-separated origins | Manual |
| `EMAIL_VERIFICATION_URL` | Full URL | Manual |
| `INVITE_SECRET` | **Exactly 64 hex characters** | `openssl rand -hex 32` |
| `JWT_SECRET` | 32+ bytes | `openssl rand -hex 32` |
| `REFRESH_TOKEN_SECRET` | 32+ bytes | `openssl rand -hex 32` |
| `DATABASE_URL` | PostgreSQL URL | `postgresql://postgres:dev@postgres:5432/ourchat` |
| `SMTP_HOST` | SMTP server | `ourchat-mailhog` (for staging) |
| `SMTP_PORT` | SMTP port | `1025` (for mailpit) |

> **Critical**: `INVITE_SECRET` validation requires **exactly 64 characters**. Using `openssl rand -base64 32` produces 44 characters and will fail.

**Creating the secret:**
```bash
kubectl create secret generic ourchat-secrets \
  --namespace=ourchat \
  --from-literal=DATABASE_URL="postgresql://postgres:dev@postgres:5432/ourchat?schema=public" \
  --from-literal=JWT_SECRET="$(openssl rand -hex 32)" \
  --from-literal=REFRESH_TOKEN_SECRET="$(openssl rand -hex 32)" \
  --from-literal=INVITE_SECRET="$(openssl rand -hex 32)"
```

### 7. Istio VirtualService - No Wildcards

Istio **rejects** wildcards like `*.nip.io` or `ourchat.*.nip.io`.

**Error:**
```
domain name "ourchat.*.nip.io" invalid (label "*" invalid)
```

**Solution**: Use the actual IP-based domain:
```yaml
# apps/oracle/virtual-services.yaml
spec:
  hosts:
    - "ourchat.138-2-48-165.nip.io"  # Actual domain, not wildcard
```

### 8. k3s API Access via SSH Tunnel

k3s API (port 6443) is not exposed. Use SSH tunnel:

```bash
# Create SSH tunnel
ssh -f -N -L 6443:localhost:6443 ubuntu@<vm-ip>

# Fetch kubeconfig (keep localhost:6443)
ssh ubuntu@<vm-ip> "sudo cat /etc/rancher/k3s/k3s.yaml" > /tmp/oracle-k3s-kubeconfig

# Use it
export KUBECONFIG=/tmp/oracle-k3s-kubeconfig
kubectl get pods -A
```

### 9. TLS with Let's Encrypt (Kubernetes Gateway API)

The Oracle deployment uses Kubernetes Gateway API with Istio for ingress, with TLS certificates from Let's Encrypt.

**Architecture:**
```
Oracle LB (138.2.48.165)
  ├── Port 80  → NodePort 30080 → ourchat-gateway → HTTPRoutes
  └── Port 443 → NodePort 30443 → ourchat-gateway (TLS termination) → HTTPRoutes
```

**Key files:**
- `infrastructure/oracle/gateway-service.yaml` - Service with fixed NodePorts (30080/30443)
- `infrastructure/oracle/cert-manager.yaml` - Gateway, ClusterIssuers, Certificate
- `infrastructure/oracle/httproutes.yaml` - HTTPRoutes for frontend/backend

**Certificate renewal is automatic** via cert-manager and HTTP-01 challenges.

**Why Kubernetes Gateway API instead of Istio Gateway?**
- cert-manager's HTTP-01 solver supports `gatewayHTTPRoute` but not Istio-specific Gateway
- Kubernetes Gateway API is the standard, Istio implements it via `gatewayClassName: istio`

### 10. Frontend Build Configuration (Critical)

**The Problem**: Next.js `NEXT_PUBLIC_*` environment variables are baked at **build time**, not runtime. This means the frontend Docker image must be built with the correct API URLs for each environment.

**Build configuration files:**
```
docker/frontend/
├── .env.local    # For local k3d builds (http://api.ourchat.localhost)
└── .env.oracle   # For Oracle Cloud builds (https://api.ourchat.138-2-48-165.nip.io)
```

**Environment file format:**
```bash
# docker/frontend/.env.oracle
NEXT_PUBLIC_GRAPHQL_HTTP_URL=https://api.ourchat.138-2-48-165.nip.io/graphql
NEXT_PUBLIC_GRAPHQL_WS_URL=wss://api.ourchat.138-2-48-165.nip.io/graphql
```

**Building with the correct environment:**

For Oracle Cloud:
```bash
./scripts/oracle-lab.sh build-push
# Automatically reads from docker/frontend/.env.oracle
```

For Local k3d:
```bash
./scripts/local-lab.sh build
# Automatically reads from docker/frontend/.env.local
```

**Manual build with build args:**
```bash
docker buildx build --platform linux/arm64 \
  -f docker/frontend/Dockerfile \
  --build-arg "NEXT_PUBLIC_GRAPHQL_HTTP_URL=https://api.ourchat.138-2-48-165.nip.io/graphql" \
  --build-arg "NEXT_PUBLIC_GRAPHQL_WS_URL=wss://api.ourchat.138-2-48-165.nip.io/graphql" \
  -t ap-osaka-1.ocir.io/axeavx1flryv/ourchat/frontend:latest \
  --push .
```

**Common mistake**: Building frontend without specifying build args uses Dockerfile defaults (localhost URLs), causing CORS errors when deployed.

### 11. Flux Reconciliation Commands

**Force reconciliation after git push:**
```bash
# Trigger git fetch
kubectl annotate --overwrite -n flux-system gitrepository/flux-system \
  reconcile.fluxcd.io/requestedAt="$(date +%s)"

# Trigger kustomization
kubectl annotate --overwrite -n flux-system kustomization/apps \
  reconcile.fluxcd.io/requestedAt="$(date +%s)"
```

**When HelmRelease is stuck with old config:**
```bash
kubectl delete helmrelease <name> -n flux-system
# Then trigger kustomization reconciliation
```

**Restart source-controller after secret changes:**
```bash
kubectl rollout restart deployment source-controller -n flux-system
```

---

## Debugging Commands

```bash
# Check Flux status
kubectl get kustomization -n flux-system
kubectl get helmreleases -n flux-system
kubectl get helmrepository -n flux-system

# Check HelmRepository (especially for OCI auth issues)
kubectl describe helmrepository platform-charts -n flux-system

# Controller logs
kubectl logs -n flux-system deploy/source-controller --tail=50
kubectl logs -n flux-system deploy/kustomize-controller --tail=50
kubectl logs -n flux-system deploy/helm-controller --tail=50

# Pod issues
kubectl get pods -n ourchat
kubectl describe pod -n ourchat <pod-name>
kubectl logs -n ourchat <pod-name> -c <container-name>
```

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| `exec format error` | Wrong architecture image | Rebuild for `linux/arm64` |
| `403 Forbidden` on image pull | Wrong username format or expired token | Check credentials, regenerate token |
| `401 Unauthorized` on chart pull | Missing secretRef in HelmRepository | Add `secretRef` pointing to docker-registry secret |
| `ImagePullBackOff` | Missing imagePullSecrets in pod spec | Add to Helm chart template and values |
| VirtualService validation error | Wildcard in host | Use actual IP-based domain |
| Backend crash: INVITE_SECRET | Not 64 characters | Use `openssl rand -hex 32` (not base64) |
| Backend crash: missing env var | Incomplete config | Check all required env vars |
| HelmRelease not updating | Cached config | Delete HelmRelease, trigger reconciliation |
| `409 Conflict` on docker push | Attestation manifest | Use `--provenance=false --sbom=false` |
| CORS errors in browser | Frontend built with wrong API URLs | Rebuild with `./scripts/oracle-lab.sh build-push` |
| Mixed content blocking | Frontend using http:// on https:// site | Update `docker/frontend/.env.oracle` to use https:// |

---

## Quick Start

```bash
# 1. Connect to Oracle cluster (creates tunnel, sets up kubeconfig)
./scripts/oracle-k8s-connect.sh

# 2. Verify cluster
kubectl get nodes

# 3. Build and push ARM64 images (reads from docker/frontend/.env.oracle)
./scripts/oracle-lab.sh build-push

# 4. Push Helm chart (if updated)
cd charts/generic-service
helm package .
helm push generic-service-*.tgz oci://ap-osaka-1.ocir.io/axeavx1flryv/ourchat/charts

# 5. Create secrets (if not exist)
kubectl create secret docker-registry ocir-secret -n flux-system ...
kubectl create secret docker-registry ocir-secret -n ourchat ...
kubectl create secret generic ourchat-secrets -n ourchat ...

# 6. Trigger Flux reconciliation
kubectl annotate --overwrite -n flux-system gitrepository/flux-system \
  reconcile.fluxcd.io/requestedAt="$(date +%s)"

# 7. Verify
kubectl get pods -n ourchat
curl https://ourchat.138-2-48-165.nip.io
curl https://api.ourchat.138-2-48-165.nip.io/health
```

### Connection Script Commands

```bash
./scripts/oracle-k8s-connect.sh          # Connect (default)
./scripts/oracle-k8s-connect.sh status   # Check connection status
./scripts/oracle-k8s-connect.sh disconnect  # Close SSH tunnel
./scripts/oracle-k8s-connect.sh refresh  # Refresh kubeconfig

# Switch between contexts (works with k9s, Lens, etc.)
kubectl config use-context oracle-ourchat     # Oracle
kubectl config use-context k3d-ourchat-local  # Local
```

---

## Environment Comparison

| Aspect | Local (k3d) | Oracle Cloud |
|--------|-------------|--------------|
| Cluster | k3d in Colima | k3s on ARM VM |
| Architecture | x86_64 or ARM64 | ARM64 only |
| Registry | k3d-registry.localhost:5000 | ap-osaka-1.ocir.io/axeavx1flryv/ourchat |
| Database | In-cluster PostgreSQL | In-cluster PostgreSQL |
| Domains | `*.localhost` | `*.<LB-IP>.nip.io` |
| Email | MailHog | Mailpit (ARM64) |
| Load Balancer | k3d built-in | OCI Flexible LB |

---

## Security

### Built-in OCI Protections (Free Tier)

| Protection | Description | Status |
|------------|-------------|--------|
| Infrastructure DDoS | Layer 3/4 DDoS mitigation at network edge | ✅ Automatic |
| Security Lists | Stateful firewall rules | ✅ Configured |
| VCN Flow Logs | Network traffic logging | ✅ Available |
| Cloud Guard | Threat detection & monitoring | ✅ Free tier included |

### IP Restrictions

SSH and Kubernetes API access are restricted to admin IPs via OCI Security Lists.

**Current configuration** (`terraform/oracle/variables.tf`):
```hcl
variable "admin_cidr_blocks" {
  default = ["131.147.163.106/32"]  # Your IP
}
```

| Port | Access |
|------|--------|
| SSH (22) | Admin IPs only |
| k8s API (6443) | Admin IPs only |
| HTTP (80) | Public |
| HTTPS (443) | Public |

**To update allowed IPs** (e.g., when your IP changes):
```bash
cd terraform/oracle

# Option 1: Update variables.tf default
# Option 2: Override via command line
tofu apply -var='admin_cidr_blocks=["NEW.IP.ADDRESS/32"]'
```

**To find your current IP:**
```bash
curl -4 ifconfig.me
```

### Application-Level Protection

- **Backend rate limiting**: NestJS ThrottlerModule (100 req/min default)
- **Istio sidecar**: All traffic goes through Envoy proxy

### Recommendations

1. **Keep your IP updated** in terraform when it changes
2. **Enable Cloud Guard** via OCI Console for threat monitoring
3. **Consider fail2ban** on the VM for additional SSH protection:
   ```bash
   ssh ubuntu@141.147.156.8 "sudo apt install fail2ban -y && sudo systemctl enable fail2ban"
   ```

---

## Notes

- **ARM images**: node:20-alpine and nginx:alpine support arm64
- **Idle reclamation**: Oracle may reclaim instances with <20% utilization over 7 days
- **Cost**: $0 within free tier limits
- **Region**: ap-osaka-1 (Osaka, Japan)
- **VM IP**: 141.147.156.8
- **LB IP**: 138.2.48.165
