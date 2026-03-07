/**
 * Smart phone mask: +55 (00) 90000-0000
 * Defaults: country code 55, area code 31
 */

const DEFAULT_COUNTRY = "55";
const DEFAULT_DDD = "31";

export function formatTelefone(value: string): string {
  // Extract only digits
  let digits = value.replace(/\D/g, "");

  // If starts with 55 and has more than 11 digits, strip country code for formatting
  if (digits.startsWith("55") && digits.length > 11) {
    digits = digits.slice(2);
  }

  // Cap at 11 digits (DDD + number)
  digits = digits.slice(0, 11);

  if (digits.length === 0) return "+55 (31) ";
  if (digits.length <= 2) return `+55 (${digits}`;
  if (digits.length <= 7) return `+55 (${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    // Landline: +55 (00) 0000-0000
    return `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  // Mobile: +55 (00) 90000-0000
  return `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Extract digits for DB persistence: always includes country code 55.
 * e.g. "5531900000000" (13 digits for mobile)
 */
export function unformatTelefone(value: string): string {
  let digits = value.replace(/\D/g, "");

  // If already starts with 55 and has 12-13 digits, it's complete
  if (digits.startsWith("55") && digits.length >= 12) {
    return digits.slice(0, 13);
  }

  // If it's national digits only (10-11), prepend 55
  if (digits.length >= 10 && digits.length <= 11) {
    return "55" + digits;
  }

  // Partial or empty — return as-is (won't pass validation anyway)
  if (digits.startsWith("55")) {
    return digits.slice(0, 13);
  }
  return digits.length > 0 ? "55" + digits.slice(0, 11) : "";
}

/**
 * Format for display (read-only contexts).
 * If digits are empty, returns "—".
 */
export function displayTelefone(value: string): string {
  const digits = unformatTelefone(value);
  if (digits.length === 0) return "—";
  return formatTelefone(digits);
}

/**
 * Handle phone input change: formats and limits.
 * Returns the formatted value.
 */
export function handleTelefoneInput(rawValue: string): string {
  return formatTelefone(rawValue);
}

/**
 * Returns default empty phone value with prefilled codes.
 */
export function defaultTelefone(): string {
  return `+${DEFAULT_COUNTRY} (${DEFAULT_DDD}) `;
}
