import { ABSERON_ID, BAKU_ID, DISTRICTS, DISTRICT_NODES, METRO, REGIONS, SETTLEMENTS, labelOf, parentOf, settlementsOf } from "./locations.ts";
export interface Selection { city?: string; districts: string[]; settlements: string[]; metro: string[] }
export const emptySelection = (): Selection => ({ districts: [], settlements: [], metro: [] });
export type CheckState = "checked" | "partial" | "none";
const MAX = 100;
const uniq = (a: string[]) => [...new Set(a)];
const toggle = (a: string[], id: string) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]);
/** Canonical form: valid ids only, no duplicates, children of a selected district dropped, full child sets promoted to the district. */
export function normalize(raw: { city?: string; districts?: string[]; settlements?: string[]; metro?: string[] }): Selection {
  let districts = uniq((raw.districts ?? []).filter((d) => DISTRICT_NODES.some((x) => x.id === d))).slice(0, MAX);
  let settlements = uniq((raw.settlements ?? []).filter((s) => SETTLEMENTS.some((x) => x.id === s))).slice(0, MAX);
  let metro = uniq((raw.metro ?? []).filter((m) => METRO.some((x) => x.id === m))).slice(0, MAX);
  settlements = settlements.filter((s) => !districts.includes(parentOf(s) as string));
  for (const d of DISTRICT_NODES) { const kids = settlementsOf(d.id).map((k) => k.id); if (kids.length && !districts.includes(d.id) && kids.every((k) => settlements.includes(k))) { districts.push(d.id); settlements = settlements.filter((s) => !kids.includes(s)); } }
  let city = raw.city && REGIONS.some((r) => r.id === raw.city) ? raw.city : undefined;
  if (city && city !== BAKU_ID) { districts = []; settlements = []; metro = []; }
  else if (city === BAKU_ID && (districts.length || settlements.length)) city = undefined;
  return { city, districts: districts.sort(), settlements: settlements.sort(), metro: metro.sort() };
}
export function districtState(sel: Selection, id: string): CheckState {
  if (sel.districts.includes(id)) return "checked";
  return settlementsOf(id).some((k) => sel.settlements.includes(k.id)) ? "partial" : "none";
}
export const isSettlementChecked = (sel: Selection, id: string) => sel.settlements.includes(id) || sel.districts.includes(parentOf(id) as string);
export function toggleDistrict(sel: Selection, id: string): Selection {
  if (sel.districts.includes(id)) return normalize({ ...sel, districts: sel.districts.filter((d) => d !== id) });
  const kids = settlementsOf(id).map((k) => k.id);
  return normalize({ ...sel, districts: [...sel.districts, id], settlements: sel.settlements.filter((s) => !kids.includes(s)) });
}
export function toggleSettlement(sel: Selection, id: string): Selection {
  const p = parentOf(id); if (!p) return sel;
  if (sel.districts.includes(p)) return normalize({ ...sel, districts: sel.districts.filter((d) => d !== p), settlements: [...sel.settlements, ...settlementsOf(p).map((k) => k.id).filter((k) => k !== id)] });
  return normalize({ ...sel, settlements: toggle(sel.settlements, id) });
}
export const toggleMetro = (sel: Selection, id: string): Selection => normalize({ ...sel, metro: toggle(sel.metro, id) });
export const selectAllMetro = (sel: Selection, ids: string[] = METRO.map((m) => m.id)): Selection => normalize({ ...sel, metro: [...sel.metro, ...ids] });
export const clearMetro = (sel: Selection): Selection => ({ ...sel, metro: [] });
export const selectAllBaku = (sel: Selection): Selection => normalize({ ...sel, city: undefined, districts: [...sel.districts, ...DISTRICTS.map((d) => d.id)] });
export const setAllBaku = (sel: Selection): Selection => ({ city: BAKU_ID, districts: [], settlements: [], metro: sel.metro });
export const setCity = (sel: Selection, id: string): Selection => normalize({ city: id || undefined, districts: id === BAKU_ID ? sel.districts : [], settlements: id === BAKU_ID ? sel.settlements : [], metro: id === BAKU_ID ? sel.metro : [] });
export const countSelected = (s: Selection) => s.districts.length + s.settlements.length + s.metro.length + (s.city ? 1 : 0);
export type ChipKind = "city" | "district" | "settlement" | "metro";
export interface Chip { kind: ChipKind; id: string; label: string; detail?: string }
export function chipsOf(s: Selection, lang = "az"): Chip[] {
  return [...(s.city ? [{ kind: "city" as const, id: s.city, label: labelOf(s.city, lang) }] : []),
    ...s.districts.map((id) => ({ kind: "district" as const, id, label: labelOf(id, lang) })),
    ...s.settlements.map((id) => ({ kind: "settlement" as const, id, label: labelOf(id, lang), detail: labelOf(parentOf(id), lang) })),
    ...s.metro.map((id) => ({ kind: "metro" as const, id, label: labelOf(id, lang) }))];
}
export function removeChip(s: Selection, kind: ChipKind, id: string): Selection {
  if (kind === "city") return { ...s, city: undefined };
  if (kind === "district") return { ...s, districts: s.districts.filter((x) => x !== id) };
  if (kind === "settlement") return { ...s, settlements: s.settlements.filter((x) => x !== id) };
  return { ...s, metro: s.metro.filter((x) => x !== id) };
}
/** URL form: ?city=…&district=a,b&area=x,y&metro=m1,m2 (stable ids only; "area" holds settlement ids). */
export function serializeSelection(s: Selection): Record<string, string> {
  const o: Record<string, string> = {};
  if (s.city) o.city = s.city; if (s.districts.length) o.district = s.districts.join(","); if (s.settlements.length) o.area = s.settlements.join(","); if (s.metro.length) o.metro = s.metro.join(",");
  return o;
}
const split = (v: string | undefined) => (v ? v.slice(0, 4000).split(",").map((x) => x.trim()).filter(Boolean) : []);
/** `rejected` is true when location params were supplied but none of the ids were valid (callers show no results instead of everything). */
export function parseSelection(q: { city?: string; district?: string; area?: string; metro?: string }): Selection & { rejected: boolean } {
  const given = [...split(q.district), ...split(q.area), ...split(q.metro), ...(q.city ? [q.city] : [])];
  const sel = normalize({ city: q.city, districts: split(q.district), settlements: split(q.area), metro: split(q.metro) });
  return { ...sel, rejected: given.length > 0 && countSelected(sel) === 0 };
}
export { ABSERON_ID };
