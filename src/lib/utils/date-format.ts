import { Language } from "@/lib/translations";

/**
 * Date formatting options for different use cases
 */
export type DateFormatStyle =
  | "short"      // e.g., "10/13/25" or "2025/10/13"
  | "medium"     // e.g., "Oct 13, 2025" or "2025年10月13日"
  | "long"       // e.g., "October 13, 2025" or "2025年10月13日"
  | "full";      // e.g., "Monday, October 13, 2025" or "2025年10月13日 月曜日"

export type TimeFormatStyle =
  | "short"      // e.g., "2:30 PM" or "14:30"
  | "medium"     // e.g., "2:30:45 PM" or "14:30:45"
  | "long";      // e.g., "2:30:45 PM GMT+9" or "14時30分45秒 GMT+9"

/**
 * Format a date according to the specified language and style
 * Uses Intl.DateTimeFormat for browser-native localization
 *
 * @param date - The date to format
 * @param language - UI language ('en' or 'ja')
 * @param style - Formatting style (default: 'medium')
 * @returns Localized date string
 *
 * @example
 * formatDate(new Date('2025-10-13'), 'en') // "Oct 13, 2025"
 * formatDate(new Date('2025-10-13'), 'ja') // "2025年10月13日"
 */
export function formatDate(
  date: Date | string | number,
  language: Language,
  style: DateFormatStyle = "medium"
): string {
  const dateObj = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  const locale = language === "ja" ? "ja-JP" : "en-US";

  let options: Intl.DateTimeFormatOptions;
  switch (style) {
    case "short":
      options = { year: "2-digit", month: "numeric", day: "numeric" };
      break;
    case "long":
      options = { year: "numeric", month: "long", day: "numeric" };
      break;
    case "full":
      options = { year: "numeric", month: "long", day: "numeric", weekday: "long" };
      break;
    case "medium":
    default:
      options = { year: "numeric", month: "short", day: "numeric" };
      break;
  }

  return new Intl.DateTimeFormat(locale, options).format(dateObj);
}

/**
 * Format a time according to the specified language and style
 *
 * @param date - The date/time to format
 * @param language - UI language ('en' or 'ja')
 * @param style - Formatting style (default: 'short')
 * @returns Localized time string
 *
 * @example
 * formatTime(new Date('2025-10-13T14:30:00'), 'en') // "2:30 PM"
 * formatTime(new Date('2025-10-13T14:30:00'), 'ja') // "14:30"
 */
export function formatTime(
  date: Date | string | number,
  language: Language,
  style: TimeFormatStyle = "short"
): string {
  const dateObj = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  const locale = language === "ja" ? "ja-JP" : "en-US";

  let options: Intl.DateTimeFormatOptions;
  switch (style) {
    case "medium":
      options = { hour: "numeric", minute: "2-digit", second: "2-digit" };
      break;
    case "long":
      options = {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
      };
      break;
    case "short":
    default:
      options = { hour: "numeric", minute: "2-digit" };
      break;
  }

  return new Intl.DateTimeFormat(locale, options).format(dateObj);
}

/**
 * Format both date and time together
 *
 * @param date - The date/time to format
 * @param language - UI language ('en' or 'ja')
 * @param dateStyle - Date formatting style (default: 'medium')
 * @param timeStyle - Time formatting style (default: 'short')
 * @returns Localized date-time string
 *
 * @example
 * formatDateTime(new Date('2025-10-13T14:30:00'), 'en')
 * // "Oct 13, 2025, 2:30 PM"
 *
 * formatDateTime(new Date('2025-10-13T14:30:00'), 'ja')
 * // "2025年10月13日 14:30"
 */
export function formatDateTime(
  date: Date | string | number,
  language: Language,
  dateStyle: DateFormatStyle = "medium",
  timeStyle: TimeFormatStyle = "short"
): string {
  const dateObj = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  const locale = language === "ja" ? "ja-JP" : "en-US";

  let dateOptions: Intl.DateTimeFormatOptions;
  switch (dateStyle) {
    case "short":
      dateOptions = { year: "2-digit", month: "numeric", day: "numeric" };
      break;
    case "long":
      dateOptions = { year: "numeric", month: "long", day: "numeric" };
      break;
    case "full":
      dateOptions = { year: "numeric", month: "long", day: "numeric", weekday: "long" };
      break;
    case "medium":
    default:
      dateOptions = { year: "numeric", month: "short", day: "numeric" };
      break;
  }

  let timeOptions: Intl.DateTimeFormatOptions;
  switch (timeStyle) {
    case "medium":
      timeOptions = { hour: "numeric", minute: "2-digit", second: "2-digit" };
      break;
    case "long":
      timeOptions = {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
      };
      break;
    case "short":
    default:
      timeOptions = { hour: "numeric", minute: "2-digit" };
      break;
  }

  const options = { ...dateOptions, ...timeOptions };

  return new Intl.DateTimeFormat(locale, options).format(dateObj);
}

/**
 * Format a relative time (e.g., "2 hours ago", "in 3 days")
 *
 * @param date - The date to compare
 * @param language - UI language ('en' or 'ja')
 * @param baseDate - Base date for comparison (default: now)
 * @returns Localized relative time string
 *
 * @example
 * formatRelativeTime(new Date(Date.now() - 2 * 60 * 60 * 1000), 'en')
 * // "2 hours ago"
 *
 * formatRelativeTime(new Date(Date.now() - 2 * 60 * 60 * 1000), 'ja')
 * // "2時間前"
 */
export function formatRelativeTime(
  date: Date | string | number,
  language: Language,
  baseDate: Date = new Date()
): string {
  const dateObj = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  const locale = language === "ja" ? "ja-JP" : "en-US";

  const diffInSeconds = Math.floor((baseDate.getTime() - dateObj.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  // Determine appropriate unit
  if (Math.abs(diffInSeconds) < 60) {
    return rtf.format(-diffInSeconds, "second");
  } else if (Math.abs(diffInSeconds) < 3600) {
    return rtf.format(-Math.floor(diffInSeconds / 60), "minute");
  } else if (Math.abs(diffInSeconds) < 86400) {
    return rtf.format(-Math.floor(diffInSeconds / 3600), "hour");
  } else if (Math.abs(diffInSeconds) < 604800) {
    return rtf.format(-Math.floor(diffInSeconds / 86400), "day");
  } else if (Math.abs(diffInSeconds) < 2592000) {
    return rtf.format(-Math.floor(diffInSeconds / 604800), "week");
  } else if (Math.abs(diffInSeconds) < 31536000) {
    return rtf.format(-Math.floor(diffInSeconds / 2592000), "month");
  } else {
    return rtf.format(-Math.floor(diffInSeconds / 31536000), "year");
  }
}

/**
 * Format month and year (e.g., "October 2025" or "2025年10月")
 * Useful for calendar headers
 *
 * @param date - The date to format
 * @param language - UI language ('en' or 'ja')
 * @returns Localized month-year string
 */
export function formatMonthYear(date: Date | string | number, language: Language): string {
  const dateObj = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  const locale = language === "ja" ? "ja-JP" : "en-US";

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
  }).format(dateObj);
}
