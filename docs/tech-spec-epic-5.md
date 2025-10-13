# Tech Spec: Epic 5 - Settings & Customization

**Epic ID:** Epic 5
**Priority:** Medium (MVP)
**Story Points:** 8
**Estimated Duration:** 1 week
**Dependencies:** Epic 1 (Authentication, user preferences storage)

---

## 1. Epic Overview

Settings and customization allow family members to personalize their experience. Users can toggle dark mode, adjust font size for accessibility, set quiet hours to prevent message disturbances during sleep, and switch between Japanese and English languages. All preferences are stored in a JSONB column for flexibility and retrieved on app load.

**User Stories:**

- **US-5.1:** As a family member, I want to enable dark mode so that the app is easier on my eyes at night
  - **AC1:** Toggle dark/light mode in settings
  - **AC2:** Theme persists across sessions
  - **AC3:** All screens respect theme

- **US-5.2:** As an older family member, I want to increase font size so that I can read messages easily
  - **AC1:** Select small/medium/large font size
  - **AC2:** All text scales proportionally
  - **AC3:** Layout remains usable at large sizes

- **US-5.3:** As a family member, I want to set quiet hours so that I'm not disturbed during sleep
  - **AC1:** Enable quiet hours in settings
  - **AC2:** Set start and end time
  - **AC3:** App blocks message sending during quiet hours
  - **AC4:** Clear toast message explains why send is blocked

- **US-5.4:** As a user, I want to customize language settings so that I can use the app in my preferred language
  - **AC1:** Switch app UI language (English/Japanese in MVP)
  - **AC2:** Set preferred language for message translation (20+ languages supported)
  - **AC3:** All UI text, labels, buttons translated
  - **AC4:** Date/time formats localized
  - **AC5:** Settings persist across sessions

---

## 2. Architecture Components

### 2.1 Frontend Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Settings Screen** | `app/(dashboard)/settings/page.tsx` | Main settings interface |
| **Profile Section** | `components/settings/profile-section.tsx` | Name, avatar, email display/edit |
| **Family Section** | `components/settings/family-section.tsx` | Family name, members, invite code |
| **Preferences Section** | `components/settings/preferences-section.tsx` | Theme, font, language, quiet hours |
| **Theme Toggle** | `components/settings/theme-toggle.tsx` | Dark/light mode switcher |
| **Font Size Selector** | `components/settings/font-size-selector.tsx` | Small/medium/large buttons |
| **Quiet Hours Picker** | `components/settings/quiet-hours-picker.tsx` | Time range picker |
| **Language Selector** | `components/settings/language-selector.tsx` | Language dropdown |

### 2.2 Backend API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `GET /api/users/:id` | GET | Fetch user profile and preferences |
| `PATCH /api/users/:id` | PATCH | Update user preferences |
| `PATCH /api/users/:id/profile` | PATCH | Update name/avatar |

### 2.3 Database Schema

```sql
-- Users table preferences column (JSONB)
-- Already defined in Epic 1, but showing structure here
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{
  "theme": "light",
  "fontSize": "medium",
  "uiLanguage": "en",
  "preferredLanguage": "en",
  "quietHoursEnabled": false,
  "quietHoursStart": "22:00",
  "quietHoursEnd": "07:00"
}';

-- Index on preferences for faster queries (optional, not critical for MVP)
CREATE INDEX IF NOT EXISTS idx_users_preferences ON users USING GIN (preferences);
```

**Preferences Schema (TypeScript):**
```typescript
// UI language codes (extensible)
type UILanguage = 'en' | 'ja';

// Translation target languages (extensible - top 20 for MVP)
type TranslationLanguage =
  | 'en'  // English
  | 'ja'  // Japanese
  | 'es'  // Spanish
  | 'fr'  // French
  | 'de'  // German
  | 'zh'  // Chinese (Simplified)
  | 'ko'  // Korean
  | 'pt'  // Portuguese
  | 'ru'  // Russian
  | 'ar'  // Arabic
  | 'it'  // Italian
  | 'nl'  // Dutch
  | 'pl'  // Polish
  | 'tr'  // Turkish
  | 'vi'  // Vietnamese
  | 'th'  // Thai
  | 'id'  // Indonesian
  | 'hi'  // Hindi
  | 'sv'  // Swedish
  | 'no'; // Norwegian

interface UserPreferences {
  theme: 'light' | 'dark';
  fontSize: 'small' | 'medium' | 'large';
  uiLanguage: UILanguage;              // App interface language (en, ja)
  preferredLanguage: TranslationLanguage; // Message translation target
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "HH:MM" format
  quietHoursEnd: string; // "HH:MM" format
}
```

