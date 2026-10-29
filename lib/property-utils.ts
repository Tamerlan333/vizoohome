import { labelOf } from "./locations.ts";
type Loc = { az?: string; ru?: string; en?: string };
export interface Photo { url: string; alt?: string | null }
export interface Property {
  _id: string; slug: string; title: Loc; description?: Loc; transaction: "sale" | "rent"; propertyType: string;
  cityId: string; districtId?: string; settlementId?: string; metroIds?: string[]; areaId?: string; address?: string; price: number; currency: string; rooms?: number; areaM2?: number;
  floor?: number; totalFloors?: number; buildingType?: "new" | "old" | "not_applicable"; repairStatus?: "repaired" | "unrepaired"; hasTitleDeed?: "yes" | "no";
  featured?: boolean; /** Only fetched for the detail page (see getBySlug); never in list results. */ contactPhone?: string; videoUrl?: string | null; photos?: Photo[];
}
/** Legacy documents may still say "house" or "villa"; both belong to the unified "yard-house" category. */
export const normalizeType = (t: string): string => (t === "house" || t === "villa" ? "yard-house" : t);
export const expandType = (t: string): string[] => (t === "yard-house" ? ["yard-house", "house", "villa"] : [t]);
const pick = (l: Loc | undefined, lang: string): string => (l as Record<string, string | undefined> | undefined)?.[lang] || l?.az || l?.en || l?.ru || "";
export const titleOf = (p: Property, lang = "az") => pick(p.title, lang) || p.slug;
export const descOf = (p: Property, lang = "az") => pick(p.description, lang);
export const locationOf = (p: Property, lang = "az") => [p.settlementId || p.areaId, p.districtId, p.cityId].filter(Boolean).slice(0, 2).map((id) => labelOf(id, lang)).join(", ");
export const img = (url: string, w: number) => `${url}?w=${w}&auto=format`;
