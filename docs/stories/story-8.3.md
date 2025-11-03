# Story 8.3: Renovate Bot for Automated Dependency Updates

Status: TODO

## Story

As a developer,
I want Renovate bot to automatically create pull requests for dependency updates,
so that I can keep the project's npm packages, GitHub Actions, and Docker images up-to-date without manual monitoring.

## Acceptance Criteria

1. **AC1:** Renovate bot is configured to monitor npm dependencies in package.json
2. **AC2:** Renovate automatically creates PRs for dependency updates (patch, minor, major)
3. **AC3:** PRs are grouped intelligently (e.g., all patch updates together, test dependencies separate)
4. **AC4:** Renovate monitors GitHub Actions workflow dependencies for updates
5. **AC5:** PRs include release notes, changelogs, and compatibility information
6. **AC6:** Renovate respects project's package manager (pnpm) and lockfile
7. **AC7:** Renovate runs on a schedule (daily or weekly) to avoid noise
8. **AC8:** Auto-merge is configured for low-risk updates (patch versions with passing CI)

## Tasks / Subtasks

- [ ] Create Renovate configuration file (AC: #1, #3, #7)
  - [ ] Create `renovate.json` in project root
  - [ ] Configure npm package manager detection (pnpm)
  - [ ] Set up dependency dashboard for visibility
  - [ ] Configure schedule (daily for security, weekly for features)
  - [ ] Define grouping rules for related dependencies
  - [ ] Set up semantic commit messages

- [ ] Configure npm dependency updates (AC: #1, #2, #6)
  - [ ] Enable npm manager in Renovate config
  - [ ] Configure version ranges and update strategies
  - [ ] Set up separate rules for devDependencies vs dependencies
  - [ ] Configure pnpm-lock.yaml handling
  - [ ] Define package groups (e.g., @radix-ui/*, @graphql-codegen/*)
  - [ ] Set stability days for major version updates

- [ ] Configure GitHub Actions updates (AC: #4)
  - [ ] Enable github-actions manager
  - [ ] Configure automerge for GitHub Actions (digest updates)
  - [ ] Group GitHub Actions updates by type
  - [ ] Pin action versions with SHA for security
  - [ ] Monitor all workflow files in .github/workflows/

- [ ] Set up automerge rules (AC: #8)
  - [ ] Enable automerge for patch updates with passing CI
  - [ ] Require CI success for all PRs
  - [ ] Configure automerge labels and PR titles
  - [ ] Set up branch protection compatibility
  - [ ] Add exceptions for high-risk packages (skip automerge)

- [ ] Configure PR formatting and metadata (AC: #5)
  - [ ] Enable release notes in PR descriptions
  - [ ] Configure changelog links
  - [ ] Add compatibility checks in PR body
  - [ ] Set up semantic PR titles for consistency
  - [ ] Configure labels for different update types

- [ ] Install and activate Renovate bot (AC: All)
  - [ ] Install Renovate GitHub App to repository
  - [ ] Grant repository access to Renovate
  - [ ] Trigger initial onboarding PR
  - [ ] Review and merge onboarding PR
  - [ ] Verify Renovate dashboard is created

- [ ] Create team documentation (AC: All)
  - [ ] Document Renovate configuration in README or docs/
  - [ ] Explain automerge behavior and when it applies
  - [ ] Provide guidelines for reviewing Renovate PRs
  - [ ] Document how to pause/resume Renovate
  - [ ] Add troubleshooting section for common issues

- [ ] Test Renovate configuration (AC: All)
  - [ ] Verify Renovate creates PR for outdated dependencies
  - [ ] Test grouping rules work as expected
  - [ ] Confirm automerge triggers for patch updates
  - [ ] Verify GitHub Actions are detected and updated
  - [ ] Check PR formatting includes release notes
  - [ ] Validate schedule runs at expected times

## Dev Notes

### Architecture Patterns and Constraints

**Renovate Architecture:**
- Renovate runs as GitHub App (hosted by Mend.io)
- Alternative: Self-hosted via GitHub Actions (renovatebot/github-action)
- Recommended: Use hosted app for zero maintenance
- Configuration file: `renovate.json` in repository root

**Package Manager Integration:**
- Project uses pnpm: Renovate auto-detects via pnpm-lock.yaml
- Lockfile updates: Renovate generates new lockfile in PRs
- Workspace support: Renovate handles monorepo if configured
- Version constraints: Respects package.json ranges (^, ~, etc.)

**Update Strategy:**
- **Patch updates**: Auto-merge if CI passes (low risk)
- **Minor updates**: Manual review required (feature changes)
- **Major updates**: Manual review + testing (breaking changes)
- **Security updates**: High priority, separate PR group

**CI/CD Integration:**
- Renovate PRs trigger full CI pipeline (defined in .github/workflows/ci.yml)
- Automerge requires: all CI checks pass + branch protection rules
- No additional CI configuration needed (uses existing workflows)

**Grouping Strategy:**
- Group all patch updates together (reduce PR noise)
- Group by package ecosystem (@radix-ui, @graphql-codegen)
- Separate devDependencies from production dependencies
- Keep major updates isolated for careful review

**Security Considerations:**
- Renovate has read/write access to repository
- Uses GitHub App permissions (limited scope)
- Automerge only for patch versions (security patches)
- Pin GitHub Actions to SHA for supply chain security

### Project Structure Notes

**Files to create:**
- `renovate.json` - Primary configuration file
- `docs/RENOVATE.md` - Optional team documentation (or add to README)

**Files Renovate will monitor:**
- `package.json` - npm dependencies
- `pnpm-lock.yaml` - lockfile updates
- `.github/workflows/*.yml` - GitHub Actions
- `Dockerfile` - Docker base images (if exists)
- `docker-compose.yml` - Service images (if relevant)

**Renovate-generated artifacts:**
- Dependency Dashboard issue (GitHub Issues)
- Pull requests for updates
- Commit messages following conventional commits

**Configuration file examples:**

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "schedule": ["before 3am on Monday"],
  "packageRules": [
    {
      "matchUpdateTypes": ["patch"],
      "automerge": true
    }
  ]
}
```

**Alternative self-hosted setup:**
If using GitHub Action instead of hosted app:
- Create `.github/workflows/renovate.yml`
- Use `renovatebot/github-action@v2`
- Requires RENOVATE_TOKEN secret

### References

- [Source: Renovate Official Docs - https://docs.renovatebot.com]
- [Source: Renovate GitHub Action - https://github.com/renovatebot/github-action]
- [Source: package.json - Current dependencies]
- [Source: .github/workflows/ - Existing CI workflows]
- [Source: docs/solution-architecture.md#Technology Stack]
- [Source: pnpm workspace configuration (if exists)]

### Dependencies

**Upstream dependencies:**
- GitHub repository with admin access (to install app)
- Existing CI/CD pipeline (.github/workflows/ci.yml)
- Branch protection rules configured (optional but recommended)

**Blocking dependencies:**
- None (standalone story)

**Recommended prerequisites:**
- Story 8.2 (Gitleaks) completed first for security scanning
- CI pipeline stable and reliable

**Related stories:**
- Story 8.2: Gitleaks pre-commit hook
- Epic 8: Security and DevOps improvements (if exists)

## Implementation Notes

### Recommended Renovate Configuration (renovate.json)

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended",
    ":dependencyDashboard",
    ":semanticCommits",
    ":preserveSemverRanges"
  ],
  "schedule": ["before 3am on Monday"],
  "timezone": "America/Los_Angeles",
  "packageRules": [
    {
      "description": "Automerge patch updates if CI passes",
      "matchUpdateTypes": ["patch"],
      "automerge": true,
      "automergeType": "pr",
      "platformAutomerge": true
    },
    {
      "description": "Group all Radix UI updates",
      "groupName": "Radix UI",
      "matchPackagePatterns": ["^@radix-ui/"]
    },
    {
      "description": "Group GraphQL Codegen tools",
      "groupName": "GraphQL Codegen",
      "matchPackagePatterns": ["^@graphql-codegen/"]
    },
    {
      "description": "Group dev dependencies",
      "groupName": "Dev Dependencies",
      "matchDepTypes": ["devDependencies"],
      "matchUpdateTypes": ["patch", "minor"]
    },
    {
      "description": "Separate major updates for careful review",
      "matchUpdateTypes": ["major"],
      "automerge": false,
      "labels": ["dependencies", "major-update"]
    },
    {
      "description": "High priority for security updates",
      "matchUpdateTypes": ["patch"],
      "matchPackagePatterns": ["*"],
      "matchDatasources": ["npm"],
      "semanticCommitType": "fix",
      "semanticCommitScope": "security",
      "labels": ["security", "dependencies"]
    }
  ],
  "npm": {
    "minimumReleaseAge": "3 days"
  },
  "lockFileMaintenance": {
    "enabled": true,
    "schedule": ["before 3am on the first day of the month"]
  },
  "vulnerabilityAlerts": {
    "enabled": true,
    "labels": ["security"],
    "assignees": ["@yoganick"]
  }
}
```

### Installation Steps

1. **Install Renovate GitHub App:**
   - Go to https://github.com/apps/renovate
   - Click "Install" and select repository
   - Grant read/write permissions

2. **Renovate creates onboarding PR:**
   - Reviews detected package files
   - Proposes initial configuration
   - Lists pending updates

3. **Review and merge onboarding PR:**
   - Review proposed renovate.json
   - Adjust configuration if needed
   - Merge to activate Renovate

4. **Monitor Dependency Dashboard:**
   - GitHub issue created by Renovate
   - Shows all pending updates
   - Allows manual triggering of updates

### Alternative: Self-hosted GitHub Action

Create `.github/workflows/renovate.yml`:

```yaml
name: Renovate
on:
  schedule:
    - cron: '0 2 * * 1' # Monday at 2am
  workflow_dispatch:

jobs:
  renovate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Self-hosted Renovate
        uses: renovatebot/github-action@v40
        with:
          configurationFile: renovate.json
          token: ${{ secrets.RENOVATE_TOKEN }}
```

## Definition of Done

- [ ] `renovate.json` configuration file created and committed
- [ ] Renovate GitHub App installed and activated (or self-hosted action configured)
- [ ] Onboarding PR reviewed and merged
- [ ] Dependency Dashboard issue created and accessible
- [ ] At least one automated PR created by Renovate for testing
- [ ] Automerge successfully merges a patch update PR (if available)
- [ ] GitHub Actions updates detected and PR created
- [ ] Team documentation completed and reviewed
- [ ] Team walkthrough conducted demonstrating Renovate workflow
- [ ] No conflicts with existing CI/CD pipeline
