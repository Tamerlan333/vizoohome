import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
import { MAX_PREVIEW, SWIPE_MIN, previewPhotos, hasControls, showLeft, rightMode, move, clampIndex, toMount, totalPhotos, swipeDirection } from "./preview-photos.ts"; import { DICT, LANGS } from "./i18n/dict.ts";
const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ url: `https://cdn.example.com/p${i + 1}.jpg`, alt: `a${i + 1}` }));
test("previewPhotos: at most 5, in order, the 6th and later are never returned", () => {
  assert.equal(MAX_PREVIEW, 5); const r = previewPhotos(mk(8)); assert.equal(r.length, 5); assert.deepEqual(r.map((p) => p.url), mk(5).map((p) => p.url));
  assert.ok(!JSON.stringify(r).includes("p6.jpg") && !JSON.stringify(r).includes("p8.jpg")); assert.equal(previewPhotos(mk(3)).length, 3); assert.equal(previewPhotos(mk(5)).length, 5); });
test("previewPhotos: empty, missing and invalid input is safe", () => {
  for (const v of [undefined, null, [], "x" as never, 5 as never, {} as never]) assert.deepEqual(previewPhotos(v), []);
  const bad = previewPhotos([{ url: "" }, { url: undefined }, { url: "javascript:alert(1)" }, { url: "   " }, { url: 7 as never }, null as never, { url: " https://a.b/c.jpg " }]); assert.deepEqual(bad, [{ url: "https://a.b/c.jpg", alt: null }]); });
test("controls: only with two or more preview photos (one photo = no arrows); left arrow hidden on the first photo", () => {
  assert.deepEqual([0, 1, 2, 5].map(hasControls), [false, false, true, true]); assert.equal(showLeft(0), false); assert.equal(showLeft(1), true); });
test("right control: next on photos 1-4, then the 'view details' link on the last preview photo (+ extra-photos hint only when more exist)", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => rightMode(i, 5, 8)), ["next", "next", "next", "next", "more"]); assert.deepEqual([0, 1, 2, 3, 4].map((i) => rightMode(i, 5, 5)), ["next", "next", "next", "next", "details"]);
  assert.deepEqual([0, 1, 2].map((i) => rightMode(i, 3, 3)), ["next", "next", "details"], "fewer than 5 photos: stops at the last available one"); });
test("move never leaves the preview: no photo before the first or after the last preview photo", () => {
  assert.equal(move(0, 5, -1), 0); assert.equal(move(0, 5, 1), 1); assert.equal(move(3, 5, 1), 4); assert.equal(move(4, 5, 1), 4, "cannot go to a 6th photo"); assert.equal(move(0, 0, 1), 0);
  let i = 0; for (let k = 0; k < 20; k++) i = move(i, 5, 1); assert.equal(i, 4); assert.equal(clampIndex(9, 5), 4); assert.equal(clampIndex(-3, 5), 0); assert.equal(clampIndex(2, 0), 0); });
test("lazy loading: only the current and next preview photos are ever mounted", () => {
  assert.deepEqual(toMount(0, 5), [0, 1]); assert.deepEqual(toMount(3, 5), [3, 4]); assert.deepEqual(toMount(4, 5), [4]); assert.deepEqual(toMount(0, 1), [0]); assert.deepEqual(toMount(0, 0), []); for (let i = 0; i < 5; i++) assert.ok(toMount(i, 5).every((x) => x < 5)); });
test("total photo count", () => { assert.equal(totalPhotos(8, 5), 8); assert.equal(totalPhotos(undefined, 3), 3); assert.equal(totalPhotos(2, 3), 3); assert.equal(totalPhotos("9", 5), 5); });
test("swipe detection: clear horizontal swipes only; taps and vertical scrolls are ignored", () => {
  assert.equal(SWIPE_MIN, 40); assert.equal(swipeDirection(-80, 5), 1, "swipe left = next"); assert.equal(swipeDirection(80, -5), -1, "swipe right = previous");
  assert.equal(swipeDirection(0, 0), 0, "a tap"); assert.equal(swipeDirection(-39, 0), 0, "too short"); assert.equal(swipeDirection(-60, 50), 0, "diagonal"); assert.equal(swipeDirection(-10, 120), 0, "vertical scroll"); assert.equal(swipeDirection(-40, 20), 1); });