### 2.4 Libraries & Services

| Library | Version | Purpose |
|---------|---------|---------|
| **next-intl** | 3.x | Internationalization (i18n) for UI language (MVP: English/Japanese, extensible) |
| **next-themes** | 0.2.x | Dark mode with SSR support |
| **TailwindCSS** | 3.4.x | Theming with dark: classes |
| **CSS Variables** | Native | Font scaling |

---

## 3. Implementation Details

### 3.1 Database Schema (Detailed)

#### User Preferences Column

**Default Preferences (on user creation):**
```sql
-- In Epic 1 register/join APIs
INSERT INTO users (..., preferences) VALUES (
  ...,
  '{
    "theme": "light",
    "fontSize": "medium",
    "uiLanguage": "en",
    "preferredLanguage": "en",
    "quietHoursEnabled": false,
    "quietHoursStart": "22:00",
    "quietHoursEnd": "07:00"
  }'::jsonb
);
```

**Querying Preferences:**
```sql
-- Get user's theme preference
SELECT preferences->>'theme' as theme FROM users WHERE id = 'user-uuid';

-- Update specific preference (JSONB merge)
UPDATE users
SET preferences = preferences || '{"theme": "dark"}'::jsonb
WHERE id = 'user-uuid';
```

### 3.2 API Contracts

#### PATCH /api/users/:id

**Authentication:** Required (JWT, must be own user)

**Request Schema (Zod):**
```typescript
import { z } from 'zod';

export const updatePreferencesSchema = z.object({
  theme: z.enum(['light', 'dark']).optional(),
  fontSize: z.enum(['small', 'medium', 'large']).optional(),
  uiLanguage: z.enum(['en', 'ja']).optional(),
  preferredLanguage: z.enum([
    'en', 'ja', 'es', 'fr', 'de', 'zh', 'ko', 'pt', 'ru', 'ar',
    'it', 'nl', 'pl', 'tr', 'vi', 'th', 'id', 'hi', 'sv', 'no'
  ]).optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)').optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)').optional(),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
```

**Response Schema:**
```typescript
type UpdatePreferencesResponse = {
  user: {
    id: string;
    preferences: UserPreferences;
  };
};
```

**Error Responses:**
- 400: Invalid input (invalid time format)
- 401: Not authenticated
- 403: Cannot update other user's preferences
- 500: Server error

**Rate Limiting:** None (low-frequency updates)

**Implementation Logic:**
1. Validate JWT (user must be updating own preferences)
2. Validate input with Zod
3. Merge new preferences with existing (JSONB || operator)
4. Update user record
5. Return updated preferences

```typescript
// app/api/users/[id]/route.ts
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { updatePreferencesSchema } from '@/lib/validators/settings';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify user is updating own preferences
  if (user.id !== params.id) {
    return NextResponse.json(
      { error: 'Cannot update other user\'s preferences' },
      { status: 403 }
    );
  }

  const body = await request.json();
  const result = updatePreferencesSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0].message },
      { status: 400 }
    );
  }

  // Merge preferences (JSONB || operator)
  const { data: updatedUser, error: updateError } = await supabase
    .from('users')
    .update({
      preferences: supabase.raw(`preferences || '${JSON.stringify(result.data)}'::jsonb`),
    })
    .eq('id', user.id)
    .select('id, preferences')
    .single();

  if (updateError) {
    console.error('Failed to update preferences:', updateError);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }

  return NextResponse.json({ user: updatedUser });
}
```

---

#### PATCH /api/users/:id/profile

**Authentication:** Required (JWT, must be own user)

**Request Schema (Zod):**
```typescript
export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50).optional(),
  avatar: z.string().url('Invalid avatar URL').or(z.string().startsWith('data:image/')).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
```

**Response Schema:**
```typescript
type UpdateProfileResponse = {
  user: {
    id: string;
    name: string;
    avatar: string | null;
  };
};
```

**Error Responses:**
- 400: Invalid input
- 401: Not authenticated
- 403: Cannot update other user's profile
- 500: Server error

**Rate Limiting:** 10 updates per hour per user

