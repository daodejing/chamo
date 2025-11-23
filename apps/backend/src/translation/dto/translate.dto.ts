import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const SUPPORTED_LANGUAGE_CODES = [
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

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGE_CODES)[number];

export const DEFAULT_SUPPORTED_LANGUAGE: SupportedLanguageCode = 'en';

export const SUPPORTED_LANGUAGE_SET = new Set<SupportedLanguageCode>(
  SUPPORTED_LANGUAGE_CODES,
);

export const isSupportedLanguageCode = (
  value: unknown,
): value is SupportedLanguageCode =>
  typeof value === 'string' &&
  SUPPORTED_LANGUAGE_SET.has(value as SupportedLanguageCode);

export class TranslateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000, {
    message: 'Message text exceeds maximum supported length.',
  })
  text!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  messageId!: string;

  @IsString()
  @IsIn(SUPPORTED_LANGUAGE_CODES)
  targetLanguage!: SupportedLanguageCode;
}

export const SUPPORTED_LANGUAGES: Record<SupportedLanguageCode, string> = {
  en: 'English',
  ja: 'Japanese',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  zh: 'Chinese (Simplified)',
  ko: 'Korean',
  pt: 'Portuguese',
  ru: 'Russian',
  ar: 'Arabic',
  it: 'Italian',
  nl: 'Dutch',
  pl: 'Polish',
  tr: 'Turkish',
  vi: 'Vietnamese',
  th: 'Thai',
  id: 'Indonesian',
  hi: 'Hindi',
  sv: 'Swedish',
  no: 'Norwegian',
};
