'use client';

import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Language } from '@/lib/translations';

/**
 * Story 1.13: Supported language codes for invite emails
 * Same as translation languages from Story 5.4
 */
export type InviteLanguageCode =
  | 'en' | 'ja' | 'es' | 'fr' | 'de' | 'zh' | 'ko' | 'pt'
  | 'ru' | 'ar' | 'it' | 'nl' | 'pl' | 'tr' | 'vi' | 'th'
  | 'id' | 'hi' | 'sv' | 'no';

interface InviteLanguageSelectorProps {
  value: InviteLanguageCode;
  onValueChange: (value: InviteLanguageCode) => void;
  disabled?: boolean;
  currentUiLanguage: Language;
}

/**
 * Get language options with labels in current UI language
 */
const getLanguageOptions = (currentLang: Language): Array<{ value: InviteLanguageCode; label: string }> => {
  const isJapanese = currentLang === 'ja';

  return [
    { value: 'en', label: isJapanese ? 'English (英語)' : 'English' },
    { value: 'ja', label: isJapanese ? '日本語' : 'Japanese (日本語)' },
  ];
};

/**
 * Story 1.13: Language selector for invite emails
 * Allows admins to select which language the invitation email should be sent in
 */
export function InviteLanguageSelector({
  value,
  onValueChange,
  disabled = false,
  currentUiLanguage,
}: InviteLanguageSelectorProps) {
  const languageOptions = useMemo(
    () => getLanguageOptions(currentUiLanguage),
    [currentUiLanguage]
  );

  return (
    <Select
      value={value}
      onValueChange={(val) => onValueChange(val as InviteLanguageCode)}
      disabled={disabled}
    >
      <SelectTrigger className="rounded-xl bg-background">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {languageOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
