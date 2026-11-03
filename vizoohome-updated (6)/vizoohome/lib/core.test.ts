import test from "node:test"; import assert from "node:assert/strict";
import { makeSlug, slugify } from "./slug.ts"; import { parseSearch } from "./search.ts"; import { isValidLocation, BAKU_ID, fold } from "./locations.ts";
test("slugify az", () => assert.equal(slugify("Nəsimi 3 otaqlı mənzil!"), "nesimi-3-otaqli-menzil"));
test("makeSlug suffix", () => assert.equal(makeSlug("Səbail villa", () => "ab12"), "sebail-villa-ab12"));
test("makeSlug empty title", () => assert.equal(makeSlug("!!!", () => "x"), "elan-x"));
test("fold matches without diacritics", () => { assert.equal(fold("Nəsimi"), "nesimi"); assert.equal(fold("İçəri Şəhər"), "iceri seher"); assert.equal(fold("Işıq"), "isiq"); });
test("isValidLocation", () => {
  assert.ok(isValidLocation(BAKU_ID)); assert.ok(isValidLocation(BAKU_ID, "dist-nesimi", "settle-nesimi-kubinka"));
  assert.equal(isValidLocation("city-gence", "dist-nesimi"), false); assert.equal(isValidLocation(BAKU_ID, "dist-yasamal", "settle-sebail-bayil"), false);
  assert.ok(isValidLocation("rayon-abseron", "", "settle-abseron-masazir")); assert.equal(isValidLocation(BAKU_ID, "", "settle-abseron-masazir"), false);
  assert.equal(isValidLocation("rayon-abseron", "dist-nesimi"), false); assert.equal(isValidLocation(BAKU_ID, "", "settle-nope"), false); });
test("parse rooms/land/range/page + other filters survive", () => {
  assert.equal(parseSearch({ rooms: "5" }).rooms, 5); assert.equal(parseSearch({ rooms: "9" }).rooms, undefined); assert.equal(parseSearch({ type: "land", rooms: "3" }).rooms, undefined);
  assert.equal(parseSearch({ minPrice: "500", maxPrice: "100" }).maxPrice, undefined); assert.equal(parseSearch({ page: "-3" }).page, 1); assert.equal(parseSearch({ transaction: "rent" }).transaction, "rent");
  const p = parseSearch({ district: "dist-nesimi", minPrice: "100", maxPrice: "900", rooms: "2", type: "apartment", building: "new" });
  assert.deepEqual([p.districts, p.minPrice, p.maxPrice, p.rooms, p.type, p.building], [["dist-nesimi"], 100, 900, 2, "apartment", "new"]); });