**Implementation Logic:**
1. Validate JWT
2. Validate input (name length, avatar URL format)
3. Update user record (name and/or avatar)
4. Return updated profile

---

### 3.3 Component Implementation Guide

#### Component: Preferences Section

**File:** `components/settings/preferences-section.tsx`

**Props:** None (fetches from auth context)

**State Management:**
```typescript
const { user } = useAuth();
const [preferences, setPreferences] = useState<UserPreferences>(user?.preferences || defaultPreferences);
const [saving, setSaving] = useState(false);
```

**Key Functions:**
- `handleThemeToggle()` - Switch theme and save
- `handleFontSizeChange(size)` - Update font size
- `handleLanguageChange(lang)` - Switch language and reload translations
- `handleQuietHoursChange(enabled, start, end)` - Update quiet hours
- `savePreferences()` - Call API to persist changes

**Integration Points:**
- API: `PATCH /api/users/:id`
- Context: `useAuth()` for user data
- Theme: `next-themes` for dark mode
- i18n: `next-intl` for language switching

**Implementation:**
```tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ThemeToggle } from './theme-toggle';
import { QuietHoursPicker } from './quiet-hours-picker';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

export function PreferencesSection() {
  const { user } = useAuth();
  const t = useTranslations('Settings');
  const [preferences, setPreferences] = useState<UserPreferences>(
    user?.preferences || {
      theme: 'light',
      fontSize: 'medium',
      uiLanguage: 'en',
      preferredLanguage: 'en',
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    }
  );
  const [saving, setSaving] = useState(false);

  const savePreferences = async (updates: Partial<UserPreferences>) => {
    if (!user) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }

      const { user: updatedUser } = await response.json();
      setPreferences(updatedUser.preferences);

      toast.success(t('preferencesSaved'));
    } catch (error) {
      console.error('Failed to save preferences:', error);
      toast.error(t('preferencesError'));
    } finally {
      setSaving(false);
    }
  };

  const handleFontSizeChange = (fontSize: 'small' | 'medium' | 'large') => {
    setPreferences((prev) => ({ ...prev, fontSize }));
    savePreferences({ fontSize });

    // Apply font size immediately via CSS variable
    document.documentElement.style.setProperty(
      '--font-scale',
      fontSize === 'small' ? '0.875' : fontSize === 'large' ? '1.125' : '1'
    );
  };

  const handleUILanguageChange = (uiLanguage: 'en' | 'ja') => {
    setPreferences((prev) => ({ ...prev, uiLanguage }));
    savePreferences({ uiLanguage });

    // Reload page to apply new UI language
    window.location.reload();
  };

  const handlePreferredLanguageChange = (preferredLanguage: TranslationLanguage) => {
    setPreferences((prev) => ({ ...prev, preferredLanguage }));
    savePreferences({ preferredLanguage });

    // No reload needed - translation target updates immediately
    toast.success(t('translationLanguageUpdated'));
  };

  const handleQuietHoursChange = (
    enabled: boolean,
    start?: string,
    end?: string
  ) => {
    const updates: Partial<UserPreferences> = {
      quietHoursEnabled: enabled,
      ...(start && { quietHoursStart: start }),
      ...(end && { quietHoursEnd: end }),
    };

    setPreferences((prev) => ({ ...prev, ...updates }));
    savePreferences(updates);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">{t('appearance')}</h3>

        {/* Theme Toggle */}
        <div className="flex items-center justify-between mb-4">
          <Label>{t('theme')}</Label>
          <ThemeToggle
            theme={preferences.theme}
            onToggle={(theme) => {
              setPreferences((prev) => ({ ...prev, theme }));
              savePreferences({ theme });
            }}
          />
        </div>

        {/* Font Size */}
        <div className="flex items-center justify-between mb-4">
          <Label>{t('fontSize')}</Label>
          <div className="flex gap-2">
            {(['small', 'medium', 'large'] as const).map((size) => (
              <Button
                key={size}
                variant={preferences.fontSize === size ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFontSizeChange(size)}
                disabled={saving}
              >
                {t(`fontSize.${size}`)}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">{t('language')}</h3>

        {/* UI Language */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <Label>{t('appLanguage')}</Label>
            <p className="text-sm text-muted-foreground">{t('appLanguageDescription')}</p>
          </div>
          <Select
            value={preferences.uiLanguage}
            onValueChange={(value) => handleUILanguageChange(value as 'en' | 'ja')}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ja">日本語</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Translation Target Language */}
        <div className="flex items-center justify-between">
          <div>
            <Label>{t('translateMessagesTo')}</Label>
            <p className="text-sm text-muted-foreground">{t('translationDescription')}</p>
          </div>
          <Select
            value={preferences.preferredLanguage}
            onValueChange={handlePreferredLanguageChange}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ja">Japanese (日本語)</SelectItem>
              <SelectItem value="es">Spanish (Español)</SelectItem>
              <SelectItem value="fr">French (Français)</SelectItem>
              <SelectItem value="de">German (Deutsch)</SelectItem>
              <SelectItem value="zh">Chinese (中文)</SelectItem>
              <SelectItem value="ko">Korean (한국어)</SelectItem>
              <SelectItem value="pt">Portuguese (Português)</SelectItem>
              <SelectItem value="ru">Russian (Русский)</SelectItem>
              <SelectItem value="ar">Arabic (العربية)</SelectItem>
              <SelectItem value="it">Italian (Italiano)</SelectItem>
              <SelectItem value="nl">Dutch (Nederlands)</SelectItem>
              <SelectItem value="pl">Polish (Polski)</SelectItem>
              <SelectItem value="tr">Turkish (Türkçe)</SelectItem>
              <SelectItem value="vi">Vietnamese (Tiếng Việt)</SelectItem>
              <SelectItem value="th">Thai (ไทย)</SelectItem>
              <SelectItem value="id">Indonesian (Bahasa Indonesia)</SelectItem>
              <SelectItem value="hi">Hindi (हिन्दी)</SelectItem>
              <SelectItem value="sv">Swedish (Svenska)</SelectItem>
              <SelectItem value="no">Norwegian (Norsk)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">{t('quietHours')}</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>{t('enableQuietHours')}</Label>
            <Switch
              checked={preferences.quietHoursEnabled}
              onCheckedChange={(checked) => handleQuietHoursChange(checked)}
              disabled={saving}
            />
          </div>

          {preferences.quietHoursEnabled && (
            <QuietHoursPicker
              startTime={preferences.quietHoursStart}
              endTime={preferences.quietHoursEnd}
              onChange={(start, end) => handleQuietHoursChange(true, start, end)}
              disabled={saving}
            />
          )}

          <p className="text-sm text-muted-foreground">
            {t('quietHoursDescription')}
          </p>
        </div>
      </div>
    </div>
  );
}
```

