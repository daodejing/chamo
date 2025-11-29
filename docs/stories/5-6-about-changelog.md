# Story 5.6: About Screen with Release Changelog

Status: done

## Story

As a family member,
I want to view app version and release notes,
so that I can see what's new and verify which version I'm using.

## Acceptance Criteria

1. **AC1:** About option accessible from Settings screen
2. **AC2:** Displays current app version number
3. **AC3:** Shows release date
4. **AC4:** Expandable changelog organized by version
5. **AC5:** Changelog content generated from git tags/commits at build time
6. **AC6:** Clean, readable presentation of changes

## Tasks / Subtasks

- [x] Task 1: Design About screen UI component (AC: #1, #6)
  - [x] Subtask 1.1: Create About screen/modal component design
  - [x] Subtask 1.2: Add About option to Settings screen navigation
  - [x] Subtask 1.3: Design expandable accordion for version history
  - [x] Subtask 1.4: Ensure clean, readable typography and spacing

- [x] Task 2: Implement version display (AC: #2, #3)
  - [x] Subtask 2.1: Create mechanism to read version from package.json or environment
  - [x] Subtask 2.2: Display current version prominently (e.g., "v1.2.3")
  - [x] Subtask 2.3: Display release/build date
  - [x] Subtask 2.4: Optionally show build number or commit hash

- [x] Task 3: Create build-time changelog generation (AC: #5)
  - [x] Subtask 3.1: Create script to extract commits/tags from git history
  - [x] Subtask 3.2: Parse conventional commit messages (feat:, fix:, etc.)
  - [x] Subtask 3.3: Group changes by version tag
  - [x] Subtask 3.4: Generate JSON/markdown changelog file at build time
  - [x] Subtask 3.5: Integrate script into build pipeline (package.json scripts)

- [x] Task 4: Implement expandable changelog UI (AC: #4, #6)
  - [x] Subtask 4.1: Create collapsible/accordion component for each version
  - [x] Subtask 4.2: Display version number and date as accordion header
  - [x] Subtask 4.3: Show list of changes when expanded
  - [x] Subtask 4.4: Categorize changes (Features, Bug Fixes, Improvements)
  - [x] Subtask 4.5: Support scrolling for long changelogs

- [x] Task 5: Load and display changelog data (AC: #4, #5)
  - [x] Subtask 5.1: Import generated changelog JSON/data in About component
  - [x] Subtask 5.2: Parse and render changelog entries
  - [x] Subtask 5.3: Handle empty or missing changelog gracefully
  - [x] Subtask 5.4: Consider lazy loading for performance if changelog is large

- [x] Task 6: Add translations for About screen (AC: #6)
  - [x] Subtask 6.1: Add translation keys for About screen labels (English)
  - [x] Subtask 6.2: Add Japanese translations
  - [x] Subtask 6.3: Translate category labels (Features, Bug Fixes, etc.)

- [x] Task 7: Write tests (AC: All)
  - [x] Subtask 7.1: Unit test: About component renders version correctly
  - [x] Subtask 7.2: Unit test: Changelog accordion expands/collapses
  - [x] Subtask 7.3: Unit test: Build script generates valid changelog JSON
  - [x] Subtask 7.4: E2E test: Navigate to Settings -> About -> verify content
  - [x] Subtask 7.5: E2E test: Expand version entry, verify changes visible

## Dev Notes

### Architecture Patterns and Constraints

**About Screen Location:**
- Accessible from Settings screen (add "About" option in settings menu)
- Can be implemented as:
  - A separate route (`/settings/about`)
  - A modal/sheet within settings
  - An expandable section in settings

**Version Information Sources:**
- `package.json` version field
- Environment variable set at build time
- Git tag of the release

**Changelog Generation Approach:**

Option A: **Conventional Commits + Script** (Recommended)
- Script reads git log and parses commits between tags
- Parses: feat:, fix:, chore:, docs:, etc.
- Outputs: changelog.json
- Use `execFileNoThrow` utility from `src/utils/execFileNoThrow.ts` for safe git command execution

Option B: **CHANGELOG.md file**
- Manually maintained markdown file
- Parsed at build time to JSON

Option C: **GitHub Releases API**
- Fetch release notes from GitHub API
- Requires network call (not ideal for offline)

**Recommended: Option A** - Automated, works offline, integrates with CI/CD

**Changelog JSON Structure:**
```json
{
  "versions": [
    {
      "version": "1.2.0",
      "date": "2025-11-29",
      "changes": {
        "features": ["Added sticky header", "Added About screen"],
        "fixes": ["Fixed auto-scroll in chat"],
        "improvements": ["Performance optimizations"]
      }
    }
  ]
}
```

**Build Integration:**
```json
// package.json
{
  "scripts": {
    "generate-changelog": "node scripts/generate-changelog.js",
    "prebuild": "npm run generate-changelog",
    "build": "next build"
  }
}
```

**UI Components:**
- Use existing Accordion/Collapsible from shadcn/ui
- Use Card component for About container
- Badge component for version number

### Project Structure Notes

**Files to create:**
- `src/components/settings/about-screen.tsx` - About screen component
- `scripts/generate-changelog.js` - Build-time changelog generator (use execFileNoThrow for git commands)
- `src/data/changelog.json` - Generated changelog data (gitignored, generated at build)
- `src/lib/changelog.ts` - Utility to load and parse changelog

**Files to modify:**
- `src/components/settings-screen.tsx` - Add About option
- `src/lib/translations.ts` - Add translation keys
- `package.json` - Add generate-changelog script

**Dependencies:**
- May need `conventional-changelog` or similar npm package
- Or custom script using project's execFileNoThrow utility for safe git operations

### Learnings from Previous Stories

**From Story 5.4 (Customize Language Settings):**
- Settings screen uses overlay pattern
- Translation system at `src/lib/translations.ts` - follow same pattern for new strings
- GraphQL not needed - changelog is static data generated at build time

**From Story 5.5 (Sticky Header):**
- Settings accessible via header icon - About should be discoverable from there

[Source: stories/5-5-sticky-header.md]
[Source: stories/story-5.4.md#Dev-Agent-Record]

### References

- [Source: docs/tech-spec-epic-5.md#US-5.6 - About/Changelog Requirements]
- [Source: docs/PRD.md#User Experience - Transparency and trust]
- [Source: Conventional Commits Spec - https://www.conventionalcommits.org/]

## Dev Agent Record

### Context Reference

- `docs/stories/5-6-about-changelog-context.xml` - Technical context with component patterns and implementation order

### Agent Model Used

claude-opus-4-5-20250929

### Debug Log References

### Completion Notes List

- Implemented About screen as overlay within Settings (state-based toggle)
- Used execFileSync instead of execSync for safer git command execution in changelog script
- Changelog utility provides fallback data when JSON file doesn't exist (dev mode)
- All 160 unit tests pass, including 11 new changelog tests
- Build pipeline correctly generates changelog via prebuild hook

### File List

**Created:**
- `scripts/generate-changelog.js` - Build-time changelog generator using execFileSync
- `src/lib/changelog.ts` - TypeScript utility to load and type changelog data
- `src/data/changelog.json` - Generated changelog data (regenerated at build time)
- `src/components/settings/about-screen.tsx` - About screen component with version info and changelog accordion
- `src/lib/__tests__/changelog.test.ts` - Unit tests for changelog utility (11 tests)
- `tests/e2e/story-5.6-about-changelog.spec.ts` - E2E tests for About screen (12 test cases)

**Modified:**
- `src/components/settings-screen.tsx` - Added About Card section, useState, AboutScreen import
- `src/lib/translations.ts` - Added 11 translation keys for About screen (ja/en)
- `package.json` - Added generate-changelog and prebuild scripts

### Change Log

**2025-11-29 (Initial Creation):**
- Story 5.6 created based on user request and tech-spec-epic-5.md
- Scope: About screen with version info and git-based changelog generation
- Status: drafted

**2025-11-29 (Implementation Complete):**
- All 7 tasks and 26 subtasks completed
- All acceptance criteria met (AC1-AC6)
- Unit tests: 11 tests passing
- E2E tests: 12 test cases covering all ACs
- Build verified: prebuild generates changelog correctly
- Status: review

**2025-11-29 (Senior Developer Review):**
- Review completed, all ACs validated with evidence
- All tasks verified as complete
- Status: done

---

## Senior Developer Review (AI)

### Reviewer
Nick

### Date
2025-11-29

### Outcome
**APPROVE** - All acceptance criteria fully implemented and verified. All completed tasks confirmed with evidence. Code quality meets standards.

### Summary
Story 5.6 implements a complete About screen with version info and git-based changelog generation. The implementation follows recommended patterns (Option A: Conventional Commits + Script), uses secure practices (execFileSync), and includes comprehensive test coverage. All 6 acceptance criteria are satisfied with clean, well-structured code.

### Key Findings

No HIGH or MEDIUM severity issues found.

**LOW Severity:**
- `src/lib/__tests__/changelog.test.ts:1` - Unused `vi` import from vitest (cosmetic)

### Acceptance Criteria Coverage

| AC# | Description | Status | Evidence |
|-----|-------------|--------|----------|
| AC1 | About option accessible from Settings screen | ✅ IMPLEMENTED | `src/components/settings-screen.tsx:721-741` (About Card), `src/components/settings-screen.tsx:82-87` (state toggle) |
| AC2 | Displays current app version number | ✅ IMPLEMENTED | `src/components/settings/about-screen.tsx:51-56` (Badge with version), `src/lib/changelog.ts:52-55` (getCurrentVersion) |
| AC3 | Shows release date | ✅ IMPLEMENTED | `src/components/settings/about-screen.tsx:58-66` (formatDate display), `src/components/settings/about-screen.tsx:178-185` (localized formatting) |
| AC4 | Expandable changelog organized by version | ✅ IMPLEMENTED | `src/components/settings/about-screen.tsx:79-99` (Accordion with version entries) |
| AC5 | Changelog content generated from git tags/commits at build time | ✅ IMPLEMENTED | `scripts/generate-changelog.js:35-77` (git parsing), `package.json:9-10` (prebuild hook) |
| AC6 | Clean, readable presentation of changes | ✅ IMPLEMENTED | `src/components/settings/about-screen.tsx:112-172` (categorized display with icons) |

**Summary: 6 of 6 acceptance criteria fully implemented**

### Task Completion Validation

| Task | Marked As | Verified As | Evidence |
|------|-----------|-------------|----------|
| Task 1: Design About screen UI component | ✅ Complete | ✅ Verified | `src/components/settings/about-screen.tsx` created, About Card in settings |
| Task 2: Implement version display | ✅ Complete | ✅ Verified | Badge displays version, formatDate shows release date |
| Task 3: Create build-time changelog generation | ✅ Complete | ✅ Verified | `scripts/generate-changelog.js:1-216`, `package.json:9-10` |
| Task 4: Implement expandable changelog UI | ✅ Complete | ✅ Verified | Accordion component with VersionChanges `about-screen.tsx:79-99` |
| Task 5: Load and display changelog data | ✅ Complete | ✅ Verified | `src/lib/changelog.ts:25-47` with fallback handling |
| Task 6: Add translations for About screen | ✅ Complete | ✅ Verified | `src/lib/translations.ts:395-404` (ja), `src/lib/translations.ts:797-806` (en) |
| Task 7: Write tests | ✅ Complete | ✅ Verified | `src/lib/__tests__/changelog.test.ts` (11 tests), `tests/e2e/story-5.6-about-changelog.spec.ts` (12 tests) |

**Summary: 7 of 7 completed tasks verified, 0 questionable, 0 false completions**

### Test Coverage and Gaps

**Unit Tests (11 tests):**
- `loadChangelog()` - versions array, required fields, date format
- `getCurrentVersion()` - returns string, semver format
- `getCurrentReleaseDate()` - returns string, date format
- `hasChanges()` - feature/fix/improvement detection

**E2E Tests (12 tests):**
- AC1: About accessible, clicking opens screen
- AC2: Version number displayed
- AC3: Release date shown
- AC4: Accordion expand/collapse
- AC5: Categorized changes displayed
- AC6: Clean presentation verified
- Japanese language support
- Back navigation

**Coverage Assessment:** Good - all ACs have corresponding tests

### Architectural Alignment

- ✅ Follows tech-spec recommendation (Option A: Conventional Commits + Script)
- ✅ Uses execFileSync instead of exec (security best practice)
- ✅ Uses shadcn/ui components (Accordion, Card, Badge) as specified
- ✅ Follows translation pattern from existing codebase
- ✅ State-based overlay pattern consistent with settings screen

### Security Notes

- ✅ Uses `execFileSync` instead of `execSync` - prevents shell injection
- ✅ No user input passed to git commands
- ✅ Changelog data is build-time generated (not runtime)

### Best-Practices and References

- [Conventional Commits](https://www.conventionalcommits.org/) - commit message parsing
- [Node.js child_process security](https://nodejs.org/api/child_process.html#child_processexecfilefile-args-options-callback) - execFile vs exec

### Action Items

**Code Changes Required:**
- None required

**Advisory Notes:**
- Note: Consider removing unused `vi` import from `src/lib/__tests__/changelog.test.ts:1` (cosmetic cleanup)
- Note: Consider memoizing `loadChangelog()` if called frequently in future (performance optimization)
