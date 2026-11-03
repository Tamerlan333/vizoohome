import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path";
import { DICT, LANGS, translate } from "./i18n/dict.ts"; import { toggleId, parseSaved } from "./saved-core.ts";
import { expandType, normalizeType } from "./property-utils.ts"; import { parseSearch } from "./search.ts";
test("dictionary complete in all languages", () => { const keys = Object.keys(DICT.az); assert.ok(keys.length > 80);
  for (const l of LANGS) { assert.equal(Object.keys(DICT[l]).length, keys.length); for (const k of keys) assert.ok(DICT[l][k]?.trim(), `${l}:${k}`); } });
test("translate vars + fallback", () => { assert.equal(translate("en", "list.count", { n: 3 }), "3 results found"); assert.equal(translate("ru", "no.such.key"), "no.such.key"); });
test("every literal t('key') used in the code exists", () => {
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (["node_modules", ".next"].includes(e.name) ? [] : walk(path.join(d, e.name))) : /\.tsx?$/.test(e.name) && !/\.test\.ts$/.test(e.name) ? [path.join(d, e.name)] : []);
  const missing: string[] = [];
  for (const f of [...walk("app"), ...walk("components"), ...walk("lib")]) for (const m of fs.readFileSync(f, "utf8").matchAll(/\bt\(\s*["']([a-z0-9.]+)["']\s*[,)]/gi)) if (!DICT.az[m[1]]) missing.push(`${f}:${m[1]}`);
  assert.deepEqual(missing, []);
  for (const k of ["ty.apartment", "ty.yard-house", "ty.land", "ty.commercial", "ty.other", "bt.new", "bt.old", "tx.sale", "tx.rent", "tab.sale", "tab.rent"]) assert.ok(DICT.az[k], k); });
test("saved toggle + parse", () => { assert.deepEqual(toggleId([], "a"), ["a"]); assert.deepEqual(toggleId(["a", "b"], "a"), ["b"]);
  assert.deepEqual(parseSaved("not json"), []); assert.deepEqual(parseSaved('["x",1,"y"]'), ["x", "y"]); assert.deepEqual(parseSaved(null), []); });
test("villa and garden house are one category", () => { assert.deepEqual(expandType("yard-house"), ["yard-house", "house", "villa"]); assert.equal(normalizeType("villa"), "yard-house"); assert.equal(normalizeType("house"), "yard-house"); assert.deepEqual(expandType("land"), ["land"]); });
test("search: legacy type, building, land", () => { assert.equal(parseSearch({ type: "villa" }).type, "yard-house"); assert.equal(parseSearch({ building: "new" }).building, "new");
  assert.equal(parseSearch({ building: "x" }).building, undefined); assert.equal(parseSearch({ type: "land", building: "new", rooms: "2" }).building, undefined); assert.equal(parseSearch({ type: "apartment", building: "old", rooms: "2" }).rooms, 2); });