---

#### Component: Theme Toggle

**File:** `components/settings/theme-toggle.tsx`

**Props:**
```typescript
interface ThemeToggleProps {
  theme: 'light' | 'dark';
  onToggle: (theme: 'light' | 'dark') => void;
}
```

**Implementation:**
```tsx
'use client';

import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const { setTheme } = useTheme();

  const handleToggle = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    onToggle(newTheme);
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleToggle}
      aria-label="Toggle theme"
    >
      {theme === 'light' ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5" />
      )}
    </Button>
  );
}
```

---

#### Component: Quiet Hours Picker

**File:** `components/settings/quiet-hours-picker.tsx`

**Props:**
```typescript
interface QuietHoursPickerProps {
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  onChange: (startTime: string, endTime: string) => void;
  disabled?: boolean;
}
```

**Implementation:**
```tsx
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function QuietHoursPicker({
  startTime,
  endTime,
  onChange,
  disabled,
}: QuietHoursPickerProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <Label htmlFor="quiet-start">Start Time</Label>
        <Input
          id="quiet-start"
          type="time"
          value={startTime}
          onChange={(e) => onChange(e.target.value, endTime)}
          disabled={disabled}
        />
      </div>
      <span className="text-muted-foreground">to</span>
      <div className="flex-1">
        <Label htmlFor="quiet-end">End Time</Label>
        <Input
          id="quiet-end"
          type="time"
          value={endTime}
          onChange={(e) => onChange(startTime, e.target.value)}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
```

---

### 3.4 Internationalization (i18n) Setup

#### File: `lib/i18n/config.ts`

**Configuration:**
```typescript
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`../../messages/${locale}.json`)).default,
}));
```

#### File: `messages/en.json`

