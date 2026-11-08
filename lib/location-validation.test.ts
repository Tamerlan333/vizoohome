import test from "node:test"; import assert from "node:assert/strict";
import { COORD_DECIMALS, MESSAGES, checkInsideAzerbaijan, checkRange, formatCoord, parseCoordinate, parseCoordinatePair, readPoint, roundCoord, toGeopoint } from "./location-validation.ts";

test("stored value: geopoint with 6 decimals, no altitude, never -0", () => {
  assert.equal(COORD_DECIMALS, 6); assert.deepEqual(toGeopoint(40.40930049, 49.86710051), { _type: "geopoint", lat: 40.409300, lng: 49.867101 });
  assert.deepEqual(Object.keys(toGeopoint(1, 2)).sort(), ["_type", "lat", "lng"]); assert.equal(Object.is(roundCoord(-0.0000001), -0), false); assert.equal(roundCoord(-0.0000001), 0);
  assert.equal(formatCoord(40.4093), "40.409300"); assert.equal(roundCoord(49.123456789), 49.123457); });
test("checkRange (error level): an empty field is fine, partial / non-numeric / out-of-range values are errors", () => {
  for (const v of [undefined, null, {}, { _type: "geopoint" }, { lat: 40.4, lng: 49.8 }, { _type: "geopoint", lat: 0, lng: 0 }, { lat: -90, lng: 180 }, { lat: 90, lng: -180 }]) assert.equal(checkRange(v), true, JSON.stringify(v));
  assert.equal(checkRange({ lat: 40.4 }), MESSAGES.incomplete); assert.equal(checkRange({ lng: 49.8 }), MESSAGES.incomplete); assert.equal(checkRange({ lat: 40.4, lng: null }), MESSAGES.incomplete);
  for (const v of [{ lat: "40.4", lng: 49.8 }, { lat: 40.4, lng: "49.8" }, { lat: NaN, lng: 1 }, { lat: 1, lng: Infinity }, "x", 5, true]) assert.equal(checkRange(v), MESSAGES.notNumber, JSON.stringify(v));
  for (const v of [{ lat: 90.0001, lng: 0 }, { lat: -91, lng: 0 }, { lat: 0, lng: 180.1 }, { lat: 0, lng: -181 }, { lat: 95, lng: 49.8 }]) assert.equal(checkRange(v), MESSAGES.range, JSON.stringify(v)); });
test("checkInsideAzerbaijan (warning level): Baku, Ganja, Nakhchivan fine; far-away and swapped points warn; invalid points are left to the error rule", () => {
  for (const v of [undefined, null, {}, { lat: 40.4093, lng: 49.8671 }, { lat: 40.6828, lng: 46.3606 }, { lat: 39.209, lng: 45.4122 }]) assert.equal(checkInsideAzerbaijan(v), true, JSON.stringify(v));
  for (const v of [{ lat: 49.8671, lng: 40.4093 }, { lat: 55.75, lng: 37.6 }, { lat: 51.5, lng: -0.12 }, { lat: 0, lng: 0 }]) assert.equal(checkInsideAzerbaijan(v), MESSAGES.outside, JSON.stringify(v));
  for (const v of [{ lat: 95, lng: 49 }, { lat: 40 }, { lat: "a", lng: 1 }]) assert.equal(checkInsideAzerbaijan(v), true, "no double reporting: " + JSON.stringify(v)); });
test("readPoint returns only usable points", () => {
  assert.deepEqual(readPoint({ _type: "geopoint", lat: 40.4, lng: 49.8, alt: 5 }), { lat: 40.4, lng: 49.8 });
  for (const v of [undefined, null, {}, { lat: 40.4 }, { lat: "40", lng: "49" }, { lat: 95, lng: 49 }, { lat: NaN, lng: 1 }, "x"]) assert.equal(readPoint(v), null, JSON.stringify(v)); });
test("parseCoordinate: plain numbers with a dot only", () => {
  for (const [t, n] of [["40.4093", 40.4093], [" 49.8671 ", 49.8671], ["-12.5", -12.5], ["+3", 3], ["0", 0], ["180", 180], ["40.123456789012", 40.123456789012]] as [string, number][]) assert.equal(parseCoordinate(t), n, t);
  for (const t of ["", " ", "40,4093", "abc", "40.", ".5", "1e3", "40.4.3", "40 49", "١٢", "40.4093°", "--1", "1234.5"]) assert.equal(parseCoordinate(t), null, JSON.stringify(t)); });
test("parseCoordinatePair: 'lat, lng' in common spellings; decimal commas and junk are rejected", () => {
  const ok = (t: string, lat: number, lng: number) => assert.deepEqual(parseCoordinatePair(t), { ok: true, lat, lng }, t);
  ok("40.4093, 49.8671", 40.4093, 49.8671); ok("40.4093,49.8671", 40.4093, 49.8671); ok("40.4093 49.8671", 40.4093, 49.8671); ok("40.4093; 49.8671", 40.4093, 49.8671); ok("(40.4093, 49.8671)", 40.4093, 49.8671); ok("[40.4093, 49.8671]", 40.4093, 49.8671); ok("  40.4093 ,  49.8671  ", 40.4093, 49.8671); ok("-33.8688, 151.2093", -33.8688, 151.2093); ok("40.40930049, 49.86710051", 40.409300, 49.867101);
  assert.deepEqual(parseCoordinatePair(""), { ok: false, reason: "empty" }); assert.deepEqual(parseCoordinatePair("   "), { ok: false, reason: "empty" });
  for (const t of ["40,4093 49,8671", "40.4093", "40.4093, 49.8671, 12", "abc, def", "40.4093° N, 49.8671° E", "40.4093 - 49.8671", "<script>", "40.4093,", ",49.8671", "1e2, 3"]) assert.deepEqual(parseCoordinatePair(t), { ok: false, reason: "format" }, t);
  for (const t of ["95, 49.8", "40.4, 181", "-91, 0", "0, -181"]) assert.deepEqual(parseCoordinatePair(t), { ok: false, reason: "range" }, t); });
test("messages are Azerbaijani and non-empty", () => { for (const [k, v] of Object.entries(MESSAGES)) assert.ok(typeof v === "string" && v.length > 10, k); assert.ok(MESSAGES.outside.includes("Azərbaycan")); assert.ok(MESSAGES.incomplete.includes("Enlik")); });
