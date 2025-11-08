import type { TranslationLanguage } from '@/components/settings/translation-language-selector';

export const DEFAULT_TRANSLATION_LANGUAGE: TranslationLanguage = 'en';

export const SUPPORTED_TRANSLATION_LANGUAGES: readonly TranslationLanguage[] = [
  'en',
  'ja',
  'es',
  'fr',
  'de',
  'zh',
  'ko',
  'pt',
  'ru',
  'ar',
  'it',
  'nl',
  'pl',
  'tr',
  'vi',
  'th',
  'id',
  'hi',
  'sv',
  'no',
] as const;

export const isSupportedTranslationLanguage = (
  value: unknown,
): value is TranslationLanguage => {
  return (
    typeof value === 'string' &&
    SUPPORTED_TRANSLATION_LANGUAGES.includes(
      value as TranslationLanguage,
    )
  );
};
