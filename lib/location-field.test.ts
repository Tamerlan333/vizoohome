import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
const schema = fs.readFileSync("sanity/schemaTypes/property.ts", "utf8");
const ORIGINAL_FIELDS = ["transaction", "propertyType", "buildingType", "areaM2", "hasTitleDeed", "price", "currency", "rooms", "cityId", "districtId", "settlementId", "metroIds", "address", "areaId", "repairStatus", "floor", "totalFloors", "photos", "video", "slug", "contactPhone", "featured"];
const fieldNames = () => [...schema.matchAll(/defineField\(\{\s*name:\s*"([A-Za-z0-9_]+)"/g)].map((m) => m[1]);
const locationBlock = () => { const i = schema.indexOf('defineField({ name: "location"'); assert.ok(i > 0, "location field exists"); const j = schema.indexOf("defineField(", i + 10); return schema.slice(i, j === -1 ? undefined : j); };

test("Studio guard: every existing field is still there, in the same order; the only addition is `location`, right after `address`", () => {
  const now = fieldNames(); assert.deepEqual(now.filter((n) => n !== "location"), ORIGINAL_FIELDS, "existing fields unchanged and in the same order");
  assert.equal(now.filter((n) => n === "location").length, 1); assert.equal(now.indexOf("location"), now.indexOf("address") + 1); });
test("Studio guard: the numbered sections are unchanged", () => {
  const sections = [...schema.matchAll(/\{ name: "([a-zA-Z]+)", title: "(\d\.[^"]+)"/g)].map((m) => `${m[1]}|${m[2]}`);
  assert.deepEqual(sections, ["main|1. Elanın əsas məlumatları", "features|2. Əmlakın xüsusiyyətləri", "price|3. Qiymət və otaqlar", "place|4. Ünvan və məkan", "repairFloor|5. Təmir və mərtəbə", "media|6. Şəkillər və video", "other|8. Əlaqə və digər məlumatlar"]); });
test("location field: optional geopoint in section 4, own Azerbaijani label, custom input, error + warning rules", () => {
  const b = locationBlock();
  assert.ok(b.includes('type: "geopoint"') && b.includes('fieldset: "place"') && b.includes("components: { input: PropertyLocationInput }"));
  assert.ok(b.includes('title: "Xəritədə dəqiq yer (pin)"') && b.includes("İstəyə bağlı"));
  assert.ok(b.includes("rule.custom(checkRange).error()") && b.includes("rule.custom(checkInsideAzerbaijan).warning()"));
  for (const bad of ["required", "hidden", "readOnly", "initialValue"]) assert.ok(!b.includes(bad), `location must not be ${bad}`);
  assert.ok(schema.includes('from "../../lib/location-validation.ts"') && schema.includes('from "../components/PropertyLocationInput"')); });
test("input component (B1): replaces only this field's input, writes geopoint lat/lng without altitude, no map library", () => {
  const c = fs.readFileSync("sanity/components/PropertyLocationInput.tsx", "utf8");
  assert.ok(c.startsWith('"use client"') && c.includes("export default function PropertyLocationInput")); assert.ok(c.includes("set(toGeopoint(") && c.includes("onChange(unset())"));
  assert.equal((c.match(/<Label as="label"/g) ?? []).length, 3, "real <label> elements (Sanity's Label renders a div unless as=\"label\")"); assert.ok(!/maplibre|terra-draw|turf|google/i.test(c), "no map library in B1"); assert.ok(!/\balt\b/.test(c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")), "no altitude"); });
test("dependencies (B1): no map packages anywhere; the component only imports packages that already exist (react, sanity, @sanity/ui)", () => {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")); for (const n of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) assert.ok(!/maplibre|terra-draw|turf/i.test(n), "unexpected package " + n);
  const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8")); assert.equal(Object.keys(lock.packages).filter((k) => /maplibre|terra-draw|turf/i.test(k)).length, 0, "lockfile has no map packages");
  assert.ok(lock.packages["node_modules/@sanity/ui"], "@sanity/ui is installed (Sanity itself depends on it)");
  const c = fs.readFileSync("sanity/components/PropertyLocationInput.tsx", "utf8"); const outside = [...c.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).filter((m) => !m.startsWith(".")).sort();
  assert.deepEqual(outside, ["@sanity/ui", "react", "sanity"]); });
