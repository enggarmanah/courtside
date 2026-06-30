/**
 * WhatsApp number formatting utilities.
 *
 * Rules:
 * - If the number starts with 8 (e.g. 87733342024):
 *     - Display as 0 + number (087733342024)
 *     - Link uses 62 + number (6287733342024)
 * - Otherwise the number is returned as-is (digits only).
 */

/**
 * Returns true if the number is present, non-empty, and not "0".
 */
export const isValidWhatsApp = (num: string | undefined | null): num is string => {
  const trimmed = num?.trim();
  return !!trimmed && trimmed !== '0' && trimmed.length > 0;
};

/**
 * Strips all non-digit characters from a phone number.
 */
export const digitsOnly = (num: string): string => num.replace(/\D/g, '');

/**
 * Returns the display version of a WA number:
 *   - 87733342024 → 087733342024
 *   - other        → digits-only as-is
 */
export const formatWhatsAppDisplay = (num: string): string => {
  const cleaned = digitsOnly(num);
  if (cleaned.startsWith('8')) {
    return `0${cleaned}`;
  }
  return cleaned;
};

/**
 * Returns the wa.me link target for a WA number:
 *   - 87733342024 → 6287733342024
 *   - other        → digits-only as-is
 */
export const formatWhatsAppLink = (num: string): string => {
  const cleaned = digitsOnly(num);
  if (cleaned.startsWith('8')) {
    return `62${cleaned}`;
  }
  return cleaned;
};
