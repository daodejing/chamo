import { describe, it, expect } from 'vitest';
import { translations, t, Language } from '@/lib/translations';

describe('Translation Completeness', () => {
  const languages: Language[] = ['en', 'ja'];

  it('has the same keys in both English and Japanese translations', () => {
    const enKeys = Object.keys(translations.en).sort();
    const jaKeys = Object.keys(translations.ja).sort();

    expect(enKeys).toEqual(jaKeys);
  });

  it('has no empty values in English translations', () => {
    const emptyKeys = Object.entries(translations.en)
      .filter(([key, value]) => value === '')
      .map(([key]) => key);

    // Allow specific keys to be empty (like calendar.year, calendar.month which might be intentional)
    const allowedEmptyKeys = ['calendar.year', 'calendar.month'];
    const unexpectedEmptyKeys = emptyKeys.filter(key => !allowedEmptyKeys.includes(key));

    expect(unexpectedEmptyKeys).toEqual([]);
  });

  it('has no empty values in Japanese translations (except allowed keys)', () => {
    const emptyKeys = Object.entries(translations.ja)
      .filter(([key, value]) => value === '')
      .map(([key]) => key);

    // No empty keys should exist in Japanese
    expect(emptyKeys).toEqual([]);
  });

  it('has all new language settings keys in both languages', () => {
    const requiredKeys = [
      'settings.appLanguage',
      'settings.appLanguageHelp',
      'settings.translateMessagesTo',
      'settings.translateMessagesToHelp',
      'toast.languageChanging',
      'toast.translationLanguageUpdated',
    ];

    for (const key of requiredKeys) {
      expect(translations.en).toHaveProperty(key);
      expect(translations.ja).toHaveProperty(key);

      // Should not be empty
      expect(translations.en[key as keyof typeof translations.en]).toBeTruthy();
      expect(translations.ja[key as keyof typeof translations.ja]).toBeTruthy();
    }
  });

  describe('t() function', () => {
    it('returns correct translation for English', () => {
      const result = t('settings.appLanguage', 'en');
      expect(result).toBe('App Language');
    });

    it('returns correct translation for Japanese', () => {
      const result = t('settings.appLanguage', 'ja');
      expect(result).toBe('アプリの言語');
    });

    it('handles replacements correctly', () => {
      const result = t('settings.membersCount', 'en', { current: '5', max: '10' });
      expect(result).toBe('5 / 10 members');
    });

    it('handles replacements correctly in Japanese', () => {
      const result = t('settings.membersCount', 'ja', { current: '5', max: '10' });
      expect(result).toBe('5 / 10 人');
    });

    it('returns the key if translation is missing', () => {
      const result = t('nonexistent.key', 'en');
      expect(result).toBe('nonexistent.key');
    });

    it('handles multiple replacements', () => {
      const result = t('toast.messageScheduled', 'en', { time: '2:30 PM' });
      expect(result).toBe('Message scheduled for 2:30 PM');
    });
  });

  describe('Translation quality', () => {
    it('has consistent formatting patterns', () => {
      // Check that button labels don't end with periods
      const buttonKeys = Object.keys(translations.en).filter(
        key => key.includes('.button') || key.includes('Button')
      );

      for (const key of buttonKeys) {
        const value = translations.en[key as keyof typeof translations.en];
        expect(value).not.toMatch(/\.$/);
      }
    });

    it('uses placeholder format {variable} consistently', () => {
      // Find all translations with placeholders
      const placeholderRegex = /\{[^}]+\}/g;

      for (const [key, value] of Object.entries(translations.en)) {
        const enPlaceholders = value.match(placeholderRegex) || [];
        const jaValue = translations.ja[key as keyof typeof translations.ja];
        const jaPlaceholders = jaValue.match(placeholderRegex) || [];

        // Same placeholders should exist in both languages
        expect(enPlaceholders.sort()).toEqual(jaPlaceholders.sort());
      }
    });
  });

  describe('Story 5.4 specific translations', () => {
    it('has all UI language selector translations', () => {
      expect(t('settings.appLanguage', 'en')).toBe('App Language');
      expect(t('settings.appLanguage', 'ja')).toBe('アプリの言語');

      expect(t('settings.appLanguageHelp', 'en')).toContain('reload');
      expect(t('settings.appLanguageHelp', 'ja')).toContain('再読み込み');
    });

    it('has all translation language selector translations', () => {
      expect(t('settings.translateMessagesTo', 'en')).toBe('Translate Messages To');
      expect(t('settings.translateMessagesTo', 'ja')).toBe('メッセージの翻訳先');

      expect(t('settings.translateMessagesToHelp', 'en')).toContain('translate');
      expect(t('settings.translateMessagesToHelp', 'ja')).toContain('翻訳');
    });

    it('has all toast message translations for language changes', () => {
      expect(t('toast.languageChanging', 'en')).toContain('Reloading');
      expect(t('toast.languageChanging', 'ja')).toContain('リロード');

      expect(t('toast.translationLanguageUpdated', 'en')).toContain('updated');
      expect(t('toast.translationLanguageUpdated', 'ja')).toContain('更新');
    });
  });
});
