/**
 * Pure geographic helpers for the draw-to-search map (Stage A).
 * No dependencies, no browser APIs: usable on the server, in the browser and in unit tests.
 *
 * Conventions
 * - GeoJSON order everywhere: [longitude, latitude].
 * - A search area is one simple polygon (one outer ring, no holes, no self-crossings).
 * - A point exactly on the boundary counts as INSIDE (documented and tested).
 * - Polygons crossing the antimeridian (+-180) are not supported (irrelevant for Azerbaijan).
 */
export type LngLat = [number, number];
export interface GeoPolygon { type: "Polygon"; coordinates: LngLat[][] }
/** [minLng, minLat, maxLng, maxLat] */
export type BBox = [number, number, number, number];

/** Rough bounding box of Azerbaijan including Nakhchivan. Used as the default map extent and for a soft plausibility check. */
export const AZ_BOUNDS: BBox = [44.70, 38.35, 50.90, 41.95];
/** Initial map centre: Baku [lng, lat]. */
export const BAKU_CENTER: LngLat = [49.8671, 40.4093];
export const MAX_VERTICES = 100;
/** Azerbaijan is about 86,600 km2; anything bigger than this is not a useful search area. */
export const MAX_AREA_KM2 = 90000;

const EPS_DIST = 1e-10;   // degrees: tolerance for "on the boundary"
const EPS_CROSS = 1e-15;  // tolerance for collinearity tests

export const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
export const isValidCoordinate = (lat: unknown, lng: unknown): boolean =>
  isFiniteNumber(lat) && isFiniteNumber(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
/** Soft check (bounding box only) for the Studio pin picker: warns about pins far outside the country. */
export const isWithinAzerbaijan = (lat: unknown, lng: unknown): boolean =>
  isValidCoordinate(lat, lng) && (lng as number) >= AZ_BOUNDS[0] && (lng as number) <= AZ_BOUNDS[2] && (lat as number) >= AZ_BOUNDS[1] && (lat as number) <= AZ_BOUNDS[3];
export const isValidBBox = (b: unknown): b is BBox =>
  Array.isArray(b) && b.length === 4 && b.every(isFiniteNumber) && b[0] <= b[2] && b[1] <= b[3] && isValidCoordinate(b[1], b[0]) && isValidCoordinate(b[3], b[2]);

export type PolygonError = "not_polygon" | "holes_not_supported" | "too_many_points" | "invalid_coordinate" | "too_few_points" | "zero_area" | "self_intersecting" | "too_large";
export type PolygonResult = { ok: true; polygon: GeoPolygon } | { ok: false; error: PolygonError };
const fail = (error: PolygonError): PolygonResult => ({ ok: false, error });
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

const cross = (a: LngLat, b: LngLat, c: LngLat) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const withinBox = (a: LngLat, b: LngLat, p: LngLat) =>
  p[0] >= Math.min(a[0], b[0]) - EPS_DIST && p[0] <= Math.max(a[0], b[0]) + EPS_DIST && p[1] >= Math.min(a[1], b[1]) - EPS_DIST && p[1] <= Math.max(a[1], b[1]) + EPS_DIST;
function segmentsIntersect(p1: LngLat, p2: LngLat, p3: LngLat, p4: LngLat): boolean {
  const d1 = cross(p3, p4, p1), d2 = cross(p3, p4, p2), d3 = cross(p1, p2, p3), d4 = cross(p1, p2, p4);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return (Math.abs(d1) <= EPS_CROSS && withinBox(p3, p4, p1)) || (Math.abs(d2) <= EPS_CROSS && withinBox(p3, p4, p2))
    || (Math.abs(d3) <= EPS_CROSS && withinBox(p1, p2, p3)) || (Math.abs(d4) <= EPS_CROSS && withinBox(p1, p2, p4));
}

/** Area in km2 using a local equirectangular approximation (accurate to a few percent for city-sized areas). */
export function ringAreaKm2(ring: readonly LngLat[]): number {
  if (ring.length < 3) return 0;
  const lat0 = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const kx = 111.320 * Math.cos((lat0 * Math.PI) / 180), ky = 110.574;
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) sum += (ring[j][0] * kx) * (ring[i][1] * ky) - (ring[i][0] * kx) * (ring[j][1] * ky);
  return Math.abs(sum) / 2;
}
export const polygonAreaKm2 = (poly: GeoPolygon): number => ringAreaKm2(poly.coordinates[0] ?? []);

