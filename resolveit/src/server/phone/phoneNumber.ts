/** Normalizes a phone number to E.164 (+ and 8–15 digits). Returns null when it cannot. */
export function normalizePhoneNumber(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  // Ten digits without a country code are treated as US/Canada, matching the Vapi number region.
  if (!trimmed.startsWith("+") && digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}
