import test from "node:test"; import assert from "node:assert/strict";
import { AZ_BOUNDS, BAKU_CENTER, MAX_VERTICES, filterInPolygon, hasCoordinates, isValidBBox, isValidCoordinate, isWithinAzerbaijan, pointInPolygon, polygonAreaKm2, polygonBBox, polygonFromParam, polygonToParam, validatePolygon, type GeoPolygon, type LngLat } from "./geo.ts";
const poly = (ring: LngLat[]): GeoPolygon => { const r = validatePolygon({ type: "Polygon", coordinates: [ring] }); assert.ok(r.ok, JSON.stringify(r)); return (r as { ok: true; polygon: GeoPolygon }).polygon; };
const SQUARE: LngLat[] = [[49.80, 40.30], [49.90, 40.30], [49.90, 40.50], [49.80, 40.50]];
const err = (v: unknown) => { const r = validatePolygon(v); assert.equal(r.ok, false); return (r as { ok: false; error: string }).error; };
const ring = (c: LngLat[]) => ({ type: "Polygon", coordinates: [c] });
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

test("coordinates: finite numbers inside the valid ranges only", () => {
  assert.ok(isValidCoordinate(40.4093, 49.8671)); assert.ok(isValidCoordinate(-90, 180)); assert.ok(isValidCoordinate(0, 0));
  for (const [a, b] of [[91, 0], [0, 181], [-91, 0], [0, -181], [NaN, 1], [1, Infinity], ["40", "49"], [null, 1], [undefined, undefined]] as [unknown, unknown][]) assert.equal(isValidCoordinate(a, b), false, `${a},${b}`);
  assert.ok(hasCoordinates({ lat: 40, lng: 49 })); assert.equal(hasCoordinates({ lat: 40 }), false); assert.equal(hasCoordinates({ lat: "40", lng: "49" }), false); assert.equal(hasCoordinates({}), false); });
test("Azerbaijan plausibility (soft bounding box): Baku, Ganja, Nakhchivan in; London, Moscow, Tehran out", () => {
  assert.ok(isWithinAzerbaijan(40.4093, 49.8671)); assert.ok(isWithinAzerbaijan(40.6828, 46.3606)); assert.ok(isWithinAzerbaijan(39.2090, 45.4122));
  assert.equal(isWithinAzerbaijan(51.5, -0.12), false); assert.equal(isWithinAzerbaijan(55.75, 37.6), false); assert.equal(isWithinAzerbaijan(35.7, 51.4), false); assert.equal(isWithinAzerbaijan(NaN, 49), false);
  assert.deepEqual(BAKU_CENTER, [49.8671, 40.4093]); assert.ok(isValidBBox(AZ_BOUNDS)); assert.equal(isValidBBox([1, 1, 0, 2]), false); assert.equal(isValidBBox([NaN, 0, 1, 1]), false); assert.equal(isValidBBox("x"), false); });
test("validatePolygon: accepts Polygon and Feature<Polygon>, closes the ring, drops duplicates", () => {
  const p = poly(SQUARE); assert.equal(p.coordinates[0].length, 5); assert.deepEqual(p.coordinates[0][0], p.coordinates[0][4]);
  const feature = { type: "Feature", properties: {}, geometry: ring([...SQUARE, SQUARE[0]]) }; const r = validatePolygon(feature); assert.ok(r.ok); assert.equal((r as { polygon: GeoPolygon }).polygon.coordinates[0].length, 5);
  const dup = validatePolygon(ring([SQUARE[0], SQUARE[0], SQUARE[1], SQUARE[2], SQUARE[2], SQUARE[3], SQUARE[0]])); assert.ok(dup.ok); assert.equal((dup as { polygon: GeoPolygon }).polygon.coordinates[0].length, 5); });
