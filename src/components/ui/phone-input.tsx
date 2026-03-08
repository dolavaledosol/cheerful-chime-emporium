import React from "react";
import PhoneInputLib from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Phone input with country flag dropdown.
 * Value is in E.164 format: +5531999870106
 * Default country: BR
 */
const PhoneInput = React.forwardRef<HTMLDivElement, PhoneInputProps>(
  ({ value, onChange, placeholder = "Número de telefone", className, disabled }, ref) => {
    return (
      <div ref={ref} className={cn("phone-input-wrapper", className)}>
        <PhoneInputLib
          international
          defaultCountry="BR"
          value={value || ""}
          onChange={(val) => onChange(val || "")}
          placeholder={placeholder}
          disabled={disabled}
        />
      </div>
    );
  }
);

PhoneInput.displayName = "PhoneInput";

export { PhoneInput };

/**
 * Convert E.164 phone to digits-only for DB storage.
 * "+5531999870106" → "5531999870106"
 */
export function phoneToDigits(e164: string): string {
  return e164.replace(/\D/g, "");
}

/**
 * Convert digits from DB to E.164 for the component.
 * "5531999870106" → "+5531999870106"
 */
export function digitsToPhone(digits: string): string {
  if (!digits) return "";
  const clean = digits.replace(/\D/g, "");
  if (!clean) return "";
  return clean.startsWith("+") ? clean : `+${clean}`;
}

/**
 * Format phone digits for display (read-only contexts).
 */
export function displayPhone(digits: string): string {
  if (!digits) return "—";
  const phone = digitsToPhone(digits);
  // Simple formatting for Brazilian numbers
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) {
    const national = d.slice(2);
    const ddd = national.slice(0, 2);
    if (national.length === 11) {
      return `+55 (${ddd}) ${national.slice(2, 7)}-${national.slice(7)}`;
    }
    if (national.length === 10) {
      return `+55 (${ddd}) ${national.slice(2, 6)}-${national.slice(6)}`;
    }
  }
  return `+${d}`;
}
