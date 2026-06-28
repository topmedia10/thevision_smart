/**
 * Normalize an Israeli phone number to canonical E.164 (+9725XXXXXXXX).
 * Returns null if it cannot be resolved to a valid IL mobile number.
 *
 * IL mobile numbers are 05X-XXXXXXX (10 digits local) → +9725XXXXXXXX.
 */
export function normalizeIsraeliPhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/[^\d+]/g, "");

  // Strip a leading + for uniform processing, remember nothing else.
  if (digits.startsWith("+")) digits = digits.slice(1);

  // 00 international prefix → drop.
  if (digits.startsWith("00")) digits = digits.slice(2);

  // Cases:
  //  972XXXXXXXXX  (country code, no +)
  //  0XXXXXXXXX    (local with trunk 0)
  //  5XXXXXXXX     (bare mobile without trunk 0)
  if (digits.startsWith("972")) {
    digits = digits.slice(3);
  } else if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // Now `digits` should be the subscriber number: 5XXXXXXXX (9 digits, starts 5).
  if (!/^5\d{8}$/.test(digits)) return null;

  return `+972${digits}`;
}

export function isValidIsraeliMobile(raw: string | undefined | null): boolean {
  return normalizeIsraeliPhone(raw) !== null;
}
