/**
 * Date Utilities for RestroFlow POS
 * Converts date strings between legacy DD-MM-YYYY and ISO YYYY-MM-DD for database sorting.
 */

export function formatToISODate(dateStr: string): string {
  if (!dateStr) return dateStr;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
  }
  return dateStr;
}

export function formatFromISODate(isoDateStr: string): string {
  if (!isoDateStr) return isoDateStr;
  const parts = isoDateStr.split('-');
  if (parts.length === 3 && parts[0].length === 4 && parts[2].length === 2) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY
  }
  return isoDateStr;
}
