import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
import { normalizePhone, formatPhone, telHref, waHref, contactOf, isValidPhone } from "./phone.ts";
test("Azerbaijani formats normalize to one E.164 number", () => {
  for (const v of ["+994 50 123 45 67", "+994501234567", "0501234567", "050 123 45 67", "050-123-45-67", "994501234567", "00994501234567", "50 123 45 67", " +994 (50) 123-45-67 "]) assert.equal(normalizePhone(v), "+994501234567", v);
  assert.equal(normalizePhone("(012) 123-45-67"), "+994121234567"); assert.equal(normalizePhone("0707771122"), "+994707771122"); });
test("international numbers are allowed, bad input is rejected", () => {
  assert.equal(normalizePhone("+90 532 123 45 67"), "+905321234567"); assert.equal(normalizePhone("+49 151 12345678"), "+4915112345678"); assert.equal(normalizePhone("+1 (415) 555-2671"), "+14155552671");
  for (const bad of ["", "   ", "abc", "050123", "+994 5012345", "+994 0 50 123 45 6", "+0501234567", "05012345678901", "050 123 45 67 ext 5", "++994501234567", "994+501234567", "+12", undefined, null, 5, "<script>"]) assert.equal(normalizePhone(bad as unknown), null, String(bad));
  assert.equal(isValidPhone("+994501234567"), true); assert.equal(isValidPhone("x"), false); });
test("display, tel and WhatsApp links use the same number", () => {
  assert.equal(formatPhone("+994501234567"), "+994 50 123 45 67"); assert.equal(formatPhone("+4915112345678"), "+4915112345678");
  assert.equal(telHref("+994501234567"), "tel:+994501234567"); assert.equal(waHref("+994501234567"), "https://wa.me/994501234567");
  assert.equal(waHref("+994501234567", "Salam! test"), "https://wa.me/994501234567?text=Salam!%20test");
  const c = contactOf("050 123 45 67", "Salam"); assert.deepEqual(c, { display: "+994 50 123 45 67", tel: "tel:+994501234567", wa: "https://wa.me/994501234567?text=Salam" }); });
test("missing or invalid numbers produce no contact block (no undefined, no placeholder)", () => { for (const v of [undefined, null, "", "  ", "nope"]) assert.equal(contactOf(v as unknown), null); });
test("schema: contactPhone field, Azerbaijani label/description/placeholder, validation, separate from description", () => {
  const sc = fs.readFileSync("sanity/schemaTypes/property.ts", "utf8");
  assert.ok(sc.includes('name: "contactPhone", title: "Əlaqə nömrəsi", type: "string"')); assert.ok(sc.includes('placeholder: "+994 XX XXX XX XX"'));
  assert.ok(sc.includes("Bu elan üçün ev sahibinin və ya səlahiyyətli əlaqə şəxsin telefon nömrəsini daxil edin.")); assert.ok(sc.includes("isValidPhone(v)"));
  assert.equal((sc.match(/name: "contactPhone"/g) ?? []).length, 1); assert.ok(!/contactPhone[^\n]*initialValue/.test(sc), "no default/hardcoded phone"); });
test("privacy: phone is fetched by the detail query only, never in list/related/saved/filter/sitemap queries", () => {
  const p = fs.readFileSync("lib/properties.ts", "utf8"); const q = fs.readFileSync("lib/query.ts", "utf8");
  const proj = /export const PROJ = `([^`]*)`/.exec(p)?.[1] ?? ""; const base = /const BASE = `([^`]*)`/.exec(p)?.[1] ?? ""; assert.ok(proj.length > 0 && base.length > 0);
  assert.ok(!base.includes("contactPhone") && !proj.includes("contactPhone")); assert.ok(/PROJ_DETAIL = `\{\$\{BASE\},contactPhone\}`/.test(p));
  assert.ok(/getBySlug[^\n]*\$\{PROJ_DETAIL\}/.test(p)); for (const fn of ["getRelated", "getByIds", "allSlugs"]) { const line = p.split("\n").find((l) => l.includes(`export const ${fn}`)) ?? ""; assert.ok(line && !line.includes("PROJ_DETAIL") && !line.includes("contactPhone"), fn); }
  assert.ok(/\$\{PROJ\}/.test(p.split("\n").find((l) => l.includes("listPublished") || l.includes("items")) ?? "") || p.includes("${PROJ}")); assert.ok(!q.includes("contactPhone")); });
test("detail page renders the block only when valid and passes no phone to client components", () => {
  const d = fs.readFileSync("components/PropertyDetail.tsx", "utf8"); assert.ok(d.includes("contactOf(p.contactPhone")); assert.ok(d.includes("{contact && (")); assert.ok(d.includes('href={contact.tel}') && d.includes("href={contact.wa}"));
  assert.ok(!/<(Gallery|SaveButton|PropertyCard)[^>]*contactPhone/.test(d)); assert.ok(!fs.readFileSync("components/PropertyCard.tsx", "utf8").includes("contactPhone")); });
