import test from "node:test"; import assert from "node:assert/strict";
import { createDrawController, DRAW_DEFAULTS, type DrawPreview, type DrawState } from "./draw-controller.ts";
import type { LngLat } from "./geo.ts";

/** Test projection: 1 px = 0.001 degree, so container pixels and coordinates are easy to reason about. */
const SCALE = 1000;
const project = (lng: number, lat: number) => ({ x: lng * SCALE, y: lat * SCALE });
const P = (x: number, y: number, pointerId = 1, button = 0) => ({ x, y, lng: x / SCALE, lat: y / SCALE, pointerId, button });

function setup(extra: Partial<Parameters<typeof createDrawController>[0]> = {}) {
  const states: DrawState[] = []; const previews: DrawPreview[] = []; const closed: LngLat[][] = []; const rejected: string[] = [];
  const c = createDrawController({ project, onStateChange: (s) => states.push(s), onPreview: (p) => previews.push(p), onClose: (r) => { closed.push(r); }, onCloseRejected: (r) => rejected.push(r), ...extra });
  return { c, states, previews, closed, rejected };
}
/** Draws a square-ish stroke from (100,100) clockwise, ending near (but not at) the start. */
function strokeSquare(c: ReturnType<typeof createDrawController>, id = 1, endAt: [number, number] = [100, 130]) {
  assert.equal(c.pointerDown(P(100, 100, id)), true);
  for (let x = 100; x <= 300; x += 5) c.pointerMove(P(x, 100, id));
  for (let y = 100; y <= 300; y += 5) c.pointerMove(P(300, y, id));
  for (let x = 300; x >= 100; x -= 5) c.pointerMove(P(x, 300, id));
  for (let y = 300; y >= endAt[1]; y -= 5) c.pointerMove(P(endAt[0], y, id));
  c.pointerUp(P(endAt[0], endAt[1], id));
}

test("idle ignores pointers; arm() starts a new area", () => {
  const { c, states } = setup();
  assert.equal(c.getState(), "idle"); assert.equal(c.pointerDown(P(10, 10)), false); c.pointerMove(P(20, 20)); c.pointerUp(P(20, 20));
  assert.equal(c.getState(), "idle"); assert.deepEqual(c.getLine(), []);
  c.arm(); assert.equal(c.getState(), "armed"); assert.deepEqual(states, ["armed"]); });

test("holding and moving draws a free line; releasing does NOT close it", () => {
  const { c, closed, states } = setup(); c.arm();
  strokeSquare(c, 1, [100, 100]);                                  // even releasing exactly on the start point
  assert.equal(c.getState(), "openLine"); assert.equal(closed.length, 0, "no automatic close on release");
  assert.ok(c.getLine().length > 20); assert.deepEqual(states, ["armed", "stroking", "openLine"]); });

test("points closer than minDistancePx are skipped", () => {
  const { c } = setup(); c.arm(); c.pointerDown(P(0, 0));
  for (let i = 1; i <= 30; i++) c.pointerMove(P(i, 0));             // 1 px steps, minDistance 4 px
  const n = c.getLine().length; assert.ok(n >= 7 && n <= 9, "about every 4th px: " + n); assert.equal(DRAW_DEFAULTS.minDistancePx, 4); });

test("a separate click near the start closes the area with a simplified ring", () => {
  const { c, closed, states } = setup(); c.arm(); strokeSquare(c);
  assert.equal(c.pointerDown(P(104, 103)), true); c.pointerUp(P(104, 103));
  assert.equal(c.getState(), "closed"); assert.equal(closed.length, 1);
  const ring = closed[0]; assert.ok(ring.length >= 4 && ring.length <= DRAW_DEFAULTS.maxVertices, "corners only: " + ring.length);
  assert.notDeepEqual(ring[0], ring[ring.length - 1], "open ring: the host closes it");
  for (const corner of [[0.1, 0.1], [0.3, 0.1], [0.3, 0.3], [0.1, 0.3]]) assert.ok(ring.some((p) => Math.abs(p[0] - corner[0]) < 1e-9 && Math.abs(p[1] - corner[1]) < 1e-9), "corner kept " + corner);
  assert.equal(states.at(-1), "closed"); });

test("a click far from the start does not close; it adds one straight vertex", () => {
  const { c, closed } = setup(); c.arm(); strokeSquare(c);
  const n = c.getLine().length;
  c.pointerDown(P(150, 200)); c.pointerUp(P(150, 200));
  assert.equal(c.getState(), "openLine"); assert.equal(closed.length, 0); assert.equal(c.getLine().length, n + 1); assert.deepEqual(c.getLine().at(-1), [0.15, 0.2]);
  c.pointerDown(P(100 + DRAW_DEFAULTS.closeTolerancePx + 3, 100)); c.pointerUp(P(100 + DRAW_DEFAULTS.closeTolerancePx + 3, 100));
  assert.equal(closed.length, 0, "just outside the close tolerance"); });

test("press-and-drag in openLine continues the line instead of closing", () => {
  const { c, closed, states } = setup(); c.arm(); strokeSquare(c);
  const n = c.getLine().length;
  c.pointerDown(P(102, 101)); c.pointerMove(P(110, 101)); c.pointerMove(P(120, 101)); c.pointerUp(P(130, 101));
  assert.equal(closed.length, 0); assert.equal(c.getState(), "openLine"); assert.ok(c.getLine().length > n);
  assert.deepEqual(states.slice(-2), ["stroking", "openLine"]); });

