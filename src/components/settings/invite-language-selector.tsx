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
    { value: 'es', label: isJapanese ? 'Spanish (スペイン語)' : 'Spanish (Español)' },
    { value: 'fr', label: isJapanese ? 'French (フランス語)' : 'French (Français)' },
    { value: 'de', label: isJapanese ? 'German (ドイツ語)' : 'German (Deutsch)' },
    { value: 'zh', label: isJapanese ? 'Chinese (中国語)' : 'Chinese (中文)' },
    { value: 'ko', label: isJapanese ? 'Korean (韓国語)' : 'Korean (한국어)' },
    { value: 'pt', label: isJapanese ? 'Portuguese (ポルトガル語)' : 'Portuguese (Português)' },
    { value: 'ru', label: isJapanese ? 'Russian (ロシア語)' : 'Russian (Русский)' },
    { value: 'ar', label: isJapanese ? 'Arabic (アラビア語)' : 'Arabic (العربية)' },
    { value: 'it', label: isJapanese ? 'Italian (イタリア語)' : 'Italian (Italiano)' },
    { value: 'nl', label: isJapanese ? 'Dutch (オランダ語)' : 'Dutch (Nederlands)' },
    { value: 'pl', label: isJapanese ? 'Polish (ポーランド語)' : 'Polish (Polski)' },
    { value: 'tr', label: isJapanese ? 'Turkish (トルコ語)' : 'Turkish (Türkçe)' },
    { value: 'vi', label: isJapanese ? 'Vietnamese (ベトナム語)' : 'Vietnamese (Tiếng Việt)' },
    { value: 'th', label: isJapanese ? 'Thai (タイ語)' : 'Thai (ไทย)' },
    { value: 'id', label: isJapanese ? 'Indonesian (インドネシア語)' : 'Indonesian (Bahasa Indonesia)' },
    { value: 'hi', label: isJapanese ? 'Hindi (ヒンディー語)' : 'Hindi (हिन्दी)' },
    { value: 'sv', label: isJapanese ? 'Swedish (スウェーデン語)' : 'Swedish (Svenska)' },
    { value: 'no', label: isJapanese ? 'Norwegian (ノルウェー語)' : 'Norwegian (Norsk)' },
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
      <SelectTrigger className="rounded-xl">
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
