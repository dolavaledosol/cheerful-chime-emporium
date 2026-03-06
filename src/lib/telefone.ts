/**
 * Smart phone mask supporting:
 * - Mobile (11 digits): (00) 00000-0000
 * - Landline (10 digits): (00) 0000-0000
 */
export function formatTelefone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    // Landline: (00) 0000-0000
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  // Mobile: (00) 00000-0000
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Extract only digits from a formatted phone string, max 11.
 */
export function unformatTelefone(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

/**
 * Handle phone input change: formats and limits to 11 digits.
 * Returns the formatted value.
 */
export function handleTelefoneInput(rawValue: string): string {
  return formatTelefone(rawValue);
}