/** Accepts a GeoJSON Polygon or a Feature<Polygon> (what drawing libraries emit). Returns a normalized, closed polygon or a reason code. */
export function validatePolygon(input: unknown): PolygonResult {
  let g: unknown = input;
  if (isObj(g) && g.type === "Feature") g = g.geometry;
  if (!isObj(g) || g.type !== "Polygon" || !Array.isArray(g.coordinates) || g.coordinates.length === 0) return fail("not_polygon");
  if (g.coordinates.length > 1) return fail("holes_not_supported");
  const raw: unknown = g.coordinates[0];
  if (!Array.isArray(raw)) return fail("not_polygon");
  if (raw.length > MAX_VERTICES + 1) return fail("too_many_points");
  const pts: LngLat[] = [];
  for (const p of raw) {
    if (!Array.isArray(p) || p.length < 2 || !isValidCoordinate(p[1], p[0])) return fail("invalid_coordinate");
    const q: LngLat = [p[0] as number, p[1] as number];
    const last = pts[pts.length - 1];
    if (!last || last[0] !== q[0] || last[1] !== q[1]) pts.push(q);          // drop consecutive duplicates
  }
  if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();   // drop the closing point
  if (pts.length < 3) return fail("too_few_points");
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;                   // neighbouring edges share a vertex
      if (segmentsIntersect(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return fail("self_intersecting");
    }
  }
  // After the crossing test: the signed areas of a bow-tie cancel out, so "zero area" must not be decided first.
  if (ringAreaKm2(pts) < 1e-6) return fail("zero_area");                     // all points on one line (or the same spot)
  if (ringAreaKm2(pts) > MAX_AREA_KM2) return fail("too_large");
  return { ok: true, polygon: { type: "Polygon", coordinates: [[...pts, pts[0]]] } };
}

export function polygonBBox(poly: GeoPolygon): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of poly.coordinates[0] ?? []) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  return [minX, minY, maxX, maxY];
}

function onSegment(ax: number, ay: number, bx: number, by: number, px: number, py: number): boolean {
  const len = Math.hypot(bx - ax, by - ay);
  if (len === 0) return Math.hypot(px - ax, py - ay) <= EPS_DIST;
  const dist = Math.abs((bx - ax) * (py - ay) - (by - ay) * (px - ax)) / len;   // perpendicular distance in degrees
  if (dist > EPS_DIST) return false;
  const t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / (len * len);
  return t >= -EPS_DIST / len && t <= 1 + EPS_DIST / len;
}

