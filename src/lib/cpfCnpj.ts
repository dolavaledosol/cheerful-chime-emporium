/**
 * Format CPF (11 digits) or CNPJ (14 digits) with mask.
 * CPF: 000.000.000-00
 * CNPJ: 00.000.000/0000-00
 */
export function formatCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/**
 * Extract only digits from a CPF/CNPJ string, max 14.
 */
export function unformatCpfCnpj(value: string): string {
  return value.replace(/\D/g, "").slice(0, 14);
}

/**
 * Validate CPF checksum (11 digits).
 */
export function validateCpf(value: string): boolean {
  const d = value.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(d[i]) * (10 - i);
  let r = (s * 10) % 11;
  if (r === 10) r = 0;
  if (r !== parseInt(d[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(d[i]) * (11 - i);
  r = (s * 10) % 11;
  if (r === 10) r = 0;
  return r === parseInt(d[10]);
}

/**
 * Validate CNPJ checksum (14 digits).
 */
export function validateCnpj(value: string): boolean {
  const d = value.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let s = 0;
  for (let i = 0; i < 12; i++) s += parseInt(d[i]) * w1[i];
  let r = s % 11;
  const d1 = r < 2 ? 0 : 11 - r;
  if (parseInt(d[12]) !== d1) return false;
  s = 0;
  for (let i = 0; i < 13; i++) s += parseInt(d[i]) * w2[i];
  r = s % 11;
  const d2 = r < 2 ? 0 : 11 - r;
  return parseInt(d[13]) === d2;
}

/**
 * Validate CPF or CNPJ based on digit count.
 * Returns error message or null if valid.
 */
export function validateCpfCnpj(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return null; // empty is ok (optional)
  if (digits.length <= 11) {
    if (digits.length !== 11) return "CPF deve ter 11 dígitos";
    if (!validateCpf(digits)) return "CPF inválido";
  } else {
    if (digits.length !== 14) return "CNPJ deve ter 14 dígitos";
    if (!validateCnpj(digits)) return "CNPJ inválido";
  }
  return null;
}
