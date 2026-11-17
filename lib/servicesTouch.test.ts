import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
import { createPressTracker, SCROLL_SLOP } from "./servicesTouch.ts";

const BOX = { left: 0, top: 100, right: 300, bottom: 500 };
const setup = () => { const log: string[] = []; const tr = createPressTracker<string>((c, on) => log.push(`${c}:${on}`)); return { log, tr }; };

test("touch: orange from touchstart, kept for the whole hold, cleared on lift", () => {
  const { log, tr } = setup();
  assert.equal(tr.start("A", BOX, { id: 1, x: 150, y: 300 }, 0, 0), true); assert.deepEqual(log, ["A:true"], "activates synchronously on touchstart");
  for (let i = 0; i < 20; i++) assert.equal(tr.move({ id: 1, x: 150 + (i % 3), y: 300 - (i % 2) }, 0, 0), true); // finger drift inside the card
  assert.deepEqual(log, ["A:true"], "small finger movement inside the card never clears it");
  assert.equal(tr.end(1), true); assert.deepEqual(log, ["A:true", "A:false"]); assert.equal(tr.isActive(), false); });

test("touch: a quick tap shows the press and leaves nothing behind", () => {
  const { log, tr } = setup(); tr.start("A", BOX, { id: 7, x: 10, y: 110 }, 0, 0); tr.end(7);
  assert.deepEqual(log, ["A:true", "A:false"]); assert.equal(tr.end(7), false, "a second end is a no-op"); });

test("touch: leaving the card clears, coming back restores, without duplicate updates", () => {
  const { log, tr } = setup(); tr.start("A", BOX, { id: 1, x: 150, y: 300 }, 0, 0);
  tr.move({ id: 1, x: -5, y: 300 }, 0, 0); tr.move({ id: 1, x: -20, y: 300 }, 0, 0);
  tr.move({ id: 1, x: 40, y: 300 }, 0, 0); tr.move({ id: 1, x: 60, y: 300 }, 0, 0); tr.end(1);
  assert.deepEqual(log, ["A:true", "A:false", "A:true", "A:false"]); });

test("touch: once the page scrolls the press ends for good and later moves are ignored", () => {
  const { log, tr } = setup(); tr.start("A", BOX, { id: 1, x: 150, y: 300 }, 0, 1000);
  assert.equal(tr.move({ id: 1, x: 150, y: 298 }, 0, 1000 + SCROLL_SLOP), true, "within slop: still pressed");
  assert.equal(tr.move({ id: 1, x: 150, y: 280 }, 0, 1000 + SCROLL_SLOP + 1), false, "scroll took over");
  assert.equal(tr.move({ id: 1, x: 150, y: 300 }, 0, 1000), false); assert.equal(tr.end(1), false);
  assert.deepEqual(log, ["A:true", "A:false"]); });

test("touch: only the first finger's card is pressed; other fingers are ignored", () => {
  const { log, tr } = setup(); tr.start("A", BOX, { id: 1, x: 150, y: 300 }, 0, 0);
  assert.equal(tr.start("B", BOX, { id: 2, x: 150, y: 300 }, 0, 0), false);
  tr.move({ id: 2, x: -50, y: 300 }, 0, 0); assert.equal(tr.end(2), false, "lifting the second finger does not end the press");
  assert.deepEqual(log, ["A:true"]); tr.end(1); tr.start("B", BOX, { id: 3, x: 1, y: 101 }, 0, 0);
  assert.deepEqual(log, ["A:true", "A:false", "B:true"]); });

test("touch: a forced stop (blur/unmount) always clears", () => {
  const { log, tr } = setup(); tr.start("A", BOX, { id: 1, x: 150, y: 300 }, 0, 0); assert.equal(tr.end(), true);
  assert.deepEqual(log, ["A:true", "A:false"]); assert.equal(tr.end(), false); });

test("touch wiring: native Touch Events only, passive, no blocking, every listener removed", () => {
  const c = fs.readFileSync("components/ServicesSection.tsx", "utf8").replace(/^\s*\/\/.*$/gm, "").replace(/\/\/ .*$/gm, ""); // code only, no comments
  assert.ok(!/pointer(down|move|up|cancel)/.test(c), "no competing Pointer Events handlers");
  assert.ok(!/preventDefault|setPointerCapture|touch-action|setTimeout|setInterval/.test(c), "no blocking, capture, or timers");
  for (const ev of ["touchmove", "touchend", "touchcancel", "blur"]) assert.equal((c.match(new RegExp(`window\\.addEventListener\\("${ev}"`, "g")) ?? []).length, 1, ev),
    assert.equal((c.match(new RegExp(`window\\.removeEventListener\\("${ev}"`, "g")) ?? []).length, 1, ev);
  assert.ok(c.includes('list.addEventListener("touchstart", onStart, opts)') && c.includes('list.removeEventListener("touchstart", onStart)'));
  const css = fs.readFileSync("app/globals.css", "utf8"); assert.ok(/@media \(hover:none\)\{[^@]*\.svc-card\[data-pressed\]\{transform:translateY\(-3px\);border-color:#FF9D23\}/.test(css));
  assert.ok(/@media \(hover:hover\)\{\s*\.svc-card:focus-within\{border-color:#FF9D23\}[^@]*\.svc-card:hover\{transform:translateY\(-3px\);border-color:#FF9D23\}/.test(css), "desktop hover/focus unchanged"); });