test("a short line cannot be closed (too few points after simplification)", () => {
  const { c, closed, rejected } = setup(); c.arm();
  c.pointerDown(P(100, 100)); for (let x = 100; x <= 200; x += 5) c.pointerMove(P(x, 100)); c.pointerUp(P(200, 100));   // a straight stroke
  c.pointerDown(P(101, 101)); c.pointerUp(P(101, 101));
  assert.equal(closed.length, 0); assert.deepEqual(rejected, ["too_few_points"]); assert.equal(c.getState(), "openLine"); });

test("the host can reject the close (validation failed) and drawing continues", () => {
  let calls = 0; const { c } = setup({ onClose: () => { calls++; return false; } }); c.arm(); strokeSquare(c);
  c.pointerDown(P(100, 102)); c.pointerUp(P(100, 102));
  assert.equal(calls, 1); assert.equal(c.getState(), "openLine"); assert.ok(c.getLine().length > 3, "line kept"); });

test("maxVertices caps the closed ring for a long wavy stroke", () => {
  const { c, closed } = setup({ maxVertices: 20 }); c.arm();
  c.pointerDown(P(500, 300));
  for (let i = 1; i <= 720; i++) { const a = (i / 720) * 2 * Math.PI * 0.97, r = 200 + 15 * Math.sin(i / 6); c.pointerMove(P(300 + r * Math.cos(a) + 0, 300 + r * Math.sin(a))); }
  c.pointerUp(P(490, 260)); assert.ok(c.getLine().length > 100);
  c.pointerDown(P(501, 301)); c.pointerUp(P(501, 301));
  assert.equal(closed.length, 1); assert.ok(closed[0].length <= 20 && closed[0].length >= 3, "got " + closed[0].length); });

test("the sliver at the end of the stroke (last point next to the start) is dropped", () => {
  const { c, closed } = setup(); c.arm(); strokeSquare(c, 1, [100, 106]);
  c.pointerDown(P(100, 100)); c.pointerUp(P(100, 100));
  const ring = closed[0]; const a = project(...ring[0]), b = project(...ring[ring.length - 1]);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= DRAW_DEFAULTS.closeTolerancePx); });

test("preview: nearStart while hovering the start in openLine; cursor cleared on leave", () => {
  const { c, previews } = setup(); c.arm(); strokeSquare(c);
  c.pointerMove(P(200, 200)); assert.equal(previews.at(-1)!.nearStart, false); assert.deepEqual(previews.at(-1)!.cursor, [0.2, 0.2]);
  c.pointerMove(P(105, 104)); assert.equal(previews.at(-1)!.nearStart, true);
  c.pointerLeave(); assert.equal(previews.at(-1)!.cursor, null); assert.equal(previews.at(-1)!.nearStart, false); });

test("non-primary buttons, extra fingers and invalid numbers are ignored", () => {
  const { c } = setup(); c.arm();
  assert.equal(c.pointerDown(P(10, 10, 1, 2)), false, "right button"); assert.equal(c.getState(), "armed");
  assert.equal(c.pointerDown({ ...P(10, 10), lng: NaN }), false); assert.equal(c.getState(), "armed");
  c.pointerDown(P(100, 100, 1)); c.pointerMove(P(150, 100, 1));
  assert.equal(c.pointerDown(P(400, 400, 2)), true, "second finger swallowed"); c.pointerMove(P(450, 450, 2)); c.pointerUp(P(450, 450, 2));
  assert.equal(c.getState(), "stroking", "the second finger does not end the first stroke");
  assert.ok(c.getLine().every((p) => p[0] < 0.4), "and adds no points"); });

test("pointerCancel ends the stroke but keeps the line; a pending press is dropped", () => {
  const { c, closed } = setup(); c.arm(); c.pointerDown(P(0, 0, 7)); c.pointerMove(P(50, 0, 7));
  c.pointerCancel(7); assert.equal(c.getState(), "openLine"); assert.equal(c.getLine().length, 2);
  c.pointerDown(P(0, 0, 8)); c.pointerCancel(8); c.pointerUp(P(0, 0, 8)); assert.equal(closed.length, 0); });

test("cancel()/reset() return to idle from every state and discard the line", () => {
  for (const reach of ["armed", "stroking", "openLine", "closed"] as DrawState[]) for (const how of ["cancel", "reset"] as const) {
    const { c, previews } = setup(); c.arm();
    if (reach !== "armed") c.pointerDown(P(100, 100));
    if (reach === "openLine" || reach === "closed") strokeSquare(c);
    if (reach === "stroking") c.pointerMove(P(150, 100));
    if (reach === "closed") { c.pointerDown(P(100, 101)); c.pointerUp(P(100, 101)); }
    assert.equal(c.getState(), reach === "closed" ? "closed" : reach, `reached ${reach}`);
    c[how](); assert.equal(c.getState(), "idle"); assert.deepEqual(c.getLine(), []); assert.deepEqual(previews.at(-1)!.line, [], `${how} from ${reach}`);
    assert.equal(c.pointerDown(P(1, 1)), false);
  } });

test("arm() after closing starts over", () => {
  const { c } = setup(); c.arm(); strokeSquare(c); c.pointerDown(P(100, 101)); c.pointerUp(P(100, 101));
  assert.equal(c.getState(), "closed"); c.arm(); assert.equal(c.getState(), "armed"); assert.deepEqual(c.getLine(), []); });
