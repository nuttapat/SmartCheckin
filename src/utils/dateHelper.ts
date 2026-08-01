/**
 * Utility functions for session and teaching week date management
 */

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
 * Formats a timestamp into a full date-time string in Bangkok timezone (Asia/Bangkok, UTC+7).
 * Example output: "01/08/2569 13:15:30"
 */
export function formatBangkokDateTime(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return 'ยังไม่เคยสแกน';
  try {
    const dt = new Date(dateInput);
    if (isNaN(dt.getTime())) return 'ยังไม่เคยสแกน';
    return dt.toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
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
 * Formats a timestamp into a time-only string in Bangkok timezone (Asia/Bangkok, UTC+7).
 * Example output: "13:15 น."
 */
export function formatBangkokTime(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return '-';
  try {
    const dt = new Date(dateInput);
    if (isNaN(dt.getTime())) return '-';
    return dt.toLocaleTimeString('th-TH', {
      timeZone: 'Asia/Bangkok',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }) + ' น.';
  } catch (e) {
    return '-';
  }
}