test("validatePolygon: rejects bad input with a reason code", () => {
  for (const v of [null, undefined, 5, "x", [], {}, { type: "Point", coordinates: [1, 2] }, { type: "MultiPolygon", coordinates: [] }, { type: "Polygon" }, { type: "Polygon", coordinates: [] }, { type: "Polygon", coordinates: ["x"] }]) assert.equal(err(v), "not_polygon", JSON.stringify(v));
  assert.equal(err({ type: "Polygon", coordinates: [SQUARE, [[49.82, 40.32], [49.84, 40.32], [49.84, 40.34]]] }), "holes_not_supported");
  assert.equal(err(ring([[49.8, 40.3], [49.9, 40.3]])), "too_few_points"); assert.equal(err(ring([[49.8, 40.3], [49.8, 40.3], [49.9, 40.3], [49.8, 40.3]])), "too_few_points");
  assert.equal(err(ring([[49.8, 40.3], [49.9, NaN], [49.9, 40.5]])), "invalid_coordinate"); assert.equal(err(ring([[49.8, 95], [49.9, 40.3], [49.9, 40.5]])), "invalid_coordinate"); assert.equal(err(ring([[49.8, 40.3], ["a", 1], [49.9, 40.5]] as never)), "invalid_coordinate"); assert.equal(err(ring([[49.8], [49.9, 40.3], [49.9, 40.5]] as never)), "invalid_coordinate");
  assert.equal(err(ring([[49.80, 40.30], [49.85, 40.30], [49.90, 40.30]])), "zero_area");
  assert.equal(err(ring([[49.8, 40.3], [49.9, 40.5], [49.9, 40.3], [49.8, 40.5]])), "self_intersecting", "bow-tie");
  assert.equal(err(ring([[49.8, 40.3], [49.9, 40.3], [49.9, 40.5], [49.85, 40.3], [49.8, 40.5]])), "self_intersecting", "edge touches another edge");
  const many = Array.from({ length: MAX_VERTICES + 5 }, (_, i) => [49.8 + 0.1 * Math.cos((i / (MAX_VERTICES + 5)) * 2 * Math.PI), 40.4 + 0.1 * Math.sin((i / (MAX_VERTICES + 5)) * 2 * Math.PI)] as LngLat); assert.equal(err(ring(many)), "too_many_points");
  assert.equal(err(ring([[44, 38], [51, 38], [51, 42], [44, 42]])), "too_large", "about 260,000 km2, larger than the country");
  assert.equal(err(ring([[30, 20], [70, 20], [70, 60], [30, 60]])), "too_large", "bigger than the country"); });
test("pointInPolygon: inside, outside and boundary (boundary counts as inside)", () => {
  const p = poly(SQUARE);
  assert.ok(pointInPolygon(49.85, 40.40, p)); assert.equal(pointInPolygon(49.95, 40.40, p), false); assert.equal(pointInPolygon(49.85, 40.55, p), false); assert.equal(pointInPolygon(49.79, 40.29, p), false);
  for (const [x, y] of [[49.80, 40.30], [49.90, 40.50], [49.85, 40.30], [49.80, 40.40], [49.90, 40.45], [49.85, 40.50]]) assert.ok(pointInPolygon(x, y, p), `boundary ${x},${y}`);
  assert.equal(pointInPolygon(49.8000001, 40.40, p), true); assert.equal(pointInPolygon(49.79999, 40.40, p), false);
  assert.equal(pointInPolygon(NaN, 40.4, p), false); assert.equal(pointInPolygon(49.85, 95, p), false); assert.equal(pointInPolygon(49.85, 40.4, { type: "Polygon", coordinates: [] }), false); });
test("pointInPolygon: concave shapes (U / L), clockwise and counter-clockwise give the same answers", () => {
  const U: LngLat[] = [[49.80, 40.30], [49.90, 40.30], [49.90, 40.50], [49.86, 40.50], [49.86, 40.35], [49.84, 40.35], [49.84, 40.50], [49.80, 40.50]];
  const ccw = poly(U), cw = poly([...U].reverse());
  for (const [x, y, exp] of [[49.82, 40.45, true], [49.88, 40.45, true], [49.85, 40.45, false], [49.85, 40.32, true], [49.85, 40.36, false], [49.95, 40.4, false]] as [number, number, boolean][]) { assert.equal(pointInPolygon(x, y, ccw), exp, `ccw ${x},${y}`); assert.equal(pointInPolygon(x, y, cw), exp, `cw ${x},${y}`); } });
