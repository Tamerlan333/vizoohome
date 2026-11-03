const MAP: Record<string, string> = { ə: "e", ı: "i", ö: "o", ü: "u", ç: "c", ş: "s", ğ: "g" };
export function slugify(s: string): string {
  return s.toLowerCase().replace(/\u0307/g, "").replace(/[əıöüçşğ]/g, (c) => MAP[c]).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
export function makeSlug(title: string, rand: () => string = () => Math.random().toString(36).slice(2, 6)): string {
  return `${slugify(title).slice(0, 60).replace(/-$/, "") || "elan"}-${rand()}`;
}
