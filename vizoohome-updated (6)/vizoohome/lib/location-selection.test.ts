import test from "node:test"; import assert from "node:assert/strict";
import * as S from "./location-selection.ts"; import { settlementsOf, DISTRICTS } from "./locations.ts"; import { buildParams, FILTER } from "./query.ts"; import { parseSearch } from "./search.ts";
const E = S.emptySelection(); const NES = "dist-nesimi", BIN = "dist-bineqedi"; const kids = (d: string) => settlementsOf(d).map((k) => k.id);
test("selecting a district implies all children", () => { const s = S.toggleDistrict(E, NES); assert.deepEqual(s.districts, [NES]); assert.equal(S.districtState(s, NES), "checked"); assert.ok(kids(NES).every((k) => S.isSettlementChecked(s, k))); });
test("deselecting a district clears it", () => { const s = S.toggleDistrict(S.toggleDistrict(E, NES), NES); assert.deepEqual([s.city, s.districts, s.settlements, s.metro], [undefined, [], [], []]); });
test("one child -> partial; district not selected", () => { const s = S.toggleSettlement(E, kids(NES)[0]); assert.equal(S.districtState(s, NES), "partial"); assert.deepEqual(s.districts, []); assert.equal(s.settlements.length, 1); });
test("all children -> promoted to district (no duplicates)", () => { let s = E; for (const k of kids(NES)) s = S.toggleSettlement(s, k); assert.deepEqual(s.districts, [NES]); assert.deepEqual(s.settlements, []); });
test("unchecking a child of a selected district demotes to the other children", () => { const s = S.toggleSettlement(S.toggleDistrict(E, BIN), kids(BIN)[0]); assert.deepEqual(s.districts, []); assert.equal(s.settlements.length, kids(BIN).length - 1); assert.equal(S.districtState(s, BIN), "partial"); });
test("selecting a district drops its explicit children", () => { const s = S.toggleDistrict(S.toggleSettlement(E, kids(BIN)[0]), BIN); assert.deepEqual([s.districts, s.settlements], [[BIN], []]); });
test("multiple districts and settlements across districts", () => { let s = S.toggleDistrict(E, NES); s = S.toggleDistrict(s, "dist-yasamal"); s = S.toggleSettlement(s, "settle-sebail-bayil"); s = S.toggleSettlement(s, "settle-xezer-buzovna"); assert.equal(s.districts.length, 2); assert.equal(s.settlements.length, 2); });
test("metro: multiple, independent of same-name settlement/district", () => { let s = S.toggleMetro(E, "metro-28-may"); s = S.toggleMetro(s, "metro-nesimi"); assert.deepEqual(s.metro, ["metro-28-may", "metro-nesimi"]); assert.deepEqual([s.districts, s.settlements], [[], []]);
  s = S.toggleMetro(s, "metro-28-may"); assert.deepEqual(s.metro, ["metro-nesimi"]); });
test("select all / clear metro", () => { const s = S.selectAllMetro(E); assert.equal(s.metro.length, 25); assert.equal(S.clearMetro(s).metro.length, 0); assert.equal(S.selectAllBaku(E).districts.length, DISTRICTS.length); });
test("city rules", () => { assert.equal(S.setAllBaku(S.toggleMetro(E, "metro-sahil")).metro.length, 1); assert.deepEqual(S.setCity(S.toggleDistrict(E, NES), "city-gence"), { city: "city-gence", districts: [], settlements: [], metro: [] });
  assert.equal(S.normalize({ city: "city-baki", districts: [NES] }).city, undefined); assert.equal(S.normalize({ city: "city-baki", metro: ["metro-sahil"] }).city, "city-baki"); });
test("chips and removal", () => { const s = S.toggleMetro(S.toggleSettlement(S.toggleDistrict(E, NES), "settle-sebail-bayil"), "metro-sahil"); const c = S.chipsOf(s); assert.equal(c.length, 3); assert.equal(S.countSelected(s), 3);
  const r = S.removeChip(s, "metro", "metro-sahil"); assert.equal(r.metro.length, 0); assert.equal(r.districts.length, 1); });
test("URL round trip", () => { const s = S.toggleMetro(S.toggleMetro(S.toggleSettlement(S.toggleDistrict(E, NES), "settle-sebail-bayil"), "metro-sahil"), "metro-28-may");
  const o = S.serializeSelection(s); const back = S.parseSelection(o); assert.deepEqual({ ...back, rejected: undefined }, { ...s, rejected: undefined }); assert.equal(back.rejected, false);
  const q = new URLSearchParams(o).toString(); const parsed = Object.fromEntries(new URLSearchParams(q)); assert.deepEqual(S.parseSelection(parsed).metro, s.metro); });
test("invalid ids rejected; fully invalid flagged; legacy area dropped", () => {
  const p = S.parseSelection({ district: "dist-nesimi,bogus,dist-nesimi", metro: "metro-nope,metro-sahil" }); assert.deepEqual([p.districts, p.metro, p.rejected], [[NES], ["metro-sahil"], false]);
  assert.equal(S.parseSelection({ metro: "nope" }).rejected, true); assert.equal(S.parseSelection({ area: "area-genclik" }).rejected, true); assert.equal(S.parseSelection({}).rejected, false);
  assert.equal(parseSearch({ metro: "x" }).badLocation, true); });
test("query params: arrays default empty, OR/AND clauses present", () => {
  const p = buildParams(parseSearch({ district: `${NES},dist-yasamal`, metro: "metro-sahil,metro-28-may", type: "yard-house", rooms: "3", minPrice: "10", page: "2" }));
  assert.deepEqual(p.districts, [NES, "dist-yasamal"]); assert.deepEqual(p.metro, ["metro-28-may", "metro-sahil"]); assert.deepEqual(p.settlements, []); assert.deepEqual(p.types, ["yard-house", "house", "villa"]); assert.equal(p.rooms, 3); assert.equal(p.min, 10); assert.equal(p.from, 12);
  const none = buildParams(parseSearch({})); assert.deepEqual([none.districts, none.settlements, none.metro, none.city], [[], [], [], null]);
  for (const part of ["districtId in $districts", "cityId in $districts", "settlementId in $settlements", "metroIds[@ in $metro]", "propertyType in $types", "price>=$min"]) assert.ok(FILTER.includes(part), part); });
