import test from "node:test"; import assert from "node:assert/strict";
import { AREA_DECIMALS, AZ_BOUNDS, BAKU_CENTER, MAX_VERTICES, filterInPolygon, hasCoordinates, isValidBBox, isValidCoordinate, isWithinAzerbaijan, pointInPolygon, polygonAreaKm2, polygonBBox, polygonFromParam, polygonToParam, polygonWithinBounds, roundCoord, roundRing, simplifyPath, simplifyPathIndices, validatePolygon, validateSearchArea, type GeoPolygon, type LngLat } from "./geo.ts";
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

/* ---- Draw-to-search helpers (Stage 1) ---- */
/** Same algorithm Terra Draw uses to reject over-precise coordinates (is-valid-coordinate.ts, getDecimalPlaces). */
const decimalPlaces = (v: number) => { let cur = 1, p = 0; while (Math.round(v * cur) / cur !== v) { cur *= 10; p++; } return p; };
/** A freehand-like closed loop around Baku: n points, noisy radius, full double precision (like MapLibre lngLat values). */
function freehandLoop(n: number, seed: number, rLng = 0.04, rLat = 0.03): LngLat[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: n }, (_, i) => { const a = (i / n) * 2 * Math.PI, k = 1 + (rnd() - 0.5) * 0.02; return [BAKU_CENTER[0] + rLng * k * Math.cos(a) + rnd() * 1e-9, BAKU_CENTER[1] + rLat * k * Math.sin(a) + rnd() * 1e-9] as LngLat; });
}
/** Rough equirectangular "pixels" for the tests (the UI uses map.project instead). */
const toPx = ([lng, lat]: LngLat): [number, number] => [lng * 85000, lat * 111000];

test("simplifyPathIndices: keeps endpoints and corners, drops collinear points, skips non-finite points", () => {
  const line = Array.from({ length: 50 }, (_, i) => [i, 2 * i]);
  assert.deepEqual(simplifyPathIndices(line, 0.5), [0, 49], "a straight stroke collapses to its endpoints");
  const L = [[0, 0], [5, 0], [10, 0], [10, 5], [10, 10]];
  assert.deepEqual(simplifyPathIndices(L, 0.5), [0, 2, 4], "the corner survives");
  assert.deepEqual(simplifyPathIndices(L, 0), [0, 2, 4], "tolerance 0 still drops exactly collinear points");
  assert.deepEqual(simplifyPathIndices([[0, 0], [1, 1]], 5), [0, 1]); assert.deepEqual(simplifyPathIndices([[0, 0]], 5), [0]); assert.deepEqual(simplifyPathIndices([], 5), []);
  assert.deepEqual(simplifyPathIndices([[0, 0], [NaN, 3], [5, 5], [Infinity, 1], [10, 0]], 0.1), [0, 2, 4], "non-finite points are ignored, indices refer to the input");
  assert.deepEqual(simplifyPathIndices(L, NaN), [0, 2, 4], "a bad tolerance behaves like 0");
  assert.deepEqual(simplifyPath(L, 0.5), [[0, 0], [10, 0], [10, 10]], "simplifyPath returns the points themselves"); });

test("simplifyPathIndices: maxPoints caps a long freehand stroke (600+ points) and the order is preserved", () => {
  const stroke = freehandLoop(640, 7).map(toPx);
  const all = simplifyPathIndices(stroke, 0); assert.ok(all.length > MAX_VERTICES, "the raw stroke is too detailed: " + all.length);
  for (const max of [MAX_VERTICES, 60, 12]) {
    const idx = simplifyPathIndices(stroke, 2, max);
    assert.ok(idx.length <= max && idx.length >= 3, `max ${max}: got ${idx.length}`);
    assert.equal(idx[0], 0); assert.equal(idx[idx.length - 1], stroke.length - 1);
    for (let i = 1; i < idx.length; i++) assert.ok(idx[i] > idx[i - 1], "strictly increasing");
  } });

test("roundRing: AREA_DECIMALS (5) decimals, same rounding as the URL form, idempotent, accepted by Terra Draw's precision check (<= 9)", () => {
  assert.equal(AREA_DECIMALS, 5);
  const raw = freehandLoop(40, 3); const r = roundRing(raw);
  assert.equal(r.length, raw.length);
  for (let i = 0; i < r.length; i++) for (const k of [0, 1]) {
    assert.ok(decimalPlaces(r[i][k]) <= AREA_DECIMALS, `decimals of ${r[i][k]}`);
    assert.equal(r[i][k], Number(raw[i][k].toFixed(5)), "matches toFixed(5), as used by polygonToParam");
    assert.ok(Math.abs(r[i][k] - raw[i][k]) <= 5e-6);
  }
  assert.ok(raw.some((p) => decimalPlaces(p[0]) > 9), "the raw input really is over-precise (what Terra Draw rejected)");
  assert.deepEqual(roundRing(r), r, "idempotent"); assert.equal(roundCoord(49.867149999, 5), 49.86715); assert.equal(roundCoord(-0.000004), -0); });

