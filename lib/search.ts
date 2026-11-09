import { parseSelection } from "./location-selection.ts";
import { normalizeType } from "./property-utils.ts";
import { BUILDING_FILTER_VALUES, PROPERTY_TYPES } from "./property-fields.ts";
import { parseAdvanced, type AdvancedFilters } from "./advanced-filters.ts";
import { polygonFromParam, type GeoPolygon } from "./geo.ts";
export interface SearchParams extends AdvancedFilters { transaction: "sale" | "rent"; city?: string; districts: string[]; settlements: string[]; metro: string[]; badLocation: boolean; type?: string; building?: "new" | "old"; rooms?: number; minPrice?: number; maxPrice?: number; page: number; /** Draw-to-search area from the "poly" URL parameter. Only present when valid (an invalid value is ignored). */ polygon?: GeoPolygon }
type Q = Record<string, string | string[] | undefined>;
const TYPES: string[] = PROPERTY_TYPES.map((o) => o.value);
const num = (v: string | undefined): number | undefined => { if (v === undefined || v === "") return undefined; const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : undefined; };
export function parseSearch(q: Q): SearchParams {
  const s = (k: string): string | undefined => (typeof q[k] === "string" ? (q[k] as string) : undefined);
  const sel = parseSelection({ city: s("city"), district: s("district"), area: s("area"), metro: s("metro") });
  const t = normalizeType(s("type") ?? ""); const type = TYPES.includes(t) ? t : undefined;
  const b = s("building"); const building = type === "land" ? undefined : (BUILDING_FILTER_VALUES as readonly string[]).includes(b ?? "") ? (b as "new" | "old") : undefined;
  let rooms = num(s("rooms")); if (rooms !== undefined && (rooms < 1 || rooms > 5 || !Number.isInteger(rooms))) rooms = undefined; if (type === "land") rooms = undefined;
  const minPrice = num(s("minPrice")); let maxPrice = num(s("maxPrice"));
  if (minPrice !== undefined && maxPrice !== undefined && maxPrice < minPrice) maxPrice = undefined;
  const adv = parseAdvanced(q, { land: type === "land" });
  const page = Math.max(1, Math.floor(num(s("page")) ?? 1));
  /** "poly" (not "area": that name already means a settlement in the location filter). */
  const poly = polygonFromParam(s("poly"));
  return { transaction: s("transaction") === "rent" ? "rent" : "sale", city: sel.city, districts: sel.districts, settlements: sel.settlements, metro: sel.metro, badLocation: sel.rejected, type, building, rooms, minPrice, maxPrice, page, ...adv, ...(poly.ok ? { polygon: poly.polygon } : {}) };
}
