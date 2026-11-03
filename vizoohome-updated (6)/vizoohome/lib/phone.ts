/** Contact-phone helpers (pure). Accepts Azerbaijani formats and international numbers; stores nothing, only normalizes for display and links. */
export interface Contact { display: string; tel: string; wa: string }
const AZ = "994";
/** Returns E.164 ("+994501234567") or null when the text is not a plausible phone number. */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim(); if (!s || s.length > 40 || /[^\d\s()+\-.]/.test(s)) return null;
  const plus = s.startsWith("+"); if (s.lastIndexOf("+") > 0 || (!plus && s.includes("+"))) return null;
  let d = s.replace(/\D/g, "");
  if (!plus) {
    if (d.startsWith("00")) d = d.slice(2);
    else if (d.startsWith(AZ) && d.length === 12) { /* already international */ }
    else if (d.startsWith("0") && d.length === 10) d = AZ + d.slice(1);       // 050 123 45 67, (012) 123-45-67
    else if (d.length === 9 && !d.startsWith("0")) d = AZ + d;                // 50 123 45 67
    else return null;
  }
  if (d.startsWith(AZ)) return /^994[1-9]\d{8}$/.test(d) ? `+${d}` : null;    // Azerbaijan: exactly 9 national digits
  return /^[1-9]\d{7,14}$/.test(d) ? `+${d}` : null;                           // other countries: E.164, 8-15 digits
}
export const isValidPhone = (raw: unknown): boolean => normalizePhone(raw) !== null;
export function formatPhone(e164: string): string {
  const m = /^\+994(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(e164); return m ? `+994 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : e164;
}
export const telHref = (e164: string): string => `tel:${e164}`;
export const waHref = (e164: string, text?: string): string => `https://wa.me/${e164.slice(1)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
/** null when the number is missing or invalid, so callers can hide the whole contact block. */
export function contactOf(raw: unknown, waText?: string): Contact | null {
  const n = normalizePhone(raw); return n ? { display: formatPhone(n), tel: telHref(n), wa: waHref(n, waText) } : null;
}
