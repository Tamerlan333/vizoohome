import test from "node:test"; import assert from "node:assert/strict";
import * as A from "./advanced-filters.ts"; import { parseSearch } from "./search.ts"; import { buildParams, FILTER } from "./query.ts"; import { translate } from "./i18n/dict.ts";
const F = A.emptyAdvancedForm; const P = (q: Record<string, string>, land = false) => A.parseAdvanced(q, { land });
test("condition: only valid values; click active resets; 'any' stays any", () => {
  assert.equal(P({ repair: "repaired" }).repair, "repaired"); assert.equal(P({ repair: "unrepaired" }).repair, "unrepaired"); assert.equal(P({ repair: "x" }).repair, undefined);
  let f = A.pickRepair(F(), "repaired"); assert.equal(f.repair, "repaired"); f = A.pickRepair(f, "unrepaired"); assert.equal(f.repair, "unrepaired");
  f = A.pickRepair(f, "unrepaired"); assert.equal(f.repair, ""); assert.equal(A.pickRepair(F(), "").repair, ""); });
test("area: min only, max only, both inclusive, neither", () => {
  assert.deepEqual([P({ minArea: "60" }).minArea, P({ minArea: "60" }).maxArea], [60, undefined]); assert.deepEqual([P({ maxArea: "150" }).minArea, P({ maxArea: "150" }).maxArea], [undefined, 150]);
  const b = P({ minArea: "60", maxArea: "150" }); assert.deepEqual([b.minArea, b.maxArea], [60, 150]); const n = P({}); assert.deepEqual([n.minArea, n.maxArea], [undefined, undefined]);
  const q = buildParams(parseSearch({ minArea: "60", maxArea: "150" })); assert.deepEqual([q.minArea, q.maxArea], [60, 150]);
  assert.ok(FILTER.includes("areaM2>=$minArea") && FILTER.includes("areaM2<=$maxArea")); });
test("invalid area/floor values are dropped safely", () => {
  const f = P({ minArea: "-5", maxArea: "abc", minFloor: "2.5", maxFloor: "9999" }); assert.deepEqual([f.minArea, f.maxArea, f.minFloor, f.maxFloor], [undefined, undefined, undefined, undefined]);
  assert.equal(P({ minArea: "100", maxArea: "50" }).maxArea, undefined); assert.equal(P({ minFloor: "9", maxFloor: "3" }).maxFloor, undefined); });
test("validation messages (inline errors)", () => {
  assert.equal(A.validateAdvanced({ ...F(), minArea: "100", maxArea: "50" }, { land: false }).area, "adv.errRange"); assert.equal(A.validateAdvanced({ ...F(), minFloor: "5", maxFloor: "2" }, { land: false }).floor, "adv.errRange");
  assert.equal(A.validateAdvanced({ ...F(), minFloor: "1.5" }, { land: false }).floor, "adv.errInt"); assert.equal(A.validateAdvanced({ ...F(), minArea: "-1" }, { land: false }).area, "adv.errNeg");
  assert.deepEqual(A.validateAdvanced({ ...F(), minArea: "60", maxArea: "150", minFloor: "2", maxFloor: "12" }, { land: false }), { area: undefined, floor: undefined });
  assert.equal(A.validateAdvanced({ ...F(), minArea: "", maxArea: "" }, { land: false }).area, undefined); });
test("floor range", () => { const f = P({ minFloor: "2", maxFloor: "12" }); assert.deepEqual([f.minFloor, f.maxFloor], [2, 12]); const q = buildParams(parseSearch({ minFloor: "2" })); assert.deepEqual([q.minFloor, q.maxFloor], [2, null]);
  assert.ok(FILTER.includes("floor>=$minFloor") && FILTER.includes("floor<=$maxFloor")); });
test("special floor filters: first-floor exclusion, top-floor exclusion, top-only use totalFloors", () => {
  assert.equal(buildParams(parseSearch({ excludeFirstFloor: "true" })).exFirst, true); assert.equal(buildParams(parseSearch({})).exFirst, null);
  assert.equal(buildParams(parseSearch({ excludeTopFloor: "true" })).exTop, true); assert.equal(buildParams(parseSearch({ topFloorOnly: "true" })).topOnly, true);
  assert.ok(FILTER.includes("floor!=1")); assert.ok(FILTER.includes("$topOnly==null||(defined(floor)&&defined(totalFloors)&&floor==totalFloors)"));
  assert.ok(FILTER.includes("$exTop==null||!(defined(floor)&&defined(totalFloors)&&floor==totalFloors)")); assert.ok(!FILTER.includes("max(floor")); });
