/**
 * Draw-to-search controller (Stage 2): a small state machine for the public map's "Ərazini seç" tool.
 * No React, DOM or MapLibre imports: the component feeds it normalized pointer data and renders what it reports.
 *
 * Flow
 *   idle --arm()--> armed --press--> stroking --release--> openLine --press+release near start--> closed
 *   - Holding the primary button and moving draws a free line. Releasing NEVER closes the area.
 *   - In openLine: a press-and-release (no drag) within closeTolerancePx of the first point closes the area;
 *     a press-and-drag elsewhere continues the line from its end; a plain click elsewhere adds one straight vertex.
 *   - cancel()/reset() return to idle from any state.
 * Closing simplifies the line in screen pixels (Douglas-Peucker, at most maxVertices points) and hands the open ring
 * to onClose. If onClose returns false (the host's validation failed) the controller stays in openLine.
 */
import { simplifyPathIndices, type LngLat } from "./geo.ts";

export type DrawState = "idle" | "armed" | "stroking" | "openLine" | "closed";

export interface DrawPointer {
  /** Position in container pixels. */
  x: number;
  y: number;
  lng: number;
  lat: number;
  pointerId: number;
  /** 0 = primary (left mouse, touch, pen). */
  button: number;
}

export interface DrawPreview {
  state: DrawState;
  /** The line drawn so far ([lng, lat]). */
  line: LngLat[];
  /** Hover position while the line is open (for the dashed "back to start" hint), else null. */
  cursor: LngLat | null;
  /** True when a release here would close the area. */
  nearStart: boolean;
}

export interface DrawControllerOptions {
  /** Converts [lng, lat] to container pixels at the CURRENT camera (the user may zoom while drawing). */
  project: (lng: number, lat: number) => { x: number; y: number };
  onPreview?: (preview: DrawPreview) => void;
  onStateChange?: (state: DrawState) => void;
  /** Receives the simplified OPEN ring (first point not repeated). Return false to reject and keep drawing. */
  onClose?: (ring: LngLat[]) => boolean | void;
  /** Called when the user tries to close a line that is still too short. */
  onCloseRejected?: (reason: "too_few_points") => void;
  minDistancePx?: number;
  closeTolerancePx?: number;
  clickTolerancePx?: number;
  simplifyTolerancePx?: number;
  maxVertices?: number;
}

export const DRAW_DEFAULTS = { minDistancePx: 4, closeTolerancePx: 14, clickTolerancePx: 5, simplifyTolerancePx: 2, maxVertices: 60 } as const;

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const validPointer = (p: DrawPointer) => finite(p.x) && finite(p.y) && finite(p.lng) && finite(p.lat);

export interface DrawController {
  getState(): DrawState;
  getLine(): LngLat[];
  /** Start a new area (discards any open line). */
  arm(): void;
  /** Returns true when the event was used by the drawing tool (the host should then capture the pointer). */
  pointerDown(p: DrawPointer): boolean;
  pointerMove(p: DrawPointer): void;
  pointerUp(p: DrawPointer): void;
  /** Pointer cancelled or capture lost: ends the stroke but keeps the line. */
  pointerCancel(pointerId: number): void;
  /** Leaves the cursor-hover state (pointer left the map). */
  pointerLeave(): void;
  /** Back to idle, line discarded. */
  cancel(): void;
  reset(): void;
}

