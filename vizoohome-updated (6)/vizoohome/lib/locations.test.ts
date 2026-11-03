import test from "node:test"; import assert from "node:assert/strict";
import { METRO, SETTLEMENTS, DISTRICTS, REGIONS, DISTRICT_NODES, ABSERON_ID, labelOf, settlementsOf } from "./locations.ts"; import { LEGACY_TO_NEW } from "./legacy-map.ts"; import { LEGACY_AREAS } from "./locations.ts";
const EXPECTED_METRO = "20 Yanvar|28 May|8 Noyabr|Avtovağzal|Azadlıq Prospekti|Bakmil|Dərnəgül|Elmlər Akademiyası|Əhmədli|Gənclik|Həzi Aslanov|Xalqlar Dostluğu|Xocəsən|İçəri Şəhər|İnşaatçılar|Koroğlu|Qara Qarayev|Memar Əcəmi|Neftçilər|Nəriman Nərimanov|Nəsimi|Nizami|Sahil|Şah İsmayıl Xətai|Ulduz";
const EXPECTED: Record<string, string> = {
  "Abşeron rayonu": "Aşağı Güzdək|Atyalı|Ceyranbatan|Çiçək|Digah|Fatmayı|Görədil|Güzdək|Hökməli|Köhnə Corat|Qobu|Masazır|Mehdiabad|Məmmədli|Novxanı|Pirəkəşkül|Saray|Yeni Corat|Zuğulba",
  "Binəqədi": "2-ci Alatava|28 May|6-cı mikrorayon|7-ci mikrorayon|8-ci mikrorayon|9-cu mikrorayon|Biləcəri|Binəqədi|Xocəsən|Xutor|M.Ə.Rəsulzadə|Sulutəpə",
  "Xətai": "Ağ şəhər|Əhmədli|Həzi Aslanov|Köhnə Günəşli|NZS",
  "Xəzər": "Binə|Buzovna|Dübəndi|Gürgən|Qala|Mərdəkan|Şağan|Şimal DRES|Şüvəlan|Türkan|Zirə",
  "Nərimanov": "Böyükşor", "Nəsimi": "1-ci mikrorayon|2-ci mikrorayon|3-cü mikrorayon|4-cü mikrorayon|5-ci mikrorayon|Kubinka", "Nizami": "8-ci kilometr|Keşlə", "Pirallahı": "Pirallahı",
  "Qaradağ": "Ələt|Qızıldaş|Qobustan|Lökbatan|Müşfiqabad|Puta|Sahil|Səngəçal|Şubanı",
  "Sabunçu": "Albalılıq|Bakıxanov|Balaxanı|Bilgəh|Kürdəxanı|Maştağa|Nardaran|Pirşağı|Ramana|Sabunçu|Savalan|Sea Breeze|Yeni Balaxanı|Yeni Ramana|Zabrat",
  "Səbail": "20-ci sahə|Badamdar|Bayıl|Bibiheybət|Şıxov",
  "Suraxanı": "Bahar|Bülbülə|Dədə Qorqud|Əmircan|Günəşli|Hövsan|Qaraçuxur|Massiv A|Massiv B|Massiv D|Massiv G|Massiv V|Suraxanı|Şərq|Yeni Günəşli|Yeni Suraxanı|Zığ",
  "Yasamal": "Yasamal|Yeni Yasamal" };
test("all 25 metro stations present, once, in order", () => { assert.equal(METRO.length, 25); assert.deepEqual(METRO.map((m) => m.label), EXPECTED_METRO.split("|")); assert.equal(new Set(METRO.map((m) => m.id)).size, 25); });
test("every supplied district and settlement is present", () => {
  assert.equal(DISTRICT_NODES.length, 13); let total = 0;
  for (const [d, list] of Object.entries(EXPECTED)) {
    const node = DISTRICT_NODES.find((x) => x.label === d || x.label === d + " rayonu" || x.label === d); assert.ok(node, d);
    assert.deepEqual(settlementsOf(node.id).map((s) => s.label), list.split("|"), d); total += list.split("|").length; }
  assert.equal(SETTLEMENTS.length, total); assert.equal(total, 105); });
test("ids unique across categories, even for repeated labels", () => {
  const ids = [...DISTRICTS, ...SETTLEMENTS, ...METRO].map((x) => x.id); assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => !REGIONS.some((r) => r.id === id && id !== ABSERON_ID)));
  assert.notEqual(METRO.find((m) => m.label === "28 May")?.id, SETTLEMENTS.find((s) => s.label === "28 May")?.id);
  assert.equal(SETTLEMENTS.filter((s) => s.label === "Sahil").length, 1); assert.ok(labelOf("metro-sahil") === "Sahil" && labelOf("settle-qaradag-sahil") === "Sahil"); });
test("every settlement has a valid parent; Abşeron stays separate from Bakı", () => {
  for (const s of SETTLEMENTS) assert.ok(DISTRICT_NODES.some((d) => d.id === s.parent), s.id);
  assert.ok(!DISTRICTS.some((d) => d.id === ABSERON_ID)); assert.ok(REGIONS.some((r) => r.id === ABSERON_ID)); });
test("legacy area map covers every old id and targets exist", () => {
  for (const a of LEGACY_AREAS) { const t = LEGACY_TO_NEW[a.id]; assert.ok(t, a.id);
    if (t.settlement) assert.ok(SETTLEMENTS.some((s) => s.id === t.settlement), a.id); if (t.metro) assert.ok(METRO.some((m) => m.id === t.metro), a.id); if (t.district) assert.ok(DISTRICTS.some((d) => d.id === t.district), a.id); }
  assert.ok(LEGACY_TO_NEW["area-28-may"].manual && LEGACY_TO_NEW["area-sahil"].manual); });
