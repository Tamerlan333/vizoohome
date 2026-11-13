// Deterministic price formatting. PropertyCard is a client component, so this runs on the server (Node ICU) AND in the
// browser (its own ICU). Intl.NumberFormat output differs between engines (currency symbol, space characters), which caused
// React hydration error #418. This hand-written formatter returns the same string everywhere; it reproduces the
// Intl output for az-AZ / ru-RU / en-US with maximumFractionDigits: 0 exactly as the server rendered it before.
const NBSP = " ";
type Style = { group: string; symbols: Record<string, string>; before: boolean; gap: string };
const STYLES: Record<string, Style> = {
  az: { group: ".", symbols: { AZN: "₼", USD: "US$", EUR: "€" }, before: false, gap: NBSP },
  ru: { group: NBSP, symbols: { AZN: "AZN", USD: "$", EUR: "€" }, before: false, gap: NBSP },
  en: { group: ",", symbols: { AZN: `AZN${NBSP}`, USD: "$", EUR: "€" }, before: true, gap: "" },
};

export const formatPrice = (n: number, currency: string, lang: string, suffix = ""): string => {
  const s = STYLES[lang] ?? STYLES.az;
  const sign = n < 0 ? "-" : "";
  const digits = String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, s.group); // round half away from zero, like Intl
  const sym = s.symbols[currency] ?? (s.before ? `${currency}${NBSP}` : currency);
  return (s.before ? `${sign}${sym}${digits}` : `${sign}${digits}${s.gap}${sym}`) + suffix;
};