export function createDrawController(options: DrawControllerOptions): DrawController {
  const o = { ...DRAW_DEFAULTS, ...options };
  let state: DrawState = "idle";
  let line: LngLat[] = [];
  let cursor: LngLat | null = null;
  let activePointer: number | null = null;
  /** Press in openLine that has not moved yet: may become a close click, a vertex click or a continued stroke. */
  let pending: { pointerId: number; x: number; y: number } | null = null;

  const px = (c: LngLat) => o.project(c[0], c[1]);
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  const isNearStart = (x: number, y: number) => line.length >= 3 && dist(px(line[0]), { x, y }) <= o.closeTolerancePx;

  function emit() {
    const c = state === "openLine" ? cursor : null;
    const near = c !== null && (() => { const p = px(c); return isNearStart(p.x, p.y); })();
    o.onPreview?.({ state, line: line.slice(), cursor: c, nearStart: near });
  }
  function setState(next: DrawState) {
    if (next === state) return;
    state = next;
    o.onStateChange?.(state);
  }
  function addPoint(p: DrawPointer, force = false) {
    const last = line[line.length - 1];
    if (!force && last && dist(px(last), p) < o.minDistancePx) return false;
    line.push([p.lng, p.lat]);
    return true;
  }
  function clearAll(next: DrawState) {
    line = []; cursor = null; activePointer = null; pending = null;
    setState(next);
    emit();
  }

  /** Simplified open ring in [lng, lat], or null when it would have fewer than 3 points. */
  function simplifiedRing(): LngLat[] | null {
    const pts = line.map((c) => { const p = px(c); return [p.x, p.y]; });
    const idx = simplifyPathIndices(pts, o.simplifyTolerancePx, o.maxVertices);
    let ring = idx.map((i) => line[i]);
    // The stroke often ends right next to the start: drop that last point so the closing edge is not a sliver.
    while (ring.length > 3) {
      const a = px(ring[0]), b = px(ring[ring.length - 1]);
      if (dist(a, b) >= o.closeTolerancePx) break;
      ring = ring.slice(0, -1);
    }
    if (ring.length < 3) return null;
    return ring;
  }
  function tryClose() {
    const ring = simplifiedRing();
    if (!ring) { o.onCloseRejected?.("too_few_points"); emit(); return; }
    const accepted = o.onClose ? o.onClose(ring.map((c) => [c[0], c[1]] as LngLat)) : true;
    if (accepted === false) { emit(); return; }
    line = ring; cursor = null; activePointer = null; pending = null;
    setState("closed");
    emit();
  }

  return {
    getState: () => state,
    getLine: () => line.slice(),
    arm() { clearAll("armed"); },
    pointerDown(p) {
      if (p.button !== 0 || !validPointer(p)) return false;
      if (activePointer !== null || pending !== null) return state === "stroking" || state === "openLine";   // extra fingers are ignored but still swallowed
      if (state === "armed") {
        line = []; addPoint(p, true); activePointer = p.pointerId; cursor = null;
        setState("stroking"); emit();
        return true;
      }
      if (state === "openLine") {
        pending = { pointerId: p.pointerId, x: p.x, y: p.y };
        return true;
      }
      return false;
    },
    pointerMove(p) {
      if (!validPointer(p)) return;
      if (state === "stroking" && p.pointerId === activePointer) {
        if (addPoint(p)) emit();
        return;
      }
      if (state === "openLine" && pending && p.pointerId === pending.pointerId) {
        if (dist(pending, p) > o.clickTolerancePx) {           // the press became a drag: continue the line from its end
          pending = null; activePointer = p.pointerId; cursor = null;
          setState("stroking"); addPoint(p, true); emit();
        }
        return;
      }
      if (state === "openLine" && !pending) {
        cursor = [p.lng, p.lat];
        emit();
      }
    },
    pointerUp(p) {
      if (state === "stroking" && p.pointerId === activePointer) {
        if (validPointer(p)) addPoint(p);
        activePointer = null;
        cursor = validPointer(p) ? [p.lng, p.lat] : null;
        setState("openLine");                                     // releasing never closes the area
        emit();
        return;
      }
      if (state === "openLine" && pending && p.pointerId === pending.pointerId) {
        pending = null;
        if (!validPointer(p)) return;
        if (line.length >= 1 && dist(px(line[0]), p) <= o.closeTolerancePx) { tryClose(); return; }
        if (addPoint(p)) { cursor = [p.lng, p.lat]; emit(); }  // a click elsewhere adds one straight vertex
      }
    },
    pointerCancel(pointerId) {
      if (state === "stroking" && pointerId === activePointer) { activePointer = null; setState("openLine"); emit(); return; }
      if (pending && pending.pointerId === pointerId) pending = null;
    },
    pointerLeave() {
      if (state === "openLine" && cursor) { cursor = null; emit(); }
    },
    cancel() { clearAll("idle"); },
    reset() { clearAll("idle"); },
  };
}