test("contradictory top options cannot coexist", () => {
  let f = A.toggleTop(F(), "excludeTopFloor"); assert.deepEqual([f.excludeTopFloor, f.topFloorOnly], [true, false]); f = A.toggleTop(f, "topFloorOnly"); assert.deepEqual([f.excludeTopFloor, f.topFloorOnly], [false, true]);
  f = A.toggleTop(f, "excludeTopFloor"); assert.deepEqual([f.excludeTopFloor, f.topFloorOnly], [true, false]); f = A.toggleTop(f, "excludeTopFloor"); assert.deepEqual([f.excludeTopFloor, f.topFloorOnly], [false, false]);
  const u = P({ excludeTopFloor: "true", topFloorOnly: "true" }); assert.deepEqual([u.excludeTopFloor, u.topFloorOnly], [false, true]);
  const q = buildParams({ ...parseSearch({}), excludeTopFloor: true, topFloorOnly: true }); assert.deepEqual([q.exTop, q.topOnly], [null, true]);
  assert.equal(A.serializeAdvanced({ ...F(), excludeTopFloor: true, topFloorOnly: true }, { land: false }).excludeTopFloor, undefined); });
test("first-floor exclusion combines with either top option", () => { for (const w of ["excludeTopFloor", "topFloorOnly"] as const) { const f = A.toggleTop({ ...F(), excludeFirstFloor: true }, w); assert.equal(f.excludeFirstFloor, true); assert.equal(f[w], true); } });
test("serialize only active filters; round trip through the URL parser", () => {
  assert.deepEqual(A.serializeAdvanced(F(), { land: false }), {});
  const f = { ...F(), repair: "repaired" as const, minArea: "60", maxArea: "150", minFloor: "2", maxFloor: "12", excludeFirstFloor: true, topFloorOnly: true };
  const o = A.serializeAdvanced(f, { land: false }); assert.deepEqual(o, { repair: "repaired", minArea: "60", maxArea: "150", minFloor: "2", maxFloor: "12", excludeFirstFloor: "true", topFloorOnly: "true" });
  const back = parseSearch(Object.fromEntries(new URLSearchParams(new URLSearchParams(o).toString()))); assert.deepEqual([back.repair, back.minArea, back.maxArea, back.minFloor, back.maxFloor, back.excludeFirstFloor, back.excludeTopFloor, back.topFloorOnly], ["repaired", 60, 150, 2, 12, true, false, true]);
  assert.deepEqual(A.formFromFilters(back), { ...f, excludeTopFloor: false }); assert.equal(A.countActive(f, { land: false }), 5); });
test("land ignores repair and floor filters; area still applies", () => {
  const s = parseSearch({ type: "land", repair: "repaired", minFloor: "3", topFloorOnly: "true", excludeFirstFloor: "true", minArea: "600" }); assert.deepEqual([s.repair, s.minFloor, s.topFloorOnly, s.excludeFirstFloor, s.minArea], [undefined, undefined, false, false, 600]);
  assert.deepEqual(A.serializeAdvanced({ ...F(), repair: "repaired", minFloor: "3", minArea: "600" }, { land: true }), { minArea: "600" }); });
test("composes with existing filters; unrelated params preserved; defaults add nothing", () => {
  const s = parseSearch({ district: "dist-nesimi", metro: "metro-sahil", type: "apartment", building: "new", rooms: "3", minPrice: "100", maxPrice: "900", page: "3", repair: "repaired", minArea: "60", topFloorOnly: "true" });
  const p = buildParams(s); assert.deepEqual([p.districts, p.metro, p.types, p.building, p.rooms, p.min, p.max, p.from, p.repair, p.minArea, p.topOnly], [["dist-nesimi"], ["metro-sahil"], ["apartment"], "new", 3, 100, 900, 24, "repaired", 60, true]);
  const d = buildParams(parseSearch({})); assert.deepEqual([d.repair, d.minArea, d.maxArea, d.minFloor, d.maxFloor, d.exFirst, d.exTop, d.topOnly], [null, null, null, null, null, null, null, null]);
  assert.ok(FILTER.includes("repairStatus==$repair") && FILTER.includes("districtId in $districts") && FILTER.includes("price>=$min")); assert.ok(!/\$\{/.test(FILTER)); });
test("labels in az / ru / en", () => {
  const L: [string, string, string, string][] = [["adv.toggle", "Ətraflı Axtarış", "Расширенный поиск", "Advanced search"], ["adv.hide", "Filtrləri gizlət", "Скрыть фильтры", "Hide filters"], ["adv.repair", "Təmir", "Ремонт", "Renovation"], ["adv.any", "Fərqi yoxdur", "Не важно", "Any"],
    ["adv.area", "Sahə (m²)", "Площадь (м²)", "Area (m²)"], ["adv.floor", "Mərtəbə", "Этаж", "Floor"], ["adv.min", "min.", "мин.", "min."], ["adv.max", "maks.", "макс.", "max."], ["adv.notFirst", "1-ci olmasın", "Не первый", "Not first floor"],
    ["adv.notTop", "Ən üst olmasın", "Не последний", "Not top floor"], ["adv.onlyTop", "Yalnız ən üst", "Только последний", "Top floor only"], ["adv.apply", "Tətbiq et", "Применить", "Apply"], ["adv.reset", "Sıfırla", "Сбросить", "Reset"], ["b.repaired", "Təmirli", "С ремонтом", "Renovated"], ["b.unrepaired", "Təmirsiz", "Без ремонта", "Not renovated"]];
  for (const [k, a, r, e] of L) { assert.equal(translate("az", k), a); assert.equal(translate("ru", k), r); assert.equal(translate("en", k), e); } });
