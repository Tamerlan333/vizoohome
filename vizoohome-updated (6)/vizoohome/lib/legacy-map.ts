import { DISTRICTS, LEGACY_AREAS, METRO, SETTLEMENTS, labelOf } from "./locations.ts";
export interface LegacyTarget { settlement?: string; district?: string; metro?: string; manual?: string }
const sid = (district: string, name: string) => SETTLEMENTS.find((s) => s.label === name && labelOf(s.parent) === district)?.id as string;
const mid = (name: string) => METRO.find((m) => m.label === name)?.id as string;
const S = (name: string, district: string): [string, LegacyTarget] => [name, { settlement: sid(district, name), district: DISTRICTS.find((d) => d.label === district)?.id }];
const M = (name: string, metro: string): [string, LegacyTarget] => [name, { metro: mid(metro) }];
const MANUAL = (name: string, why: string): [string, LegacyTarget] => [name, { manual: why }];
const byName = new Map<string, LegacyTarget>([
  S("Zabrat", "Sabunçu"), S("Bakıxanov", "Sabunçu"), S("Mərdəkan", "Xəzər"), S("Buzovna", "Xəzər"), S("Şüvəlan", "Xəzər"), S("Əhmədli", "Xətai"), S("Həzi Aslanov", "Xətai"), S("Ağ şəhər", "Xətai"),
  S("Biləcəri", "Binəqədi"), S("8-ci mikrorayon", "Binəqədi"), S("9-cu mikrorayon", "Binəqədi"), S("Hövsan", "Suraxanı"), S("Yeni Günəşli", "Suraxanı"), S("Lökbatan", "Qaradağ"),
  S("Badamdar", "Səbail"), S("Bayıl", "Səbail"), S("20-ci sahə", "Səbail"), S("Keşlə", "Nizami"),
  M("Gənclik", "Gənclik"), M("İnşaatçılar", "İnşaatçılar"), M("Elmlər Akademiyası", "Elmlər Akademiyası"), M("Memar Əcəmi", "Memar Əcəmi"), M("İçərişəhər", "İçəri Şəhər"), M("20 Yanvar", "20 Yanvar"),
  MANUAL("28 May", "metro station and a Binəqədi settlement; old data placed it in Nəsimi"), MANUAL("Sahil", "metro station and a Qaradağ settlement; old data placed it in Səbail"), MANUAL("Montin", "not in the supplied dataset"),
]);
/** old areaId -> new target. Metro mappings change meaning slightly (neighborhood -> nearby station): review before applying. */
export const LEGACY_TO_NEW: Record<string, LegacyTarget> = Object.fromEntries(LEGACY_AREAS.map((a) => [a.id, byName.get(a.label) ?? { manual: "no mapping defined" }]));
