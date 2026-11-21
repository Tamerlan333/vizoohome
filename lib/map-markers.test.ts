import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
import { detailMarker, markerStyle, propertyHref, toMapMarkers, type MarkerSource } from "./map-markers.ts";
import { pagePolygonResults, resolveMapResults, type MapProperty, type MapRaw } from "./map-query.ts";
import { pointInPolygon, validatePolygon, type GeoPolygon, type LngLat } from "./geo.ts";

const SQ: LngLat[] = [[49.80, 40.30], [49.90, 40.30], [49.90, 40.50], [49.80, 40.50]];
const square = (): GeoPolygon => { const r = validatePolygon({ type: "Polygon", coordinates: [SQ] }); assert.ok(r.ok); return (r as { polygon: GeoPolygon }).polygon; };
const L = (id: string, lat: unknown, lng: unknown, extra: Partial<MarkerSource> = {}): MarkerSource => ({ _id: id, slug: `slug-${id}`, title: { az: `Elan ${id}` }, price: 100, currency: "AZN", lat, lng, ...extra });

test("valid coordinates get a marker; invalid, missing or out-of-range ones do not (nothing is guessed)", () => {
  const items = [
    L("ok", 40.390833, 49.87858),
    L("edge", -90, 180),
    L("noLat", undefined, 49.8), L("noLng", 40.4, undefined), L("nulls", null, null),
    L("nan", Number.NaN, 49.8), L("inf", 40.4, Number.POSITIVE_INFINITY),
    L("latHigh", 90.0001, 49.8), L("lngLow", 40.4, -180.0001),
    L("strings", "40.39", "49.87"),
  ];
  assert.deepEqual(toMapMarkers(items).map((m) => m.id), ["ok", "edge"]);
  const [m] = toMapMarkers([L("ok", 40.390833, 49.87858)]);
  assert.equal(m.lat, 40.390833); assert.equal(m.lng, 49.87858, "exact stored coordinates, no rounding or approximation");
});

test("properties without coordinates: no marker, but they are not dropped from or altered in the source list", () => {
  const items = [L("a", 40.4, 49.85), L("b", undefined, undefined), L("c", 40.41, 49.86)];
  const copy = structuredClone(items);
  assert.deepEqual(toMapMarkers(items).map((m) => m.id), ["a", "c"]);
  assert.deepEqual(items, copy, "the listing data itself is untouched (cards keep using it)");
  assert.equal(detailMarker(L("b", undefined, undefined)), null, "detail page without coordinates: map hidden");
  assert.equal(detailMarker(null), null); assert.equal(detailMarker(undefined), null);
});

test("marker <-> property association: one marker per _id, linking to that listing's own detail page", () => {
  const ms = toMapMarkers([L("x1", 40.4, 49.85, { slug: "menzil-yasamal" }), L("x2", 40.41, 49.86, { slug: "ev-nesimi" }), L("x1", 40.5, 49.9)]);
  assert.deepEqual(ms.map((m) => [m.id, m.href]), [["x1", "/properties/menzil-yasamal"], ["x2", "/properties/ev-nesimi"]], "duplicates of an id are ignored");
  assert.deepEqual([ms[0].title, ms[0].price, ms[0].currency], [{ az: "Elan x1" }, 100, "AZN"]);
  assert.equal(toMapMarkers([L("ns", 40.4, 49.85, { slug: null })])[0].href, null, "no slug: marker without a link, never a wrong link");
  assert.equal(propertyHref("a b/ç"), "/properties/a%20b%2F%C3%A7"); assert.equal(propertyHref("  "), null); assert.equal(propertyHref(undefined), null);
});

test("polygon filtering and markers agree: markers are exactly the polygon results, all inside the polygon", () => {
  const poly = square();
  const raw: MapRaw = { inBox: 4, missingCoords: 1, items: [
    { ...L("in1", 40.35, 49.82), slug: "in1" }, { ...L("in2", 40.45, 49.88), slug: "in2" },
    { ...L("boxOnly", 40.60, 49.85), slug: "boxOnly" }, { ...L("bad", Number.NaN, 49.85), slug: "bad" },
  ] as unknown as MapProperty[] };
  const result = resolveMapResults(raw, poly);
  const markers = toMapMarkers(result.items);
  assert.deepEqual(markers.map((m) => m.id), result.items.map((p) => p._id), "the same listings, same order: no second filter");
  assert.deepEqual(markers.map((m) => m.id), ["in1", "in2"]);
  assert.ok(markers.every((m) => pointInPolygon(m.lng, m.lat, poly)));
  const ids = new Set(markers.map((m) => m.id));
  assert.ok(pagePolygonResults(result, 1).rows.every((r) => ids.has(r._id)), "every listed card has its marker");
});

test("detail map: exactly its own listing's marker", () => {
  const own = L("me", 40.390833, 49.87858, { slug: "my-flat" });
  const m = detailMarker(own);
  assert.deepEqual(m && [m.id, m.lat, m.lng, m.href], ["me", 40.390833, 49.87858, "/properties/my-flat"]);
  const c = fs.readFileSync("components/PropertyLocationMap.tsx", "utf8");
  assert.equal((c.match(/new ml\.Marker\(/g) ?? []).length, 1, "one marker only");
  assert.ok(!/\bitems\b(?!-)|toMapMarkers|map-query|map-properties|sanityFetch/.test(c), "never receives or fetches other listings");
  assert.ok(/export default function PropertyLocationMap\(\{ lat, lng, title \}: \{ lat: number; lng: number; title: string \}\)/.test(c), "props: one point only");
  assert.ok(c.includes("center: [lng, lat]") && c.includes("zoom: PIN_ZOOM") && c.includes("getMapConfig("), "centred on the pin, shared map config");
  assert.ok(!/terra-draw|draw-controller|createDrawController|startDrawing|AreaResults|PropertySearch|polygon|"poly"|<button/i.test(c), "no Draw-to-Search, polygon, area selection or search controls on the detail map");
  assert.ok(!/setPopup|draggable: true|\.on\("click"/.test(c), "the pin is display-only: not draggable, no click actions");
  const d = fs.readFileSync("components/PropertyDetail.tsx", "utf8");
  assert.ok(d.includes("const pin = detailMarker(p);") && d.includes("{pin && <section") && d.includes("<PropertyLocationMap lat={pin.lat} lng={pin.lng}"), "rendered only with valid own coordinates");
});

test("wiring: search map markers keep the area gate; detail query adds coordinates without touching list/phone projections", () => {
  const m = fs.readFileSync("components/PropertyMap.tsx", "utf8");
  assert.ok(m.includes("for (const item of toMapMarkers(items))") && m.includes("if (!showMarkers) return;"), "same gate as the cards");
  assert.ok(m.includes("link.href = item.href;") && m.includes("element.dataset.propertyId = item.id;"));
  const p = fs.readFileSync("lib/properties.ts", "utf8");
  assert.ok(/const BASE = `[^`]*"lat":location\.lat,"lng":location\.lng`/.test(p), "detail gets the Studio geopoint");
  assert.ok(!/const FIELDS = `[^`]*location/.test(p) && !/export const PROJ = `[^`]*location/.test(p), "list projections unchanged");
  assert.deepEqual(Object.keys(markerStyle()).sort(), ["background", "border", "borderRadius", "boxShadow", "cursor", "height", "padding", "width"]);
});
