import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
import { MAP_FIELDS, MAP_LIMIT, MAP_PROJECTION, MAP_QUERY, buildMapParams, pagePolygonResults, resolveMapResults, type MapProperty, type MapRaw } from "./map-query.ts";
import { FILTER, PAGE_SIZE } from "./query.ts"; import { parseSearch } from "./search.ts"; import { AZ_BOUNDS, validatePolygon, type GeoPolygon, type LngLat } from "./geo.ts";
const SQ: LngLat[] = [[49.80, 40.30], [49.90, 40.30], [49.90, 40.50], [49.80, 40.50]];
const polygon = (ring: LngLat[]): GeoPolygon => { const r = validatePolygon({ type: "Polygon", coordinates: [ring] }); assert.ok(r.ok); return (r as { polygon: GeoPolygon }).polygon; };
let groq: { parse: (q: string, o: object) => unknown; evaluate: (t: unknown, o: object) => Promise<{ get(): Promise<unknown> }> } | null = null;
try { groq = (await import("groq-js")) as never; } catch { groq = null; }
const run = async (query: string, params: Record<string, unknown>, dataset: object[]) => (await (await groq!.evaluate(groq!.parse(query, { params }), { dataset, params })).get()) as MapRaw;

test("projection: same listing fields as the listing pages (drift guard), coordinates, 5 photos + count, never the phone number", () => {
  const src = fs.readFileSync("lib/properties.ts", "utf8"); const fields = /const FIELDS = `([^`]*)`/.exec(src)?.[1];
  assert.ok(fields, "FIELDS found in lib/properties.ts"); assert.equal(MAP_FIELDS, fields, "MAP_FIELDS must equal FIELDS in lib/properties.ts");
  assert.ok(MAP_PROJECTION.includes('"lat":location.lat') && MAP_PROJECTION.includes('"lng":location.lng')); assert.ok(MAP_PROJECTION.includes("[0...5]") && MAP_PROJECTION.includes('"photoCount"'));
  assert.ok(!/contactPhone/.test(MAP_PROJECTION) && !/contactPhone/.test(MAP_QUERY)); });
test("query: reuses the existing FILTER, requires coordinates + bounding box, limits rows, counts the rest, uses only $parameters", () => {
  assert.ok(MAP_QUERY.includes(FILTER), "the existing filter is reused as is");
  for (const part of ["defined(location.lat)", "defined(location.lng)", "location.lat>=$minLat", "location.lat<=$maxLat", "location.lng>=$minLng", "location.lng<=$maxLng", "[0...$limit]", '"inBox":count(', '"missingCoords":count(', "!(defined(location.lat) && defined(location.lng))"]) assert.ok(MAP_QUERY.includes(part), part);
  assert.ok(!/\$\{/.test(MAP_QUERY), "no unresolved template parts"); assert.equal((MAP_QUERY.match(/\$\w+/g) ?? []).every((p) => /^\$(tx|city|districts|settlements|metro|types|building|rooms|repair|minArea|maxArea|minFloor|maxFloor|exFirst|exTop|topOnly|min|max|minLat|maxLat|minLng|maxLng|limit)$/.test(p)), true, "only known parameters"); });
test("params: every existing filter is carried over; bounding box = polygon box, or all of Azerbaijan; limit is clamped", () => {
  const f = parseSearch({ transaction: "rent", type: "apartment", rooms: "3", maxPrice: "250000", minPrice: "100", district: "dist-nesimi", metro: "metro-sahil,metro-28-may", repair: "repaired", minArea: "50", topFloorOnly: "true", building: "new" });
  const p = buildMapParams(f, polygon(SQ)); assert.deepEqual([p.tx, p.types, p.rooms, p.max, p.min, p.districts, p.metro, p.repair, p.minArea, p.topOnly, p.building], ["rent", ["apartment"], 3, 250000, 100, ["dist-nesimi"], ["metro-28-may", "metro-sahil"], "repaired", 50, true, "new"]);
  assert.deepEqual([p.minLng, p.minLat, p.maxLng, p.maxLat, p.limit], [49.80, 40.30, 49.90, 40.50, MAP_LIMIT]); assert.ok(!("from" in p) && !("to" in p), "no pagination params");
  const q = buildMapParams(parseSearch({}), null); assert.deepEqual([q.minLng, q.minLat, q.maxLng, q.maxLat], [AZ_BOUNDS[0], AZ_BOUNDS[1], AZ_BOUNDS[2], AZ_BOUNDS[3]]);
  assert.equal(buildMapParams({}, null, 5).limit, 5); assert.equal(buildMapParams({}, null, 0).limit, 1); assert.equal(buildMapParams({}, null, 10_000_000).limit, MAP_LIMIT); assert.equal(buildMapParams({}, null, NaN).limit, MAP_LIMIT); assert.equal(buildMapParams({}, null, 7.9).limit, 7); });
test("resolveMapResults: exact polygon test, counts, truncation, defensive against bad rows", () => {
  const row = (id: string, lat: number, lng: number): MapProperty => ({ _id: id, slug: id, title: { az: id }, transaction: "sale", propertyType: "apartment", cityId: "city-baki", price: 1, currency: "AZN", lat, lng });
  const L: LngLat[] = [[49.80, 40.30], [49.90, 40.30], [49.90, 40.40], [49.85, 40.40], [49.85, 40.50], [49.80, 40.50]];   // L-shaped area
  const raw: MapRaw = { items: [row("in", 40.35, 49.82), row("in2", 40.45, 49.82), row("notch", 40.45, 49.88), row("edge", 40.30, 49.85), row("bad", NaN, 49.82)], inBox: 5, missingCoords: 3 };
  const r = resolveMapResults(raw, polygon(L)); assert.deepEqual(r.items.map((i) => i._id), ["in", "in2", "edge"]); assert.deepEqual([r.total, r.inBox, r.missingCoords, r.truncated], [3, 5, 3, false]);
  const all = resolveMapResults(raw, null); assert.deepEqual(all.items.map((i) => i._id), ["in", "in2", "notch", "edge"], "no polygon: every geocoded match"); assert.equal(resolveMapResults({ ...raw, inBox: 1200 }, null).truncated, true);
  const odd = resolveMapResults({ items: undefined as never, inBox: NaN as never, missingCoords: undefined as never }, polygon(L)); assert.deepEqual([odd.total, odd.inBox, odd.missingCoords, odd.truncated], [0, 0, 0, false]); });
test("REAL GROQ (groq-js engine): filters + polygon, missing-coordinate count, privacy", { skip: groq ? false : "groq-js is not installed" }, async () => {
  const mk = (id: string, extra: Record<string, unknown>) => ({ _id: id, _type: "property", slug: { current: id }, title: { az: id }, transaction: "sale", propertyType: "apartment", cityId: "city-baki", price: 200000, currency: "AZN", rooms: 3, areaM2: 80, contactPhone: "050 111 22 33", ...extra });
  const pt = (lat: number, lng: number) => ({ location: { _type: "geopoint", lat, lng } });
  const ds = [
    mk("in-match", pt(40.35, 49.82)), mk("in-edge-match", pt(40.30, 49.85)), mk("in-wrong-rooms", { ...pt(40.36, 49.83), rooms: 2 }), mk("in-too-expensive", { ...pt(40.37, 49.84), price: 900000 }), mk("in-rent", { ...pt(40.38, 49.84), transaction: "rent" }),
    mk("notch-inside-box", pt(40.45, 49.88)), mk("far-away", pt(40.60, 50.20)), mk("ganja", { ...pt(40.68, 46.36), cityId: "city-gence" }), mk("no-coords-match", {}), mk("no-coords-2", {}), mk("lat-only", { location: { _type: "geopoint", lat: 40.35 } }), mk("usd-listing", { ...pt(40.36, 49.82), currency: "USD", price: 150 }),
    { ...mk("draft-like-no-slug", pt(40.35, 49.82)), slug: undefined }];
  const L: LngLat[] = [[49.80, 40.30], [49.90, 40.30], [49.90, 40.40], [49.85, 40.40], [49.85, 40.50], [49.80, 40.50]]; const pg = polygon(L);
  const filters = parseSearch({ transaction: "sale", type: "apartment", rooms: "3", maxPrice: "250000" });
  const raw = await run(MAP_QUERY, buildMapParams(filters, pg), ds); const res = resolveMapResults(raw, pg);
  assert.deepEqual(res.items.map((i) => i._id).sort(), ["in-edge-match", "in-match"], "polygon AND every filter (sale, apartment, 3 rooms, max 250,000 AZN; USD listing excluded by the AZN price rule)");
  assert.equal(raw.inBox, 3, "in-match, in-edge-match, notch-inside-box are in the box and match the filters"); assert.equal(res.total, 2);
  assert.equal(raw.missingCoords, 3, "counted: no-coords-match, no-coords-2 and lat-only (a pin needs both lat and lng); not counted: the listing without a slug, and listings that do not match the filters");
  assert.ok(raw.items.every((i) => !("contactPhone" in i)), "the owner's phone number never reaches the map data"); assert.ok(raw.items.every((i) => typeof i.lat === "number" && typeof i.lng === "number"));
  // no polygon yet: every geocoded match inside Azerbaijan, still honouring the filters
  const open = resolveMapResults(await run(MAP_QUERY, buildMapParams(filters, null), ds), null); assert.deepEqual(open.items.map((i) => i._id).sort(), ["far-away", "ganja", "in-edge-match", "in-match", "notch-inside-box"]);
  // changing a filter changes the result (rooms = 2)
  const two = resolveMapResults(await run(MAP_QUERY, buildMapParams(parseSearch({ transaction: "sale", type: "apartment", rooms: "2" }), pg), ds), pg); assert.deepEqual(two.items.map((i) => i._id), ["in-wrong-rooms"]);
  // location filters from the existing search work together with the polygon
  const gnj = resolveMapResults(await run(MAP_QUERY, buildMapParams(parseSearch({ city: "city-gence" }), null), ds), null); assert.deepEqual(gnj.items.map((i) => i._id), ["ganja"]);
  // fetch limit: only `limit` rows are returned, the true box count is kept and the result is flagged as truncated
  const lim = await run(MAP_QUERY, buildMapParams(filters, pg, 1), ds); assert.equal(lim.items.length, 1); assert.equal(lim.inBox, 3); assert.equal(resolveMapResults(lim, pg).truncated, true);
  // nothing matches -> empty, not an error
  const none = resolveMapResults(await run(MAP_QUERY, buildMapParams(parseSearch({ transaction: "rent", rooms: "5" }), pg), ds), pg); assert.deepEqual([none.total, none.inBox], [0, 0]);
});

test("pagePolygonResults: cards for a drawn area are the exact polygon matches, in the map order, split into pages", () => {
  const row = (i: number): MapProperty => ({ _id: "p" + i, slug: "p" + i, title: { az: "p" + i }, transaction: "sale", propertyType: "apartment", cityId: "city-baki", price: 1, currency: "AZN", lat: 40.35, lng: 49.82 } as never);
  const items = Array.from({ length: 30 }, (_, i) => row(i)); const result = { items, total: 30, inBox: 34, missingCoords: 2, truncated: false };
  assert.equal(PAGE_SIZE, 12);
  const p1 = pagePolygonResults(result, 1); assert.deepEqual(p1.rows.map((r) => r._id), items.slice(0, 12).map((r) => r._id)); assert.equal(p1.total, 30, "total = exact matches, not the box count");
  assert.deepEqual(pagePolygonResults(result, 3).rows.map((r) => r._id), ["p24", "p25", "p26", "p27", "p28", "p29"]);
  assert.deepEqual(pagePolygonResults(result, 4).rows, [], "past the end: empty page, same total");
  for (const bad of [0, -2, NaN, Infinity]) assert.deepEqual(pagePolygonResults(result, bad).rows.map((r) => r._id), p1.rows.map((r) => r._id), "bad page -> page 1: " + bad);
  assert.equal(pagePolygonResults(result, 2.7).rows[0]._id, "p12", "fractional page is floored");
  assert.equal(pagePolygonResults(result, 1, 5).rows.length, 5); assert.equal(pagePolygonResults(result, 1, 0).rows.length, 12, "bad page size -> PAGE_SIZE");
  assert.deepEqual(pagePolygonResults({ ...result, items: [], total: 0 }, 1), { rows: [], total: 0 }); });

test("pagePolygonResults uses the output of resolveMapResults (exact polygon test applied before paging)", () => {
  const row = (id: string, lat: number, lng: number): MapProperty => ({ _id: id, slug: id, title: { az: id }, lat, lng } as never);
  const L: LngLat[] = [[49.80, 40.30], [49.90, 40.30], [49.90, 40.40], [49.85, 40.40], [49.85, 40.50], [49.80, 40.50]];
  const res = resolveMapResults({ items: [row("a", 40.35, 49.82), row("notch", 40.45, 49.88), row("b", 40.45, 49.82)], inBox: 3, missingCoords: 0 }, polygon(L));
  assert.deepEqual(pagePolygonResults(res, 1), { rows: [res.items[0], res.items[1]], total: 2 }); assert.deepEqual(res.items.map((i) => i._id), ["a", "b"]); });
