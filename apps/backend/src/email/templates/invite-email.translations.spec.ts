import {
  getInviteEmailTranslation,
  formatTranslation,
  inviteEmailTranslations,
} from './invite-email.translations';

describe('Invite Email Translations', () => {
  describe('getInviteEmailTranslation', () => {
    it('should return English translations for "en"', () => {
      const translation = getInviteEmailTranslation('en');
      expect(translation.greeting).toBe("You're almost there!");
      expect(translation.cta).toBe('Create your account');
    });

    it('should return Japanese translations for "ja"', () => {
      const translation = getInviteEmailTranslation('ja');
      expect(translation.greeting).toBe('もう少しです！');
      expect(translation.cta).toBe('アカウントを作成');
    });

    it('should return Spanish translations for "es"', () => {
      const translation = getInviteEmailTranslation('es');
      expect(translation.greeting).toBe('¡Ya casi está!');
      expect(translation.cta).toBe('Crear tu cuenta');
    });

    it('should fall back to English for unsupported language codes', () => {
      const translation = getInviteEmailTranslation('xyz');
      expect(translation.greeting).toBe("You're almost there!");
      expect(translation.cta).toBe('Create your account');
    });

    it('should fall back to English for empty language code', () => {
      const translation = getInviteEmailTranslation('');
      expect(translation.greeting).toBe("You're almost there!");
    });
  });

  describe('formatTranslation', () => {
    it('should replace single placeholder', () => {
      const result = formatTranslation('Hello {name}!', { name: 'John' });
      expect(result).toBe('Hello John!');
    });

    it('should replace multiple placeholders', () => {
      const result = formatTranslation('{inviterName} invited you to {familyName}', {
        inviterName: 'Alice',
        familyName: 'The Smiths',
      });
      expect(result).toBe('Alice invited you to The Smiths');
    });

    it('should handle missing placeholders gracefully', () => {
      const result = formatTranslation('Hello {name}!', {});
      expect(result).toBe('Hello {name}!');
    });

    it('should replace same placeholder multiple times', () => {
      const result = formatTranslation('{name} and {name} again', { name: 'Bob' });
      expect(result).toBe('Bob and Bob again');
    });
  });

  describe('inviteEmailTranslations coverage', () => {
    const supportedLanguages = [
      'en', 'ja', 'es', 'fr', 'de', 'zh', 'ko', 'pt',
      'ru', 'ar', 'it', 'nl', 'pl', 'tr', 'vi', 'th',
      'id', 'hi', 'sv', 'no',
    ];

    it('should have translations for all 20 supported languages', () => {
      expect(Object.keys(inviteEmailTranslations)).toHaveLength(20);
    });

    supportedLanguages.forEach((lang) => {
      it(`should have complete translations for "${lang}"`, () => {
        const translation = inviteEmailTranslations[lang];
        expect(translation).toBeDefined();
        expect(translation.subject).toBeDefined();
        expect(translation.greeting).toBeDefined();
        expect(translation.intro).toBeDefined();
        expect(translation.cta).toBeDefined();
        expect(translation.note).toBeDefined();
        expect(translation.footer).toBeDefined();
      });
    });

    it('should have placeholders in subject for all languages', () => {
      supportedLanguages.forEach((lang) => {
        const translation = inviteEmailTranslations[lang];
        expect(translation.subject).toContain('{familyName}');
      });
    });

    it('should have placeholders in intro for all languages', () => {
      supportedLanguages.forEach((lang) => {
        const translation = inviteEmailTranslations[lang];
        expect(translation.intro).toContain('{inviterName}');
        expect(translation.intro).toContain('{familyName}');
      });
    });
  });
});
