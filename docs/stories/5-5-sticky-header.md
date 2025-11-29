# Story 5.5: Sticky Header Bar

Status: Done

## Story

As a family member,
I want the header bar to stay fixed at the top,
so that I can always access navigation icons while scrolling through content.

## Acceptance Criteria

1. **AC1:** Header (family name + action icons) remains fixed/pinned at top of screen
2. **AC2:** Content scrolls beneath the header without overlap
3. **AC3:** Works on all scrollable screens (chat, settings, etc.)
4. **AC4:** No visual glitches or z-index issues
5. **AC5:** Responsive across all screen sizes

## Tasks / Subtasks

- [x] Task 1: Analyze current header implementation (AC: #1, #3)
  - [x] Subtask 1.1: Review chat-screen.tsx header structure
  - [x] Subtask 1.2: Identify all screens with scrollable content that use the header
  - [x] Subtask 1.3: Document current CSS/layout approach for each screen

- [x] Task 2: Implement sticky header in chat screen (AC: #1, #2, #4)
  - [x] Subtask 2.1: Apply `position: sticky` or `position: fixed` to header container
  - [x] Subtask 2.2: Set appropriate `top: 0` and `z-index` values
  - [x] Subtask 2.3: Add padding/margin to content area to prevent overlap with fixed header
  - [x] Subtask 2.4: Test scroll behavior - header stays, content scrolls beneath

- [x] Task 3: Apply sticky header pattern to other scrollable screens (AC: #3)
  - [x] Subtask 3.1: Update settings screen if applicable
  - [x] Subtask 3.2: Update photo gallery if applicable
  - [x] Subtask 3.3: Update calendar view if applicable
  - [x] Subtask 3.4: Ensure consistent header behavior across all screens

- [x] Task 4: Fix z-index and visual layering issues (AC: #4)
  - [x] Subtask 4.1: Ensure header stays above all content during scroll
  - [x] Subtask 4.2: Test with modals, dropdowns, and overlays
  - [x] Subtask 4.3: Verify no visual glitches at scroll boundaries
  - [x] Subtask 4.4: Add subtle shadow or border to header for visual separation (optional)

- [x] Task 5: Verify responsive behavior (AC: #5)
  - [x] Subtask 5.1: Test on mobile viewport sizes (320px - 480px)
  - [x] Subtask 5.2: Test on tablet viewport sizes (768px - 1024px)
  - [x] Subtask 5.3: Test on desktop viewport sizes (1280px+)
  - [x] Subtask 5.4: Ensure touch scrolling works correctly on mobile

- [x] Task 6: Write tests (AC: All)
  - [x] Subtask 6.1: Write unit test verifying header has sticky/fixed positioning
  - [x] Subtask 6.2: Write E2E test: scroll page, verify header remains visible
  - [x] Subtask 6.3: Write E2E test: verify header icons are clickable after scroll

## Dev Notes

### Architecture Patterns and Constraints

**Current Header Structure:**
- Header is located in `src/components/chat-screen.tsx`
- Contains: Family name (left), action icons (right) - settings, members, logout, etc.
- Currently scrolls with page content

**Implementation Approach:**
- Use CSS `position: sticky; top: 0;` for header container
- Alternative: `position: fixed` if sticky doesn't work with current layout
- Key: Ensure content area has appropriate top padding/margin to account for fixed header height
- z-index: Header should be above content but below modals (suggest z-index: 40-50)

**CSS Pattern:**
```css
.header {
  position: sticky;
  top: 0;
  z-index: 40;
  background: var(--background); /* Ensure solid background */
}

.content {
  /* If using fixed instead of sticky, add padding-top equal to header height */
}
```

**Screens to Update:**
1. Chat screen (`src/components/chat-screen.tsx`) - Primary
2. Settings screen (`src/components/settings-screen.tsx`) - If has similar header
3. Photo gallery (`src/components/photo-gallery.tsx`) - If applicable
4. Calendar view (`src/components/calendar-view.tsx`) - If applicable

**Testing Considerations:**
- Use Playwright for E2E scroll testing
- Test with different amounts of content (few messages vs many messages)
- Test rapid scroll, slow scroll, and scroll snap behaviors

### Learnings from Previous Story

**From Story 5.4 (Customize Language Settings):**

- **Settings Screen Pattern:** Settings uses overlay pattern - may need different sticky approach
- **Modified Files:** `src/components/chat-screen.tsx`, `src/components/settings-screen.tsx` were recently updated
- **Date Formatting:** Use existing `formatDate`, `formatTime` utilities if showing timestamps in header

[Source: stories/story-5.4.md#Dev-Agent-Record]

### Project Structure Notes

**Files to modify:**
- `src/components/chat-screen.tsx` - Main chat screen header
- `src/app/chat/page.tsx` - Chat page layout (if header is here)
- `src/components/ui/*.tsx` - May need to update shared UI components
- `src/app/globals.css` or component CSS - Styling changes

**No new files expected** - This is a CSS/layout modification to existing components.

### References

- [Source: docs/tech-spec-epic-5.md#US-5.5 - Sticky Header Requirements]
- [Source: docs/PRD.md#User Experience - App usable by users aged 10-80+]
- [Source: src/components/chat-screen.tsx - Current header implementation]

## Dev Agent Record

### Context Reference

- `docs/stories/5-5-sticky-header-context.xml` - Technical context with component analysis and implementation patterns

### Agent Model Used

claude-opus-4-5-20250929

### Debug Log References

- Fixed Radix ScrollArea flex container issue using `[&>div]:!block` selector
- Fixed auto-scroll timing with staggered timeouts [100, 300, 600]ms

### Completion Notes List

1. **Sticky Header Implementation**: Used `flex-shrink-0` on header elements to prevent shrinking, combined with `z-40` for proper layering
2. **ScrollArea Fix**: Modified `scroll-area.tsx` to add `overflow-hidden` on Root and `[&>div]:!block` on viewport to fix Radix ScrollArea issues with flex containers
3. **Auto-scroll**: Implemented staggered timeouts [100, 300, 600]ms to handle async content rendering
4. **Layout Pattern**: Used `h-screen flex flex-col` with `flex-1 min-h-0` for scrollable content area
5. **All ACs verified** with Playwright MCP testing

### File List

- `src/components/chat-screen.tsx` - Main sticky header implementation, auto-scroll logic
- `src/components/ui/scroll-area.tsx` - Fixed Radix ScrollArea for flex containers
- `src/components/settings-screen.tsx` - Sticky header applied
- `src/components/calendar-view.tsx` - Sticky header applied
- `src/components/photo-gallery.tsx` - Sticky header applied
- `tests/e2e/story-5.5-sticky-header.spec.ts` - E2E tests for sticky header

### Change Log

**2025-11-29 (Initial Creation):**
- Story 5.5 created based on user request and tech-spec-epic-5.md
- Scope: Make header bar sticky/fixed across all scrollable screens
- Status: drafted

**2025-11-29 (Implementation Complete):**
- Implemented sticky header using `flex-shrink-0` and `z-40` classes
- Fixed Radix ScrollArea to work properly with flex containers
- Fixed auto-scroll to show latest messages on page load
- Applied consistent sticky header pattern across chat, settings, calendar, and photo gallery
- Created E2E tests verifying sticky header behavior
- Status: Done
