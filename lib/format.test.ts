import test from "node:test"; import assert from "node:assert/strict";
import { formatPrice } from "./format.ts";
const S = " "; // no-break space

// Expected strings are the exact output Intl.NumberFormat produced on the server before the change (hard-coded on purpose:
// the formatter must not depend on the ICU version of the machine running it).
const CASES: [string, string, string][] = [
  ["AZN", "az", `125.000${S}₼`], ["AZN", "ru", `125${S}000${S}AZN`], ["AZN", "en", `AZN${S}125,000`],
  ["USD", "az", `125.000${S}US$`], ["USD", "ru", `125${S}000${S}$`], ["USD", "en", "$125,000"],
  ["EUR", "az", `125.000${S}€`], ["EUR", "ru", `125${S}000${S}€`], ["EUR", "en", "€125,000"],
];
for (const [cur, lang, want] of CASES) test(`formatPrice ${cur} ${lang}`, () => assert.equal(formatPrice(125000, cur, lang), want));

test("formatPrice grouping boundaries", () => {
  assert.equal(formatPrice(0, "AZN", "az"), `0${S}₼`);
  assert.equal(formatPrice(999, "AZN", "az"), `999${S}₼`);
  assert.equal(formatPrice(1000, "AZN", "az"), `1.000${S}₼`);
  assert.equal(formatPrice(1234567, "AZN", "ru"), `1${S}234${S}567${S}AZN`);
  assert.equal(formatPrice(1234567, "USD", "en"), "$1,234,567");
});

test("formatPrice rounds to whole units, half away from zero", () => {
  assert.equal(formatPrice(1.5, "EUR", "en"), "€2");
  assert.equal(formatPrice(2.5, "EUR", "en"), "€3");
  assert.equal(formatPrice(999.5, "AZN", "az"), `1.000${S}₼`);
  assert.equal(formatPrice(1234.4, "USD", "ru"), `1${S}234${S}$`);
});

test("formatPrice negative sign placement matches previous output", () => {
  assert.equal(formatPrice(-1500, "AZN", "az"), `-1.500${S}₼`);
  assert.equal(formatPrice(-1500, "USD", "en"), "-$1,500");
});

test("formatPrice keeps the suffix verbatim", () => {
  assert.equal(formatPrice(800, "AZN", "az", " / ay"), `800${S}₼ / ay`);
  assert.equal(formatPrice(800, "USD", "ru", " / мес."), `800${S}$ / мес.`);
  assert.equal(formatPrice(800, "EUR", "en", " / month"), "€800 / month");
  assert.equal(formatPrice(800, "EUR", "en"), "€800");
});

test("formatPrice falls back to az for an unknown language", () => {
  assert.equal(formatPrice(125000, "AZN", "de"), `125.000${S}₼`);
});

test("formatPrice is deterministic (no Intl dependency)", () => {
  const before = Intl.NumberFormat;
  // @ts-expect-error: deliberately break Intl to prove the formatter does not use it
  Intl.NumberFormat = () => { throw new Error("Intl used"); };
  try { assert.equal(formatPrice(125000, "USD", "az"), `125.000${S}US$`); } finally { Intl.NumberFormat = before; }
});
