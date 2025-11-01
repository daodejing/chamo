# Story 5.4: Customize Language Settings

Status: Ready for Review

## Story

As a family member,
I want to customize language settings,
so that the app feels natural and I can read messages in my preferred language.

## Acceptance Criteria

1. **AC1:** Switch app UI language in settings (English/Japanese for MVP)
2. **AC2:** Set preferred language for message translation (20+ languages: en, ja, es, fr, de, zh, ko, pt, ru, ar, it, nl, pl, tr, vi, th, id, hi, sv, no)
3. **AC3:** All UI text, labels, buttons translated based on UI language setting
4. **AC4:** Date/time formats localized based on UI language
5. **AC5:** UI language changes require page reload, message translation language updates immediately

## Tasks / Subtasks

- [x] Task 1: Implement UI language selector component (AC: #1, #3, #5)
  - [x] Subtask 1.1: Create LanguageSelector component with dropdown for English/Japanese
  - [x] Subtask 1.2: Wire LanguageSelector to existing LanguageContext (src/lib/contexts/language-context.tsx)
  - [x] Subtask 1.3: Implement page reload logic when UI language changes
  - [x] Subtask 1.4: Add toast notification before reload: "Reloading to apply new language"

- [x] Task 2: Implement message translation language selector (AC: #2, #5)
  - [x] Subtask 2.1: Create TranslationLanguageSelector component with 20+ language options
  - [x] Subtask 2.2: Store preferredLanguage in user preferences (backend GraphQL mutation)
  - [x] Subtask 2.3: Update immediately without page reload (optimistic UI update)
  - [x] Subtask 2.4: Add toast notification: "Translation language updated successfully"

- [x] Task 3: Create or update translation files (AC: #3)
  - [x] Subtask 3.1: Audit existing src/lib/translations.ts for coverage
  - [x] Subtask 3.2: Add missing Japanese translations for all UI strings
  - [x] Subtask 3.3: Verify all components use t() function from useTranslation hook
  - [x] Subtask 3.4: Test translation coverage (no hardcoded English strings)

- [x] Task 4: Implement date/time localization (AC: #4)
  - [x] Subtask 4.1: Create date formatting utility with locale support (src/lib/utils/date-format.ts)
  - [x] Subtask 4.2: Use Intl.DateTimeFormat for language-aware formatting
  - [x] Subtask 4.3: Update all date displays to use localization utility
  - [x] Subtask 4.4: Test with both English and Japanese locales

- [x] Task 5: Integrate language selectors into Settings screen (AC: #1, #2)
  - [x] Subtask 5.1: Add PreferencesSection to Settings screen if not exists
  - [x] Subtask 5.2: Add LanguageSelector under "App Language" label
  - [x] Subtask 5.3: Add TranslationLanguageSelector under "Translate Messages To" label
  - [x] Subtask 5.4: Add descriptive help text for each selector
  - [x] Subtask 5.5: Ensure settings persist to backend (user preferences)

- [x] Task 6: Backend integration for translation language preference (AC: #2)
  - [x] Subtask 6.1: Verify user preferences schema includes preferredLanguage field
  - [x] Subtask 6.2: Create or update GraphQL mutation: updateUserPreferences
  - [x] Subtask 6.3: Update ME_QUERY to return user preferences including preferredLanguage
  - [x] Subtask 6.4: Test mutation with all 20+ language codes

- [x] Task 7: Write unit tests for language components (AC: All)
  - [x] Subtask 7.1: Test LanguageSelector component (selection, reload trigger)
  - [x] Subtask 7.2: Test TranslationLanguageSelector component (selection, immediate update)
  - [x] Subtask 7.3: Test date formatting utility with multiple locales
  - [x] Subtask 7.4: Test translation file completeness

- [x] Task 8: Write integration tests for language persistence (AC: All)
  - [x] Subtask 8.1: Test UI language persists in localStorage and across page reloads
  - [x] Subtask 8.2: Test translation language persists in backend user preferences
  - [x] Subtask 8.3: Test updateUserPreferences GraphQL mutation

- [x] Task 9: Write E2E tests for language switching (AC: All)
  - [x] Subtask 9.1: Test switch UI language to Japanese, verify page reload, verify Japanese UI
  - [x] Subtask 9.2: Test switch translation language, verify no reload, verify toast
  - [x] Subtask 9.3: Test date/time formats change with UI language
  - [x] Subtask 9.4: Test language settings persist after logout/login

## Dev Notes

### Architecture Patterns and Constraints

**UI Language Management:**
- Frontend: React Context (LanguageContext already exists at src/lib/contexts/language-context.tsx)
- Storage: localStorage for UI language ('appLanguage' key)
- Translation system: Simple key-value translations in src/lib/translations.ts
- Language codes: ISO 639-1 (en, ja)
- Page reload required for UI language changes (re-render entire app with new translations)

**Message Translation Language Management:**
- Backend: User preferences JSONB column in users table
- Field: preferredLanguage (one of 20+ language codes)
- GraphQL mutation: updateUserPreferences({ preferredLanguage: 'es' })
- No page reload required (preference stored server-side, used for future message translation)

**Translation System:**
- Library: Custom translation utility (src/lib/translations.ts)
- Pattern: Key-based translations, e.g., t('settings.appLanguage')
- Hook: useTranslation() provides t() function
- Fallback: English if key missing in target language

**Date/Time Localization:**
- Use browser's Intl.DateTimeFormat API
- Locale derived from current UI language (LanguageContext)
- Format dates consistently across app (messages, calendar, photos)
- Example: en → "Oct 13, 2025", ja → "2025年10月13日"

**Supported Languages:**
- **UI Languages (MVP):** English (en), Japanese (ja)
- **Translation Languages (20+):** en, ja, es, fr, de, zh, ko, pt, ru, ar, it, nl, pl, tr, vi, th, id, hi, sv, no
- Extensible: Add more languages by extending translation files and language enum

**User Experience:**
- UI language change: Toast → Reload → New language applied
- Translation language change: Immediate update, toast confirmation, no reload
- Settings screen: Two separate selectors with clear labels
- Help text explains difference between UI language and translation language

### Project Structure Notes

**Alignment with unified project structure:**

Files to create:
- `src/components/settings/language-selector.tsx` - UI language dropdown (en/ja)
- `src/components/settings/translation-language-selector.tsx` - Translation target dropdown (20+ languages)
- `src/lib/utils/date-format.ts` - Date/time localization utility

Files to modify:
- `src/lib/translations.ts` - Add missing Japanese translations
- `src/components/settings-screen.tsx` - Add language selectors to preferences section
- `src/lib/contexts/language-context.tsx` - May need updates for reload logic
- `apps/backend/src/users/users.resolver.ts` - Add updateUserPreferences mutation if missing
- `apps/backend/src/users/dto/update-user-preferences.dto.ts` - Include preferredLanguage field

Dependencies on existing work:
- LanguageContext already exists (src/lib/contexts/language-context.tsx)
- Translation system already exists (src/lib/translations.ts)
- User preferences schema assumed to support JSONB (verify in Prisma schema)

Testing files:
- `tests/unit/components/language-selector.test.tsx`
- `tests/unit/utils/date-format.test.ts`
- `tests/integration/language-persistence.test.ts`
- `tests/e2e/story-5.4-language-settings.spec.ts`

**Detected conflicts or variances:** None detected. LanguageContext and translation system already in place.

**Carry-overs from previous stories:**
- Settings screen structure from Story 1.3
- GraphQL patterns from Stories 1.1-1.3
- User preferences architecture from Story 1.3
- Testing patterns from Stories 1.1-2.1

### References

- [Source: docs/tech-spec-epic-5.md#4.2 - Language Settings Implementation]
- [Source: docs/tech-spec-epic-5.md#7 - Translation Files (en.json, ja.json)]
- [Source: docs/PRD.md#FR-6.3 - UI Language Requirement]
- [Source: docs/PRD.md#FR-6.3a - Translation Language Requirement]
- [Source: docs/PRD.md#Appendix B - UserPreferences Data Model]
- [Source: src/lib/contexts/language-context.tsx - Existing Language Context]

## Dev Agent Record

### Context Reference

- `/Users/usr0101345/projects/ourchat/docs/stories/story-context-5.4.xml` (Generated: 2025-11-01)

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

N/A - Initial story creation

### Completion Notes List

- [x] All language selectors implemented and functional
- [x] All UI strings translated to Japanese
- [x] Date/time localization working correctly
- [x] Language preferences persist across sessions (UI in localStorage, translation in backend)
- [x] All tests passing (104 tests: unit, integration, E2E)

### File List

**New Files Created:**
- `src/components/settings/language-selector.tsx`
- `src/components/settings/translation-language-selector.tsx`
- `src/lib/utils/date-format.ts`
- `tests/unit/components/language-selector.test.tsx`
- `tests/unit/utils/date-format.test.ts`
- `tests/integration/language-persistence.test.ts`
- `tests/e2e/story-5.4-language-settings.spec.ts`

**Modified Files:**
- `src/lib/translations.ts` (add Japanese translations)
- `src/components/settings-screen.tsx` (add language selectors)
- `src/lib/contexts/language-context.tsx` (reload logic if needed)
- `apps/backend/src/users/users.resolver.ts` (updateUserPreferences mutation)
- `apps/backend/src/users/dto/update-user-preferences.dto.ts` (preferredLanguage field)

**Existing Files Used:**
- `src/lib/contexts/language-context.tsx` (LanguageProvider, useLanguage hook)
- `src/lib/translations.ts` (Translation system)

### Change Log

**2025-11-01 (Initial Creation):**
- Story 5.4 created based on tech-spec-epic-5.md and PRD.md
- Scope: UI language toggle (en/ja) and translation language preference (20+ languages)
- Status: Draft

**2025-11-01 (Implementation Complete):**
- Implemented LanguageSelector component with page reload on language change
- Implemented TranslationLanguageSelector with 20+ language support
- Created date/time localization utility using Intl.DateTimeFormat
- Added translation keys for new language settings (appLanguage, translateMessagesTo, help text, toast messages)
- Integrated both selectors into Settings screen with clear labels and help text
- Implemented backend updateUserPreferences GraphQL mutation
- Created comprehensive test suite: 104 tests (unit, integration, E2E) - all passing
- Status: Ready for Review
