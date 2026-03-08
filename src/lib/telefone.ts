/**
 * @deprecated Use PhoneInput component and its utility functions instead.
 * Kept for backward compatibility during migration.
 */

export { phoneToDigits as unformatTelefone, digitsToPhone as formatTelefone, displayPhone as displayTelefone } from "@/components/ui/phone-input";

export function defaultTelefone(): string {
  return "";
}

export function handleTelefoneInput(rawValue: string): string {
  return rawValue;
}

export function validateTelefone(digits: string): string | null {
  if (!digits || digits.length === 0) return null;
  const clean = digits.replace(/\D/g, "");
  if (clean.length < 10) return "Telefone incompleto";
  return null;
}