**English Translations:**
```json
{
  "Settings": {
    "title": "Settings",
    "appearance": "Appearance",
    "theme": "Theme",
    "fontSize": "Font Size",
    "fontSize.small": "Small",
    "fontSize.medium": "Medium",
    "fontSize.large": "Large",
    "language": "Language",
    "appLanguage": "App Language",
    "appLanguageDescription": "Language for menus, buttons, and labels",
    "translateMessagesTo": "Translate Messages To",
    "translationDescription": "Messages will be translated to this language automatically",
    "translationLanguageUpdated": "Translation language updated successfully",
    "quietHours": "Quiet Hours",
    "enableQuietHours": "Enable Quiet Hours",
    "quietHoursDescription": "Block message sending and notifications during quiet hours",
    "preferencesSaved": "Preferences saved successfully",
    "preferencesError": "Failed to save preferences. Please try again."
  },
  "Common": {
    "save": "Save",
    "cancel": "Cancel",
    "edit": "Edit",
    "delete": "Delete"
  }
}
```

#### File: `messages/ja.json`

**Japanese Translations:**
```json
{
  "Settings": {
    "title": "設定",
    "appearance": "外観",
    "theme": "テーマ",
    "fontSize": "フォントサイズ",
    "fontSize.small": "小",
    "fontSize.medium": "中",
    "fontSize.large": "大",
    "language": "言語",
    "appLanguage": "アプリの言語",
    "appLanguageDescription": "メニュー、ボタン、ラベルの表示言語",
    "translateMessagesTo": "メッセージの翻訳先言語",
    "translationDescription": "メッセージは自動的にこの言語に翻訳されます",
    "translationLanguageUpdated": "翻訳言語を更新しました",
    "quietHours": "おやすみモード",
    "enableQuietHours": "おやすみモードを有効にする",
    "quietHoursDescription": "おやすみモード中はメッセージ送信と通知がブロックされます",
    "preferencesSaved": "設定を保存しました",
    "preferencesError": "設定の保存に失敗しました。もう一度お試しください。"
  },
  "Common": {
    "save": "保存",
    "cancel": "キャンセル",
    "edit": "編集",
    "delete": "削除"
  }
}
```

#### File: `app/[locale]/layout.tsx`

**Root Layout with i18n:**
```tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

---

### 3.5 Font Scaling with CSS Variables

#### File: `app/globals.css`

**CSS Variables for Font Scaling:**
```css
:root {
  --font-scale: 1; /* Default: medium */
  --font-size-base: calc(1rem * var(--font-scale));
  --font-size-sm: calc(0.875rem * var(--font-scale));
  --font-size-lg: calc(1.125rem * var(--font-scale));
  --font-size-xl: calc(1.25rem * var(--font-scale));
  --font-size-2xl: calc(1.5rem * var(--font-scale));
}

body {
  font-size: var(--font-size-base);
}

.text-sm {
  font-size: var(--font-size-sm);
}

.text-lg {
  font-size: var(--font-size-lg);
}

.text-xl {
  font-size: var(--font-size-xl);
}

.text-2xl {
  font-size: var(--font-size-2xl);
}
```

**Apply font scale on app load:**
```typescript
// lib/hooks/use-font-scale.ts
import { useEffect } from 'react';
import { useAuth } from './use-auth';

export function useFontScale() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.preferences?.fontSize) return;

    const scale = user.preferences.fontSize === 'small' ? 0.875 : user.preferences.fontSize === 'large' ? 1.125 : 1;
    document.documentElement.style.setProperty('--font-scale', scale.toString());
  }, [user?.preferences?.fontSize]);
}
```

---

## 4. Error Handling

### 4.1 Client-Side Errors

**Preference Save Errors:**
- Display toast: "Failed to save preferences. Please try again."
- Log error to console

**Language Switch Errors:**
- If translation files missing, fall back to English
- Show warning: "Some translations may be incomplete."

**Font Scale Errors:**
- If CSS variables not supported (very old browsers), fall back to default font size
- No user-facing error (graceful degradation)

### 4.2 API Errors

**Common Errors:**
- `INVALID_TIME_FORMAT` (400) - Quiet hours time format invalid
- `UNAUTHORIZED` (401) - User not authenticated
- `FORBIDDEN` (403) - Cannot update other user's preferences

### 4.3 Edge Cases

| Edge Case | Handling |
|-----------|----------|
| **Quiet hours end time before start time** | Allow (interpret as overnight, e.g., 22:00-07:00) |
| **Font scale very large (> 1.5)** | Clamp to max 1.25 (prevent layout breakage) |
| **Language changed mid-session** | Reload page to apply new translations |
| **Theme changed mid-session** | Apply immediately via `next-themes` |

---

## 5. Testing Strategy

### 5.1 Unit Tests (Vitest)

**File:** `tests/unit/settings/preferences.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { updatePreferencesSchema } from '@/lib/validators/settings';