test("card source: touch/hover handling, 44px targets, focus reveal, keyboard, details action, links, heart", () => {
  const c = fs.readFileSync("components/PropertyCard.tsx", "utf8");
  for (const cls of ["group-hover/img:opacity-100", "group-focus-within/img:opacity-100", "[@media(hover:none)]:opacity-100", "[@media(pointer:coarse)]:opacity-100", "[@media(hover:none)]:h-11", "[@media(hover:none)]:min-w-11", "[@media(pointer:coarse)]:h-11", "[@media(pointer:coarse)]:min-w-11", "before:-inset-1.5", "touch-pan-y"]) assert.ok(c.includes(cls), cls);
  assert.ok(c.includes("previewPhotos(p.photos)") && c.includes("rightMode(") && c.includes("swipeDirection(") && c.includes("onKeyDown") && c.includes("onTouchEnd") && c.includes("`/properties/${p.slug}`") && c.includes("<SaveButton id={p._id} />"));
  assert.ok(c.includes('t("card.details")') && c.includes('t("card.prev")') && c.includes('t("card.next")'), "labelled controls"); assert.ok(c.includes("e.preventDefault(); e.stopPropagation();"), "controls never trigger the parent link");
  assert.ok(!c.includes("p.photos?.[0]"), "no direct access to the first photo any more"); assert.ok(!/onMouse(Enter|Over|Leave)/.test(c), "no mouse-only handlers (pointer events + CSS media queries are used instead)"); });
test("queries: list = first 5 valid photos + count; detail projection untouched (all photos + phone)", () => {
  const q = fs.readFileSync("lib/properties.ts", "utf8"); const get = (n: string) => new RegExp("(?:export )?const " + n + " = `([^`]*)`").exec(q)?.[1] ?? "";
  const proj = get("PROJ"), base = get("BASE"), fields = get("FIELDS"), det = get("PROJ_DETAIL");
  assert.ok(proj.includes("[0...5]") && proj.includes('"photoCount":count(coalesce(photos,[])[defined(asset->url)])') && proj.includes("${FIELDS}") && !proj.includes("contactPhone"), "list: first 5 photos + count");
  assert.ok(!fields.includes("photos"), "FIELDS has no photos"); assert.ok(base.includes('"photos":photos[defined(asset)]{') && !base.includes("[0...5]"), "BASE keeps every photo");
  assert.equal(det, "{${BASE},contactPhone}", "detail projection is unchanged: all photos + the owner's phone"); });
test("translations for the card controls exist in AZ, RU and EN (incl. g.counter used by the screen-reader counter)", () => {
  for (const l of LANGS) for (const k of ["card.prev", "card.next", "card.moreCount", "card.details", "g.counter"]) assert.ok(DICT[l][k]?.trim(), `${l}:${k}`);
  assert.equal(DICT.az["card.moreCount"], "+{n} foto"); assert.equal(DICT.en["card.details"], "View property details"); for (const l of LANGS) assert.ok(DICT[l]["card.moreCount"].includes("{n}")); });
test("every translation key used in PropertyCard.tsx exists (including keys inside ternaries)", () => {
  const c = fs.readFileSync("components/PropertyCard.tsx", "utf8"); const keys = [...c.matchAll(/["`']((?:card|prop|g|tx|ty|rooms|u|price)\.[A-Za-z0-9.\-${}:]+)["`']/g)].map((m) => m[1]).filter((k) => !k.includes("$"));
  assert.ok(keys.length > 5); for (const k of keys) assert.ok(DICT.az[k], `missing key ${k}`); });
