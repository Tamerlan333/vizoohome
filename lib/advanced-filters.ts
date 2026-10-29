import { REPAIR_OPTIONS } from "./property-fields.ts";
/** Advanced search filters. Reuses the existing Sanity fields: repairStatus, areaM2, floor, totalFloors (no schema change). */
export type Repair = "repaired" | "unrepaired";
export interface AdvancedFilters { repair?: Repair; minArea?: number; maxArea?: number; minFloor?: number; maxFloor?: number; excludeFirstFloor: boolean; excludeTopFloor: boolean; topFloorOnly: boolean }
/** UI form state: raw strings so users can type and clear naturally. */
export interface AdvancedForm { repair: "" | Repair; minArea: string; maxArea: string; minFloor: string; maxFloor: string; excludeFirstFloor: boolean; excludeTopFloor: boolean; topFloorOnly: boolean }
export const emptyAdvancedForm = (): AdvancedForm => ({ repair: "", minArea: "", maxArea: "", minFloor: "", maxFloor: "", excludeFirstFloor: false, excludeTopFloor: false, topFloorOnly: false });
const MAX_AREA = 100000, MAX_FLOOR = 100;
type Q = Record<string, string | string[] | undefined>;
const str = (q: Q, k: string) => (typeof q[k] === "string" ? (q[k] as string) : undefined);
const num = (v: string | undefined, int: boolean, max: number): number | undefined => {
  if (v === undefined || v.trim() === "") return undefined; const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= max && (!int || Number.isInteger(n)) ? n : undefined;
};
/** Parses URL params. Invalid values are dropped; min>max drops the max; contradictory top-floor flags -> topFloorOnly wins. Land ignores repair/floor filters. */
export function parseAdvanced(q: Q, opts: { land: boolean }): AdvancedFilters {
  const r = str(q, "repair"); const repair: Repair | undefined = opts.land ? undefined : REPAIR_OPTIONS.some((o) => o.value === r) ? (r as Repair) : undefined;
  const minArea = num(str(q, "minArea"), false, MAX_AREA); let maxArea = num(str(q, "maxArea"), false, MAX_AREA);
  if (minArea !== undefined && maxArea !== undefined && maxArea < minArea) maxArea = undefined;
  let minFloor = opts.land ? undefined : num(str(q, "minFloor"), true, MAX_FLOOR); let maxFloor = opts.land ? undefined : num(str(q, "maxFloor"), true, MAX_FLOOR);
  if (minFloor !== undefined && maxFloor !== undefined && maxFloor < minFloor) maxFloor = undefined;
  const on = (k: string) => !opts.land && str(q, k) === "true";
  const topFloorOnly = on("topFloorOnly");
  return { repair, minArea, maxArea, minFloor, maxFloor, excludeFirstFloor: on("excludeFirstFloor"), excludeTopFloor: on("excludeTopFloor") && !topFloorOnly, topFloorOnly };
}
export const formFromFilters = (f: Partial<AdvancedFilters>): AdvancedForm => ({ repair: f.repair ?? "", minArea: f.minArea?.toString() ?? "", maxArea: f.maxArea?.toString() ?? "", minFloor: f.minFloor?.toString() ?? "", maxFloor: f.maxFloor?.toString() ?? "",
  excludeFirstFloor: !!f.excludeFirstFloor, excludeTopFloor: !!f.excludeTopFloor && !f.topFloorOnly, topFloorOnly: !!f.topFloorOnly });
function range(min: string, max: string, int: boolean, cap: number): string | undefined {
  const a = min.trim() === "" ? undefined : Number(min), b = max.trim() === "" ? undefined : Number(max);
  if ((a !== undefined && !Number.isFinite(a)) || (b !== undefined && !Number.isFinite(b))) return "adv.errNeg";
  if ((a !== undefined && a < 0) || (b !== undefined && b < 0)) return "adv.errNeg";
  if (int && ((a !== undefined && !Number.isInteger(a)) || (b !== undefined && !Number.isInteger(b)))) return "adv.errInt";
  if ((a !== undefined && a > cap) || (b !== undefined && b > cap)) return "adv.errNeg";
  if (a !== undefined && b !== undefined && a > b) return "adv.errRange";
}
/** Returns i18n keys of inline errors; floor is not validated for land (its inputs are hidden). */
export function validateAdvanced(f: AdvancedForm, opts: { land: boolean }): { area?: string; floor?: string } {
  return { area: range(f.minArea, f.maxArea, false, MAX_AREA), floor: opts.land ? undefined : range(f.minFloor, f.maxFloor, true, MAX_FLOOR) };
}
/** Only active, meaningful, valid filters become URL params (empty = omitted). */
export function serializeAdvanced(f: AdvancedForm, opts: { land: boolean }): Record<string, string> {
  const o: Record<string, string> = {}; const e = validateAdvanced(f, opts);
  if (!opts.land && f.repair) o.repair = f.repair;
  if (!e.area) { if (f.minArea.trim()) o.minArea = String(Number(f.minArea)); if (f.maxArea.trim()) o.maxArea = String(Number(f.maxArea)); }
  if (!opts.land) {
    if (!e.floor) { if (f.minFloor.trim()) o.minFloor = String(Number(f.minFloor)); if (f.maxFloor.trim()) o.maxFloor = String(Number(f.maxFloor)); }
    if (f.excludeFirstFloor) o.excludeFirstFloor = "true"; if (f.topFloorOnly) o.topFloorOnly = "true"; else if (f.excludeTopFloor) o.excludeTopFloor = "true";
  }
  return o;
}
/** "Ən üst olmasın" and "Yalnız ən üst" are mutually exclusive; clicking the active one turns it off. */
export function toggleTop(f: AdvancedForm, which: "excludeTopFloor" | "topFloorOnly"): AdvancedForm {
  return which === "topFloorOnly" ? { ...f, topFloorOnly: !f.topFloorOnly, excludeTopFloor: false } : { ...f, excludeTopFloor: !f.excludeTopFloor, topFloorOnly: false };
}
/** Clicking the active condition returns to "any" (""), clicking "any" keeps it. */
export const pickRepair = (f: AdvancedForm, v: "" | Repair): AdvancedForm => ({ ...f, repair: v !== "" && f.repair === v ? "" : v });
export function countActive(f: AdvancedForm, opts: { land: boolean }): number {
  const s = serializeAdvanced(f, opts); return (s.repair ? 1 : 0) + (s.minArea || s.maxArea ? 1 : 0) + (s.minFloor || s.maxFloor ? 1 : 0) + (s.excludeFirstFloor ? 1 : 0) + (s.excludeTopFloor ? 1 : 0) + (s.topFloorOnly ? 1 : 0);
}
