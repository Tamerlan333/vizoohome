import { slugify as sl } from "./slug.ts";
export type LocKind = "region" | "district" | "settlement" | "metro";
export interface Loc { id: string; label: string }
export interface Settlement extends Loc { parent: string }
const mk = (p: string, n: string[], x = ""): Loc[] => n.map((v) => ({ id: p + sl(v), label: v + x }));
export const BAKU_ID = "city-baki";
export const ABSERON_ID = "rayon-abseron";
export const CITIES = mk("city-", ["Bakı", "Sumqayıt", "Gəncə", "Xırdalan", "Mingəçevir", "Lənkəran", "Şəki", "Qəbələ", "Quba", "Şamaxı", "Şirvan", "Naxçıvan", "Şuşa şəhəri"]);
export const RAYONS = mk("rayon-", ["Abşeron", "Quba", "Qəbələ", "Lənkəran", "Şamaxı", "İsmayıllı", "Qusar", "Xaçmaz", "Qax", "Zaqatala", "Balakən", "Oğuz", "Göygöl", "Tovuz", "Şəmkir", "Ağdaş", "Ağcabədi", "Masallı", "Astara", "Cəlilabad", "Füzuli", "Laçın", "Kəlbəcər", "Ağdam"], " rayonu");
/** Single-choice regions (cityId). "Abşeron rayonu" keeps its existing id and stays distinct from Bakı city. */
export const REGIONS: Loc[] = [...CITIES, ...RAYONS];
/** The 12 administrative districts of Bakı city (districtId). */
export const DISTRICTS = mk("dist-", ["Binəqədi", "Xətai", "Xəzər", "Qaradağ", "Nərimanov", "Nəsimi", "Nizami", "Pirallahı", "Sabunçu", "Səbail", "Suraxanı", "Yasamal"]);
export const ABSERON: Loc = { id: ABSERON_ID, label: "Abşeron rayonu" };
/** Selectable district-level nodes: Bakı's districts plus Abşeron (supplied as its own district-level group). */
export const DISTRICT_NODES: Loc[] = [...DISTRICTS, ABSERON];
const D = (n: string) => "dist-" + sl(n);
const GROUPS: [string, string[]][] = [
  [ABSERON_ID, ["Aşağı Güzdək", "Atyalı", "Ceyranbatan", "Çiçək", "Digah", "Fatmayı", "Görədil", "Güzdək", "Hökməli", "Köhnə Corat", "Qobu", "Masazır", "Mehdiabad", "Məmmədli", "Novxanı", "Pirəkəşkül", "Saray", "Yeni Corat", "Zuğulba"]],
  [D("Binəqədi"), ["2-ci Alatava", "28 May", "6-cı mikrorayon", "7-ci mikrorayon", "8-ci mikrorayon", "9-cu mikrorayon", "Biləcəri", "Binəqədi", "Xocəsən", "Xutor", "M.Ə.Rəsulzadə", "Sulutəpə"]],
  [D("Xətai"), ["Ağ şəhər", "Əhmədli", "Həzi Aslanov", "Köhnə Günəşli", "NZS"]],
  [D("Xəzər"), ["Binə", "Buzovna", "Dübəndi", "Gürgən", "Qala", "Mərdəkan", "Şağan", "Şimal DRES", "Şüvəlan", "Türkan", "Zirə"]],
  [D("Nərimanov"), ["Böyükşor"]],
  [D("Nəsimi"), ["1-ci mikrorayon", "2-ci mikrorayon", "3-cü mikrorayon", "4-cü mikrorayon", "5-ci mikrorayon", "Kubinka"]],
  [D("Nizami"), ["8-ci kilometr", "Keşlə"]],
  [D("Pirallahı"), ["Pirallahı"]],
  [D("Qaradağ"), ["Ələt", "Qızıldaş", "Qobustan", "Lökbatan", "Müşfiqabad", "Puta", "Sahil", "Səngəçal", "Şubanı"]],
  [D("Sabunçu"), ["Albalılıq", "Bakıxanov", "Balaxanı", "Bilgəh", "Kürdəxanı", "Maştağa", "Nardaran", "Pirşağı", "Ramana", "Sabunçu", "Savalan", "Sea Breeze", "Yeni Balaxanı", "Yeni Ramana", "Zabrat"]],
  [D("Səbail"), ["20-ci sahə", "Badamdar", "Bayıl", "Bibiheybət", "Şıxov"]],
  [D("Suraxanı"), ["Bahar", "Bülbülə", "Dədə Qorqud", "Əmircan", "Günəşli", "Hövsan", "Qaraçuxur", "Massiv A", "Massiv B", "Massiv D", "Massiv G", "Massiv V", "Suraxanı", "Şərq", "Yeni Günəşli", "Yeni Suraxanı", "Zığ"]],
  [D("Yasamal"), ["Yasamal", "Yeni Yasamal"]],
];
/** Settlements/neighborhoods. Id = settle-<district>-<name>, so equal names in different places never collide. */
export const SETTLEMENTS: Settlement[] = GROUPS.flatMap(([pid, names]) => names.map((n) => ({ id: `settle-${pid.replace(/^(dist|rayon)-/, "")}-${sl(n)}`, label: n, parent: pid })));
/** Metro stations: a separate category (metroIds), never mixed with districts or settlements. */
export const METRO: Loc[] = mk("metro-", ["20 Yanvar", "28 May", "8 Noyabr", "Avtovağzal", "Azadlıq Prospekti", "Bakmil", "Dərnəgül", "Elmlər Akademiyası", "Əhmədli", "Gənclik", "Həzi Aslanov", "Xalqlar Dostluğu", "Xocəsən", "İçəri Şəhər", "İnşaatçılar", "Koroğlu", "Qara Qarayev", "Memar Əcəmi", "Neftçilər", "Nəriman Nərimanov", "Nəsimi", "Nizami", "Sahil", "Şah İsmayıl Xətai", "Ulduz"]);
/** Legacy single-area ids (old areaId field). Kept only so old listings still display; see lib/legacy-map.ts. */
export const LEGACY_AREAS: Loc[] = mk("area-", ["28 May", "Sahil", "İçərişəhər", "Gənclik", "20 Yanvar", "Elmlər Akademiyası", "İnşaatçılar", "Memar Əcəmi", "8-ci mikrorayon", "9-cu mikrorayon", "20-ci sahə", "Ağ şəhər", "Yeni Günəşli", "Əhmədli", "Həzi Aslanov", "Biləcəri", "Bakıxanov", "Zabrat", "Mərdəkan", "Şüvəlan", "Buzovna", "Hövsan", "Lökbatan", "Badamdar", "Bayıl", "Montin", "Keşlə"]);
const L10N: Record<string, { ru: string; en: string }> = { "city-baki": { ru: "Баку", en: "Baku" } };
const ALL: Loc[] = [...REGIONS, ...DISTRICTS, ...SETTLEMENTS, ...METRO, ...LEGACY_AREAS];
export const labelOf = (id?: string | null, lang: string = "az"): string => {
  if (!id) return "";
  const l = L10N[id]; if (l && (lang === "ru" || lang === "en")) return l[lang];
  return ALL.find((o) => o.id === id)?.label ?? "";
};
export const settlementsOf = (districtId: string): Settlement[] => SETTLEMENTS.filter((s) => s.parent === districtId);
export const parentOf = (settlementId: string): string | undefined => SETTLEMENTS.find((s) => s.id === settlementId)?.parent;
/** Search-friendly text: lowercase, Azerbaijani letters folded to ASCII ("Nəsimi" matches "nesimi"). */
const FOLD: Record<string, string> = { ə: "e", ı: "i", ö: "o", ü: "u", ç: "c", ş: "s", ğ: "g" };
export const fold = (s: string): string => s.toLowerCase().replace(/\u0307/g, "").replace(/[əıöüçşğ]/g, (c) => FOLD[c]);
/** Validates a stored location. Settlement must belong to the chosen district (Abşeron settlements belong to cityId=Abşeron). */
export function isValidLocation(city: string, district = "", settlement = ""): boolean {
  if (!REGIONS.some((o) => o.id === city)) return false;
  if (district && (city !== BAKU_ID || !DISTRICTS.some((d) => d.id === district))) return false;
  if (settlement) {
    const s = SETTLEMENTS.find((x) => x.id === settlement); if (!s) return false;
    if (s.parent === ABSERON_ID) return city === ABSERON_ID && !district;
    return city === BAKU_ID && (!district || district === s.parent);
  }
  return true;
}
