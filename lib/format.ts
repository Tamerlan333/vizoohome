const LOC: Record<string, string> = { az: "az-AZ", ru: "ru-RU", en: "en-US" };
export const formatPrice = (n: number, currency: string, lang: string, suffix = ""): string =>
  new Intl.NumberFormat(LOC[lang] ?? "az-AZ", { style: "currency", currency, maximumFractionDigits: 0 }).format(n) + suffix;