test("pointInPolygon agrees with an independent winding-number implementation on 3,000 random points (random simple star-shaped polygons)", () => {
  const rnd = mulberry32(42);
  const winding = (x: number, y: number, r: LngLat[]) => { let w = 0; for (let i = 0; i < r.length - 1; i++) { const [x1, y1] = r[i], [x2, y2] = r[i + 1]; const c = (x2 - x1) * (y - y1) - (x - x1) * (y2 - y1); if (y1 <= y) { if (y2 > y && c > 0) w++; } else if (y2 <= y && c < 0) w--; } return w !== 0; };
  const edgeDist = (x: number, y: number, r: LngLat[]) => { let m = Infinity; for (let i = 0; i < r.length - 1; i++) { const [ax, ay] = r[i], [bx, by] = r[i + 1]; const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))); m = Math.min(m, Math.hypot(x - ax - t * dx, y - ay - t * dy)); } return m; };
  let checked = 0;
  for (let k = 0; k < 6; k++) {
    const n = 5 + Math.floor(rnd() * 20), cx = 49.5 + rnd() * 0.8, cy = 40.2 + rnd() * 0.5;
    const angles = Array.from({ length: n }, () => rnd() * 2 * Math.PI).sort((a, b) => a - b);
    const pts = angles.map((a) => { const rad = 0.02 + rnd() * 0.06; return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)] as LngLat; });
    const r = validatePolygon(ring(pts)); if (!r.ok) continue; const p = r.polygon;
    for (let i = 0; i < 500; i++) { const x = cx - 0.1 + rnd() * 0.2, y = cy - 0.1 + rnd() * 0.2; if (edgeDist(x, y, p.coordinates[0]) < 1e-7) continue; assert.equal(pointInPolygon(x, y, p), winding(x, y, p.coordinates[0]), `polygon ${k} point ${x},${y}`); checked++; }
  }
  assert.ok(checked > 2000, "enough points were compared: " + checked); });
test("bbox and area", () => {
  const p = poly(SQUARE); assert.deepEqual(polygonBBox(p), [49.80, 40.30, 49.90, 40.50]);
  const small = poly([[49.80, 40.40], [49.90, 40.40], [49.90, 40.50], [49.80, 40.50]]); const km2 = polygonAreaKm2(small); assert.ok(Math.abs(km2 - 94.4) / 94.4 < 0.03, "0.1deg x 0.1deg near Baku is about 94 km2, got " + km2);
  assert.equal(polygonAreaKm2({ type: "Polygon", coordinates: [] }), 0); });
test("filterInPolygon: keeps order, skips items without coordinates, handles invalid rows", () => {
  const p = poly(SQUARE);
  const items = [{ id: 1, lat: 40.40, lng: 49.85 }, { id: 2, lat: 40.60, lng: 49.85 }, { id: 3 }, { id: 4, lat: "40.4", lng: "49.85" }, { id: 5, lat: 40.45, lng: 49.81 }, { id: 6, lat: NaN, lng: 49.85 }, { id: 7, lat: 40.30, lng: 49.80 }];
  assert.deepEqual(filterInPolygon(items, p).map((i) => i.id), [1, 5, 7]); assert.deepEqual(filterInPolygon([], p), []); });
test("polygon <-> URL parameter round trip; garbage is rejected", () => {
  const p = poly(SQUARE); const s = polygonToParam(p); assert.equal(s, "40.30000,49.80000~40.30000,49.90000~40.50000,49.90000~40.50000,49.80000");
  const back = polygonFromParam(s); assert.ok(back.ok); const a = p.coordinates[0], b = (back as { polygon: GeoPolygon }).polygon.coordinates[0]; assert.equal(a.length, b.length); a.forEach((pt, i) => { assert.ok(Math.abs(pt[0] - b[i][0]) < 1e-5 && Math.abs(pt[1] - b[i][1]) < 1e-5); });
  for (const bad of [undefined, null, 5, "", "abc", "40.3,49.8", "40.3,49.8~40.3,49.9", "40.3,49.8~40.3,49.9~40.5", "40.3,49.8~x,y~40.5,49.9", "<script>alert(1)</script>", "40.3,49.8~40.3,49.9~40.5,49.9,1", "999,49.8~40.3,49.9~40.5,49.9", "1e3,49.8~40.3,49.9~40.5,49.9", "40.3,49.8~40.5,49.9~40.3,49.9~40.5,49.8", "x".repeat(5000)]) assert.equal(polygonFromParam(bad).ok, false, String(bad).slice(0, 40)); });
