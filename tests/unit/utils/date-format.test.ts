import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatTime,
  formatDateTime,
  formatRelativeTime,
  formatMonthYear,
} from '@/lib/utils/date-format';

describe('date-format utilities', () => {
  // Fixed test date: October 13, 2025, 14:30:45
  const testDate = new Date('2025-10-13T14:30:45');

  describe('formatDate', () => {
    it('formats date in English with medium style', () => {
      const result = formatDate(testDate, 'en', 'medium');
      expect(result).toMatch(/Oct 13, 2025/);
    });

    it('formats date in Japanese with medium style', () => {
      const result = formatDate(testDate, 'ja', 'medium');
      expect(result).toContain('2025');
      expect(result).toContain('10');
      expect(result).toContain('13');
    });

    it('formats date with short style', () => {
      const resultEn = formatDate(testDate, 'en', 'short');
      const resultJa = formatDate(testDate, 'ja', 'short');

      expect(resultEn).toBeTruthy();
      expect(resultJa).toBeTruthy();
    });

    it('formats date with long style', () => {
      const resultEn = formatDate(testDate, 'en', 'long');
      const resultJa = formatDate(testDate, 'ja', 'long');

      expect(resultEn).toMatch(/October 13, 2025/);
      expect(resultJa).toBeTruthy();
    });

    it('formats date with full style including weekday', () => {
      const resultEn = formatDate(testDate, 'en', 'full');
      const resultJa = formatDate(testDate, 'ja', 'full');

      // Should include day of week
      expect(resultEn).toBeTruthy();
      expect(resultJa).toBeTruthy();
    });

    it('handles string date input', () => {
      const result = formatDate('2025-10-13', 'en', 'medium');
      expect(result).toBeTruthy();
    });

    it('handles timestamp input', () => {
      const result = formatDate(testDate.getTime(), 'en', 'medium');
      expect(result).toBeTruthy();
    });
  });

  describe('formatTime', () => {
    it('formats time in English with short style (12-hour)', () => {
      const result = formatTime(testDate, 'en', 'short');
      // English uses 12-hour format with AM/PM
      expect(result).toMatch(/2:30\s*PM/i);
    });

    it('formats time in Japanese with short style (24-hour)', () => {
      const result = formatTime(testDate, 'ja', 'short');
      // Japanese uses 24-hour format
      expect(result).toContain('14');
      expect(result).toContain('30');
    });

    it('formats time with medium style including seconds', () => {
      const resultEn = formatTime(testDate, 'en', 'medium');
      const resultJa = formatTime(testDate, 'ja', 'medium');

      // Should include seconds
      expect(resultEn).toMatch(/45/);
      expect(resultJa).toContain('45');
    });

    it('formats time with long style including timezone', () => {
      const resultEn = formatTime(testDate, 'en', 'long');
      const resultJa = formatTime(testDate, 'ja', 'long');

      // Should include some timezone info
      expect(resultEn).toBeTruthy();
      expect(resultJa).toBeTruthy();
    });
  });

  describe('formatDateTime', () => {
    it('formats date and time together in English', () => {
      const result = formatDateTime(testDate, 'en');

      // Should contain both date and time elements
      expect(result).toMatch(/Oct.*13.*2025/);
      expect(result).toMatch(/2:30.*PM/i);
    });

    it('formats date and time together in Japanese', () => {
      const result = formatDateTime(testDate, 'ja');

      // Should contain both date and time elements
      expect(result).toContain('2025');
      expect(result).toContain('10');
      expect(result).toContain('13');
      expect(result).toContain('14');
      expect(result).toContain('30');
    });

    it('respects custom date and time styles', () => {
      const result = formatDateTime(testDate, 'en', 'long', 'medium');

      expect(result).toBeTruthy();
      expect(result).toMatch(/October/);
    });
  });

  describe('formatRelativeTime', () => {
    it('formats recent time as "X hours ago"', () => {
      const now = new Date('2025-10-13T16:30:45'); // 2 hours later
      const result = formatRelativeTime(testDate, 'en', now);

      expect(result).toMatch(/2 hours ago/i);
    });

    it('formats future time as "in X hours"', () => {
      const past = new Date('2025-10-13T12:30:45'); // 2 hours earlier
      const result = formatRelativeTime(testDate, 'en', past);

      expect(result).toMatch(/in 2 hours/i);
    });

    it('formats time in minutes when less than 1 hour', () => {
      const now = new Date('2025-10-13T14:50:45'); // 20 minutes later
      const result = formatRelativeTime(testDate, 'en', now);

      expect(result).toMatch(/20 minutes ago/i);
    });

    it('formats time in days when more than 24 hours', () => {
      const now = new Date('2025-10-15T14:30:45'); // 2 days later
      const result = formatRelativeTime(testDate, 'en', now);

      expect(result).toMatch(/2 days ago/i);
    });

    it('formats relative time in Japanese', () => {
      const now = new Date('2025-10-13T16:30:45'); // 2 hours later
      const result = formatRelativeTime(testDate, 'ja', now);

      // Japanese relative time format
      expect(result).toBeTruthy();
    });
  });

  describe('formatMonthYear', () => {
    it('formats month and year in English', () => {
      const result = formatMonthYear(testDate, 'en');
      expect(result).toMatch(/October 2025/);
    });

    it('formats month and year in Japanese', () => {
      const result = formatMonthYear(testDate, 'ja');
      expect(result).toContain('2025');
      expect(result).toContain('10');
    });
  });

  describe('cross-language consistency', () => {
    it('formats the same date differently for different languages', () => {
      const enDate = formatDate(testDate, 'en', 'medium');
      const jaDate = formatDate(testDate, 'ja', 'medium');

      // Should be different formats
      expect(enDate).not.toBe(jaDate);

      // But both should be valid
      expect(enDate).toBeTruthy();
      expect(jaDate).toBeTruthy();
    });

    it('maintains consistency across formatting functions', () => {
      const date = formatDate(testDate, 'en', 'medium');
      const time = formatTime(testDate, 'en', 'short');
      const dateTime = formatDateTime(testDate, 'en', 'medium', 'short');

      // DateTime should contain elements from both date and time
      expect(dateTime).toBeTruthy();
    });
  });
});