/** Ray-casting test. Points on the boundary (edge or vertex) count as inside. Invalid coordinates are never inside. */
export function pointInPolygon(lng: number, lat: number, polygon: GeoPolygon): boolean {
  if (!isValidCoordinate(lat, lng)) return false;
  const ring = polygon.coordinates[0];
  if (!ring || ring.length < 4) return false;
  const [minX, minY, maxX, maxY] = polygonBBox(polygon);
  if (lng < minX - EPS_DIST || lng > maxX + EPS_DIST || lat < minY - EPS_DIST || lat > maxY + EPS_DIST) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (onSegment(xj, yj, xi, yi, lng, lat)) return true;
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export interface MaybeLocated { lat?: unknown; lng?: unknown }
export type Located<T> = T & { lat: number; lng: number };
export const hasCoordinates = <T extends MaybeLocated>(p: T): p is Located<T> => isValidCoordinate(p.lat, p.lng);
/** Items with usable coordinates that lie inside (or on the edge of) the polygon. Order is preserved; items without coordinates are skipped. */
export function filterInPolygon<T extends MaybeLocated>(items: readonly T[], polygon: GeoPolygon): Located<T>[] {
  const out: Located<T>[] = [];
  for (const it of items) if (hasCoordinates(it) && pointInPolygon(it.lng, it.lat, polygon)) out.push(it);
  return out;
}

/** Compact URL form: "lat,lng~lat,lng~..." (5 decimals, about 1 m). The closing point is implied. */
export function polygonToParam(poly: GeoPolygon): string {
  const ring = poly.coordinates[0] ?? [];
  return ring.slice(0, Math.max(ring.length - 1, 0)).map(([lng, lat]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join("~");
}
const NUM = /^-?\d{1,3}(\.\d{1,8})?$/;
export function polygonFromParam(value: unknown): PolygonResult {
  if (typeof value !== "string" || value.length === 0 || value.length > 4000) return fail("not_polygon");
  const ring: LngLat[] = [];
  for (const part of value.split("~")) {
    const bits = part.split(",");
    if (bits.length !== 2 || !NUM.test(bits[0]) || !NUM.test(bits[1])) return fail("invalid_coordinate");
    ring.push([Number(bits[1]), Number(bits[0])]);
  }
  return validatePolygon({ type: "Polygon", coordinates: [ring] });
}

/* ---- Draw-to-search helpers (Stage 1 of the drawing UI). Additions only: nothing above changes behaviour. ---- */

/** Decimals kept for a drawn search area. Matches the URL form (polygonToParam) and stays within Terra Draw's coordinate precision (9). */
export const AREA_DECIMALS = 5;

const segDist = (p: readonly number[], a: readonly number[], b: readonly number[]): number => {
  const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
function douglasPeucker(points: readonly (readonly number[])[], tolerance: number): number[] {
  const n = points.length, keep = new Uint8Array(n); keep[0] = 1; keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];                              // iterative: long freehand strokes cannot overflow the call stack
  while (stack.length) {
    const [s, e] = stack.pop()!; let maxD = -1, idx = -1;
    for (let i = s + 1; i < e; i++) { const d = segDist(points[i], points[s], points[e]); if (d > maxD) { maxD = d; idx = i; } }
    if (idx !== -1 && maxD > tolerance) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  const out: number[] = []; for (let i = 0; i < n; i++) if (keep[i]) out.push(i);
  return out;
}
/**
 * Douglas-Peucker simplification of an open path in any planar unit (use screen pixels for freehand strokes).
 * Returns the INDICES of the kept points (first and last are always kept), so callers can map back to [lng, lat].
 * With maxPoints the tolerance is doubled until the result fits. Non-finite points are skipped.
 */
export function simplifyPathIndices(points: readonly (readonly number[])[], tolerance: number, maxPoints?: number): number[] {
  const valid: number[] = [];
  for (let i = 0; i < points.length; i++) { const p = points[i]; if (Array.isArray(p) && isFiniteNumber(p[0]) && isFiniteNumber(p[1])) valid.push(i); }
  if (valid.length <= 2) return valid;
  const pts = valid.map((i) => points[i]);
  let tol = isFiniteNumber(tolerance) && tolerance > 0 ? tolerance : 0;
  const limit = isFiniteNumber(maxPoints) && maxPoints >= 2 ? Math.floor(maxPoints) : Infinity;
  let kept = douglasPeucker(pts, tol);
  for (let guard = 0; kept.length > limit && guard < 60; guard++) { tol = tol > 0 ? tol * 2 : 1e-9; kept = douglasPeucker(pts, tol); }
  return kept.map((k) => valid[k]);
}
/** Convenience wrapper around simplifyPathIndices that returns the kept points themselves. */
export function simplifyPath<T extends readonly number[]>(points: readonly T[], tolerance: number, maxPoints?: number): T[] {
  return simplifyPathIndices(points, tolerance, maxPoints).map((i) => points[i]);
}

/** Rounds every coordinate the same way polygonToParam does (toFixed), so the URL round trip is exact. */
export const roundCoord = (v: number, decimals: number = AREA_DECIMALS): number => Number(v.toFixed(decimals));
export function roundRing(ring: readonly LngLat[], decimals: number = AREA_DECIMALS): LngLat[] {
  return ring.map(([lng, lat]) => [roundCoord(lng, decimals), roundCoord(lat, decimals)] as LngLat);
}

/** True when every vertex lies inside the box (default: Azerbaijan's rough bounding box, which also touches small parts of neighbouring countries). */
export function polygonWithinBounds(poly: GeoPolygon, bounds: BBox = AZ_BOUNDS): boolean {
  const ring = poly.coordinates[0] ?? [];
  if (ring.length === 0) return false;
  return ring.every(([lng, lat]) => isFiniteNumber(lng) && isFiniteNumber(lat) && lng >= bounds[0] && lng <= bounds[2] && lat >= bounds[1] && lat <= bounds[3]);
}

export type SearchAreaError = PolygonError | "outside_region";
export type SearchAreaResult = { ok: true; polygon: GeoPolygon } | { ok: false; error: SearchAreaError };
/**
 * Full check for a polygon the user drew on the public map, BEFORE it is stored or written to the URL:
 * 1. validatePolygon on the input; 2. round to AREA_DECIMALS and validate again (rounding can merge points or create a crossing);
 * 3. every vertex inside AZ_BOUNDS; 4. the URL round trip (polygonToParam -> polygonFromParam) must succeed, so the server accepts exactly this polygon.
 * Returns the rounded, closed polygon.
 */
export function validateSearchArea(input: unknown): SearchAreaResult {
  const first = validatePolygon(input);
  if (!first.ok) return first;
  const rounded = validatePolygon({ type: "Polygon", coordinates: [roundRing(first.polygon.coordinates[0])] });
  if (!rounded.ok) return rounded;
  if (!polygonWithinBounds(rounded.polygon)) return { ok: false, error: "outside_region" };
  const back = polygonFromParam(polygonToParam(rounded.polygon));
  if (!back.ok) return back;
  return { ok: true, polygon: rounded.polygon };
}