describe('Preferences Validation', () => {
  it('should accept valid preferences', () => {
    const input = {
      theme: 'dark',
      fontSize: 'large',
      language: 'ja',
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    };

    expect(updatePreferencesSchema.parse(input)).toEqual(input);
  });

  it('should reject invalid time format', () => {
    const input = {
      quietHoursStart: '25:00', // Invalid hour
    };

    expect(() => updatePreferencesSchema.parse(input)).toThrow('Invalid time format');
  });

  it('should allow partial updates', () => {
    const input = {
      theme: 'dark',
    };

    expect(updatePreferencesSchema.parse(input)).toEqual(input);
  });
});
```

### 5.2 Integration Tests

**File:** `tests/integration/settings/preferences-flow.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { createSupabaseServerClient } from '@/lib/supabase/server';

describe('Preferences Flow Integration', () => {
  it('should update user preferences', async () => {
    const response = await fetch('http://localhost:3000/api/users/test-user-id', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        theme: 'dark',
        fontSize: 'large',
      }),
    });

    expect(response.status).toBe(200);

    const { user } = await response.json();
    expect(user.preferences.theme).toBe('dark');
    expect(user.preferences.fontSize).toBe('large');
  });
});
```

### 5.3 E2E Tests (Playwright)

**File:** `tests/e2e/settings/settings-flow.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Settings Flow', () => {
  test('should toggle dark mode', async ({ page }) => {
    await page.goto('/settings');

    // Toggle to dark mode
    await page.click('button[aria-label="Toggle theme"]');

    // Verify dark mode applied
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Reload and verify persistence
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('should change font size', async ({ page }) => {
    await page.goto('/settings');

    // Click large font size
    await page.click('button:text("Large")');

    // Verify font scale CSS variable
    const fontScale = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--font-scale')
    );
    expect(fontScale.trim()).toBe('1.125');
  });

  test('should set quiet hours', async ({ page }) => {
    await page.goto('/settings');

    // Enable quiet hours
    await page.click('button[role="switch"]');

    // Set start time
    await page.fill('input#quiet-start', '22:00');

    // Set end time
    await page.fill('input#quiet-end', '07:00');

    // Verify saved toast
    await expect(page.locator('text=Preferences saved')).toBeVisible();
  });

  test('should switch language', async ({ page }) => {
    await page.goto('/settings');

    // Switch to Japanese
    await page.click('button[role="combobox"]');
    await page.click('text=日本語');

    // Wait for page reload
    await page.waitForURL('**/settings');

    // Verify Japanese UI
    await expect(page.locator('text=設定')).toBeVisible();
  });
});
```

### 5.4 Acceptance Criteria Validation

| AC | Test Type | Validation Method |
|----|-----------|-------------------|
| **AC1.1-1.3:** Dark mode toggle | E2E | Toggle theme, verify persistence, check all screens |
| **AC2.1-2.3:** Font size scaling | E2E | Change font size, verify CSS variable, check layout usability |
| **AC3.1-3.4:** Quiet hours | E2E | Enable quiet hours, set time, verify message blocking |
| **AC4.1-4.3:** Language switching | E2E | Switch language, verify UI translations, check date formats |

---

## 6. Security Considerations

### 6.1 Preferences Privacy

**Preferences NOT Encrypted:**
- UI settings (theme, font size, language) are not sensitive
- Quiet hours are user-specific, no privacy risk
- Acceptable for server to see preferences (required for rendering)

### 6.2 Input Validation

**Server-Side Validation:**
- All preferences validated with Zod
- Time format validation (HH:MM regex)
- Enum validation for theme, fontSize, language

### 6.3 Rate Limiting

**Profile Updates:**
- 10 profile updates per hour per user (prevent abuse)
- Preferences updates unlimited (low cost, frequent UX need)

---

## 7. Performance Targets

| Operation | Target Latency | Acceptable Max |
|-----------|---------------|----------------|
| **Update preferences** | < 200ms | < 500ms |
| **Apply theme change** | < 50ms | < 100ms |
| **Apply font scale** | < 50ms | < 100ms |
| **Switch language (reload)** | < 2s | < 5s |

**Optimization Strategies:**
- Debounce preference saves (500ms delay)
- Apply theme/font changes immediately (optimistic UI)
- Cache translations (no network request on language switch)

---

## 8. Implementation Checklist

### Week 1: Backend & Database
- [ ] Add preferences JSONB column to users table (if not exists)
- [ ] Implement PATCH /api/users/:id (update preferences)
- [ ] Implement PATCH /api/users/:id/profile (update name/avatar)
- [ ] Write unit tests for API routes (95% coverage)

### Week 1: Frontend & i18n
- [ ] Set up next-intl with en/ja translation files
- [ ] Create Settings Screen layout
- [ ] Implement ProfileSection component (name, avatar, email)
- [ ] Implement PreferencesSection component (theme, font, language, quiet hours)
- [ ] Implement ThemeToggle component (next-themes integration)
- [ ] Implement FontSizeSelector component (CSS variable application)
- [ ] Implement QuietHoursPicker component (time inputs)
- [ ] Implement LanguageSelector component (dropdown)
- [ ] Set up CSS variables for font scaling
- [ ] Implement useFontScale hook (apply on app load)
- [ ] Test theme persistence (next-themes)
- [ ] Test font scaling (CSS variables)
- [ ] Test language switching (reload behavior)
- [ ] Test quiet hours (message sending blocked)
- [ ] Write integration tests (preferences update flows)
- [ ] Write E2E tests (Playwright scenarios)

### Week 1: Polish & Testing
- [ ] Translate all UI strings (en.json, ja.json)
- [ ] Test Japanese UI (full translation coverage)
- [ ] Error handling and user-facing error messages
- [ ] Performance testing (preference update latency)
- [ ] Accessibility testing (keyboard navigation, screen readers)

---

## 9. Dependencies & Risks

**Depends On:**
- Epic 1: Authentication (user preferences storage)

**Depended On By:**
- Epic 2: Quiet hours enforcement in message sending
- Epic 4: Quiet hours enforcement in calendar reminders

**Risks:**

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Translation quality (machine-translated)** | Medium | High | Review by native Japanese speaker, iterate based on feedback |
| **Font scaling breaks layout on some screens** | Low | Medium | Test on all screens, adjust layout with media queries if needed |
| **Dark mode theming inconsistencies** | Low | Medium | Use TailwindCSS dark: classes consistently, test all screens |
| **i18n setup complexity** | Low | Low | Use next-intl (well-documented), follow official examples |

---

## 10. Acceptance Criteria

### US-5.1: Enable Dark Mode

- [ ] User opens settings screen
- [ ] User clicks theme toggle button
- [ ] App switches to dark mode immediately (all screens)
- [ ] Theme persists after browser restart
- [ ] All components respect dark mode (no white backgrounds)
- [ ] TailwindCSS dark: classes applied correctly

### US-5.2: Adjust Font Size

- [ ] User opens settings screen
- [ ] User clicks "Large" font size button
- [ ] All text scales proportionally (1.125x)
- [ ] Layout remains usable (no overflow, wrapping acceptable)
- [ ] Font size persists after page reload
- [ ] CSS variable `--font-scale` applied to document root

### US-5.3: Set Quiet Hours

- [ ] User opens settings screen
- [ ] User enables quiet hours toggle
- [ ] User sets start time (e.g., 22:00) and end time (e.g., 07:00)
- [ ] Preferences saved successfully (toast notification)
- [ ] During quiet hours, message send button disabled
- [ ] Toast message: "Cannot send messages during quiet hours (22:00 - 07:00)"
- [ ] Calendar reminders skipped during quiet hours (Epic 4 integration)

### US-5.4: Customize Language Settings

- [ ] User opens settings screen
- [ ] User sees two language settings: "App Language" and "Translate Messages To"
- [ ] User selects "日本語" from "App Language" dropdown
- [ ] Page reloads with Japanese UI (all labels, buttons, menus in Japanese)
- [ ] Date/time formats localized (e.g., "2025年10月13日")
- [ ] User selects "Spanish (Español)" from "Translate Messages To" dropdown
- [ ] Toast notification: "Translation language updated successfully"
- [ ] No page reload (translation target updates immediately)
- [ ] Future messages will be translated to Spanish
- [ ] Both settings persist after logout/login
- [ ] User can switch back to English UI and English translations seamlessly

---

**Document History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-13 | Claude (Tech Spec Generator) | Initial tech spec for Epic 5 |

---

**Status:** ✅ Ready for Implementation
