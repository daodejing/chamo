import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadChangelog, getCurrentVersion, getCurrentReleaseDate, hasChanges, type ChangelogVersion } from '../changelog';

describe('changelog utility', () => {
  describe('loadChangelog', () => {
    it('returns changelog data with versions array', () => {
      const changelog = loadChangelog();

      expect(changelog).toBeDefined();
      expect(changelog.versions).toBeDefined();
      expect(Array.isArray(changelog.versions)).toBe(true);
    });

    it('each version has required fields', () => {
      const changelog = loadChangelog();

      for (const version of changelog.versions) {
        expect(version.version).toBeDefined();
        expect(typeof version.version).toBe('string');
        expect(version.date).toBeDefined();
        expect(typeof version.date).toBe('string');
        expect(version.changes).toBeDefined();
        expect(version.changes.features).toBeDefined();
        expect(version.changes.fixes).toBeDefined();
        expect(version.changes.improvements).toBeDefined();
      }
    });

    it('version date is in YYYY-MM-DD format', () => {
      const changelog = loadChangelog();
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;

      for (const version of changelog.versions) {
        expect(version.date).toMatch(datePattern);
      }
    });
  });

  describe('getCurrentVersion', () => {
    it('returns version string from first changelog entry', () => {
      const version = getCurrentVersion();

      expect(version).toBeDefined();
      expect(typeof version).toBe('string');
      expect(version.length).toBeGreaterThan(0);
    });

    it('returns version in semver-like format', () => {
      const version = getCurrentVersion();
      // Should be like "1.0.0" or similar
      expect(version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('getCurrentReleaseDate', () => {
    it('returns date string from first changelog entry', () => {
      const date = getCurrentReleaseDate();

      expect(date).toBeDefined();
      expect(typeof date).toBe('string');
    });

    it('returns date in YYYY-MM-DD format', () => {
      const date = getCurrentReleaseDate();
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;

      expect(date).toMatch(datePattern);
    });
  });

  describe('hasChanges', () => {
    it('returns true when version has features', () => {
      const version: ChangelogVersion = {
        version: '1.0.0',
        date: '2025-01-01',
        changes: {
          features: ['New feature'],
          fixes: [],
          improvements: [],
        },
      };

      expect(hasChanges(version)).toBe(true);
    });

    it('returns true when version has fixes', () => {
      const version: ChangelogVersion = {
        version: '1.0.0',
        date: '2025-01-01',
        changes: {
          features: [],
          fixes: ['Bug fix'],
          improvements: [],
        },
      };

      expect(hasChanges(version)).toBe(true);
    });

    it('returns true when version has improvements', () => {
      const version: ChangelogVersion = {
        version: '1.0.0',
        date: '2025-01-01',
        changes: {
          features: [],
          fixes: [],
          improvements: ['Performance improvement'],
        },
      };

      expect(hasChanges(version)).toBe(true);
    });

    it('returns false when version has no changes', () => {
      const version: ChangelogVersion = {
        version: '1.0.0',
        date: '2025-01-01',
        changes: {
          features: [],
          fixes: [],
          improvements: [],
        },
      };

      expect(hasChanges(version)).toBe(false);
    });
  });
});
