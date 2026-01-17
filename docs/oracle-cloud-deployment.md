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
| Frontend | http://ourchat.138-2-48-165.nip.io |
| Backend API | http://api.ourchat.138-2-48-165.nip.io |
| Health Check | http://api.ourchat.138-2-48-165.nip.io/health |

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
│   ├── network.tf
│   ├── compute.tf
│   ├── loadbalancer.tf
│   └── outputs.tf
├── clusters/oracle/            # Flux cluster config
│   ├── kustomization.yaml
│   ├── sources.yaml            # HelmRepositories (including OCI)
│   ├── infrastructure.yaml
│   └── apps.yaml
├── infrastructure/oracle/      # Infrastructure overlay
│   ├── kustomization.yaml
│   ├── namespaces.yaml
│   ├── postgres.yaml           # In-cluster PostgreSQL
│   └── ingress-patches/
├── apps/oracle/                # Application overlay
│   ├── kustomization.yaml
│   ├── virtual-services.yaml
│   ├── mailhog-patch.yaml      # ARM64 mailpit patch
│   └── image-patches/
│       ├── backend-image.yaml
│       └── frontend-image.yaml
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

### 9. Flux Reconciliation Commands

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

---

## Quick Start

```bash
# 1. Set up SSH tunnel
ssh -f -N -L 6443:localhost:6443 ubuntu@141.147.156.8

# 2. Fetch kubeconfig
ssh ubuntu@141.147.156.8 "sudo cat /etc/rancher/k3s/k3s.yaml" > /tmp/oracle-k3s-kubeconfig
export KUBECONFIG=/tmp/oracle-k3s-kubeconfig

# 3. Verify cluster
kubectl get nodes

# 4. Build and push ARM64 images
docker buildx build --platform linux/arm64 --provenance=false --sbom=false \
  -t ap-osaka-1.ocir.io/axeavx1flryv/ourchat/backend:latest \
  -f apps/backend/Dockerfile --push .

docker buildx build --platform linux/arm64 --provenance=false --sbom=false \
  -t ap-osaka-1.ocir.io/axeavx1flryv/ourchat/frontend:latest \
  -f apps/frontend/Dockerfile --push .

# 5. Push Helm chart
cd charts/generic-service
helm package .
helm push generic-service-*.tgz oci://ap-osaka-1.ocir.io/axeavx1flryv/ourchat/charts

# 6. Create secrets (if not exist)
kubectl create secret docker-registry ocir-secret -n flux-system ...
kubectl create secret docker-registry ocir-secret -n ourchat ...
kubectl create secret generic ourchat-secrets -n ourchat ...

# 7. Trigger Flux reconciliation
kubectl annotate --overwrite -n flux-system gitrepository/flux-system \
  reconcile.fluxcd.io/requestedAt="$(date +%s)"

# 8. Verify
kubectl get pods -n ourchat
curl http://ourchat.138-2-48-165.nip.io
curl http://api.ourchat.138-2-48-165.nip.io/health
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

## Notes

- **ARM images**: node:20-alpine and nginx:alpine support arm64
- **Idle reclamation**: Oracle may reclaim instances with <20% utilization over 7 days
- **Cost**: $0 within free tier limits
- **Region**: ap-osaka-1 (Osaka, Japan)
- **VM IP**: 141.147.156.8
- **LB IP**: 138.2.48.165
