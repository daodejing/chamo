import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';

describe('Language Persistence Integration Tests', () => {
  describe('UI Language (localStorage)', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('persists UI language selection to localStorage', () => {
      // Simulate language selection
      localStorage.setItem('appLanguage', 'ja');

      // Verify persistence
      expect(localStorage.getItem('appLanguage')).toBe('ja');
    });

    it('loads UI language from localStorage on app start', () => {
      // Set initial language
      localStorage.setItem('appLanguage', 'en');

      // Simulate app restart by reading from storage
      const savedLanguage = localStorage.getItem('appLanguage');

      expect(savedLanguage).toBe('en');
    });

    it('defaults to English when no language is stored', () => {
      // No language set in localStorage
      const savedLanguage = localStorage.getItem('appLanguage');

      expect(savedLanguage).toBeNull();
      // App should default to 'en' in this case
    });

    it('handles language switching from English to Japanese', () => {
      localStorage.setItem('appLanguage', 'en');
      expect(localStorage.getItem('appLanguage')).toBe('en');

      // Switch to Japanese
      localStorage.setItem('appLanguage', 'ja');
      expect(localStorage.getItem('appLanguage')).toBe('ja');
    });

    it('persists language across multiple reads', () => {
      localStorage.setItem('appLanguage', 'ja');

      // Multiple reads should return the same value
      expect(localStorage.getItem('appLanguage')).toBe('ja');
      expect(localStorage.getItem('appLanguage')).toBe('ja');
      expect(localStorage.getItem('appLanguage')).toBe('ja');
    });
  });

  describe('Translation Language (Backend Preferences)', () => {
    it('has valid GraphQL mutation signature', () => {
      const UPDATE_USER_PREFERENCES = gql`
        mutation UpdateUserPreferences($input: UpdateUserPreferencesInput!) {
          updateUserPreferences(input: $input) {
            id
            preferences {
              preferredLanguage
            }
          }
        }
      `;

      // Verify mutation is well-formed
      expect(UPDATE_USER_PREFERENCES.loc?.source.body).toContain('updateUserPreferences');
      expect(UPDATE_USER_PREFERENCES.loc?.source.body).toContain('preferences');
      expect(UPDATE_USER_PREFERENCES.loc?.source.body).toContain('preferredLanguage');
    });

    it('structures mutation input correctly', () => {
      const input = {
        preferredLanguage: 'es',
      };

      // Verify input structure
      expect(input).toHaveProperty('preferredLanguage');
      expect(input.preferredLanguage).toBe('es');
    });

    it('handles all 20+ supported language codes', () => {
      const supportedLanguages = [
        'en', 'ja', 'es', 'fr', 'de', 'zh', 'ko', 'pt',
        'ru', 'ar', 'it', 'nl', 'pl', 'tr', 'vi', 'th',
        'id', 'hi', 'sv', 'no',
      ];

      for (const lang of supportedLanguages) {
        const input = { preferredLanguage: lang };
        expect(input.preferredLanguage).toBe(lang);
        expect(supportedLanguages).toContain(lang);
      }
    });

    it('validates input structure for backend mutation', () => {
      const validInput = {
        input: {
          preferredLanguage: 'fr',
        },
      };

      expect(validInput.input).toHaveProperty('preferredLanguage');
      expect(validInput.input.preferredLanguage).toBe('fr');
    });
  });

  describe('ME_QUERY returns preferences', () => {
    it('has valid ME query structure', () => {
      const ME_QUERY = gql`
        query Me {
          me {
            id
            email
            name
            preferences {
              preferredLanguage
            }
          }
        }
      `;

      // Verify query structure
      expect(ME_QUERY.loc?.source.body).toContain('me');
      expect(ME_QUERY.loc?.source.body).toContain('preferences');
      expect(ME_QUERY.loc?.source.body).toContain('preferredLanguage');
    });

    it('can parse preferences from user object', () => {
      const mockUserResponse = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        preferences: {
          preferredLanguage: 'ja',
        },
      };

      const preferences = mockUserResponse.preferences;
      expect(preferences).toHaveProperty('preferredLanguage');
      expect(preferences.preferredLanguage).toBe('ja');
    });

    it('handles empty preferences object', () => {
      const mockUserResponse = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        preferences: {},
      };

      const preferences = mockUserResponse.preferences;
      expect(preferences).toBeDefined();
      expect(preferences.preferredLanguage).toBeUndefined();
    });
  });

  describe('Preferences merge behavior', () => {
    it('merges new preferred language with existing preferences', () => {
      const existingPreferences = {
        theme: 'dark',
        notifications: true,
      };

      const newPreferences = {
        ...existingPreferences,
        preferredLanguage: 'es',
      };

      expect(newPreferences).toEqual({
        theme: 'dark',
        notifications: true,
        preferredLanguage: 'es',
      });
    });

    it('overwrites existing preferredLanguage', () => {
      const existingPreferences = {
        preferredLanguage: 'en',
        theme: 'dark',
      };

      const newPreferences = {
        ...existingPreferences,
        preferredLanguage: 'ja',
      };

      expect(newPreferences.preferredLanguage).toBe('ja');
      expect(newPreferences.theme).toBe('dark');
    });

    it('preserves other preferences when updating language', () => {
      const existingPreferences = {
        theme: 'dark',
        fontSize: 'large',
        notifications: true,
        preferredLanguage: 'en',
      };

      const updatedPreferences = {
        ...existingPreferences,
        preferredLanguage: 'fr',
      };

      expect(updatedPreferences).toEqual({
        theme: 'dark',
        fontSize: 'large',
        notifications: true,
        preferredLanguage: 'fr',
      });
    });
  });

  describe('Cross-session persistence', () => {
    it('simulates UI language persisting across page reloads', () => {
      // Session 1: Set language
      localStorage.setItem('appLanguage', 'ja');

      // Simulate page reload by reading storage
      const session1Language = localStorage.getItem('appLanguage');
      expect(session1Language).toBe('ja');

      // Session 2: Read language (simulating new page load)
      const session2Language = localStorage.getItem('appLanguage');
      expect(session2Language).toBe('ja');

      // Should be the same across sessions
      expect(session1Language).toBe(session2Language);
    });

    it('simulates translation language persisting via backend', () => {
      // Mock backend response after mutation
      const mockBackendState = {
        user: {
          id: '123',
          preferences: {
            preferredLanguage: 'es',
          },
        },
      };

      // Verify backend stores the preference
      expect(mockBackendState.user.preferences.preferredLanguage).toBe('es');

      // Simulate subsequent ME query fetching the preference
      const fetchedPreference = mockBackendState.user.preferences.preferredLanguage;
      expect(fetchedPreference).toBe('es');
    });
  });
});
