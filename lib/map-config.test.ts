import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
import { DEFAULT_STYLE, DEFAULT_ZOOM, MAP_MESSAGES, PIN_ZOOM, TILE_ATTRIBUTION, getMapConfig, normalizeLngLat } from "./map-config.ts";

test("getMapConfig: MapTiler style URL from the key and optional style", () => {
  const KEY = "abcDEF1234567890_-xyz";
  const c = getMapConfig(KEY, undefined); assert.deepEqual(c, { ok: true, style: DEFAULT_STYLE, styleUrl: `https://api.maptiler.com/maps/streets-v2/style.json?key=${KEY}` });
  assert.deepEqual(getMapConfig(`  ${KEY}  `, "  basic-v2 "), { ok: true, style: "basic-v2", styleUrl: `https://api.maptiler.com/maps/basic-v2/style.json?key=${KEY}` });
  assert.equal((getMapConfig(KEY, "0198a2b4-1234-4abc-9def-0123456789ab") as { style: string }).style, "0198a2b4-1234-4abc-9def-0123456789ab", "custom style ids (UUID) work");
  for (const bad of ["", "   ", "../../etc", "a b", "x/y", "style.json?key=1", "<script>", "-bad", "a".repeat(80)]) assert.equal((getMapConfig(KEY, bad) as { style: string }).style, DEFAULT_STYLE, "bad style falls back: " + bad); });
test("getMapConfig: a missing or malformed key never produces a URL", () => {
  for (const k of [undefined, null, "", "   "]) assert.deepEqual(getMapConfig(k, "streets-v2"), { ok: false, reason: "missing_key" });
  for (const k of ["short", "has space in it", "key&evil=1", "a/b/c/d/e/f/g/h", "ключ-ключ-ключ", "key\nline1234", "x".repeat(200)]) assert.deepEqual(getMapConfig(k), { ok: false, reason: "invalid_key" }, k); });
test("normalizeLngLat: wraps longitude, clamps latitude, rejects non-numbers", () => {
  assert.deepEqual(normalizeLngLat(49.8671, 40.4093), { lat: 40.4093, lng: 49.8671 }); assert.deepEqual(normalizeLngLat(-0.12, 51.5), { lat: 51.5, lng: -0.12 });
  assert.equal(normalizeLngLat(409.8, 40.4)!.lng.toFixed(6), "49.800000"); assert.equal(normalizeLngLat(-310.2, 40.4)!.lng.toFixed(6), "49.800000"); assert.equal(normalizeLngLat(180, 0)!.lng, 180); assert.equal(normalizeLngLat(-180, 0)!.lng, -180); assert.equal(normalizeLngLat(540, 0)!.lng, 180);
  assert.equal(normalizeLngLat(10, 95)!.lat, 90); assert.equal(normalizeLngLat(10, -95)!.lat, -90);
  for (const [a, b] of [[NaN, 1], [1, NaN], [Infinity, 1], ["49", "40"], [null, null], [undefined, 3]] as [unknown, unknown][]) assert.equal(normalizeLngLat(a, b), null); });
test("constants and Azerbaijani texts", () => {
  assert.equal(DEFAULT_STYLE, "streets-v2"); assert.ok(DEFAULT_ZOOM < PIN_ZOOM); assert.equal(TILE_ATTRIBUTION, "© MapTiler © OpenStreetMap contributors");
  for (const [k, v] of Object.entries(MAP_MESSAGES)) assert.ok(typeof v === "string" && v.length > 5, k); assert.equal(MAP_MESSAGES.open, "Xəritədə seç"); assert.ok(MAP_MESSAGES.missing_key.includes("NEXT_PUBLIC_MAPTILER_KEY")); });
test("map component source guard: library loaded lazily, attribution stays on, one map, cleanup, env names written out in full", () => {
  const c = fs.readFileSync("sanity/components/LocationPickerMap.tsx", "utf8");
  assert.ok(/import\("maplibre-gl"\)/.test(c), "dynamic import"); assert.ok(!/^import (?!type)[^;\n]*from "maplibre-gl"/m.test(c), "no static (value) import of maplibre-gl: it must not enter the main bundle");
  assert.ok(!/attributionControl\s*:/.test(c), "attribution control is left at its default (visible)"); assert.ok(c.includes("map?.remove") || c.includes("mapRef.current?.remove()"), "map removed on unmount"); assert.ok(c.includes("let cancelled = false") && c.includes("cancelled = true"), "StrictMode-safe single map");
  assert.ok(c.includes("process.env.NEXT_PUBLIC_MAPTILER_KEY") && c.includes("process.env.NEXT_PUBLIC_MAP_STYLE"), "Next.js can inline the variables"); assert.ok(!/maptiler\.com|key=/.test(c), "no URL or key literal in the component"); assert.ok(!/maxBounds/.test(c), "navigation is not restricted to one area");
  assert.ok(c.includes("draggable: !latest.current.readOnly")); const env = fs.readFileSync(".env.example", "utf8"); assert.ok(/^NEXT_PUBLIC_MAPTILER_KEY=$/m.test(env), "the example file holds no key"); assert.ok(/^NEXT_PUBLIC_MAP_STYLE=streets-v2$/m.test(env)); });