test("polygonWithinBounds: whole polygon must lie inside Azerbaijan's bounding box (or a given box)", () => {
  assert.ok(polygonWithinBounds(poly(SQUARE)));
  assert.ok(polygonWithinBounds(poly([[45.30, 39.10], [45.50, 39.10], [45.50, 39.30], [45.30, 39.30]])), "Nakhchivan");
  assert.equal(polygonWithinBounds(poly([[42.9, 40.0], [43.1, 40.0], [43.1, 40.2], [42.9, 40.2]])), false, "eastern Turkey");
  assert.equal(polygonWithinBounds(poly([[50.80, 40.30], [51.10, 40.30], [51.10, 40.50], [50.80, 40.50]])), false, "partly in the Caspian beyond the box");
  assert.ok(polygonWithinBounds({ type: "Polygon", coordinates: [[[50.9, 41.95], [44.7, 38.35], [50.9, 38.35], [50.9, 41.95]]] }), "the box edge counts as inside");
  assert.equal(polygonWithinBounds({ type: "Polygon", coordinates: [] }), false);
  assert.equal(polygonWithinBounds(poly(SQUARE), [0, 0, 1, 1]), false, "custom bounds"); });

test("validateSearchArea: a simplified freehand loop becomes a rounded, closed polygon the server accepts unchanged", () => {
  const raw = freehandLoop(700, 11); const px = raw.map(toPx);
  const idx = simplifyPathIndices(px, 3, 60); const ring = idx.map((i) => raw[i]);
  assert.equal(validatePolygon({ type: "Polygon", coordinates: [raw] }).ok, false, "the raw stroke alone has too many points");
  const r = validateSearchArea({ type: "Polygon", coordinates: [ring] }); assert.ok(r.ok, JSON.stringify(r));
  const p = (r as { polygon: GeoPolygon }).polygon, c = p.coordinates[0];
  assert.deepEqual(c[0], c[c.length - 1], "closed"); assert.ok(c.length - 1 <= 60 && c.length - 1 >= 3);
  assert.ok(c.every(([lng, lat]) => decimalPlaces(lng) <= 5 && decimalPlaces(lat) <= 5));
  const back = polygonFromParam(polygonToParam(p)); assert.ok(back.ok); assert.deepEqual((back as { polygon: GeoPolygon }).polygon, p, "URL round trip is exact");
  const f = validateSearchArea({ type: "Feature", properties: { mode: "polygon" }, geometry: { type: "Polygon", coordinates: [[...ring, ring[0]]] } }); assert.ok(f.ok, "Feature<Polygon> (Terra Draw snapshot) is accepted");
  assert.deepEqual((f as { polygon: GeoPolygon }).polygon, p, "same result for the closed Feature form"); });

test("validateSearchArea: reason codes (validatePolygon errors pass through; rounding and region are checked)", () => {
  const code = (v: unknown) => { const r = validateSearchArea(v); assert.equal(r.ok, false); return (r as { ok: false; error: string }).error; };
  assert.equal(code(null), "not_polygon"); assert.equal(code({ type: "Point", coordinates: [49.8, 40.4] }), "not_polygon");
  assert.equal(code(ring([[49.8, 40.3], [49.9, 40.5], [49.9, 40.3], [49.8, 40.5]])), "self_intersecting");
  assert.equal(code(ring(freehandLoop(MAX_VERTICES + 20, 5))), "too_many_points");
  assert.equal(code(ring([[44, 38], [51, 38], [51, 42], [44, 42]])), "too_large");
  assert.equal(code(ring([[42.9, 40.0], [43.1, 40.0], [43.1, 40.2], [42.9, 40.2]])), "outside_region", "eastern Turkey");
  const thin: LngLat[] = [[49.8, 40.3], [49.9, 40.3], [49.900001, 40.300002]];
  assert.ok(validatePolygon(ring(thin)).ok, "valid before rounding");
  assert.equal(code(ring(thin)), "too_few_points", "two vertices merge after rounding to 5 decimals, so the area is rejected");
  assert.ok(validateSearchArea(ring(SQUARE)).ok, "a plain Baku square is fine"); });
