/**
 * Utility functions for session and teaching week date management in Bangkok Timezone (Asia/Bangkok, UTC+7)
 */

export const BANGKOK_TIMEZONE = 'Asia/Bangkok';

/**
 * Safely adds 7 days (1 week) to a date string in YYYY-MM-DD format.
 * Handles month boundaries (28, 29, 30, 31 days) and leap years automatically using JS Date.
 */
export function addOneWeekToDate(dateStr?: string): string {
  let dateObj: Date;

  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [yearStr, monthStr, dayStr] = dateStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1; // 0-indexed month
    const day = parseInt(dayStr, 10);
    dateObj = new Date(year, month, day);
  } else {
    dateObj = new Date();
  }

  // Add 7 days using JavaScript Date's built-in setDate (handles month/year rollover natively)
  dateObj.setDate(dateObj.getDate() + 7);

  const resYear = dateObj.getFullYear();
  const resMonth = String(dateObj.getMonth() + 1).padStart(2, '0');
  const resDay = String(dateObj.getDate()).padStart(2, '0');

  return `${resYear}-${resMonth}-${resDay}`;
}

/**
 * Formats a timestamp into a clean compact date-time string in Bangkok timezone.
 * Example output: "31 ก.ค. 14:57 น."
 */
export function formatBangkokDateTimeCompact(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return '-';
  try {
    const dt = new Date(dateInput);
    if (isNaN(dt.getTime())) return '-';
    const dayMonth = dt.toLocaleDateString('th-TH', {
      timeZone: BANGKOK_TIMEZONE,
      month: 'short',
      day: 'numeric',
    });
    const time = dt.toLocaleTimeString('th-TH', {
      timeZone: BANGKOK_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${dayMonth} ${time} น.`;
  } catch (e) {
    return '-';
  }
}

/**
 * Formats a timestamp into a full date-time string in Bangkok timezone (Asia/Bangkok, UTC+7).
 * Example output: "01/08/2569 13:15:30"
 */
export function formatBangkokDateTime(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return 'ยังไม่เคยสแกน';
  try {
    const dt = new Date(dateInput);
    if (isNaN(dt.getTime())) return 'ยังไม่เคยสแกน';
    return dt.toLocaleString('th-TH', {
      timeZone: BANGKOK_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch (e) {
    return 'ยังไม่เคยสแกน';
  }
}

/**
 * Formats a timestamp into a short date-time string in Bangkok timezone (Asia/Bangkok, UTC+7).
 * Example output: "01/08/2569 13:15"
 */
export function formatBangkokShortDateTime(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return '-';
  try {
    const dt = new Date(dateInput);
    if (isNaN(dt.getTime())) return '-';
    return dt.toLocaleString('th-TH', {
      timeZone: BANGKOK_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch (e) {
    return '-';
  }
}

/**
 * Formats a timestamp into a date-only string in Bangkok timezone (Asia/Bangkok, UTC+7).
 * Example output: "01/08/2569"
 */
export function formatBangkokDate(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return '-';
  try {
    const dt = new Date(dateInput);
    if (isNaN(dt.getTime())) return '-';
    return dt.toLocaleDateString('th-TH', {
      timeZone: BANGKOK_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch (e) {
    return '-';
  }
}

/**
 * Formats a timestamp into a date with abbreviated Thai month name in Bangkok timezone.
 * Example output: "1 ส.ค. 2569"
 */
export function formatBangkokDateThai(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return '-';
  try {
    const dt = new Date(dateInput);
    if (isNaN(dt.getTime())) return '-';
    return dt.toLocaleDateString('th-TH', {
      timeZone: BANGKOK_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (e) {
    return '-';
  }
}

/**
 * Formats a timestamp into a time-only string with "น." suffix in Bangkok timezone (Asia/Bangkok, UTC+7).
 * Example output: "13:15 น."
 */
export function formatBangkokTime(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return '-';
  if (typeof dateInput === 'string' && dateInput.includes('น.')) return dateInput;
  try {
    const dt = new Date(dateInput);
    if (isNaN(dt.getTime())) return typeof dateInput === 'string' ? dateInput : '-';
    return dt.toLocaleTimeString('th-TH', {
      timeZone: BANGKOK_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }) + ' น.';
  } catch (e) {
    return '-';
  }
}

/**
 * Formats a timestamp into time with seconds in Bangkok timezone.
 * Example output: "13:15:30"
 */
export function formatBangkokTimeWithSeconds(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return '-';
  try {
    const dt = new Date(dateInput);
    if (isNaN(dt.getTime())) return '-';
    return dt.toLocaleTimeString('th-TH', {
      timeZone: BANGKOK_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch (e) {
    return '-';
  }
}

/**
 * Returns current date string in YYYY-MM-DD format based on Bangkok timezone.
 */
export function getBangkokTodayDateString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: BANGKOK_TIMEZONE });
}

