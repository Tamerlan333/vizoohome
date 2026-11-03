import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
import * as F from "./property-fields.ts"; import { parseSearch } from "./search.ts"; import { buildParams, FILTER } from "./query.ts"; import { expandType, normalizeType } from "./property-utils.ts";
import { REPAIR_OPTIONS } from "./property-fields.ts"; import { parseAdvanced } from "./advanced-filters.ts";
const schema = fs.readFileSync("sanity/schemaTypes/property.ts", "utf8"); const props = fs.readFileSync("lib/properties.ts", "utf8");
test("canonical values and Azerbaijani labels", () => {
  assert.deepEqual(F.TRANSACTIONS.map((o) => [o.value, o.title]), [["sale", "Satış"], ["rent", "Kirayə"]]);
  assert.deepEqual(F.PROPERTY_TYPES.map((o) => o.title), ["Mənzil", "Həyət / Bağ evi", "Torpaq", "Kommersiya obyekti", "Digər"]);
  assert.deepEqual(F.BUILDING_TYPES.map((o) => o.title), ["Yeni tikili", "Köhnə tikili", "Aid deyil"]); assert.deepEqual(F.REPAIR_OPTIONS.map((o) => o.title), ["Təmirli", "Təmirsiz"]);
  assert.deepEqual(F.ROOM_OPTIONS.map((o) => o.title), ["1", "2", "3", "4", "5+"]); assert.ok(F.ROOM_OPTIONS.every((o) => typeof o.value === "number")); assert.deepEqual(F.CURRENCIES, ["AZN", "USD", "EUR"]); });
test("every property type the Studio offers is accepted by the website search", () => { for (const o of F.PROPERTY_TYPES) assert.equal(parseSearch({ type: o.value }).type, o.value, o.value);
  assert.equal(F.PROPERTY_TYPES.filter((o) => o.title.includes("Həyət")).length, 1); for (const l of F.LEGACY_PROPERTY_TYPES) { assert.equal(normalizeType(l), "yard-house"); assert.ok(expandType("yard-house").includes(l)); } });
test("building type: only new/old are searchable; 'not_applicable' and missing never match", () => {
  for (const v of F.BUILDING_FILTER_VALUES) assert.equal(parseSearch({ building: v }).building, v); assert.equal(parseSearch({ building: "not_applicable" }).building, undefined);
  assert.ok(F.BUILDING_TYPES.some((o) => o.value === "not_applicable")); assert.ok(FILTER.includes("$building==null||buildingType==$building")); assert.equal(buildParams(parseSearch({})).building, null); assert.equal(parseSearch({ type: "land", building: "new" }).building, undefined); });
test("repair values are shared between Studio and URL filter", () => { for (const o of REPAIR_OPTIONS) assert.equal(parseAdvanced({ repair: o.value }, { land: false }).repair, o.value); assert.equal(parseAdvanced({ repair: "renovated" }, { land: false }).repair, undefined); });
test("rooms: stored as integer, 5+ means >= 5, any = no restriction", () => {
  assert.equal(buildParams(parseSearch({ rooms: "5" })).rooms, 5); assert.equal(buildParams(parseSearch({})).rooms, null); assert.equal(buildParams(parseSearch({ rooms: "3" })).rooms, 3);
  assert.ok(FILTER.includes("($rooms>=5&&rooms>=5)||($rooms<5&&rooms==$rooms)")); assert.ok(schema.includes("ROOM_OPTIONS") && schema.includes("MAX_ROOMS")); });
test("price filter is in AZN and never silently converts other currencies", () => {
  assert.ok(FILTER.includes('coalesce(currency,"AZN")=="AZN"&&price>=$min') && FILTER.includes('coalesce(currency,"AZN")=="AZN"&&price<=$max'));
  const p = buildParams(parseSearch({ minPrice: "100", maxPrice: "900" })); assert.deepEqual([p.min, p.max], [100, 900]); assert.ok(schema.includes("positive()")); });
test("top floor uses floor == totalFloors and needs both values", () => { assert.ok(FILTER.includes("defined(floor)&&defined(totalFloors)&&floor==totalFloors")); assert.equal(F.MAX_FLOOR, 100); assert.ok(schema.includes("min(1)") && schema.includes("MAX_FLOOR")); });
test("schema defines every field the website queries or filters on", () => {
  const fields = ["transaction", "propertyType", "buildingType", "areaM2", "hasTitleDeed", "price", "currency", "rooms", "cityId", "districtId", "settlementId", "metroIds", "address", "repairStatus", "floor", "totalFloors", "photos", "video", "title", "slug", "description", "featured", "areaId", "contactPhone"];
  for (const f of fields) { assert.ok(schema.includes(`name: "${f}"`) || schema.includes(`localized("${f}"`), `schema is missing ${f}`); assert.ok(props.includes(f) || FILTER.includes(f), `website never reads ${f}`); }
  for (const f of ["transaction", "propertyType", "cityId", "districtId", "settlementId", "metroIds", "buildingType", "repairStatus", "areaM2", "floor", "totalFloors", "rooms", "price", "currency"]) assert.ok(FILTER.includes(f), `filter does not use ${f}`);
  assert.equal((schema.match(/name: "areaM2"/g) ?? []).length, 1); assert.equal((schema.match(/name: "photos"/g) ?? []).length, 1); });
test("schema uses the shared constants and has the 8 admin sections", () => {
  assert.ok(/from "\.\.\/\.\.\/lib\/property-fields\.ts"/.test(schema) && /from "\.\.\/\.\.\/lib\/locations\.ts"/.test(schema));
  for (const n of ["1. Elanın əsas məlumatları", "2. Əmlakın xüsusiyyətləri", "3. Qiymət və otaqlar", "4. Ünvan və məkan", "5. Təmir və mərtəbə", "6. Şəkillər və video", "7. Çoxdilli başlıq və təsvir", "8. Əlaqə və digər məlumatlar"]) assert.ok(schema.includes(n), n);
  assert.ok(!/title: "(Satış|Kirayə|Mənzil)"/.test(schema)); });
