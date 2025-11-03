# Story 8.2: Gitleaks Pre-commit Secret Scanning

Status: TODO

## Story

As a developer,
I want Gitleaks to scan my commits for secrets before they are committed,
so that I can prevent accidentally committing sensitive credentials to the repository.

## Acceptance Criteria

1. **AC1:** Gitleaks is integrated with existing Husky pre-commit hook
2. **AC2:** Every git commit triggers Gitleaks scan before commit completes
3. **AC3:** Commit is blocked if secrets/credentials are detected
4. **AC4:** Clear error message displays when secrets are found, showing file and line number
5. **AC5:** Developers can bypass hook with `SKIP=gitleaks git commit` for false positives (requires justification)
6. **AC6:** Gitleaks configuration file exists with project-specific rules and allowlisting
7. **AC7:** CI pipeline includes Gitleaks scan for additional protection

## Tasks / Subtasks

- [ ] Install Gitleaks as dev dependency (AC: #1)
  - [ ] Add Gitleaks to package.json devDependencies
  - [ ] Document Gitleaks version in package.json (latest stable v8.x)
  - [ ] Update pnpm-lock.yaml

- [ ] Create Gitleaks configuration file (AC: #6)
  - [ ] Create `.gitleaks.toml` in project root
  - [ ] Configure allowlist for known false positives (test fixtures, docs)
  - [ ] Set up custom rules for project-specific patterns
  - [ ] Configure entropy thresholds for generic secret detection
  - [ ] Add comments explaining each configuration section

- [ ] Integrate with Husky pre-commit hook (AC: #1, #2, #3)
  - [ ] Update `.husky/pre-commit` to run Gitleaks before lint
  - [ ] Configure Gitleaks to scan staged files only (`--staged` flag)
  - [ ] Ensure hook fails fast if secrets detected
  - [ ] Test hook with sample secret to verify blocking behavior
  - [ ] Verify existing lint checks still run after Gitleaks

- [ ] Add Gitleaks to CI pipeline (AC: #7)
  - [ ] Add Gitleaks scan step to `.github/workflows/ci.yml`
  - [ ] Run Gitleaks on full repository history for first scan
  - [ ] Configure CI to fail build if secrets detected
  - [ ] Add job to lint-and-typecheck workflow for fast feedback
  - [ ] Set up artifacts upload for Gitleaks reports

- [ ] Create developer documentation (AC: #4, #5)
  - [ ] Document Gitleaks setup in project README or CONTRIBUTING.md
  - [ ] Explain how to handle false positives (allowlist + SKIP)
  - [ ] Provide examples of common secret patterns detected
  - [ ] Document bypass procedure and when it's acceptable
  - [ ] Add troubleshooting section for common issues

- [ ] Write tests for Gitleaks integration (AC: All)
  - [ ] Test pre-commit hook blocks commits with secrets
  - [ ] Test allowlist excludes known false positives
  - [ ] Test SKIP bypass mechanism works
  - [ ] Test CI pipeline fails with secrets present
  - [ ] Verify hook doesn't break on binary files

## Dev Notes

### Architecture Patterns and Constraints

**Pre-commit Hook Integration:**
- Gitleaks runs before ESLint to fail fast on security issues
- Hook execution order: Gitleaks → ESLint → Type check (if applicable)
- Exit code 1 from Gitleaks blocks commit immediately
- Husky manages hook lifecycle, Gitleaks is a hook dependency

**Configuration Strategy:**
- `.gitleaks.toml` is the single source of truth for rules
- Allowlist patterns use regex for flexibility
- Project uses Gitleaks v8.x (latest stable as of 2025)
- Configuration version-controlled for team consistency

**CI/CD Integration:**
- Gitleaks runs in `lint-and-typecheck` job for fast feedback
- Separate from test jobs to maintain job isolation
- Uses official Gitleaks GitHub Action for optimal caching
- Reports uploaded as artifacts for audit trail

**Performance Considerations:**
- Pre-commit hook scans only staged files (`--staged`)
- CI scans full repo but caches Gitleaks binary
- Typical scan time: <5 seconds for pre-commit, <30 seconds for CI
- No impact on existing development workflow speed

**Security Design:**
- Defense in depth: pre-commit + CI both scan
- Pre-commit hook is primary defense (blocks at source)
- CI acts as safety net for bypassed hooks
- No secrets stored in Gitleaks config itself

### Project Structure Notes

**Files to create/modify:**
- `.gitleaks.toml` - Gitleaks configuration
- `.husky/pre-commit` - Update to include Gitleaks
- `.github/workflows/ci.yml` - Add Gitleaks scan step
- `README.md` or `docs/CONTRIBUTING.md` - Developer documentation
- `package.json` - Add Gitleaks devDependency (optional, if using npm install method)

**Alternative installation methods:**
1. **Pre-commit framework** (recommended): Uses `.pre-commit-config.yaml`
2. **npm package**: Add `gitleaks` to devDependencies
3. **System binary**: Installed via brew/apt (documented for team)
4. **GitHub Action**: Uses `gitleaks/gitleaks-action` in CI

Recommended approach: Pre-commit framework for consistency with Python/multi-language repos, or Husky integration for pure Node.js projects.

**Configuration file location:**
- `.gitleaks.toml` in project root
- Alternative: `.gitleaks.yml` or `gitleaks.toml` (Gitleaks auto-detects)

**Testing strategy:**
- Unit tests: Not applicable (third-party tool)
- Integration tests: Verify hook behavior in local git environment
- E2E tests: CI workflow tests with sample secrets in test branch

### References

- [Source: Gitleaks Official Docs - https://github.com/gitleaks/gitleaks]
- [Source: Pre-commit Framework - https://pre-commit.com]
- [Source: Husky Documentation - https://typicode.github.io/husky]
- [Source: docs/solution-architecture.md#Security Standards]
- [Source: .github/workflows/ci.yml - Existing CI pipeline]
- [Source: .husky/pre-commit - Current hook configuration]

### Dependencies

**Upstream dependencies:**
- Husky is already installed and configured
- Git repository with commit history
- pnpm package manager

**Blocking dependencies:**
- None (standalone story)

**Related stories:**
- Story 8.3: Renovate bot for dependency updates
- Epic 8: Security and DevOps improvements (if exists)

## Implementation Notes

### Recommended Gitleaks Config (.gitleaks.toml)

```toml
title = "OurChat Gitleaks Configuration"

[allowlist]
description = "Known false positives and test fixtures"
paths = [
  '''tests/fixtures/.*''',
  '''docs/examples/.*''',
  '''.*\.test\.(ts|js)''',
]

regexes = [
  '''test-secret-key''',
  '''example\.com''',
]

[[rules]]
id = "generic-api-key"
description = "Generic API Key"
regex = '''(?i)(api[_-]?key|apikey)['"[:space:]]*[:=]['"[:space:]]*[a-zA-Z0-9]{20,}'''
entropy = 3.5

[[rules]]
id = "aws-access-key"
description = "AWS Access Key"
regex = '''AKIA[0-9A-Z]{16}'''

[[rules]]
id = "private-key"
description = "Private Key"
regex = '''-----BEGIN (RSA|OPENSSH|DSA|EC|PGP) PRIVATE KEY-----'''
```

### Husky Pre-commit Hook Update

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run Gitleaks first (fail fast on secrets)
pnpm exec gitleaks protect --staged --verbose

# Then run lint
pnpm lint
```

### CI Workflow Integration

Add to `.github/workflows/ci.yml` in the `lint-and-typecheck` job:

```yaml
- name: Scan for secrets with Gitleaks
  uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }} # Optional for enterprise
```

## Definition of Done

- [ ] Gitleaks configuration file created and committed
- [ ] Pre-commit hook successfully blocks commits with test secrets
- [ ] CI pipeline includes Gitleaks scan and fails on secret detection
- [ ] Developer documentation updated with bypass procedures
- [ ] Team walkthrough completed demonstrating hook behavior
- [ ] All existing tests pass with new hook in place
- [ ] No false positives reported during initial team testing period
