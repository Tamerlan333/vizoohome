/**
 * Map configuration for the Studio pin-picker (and, later, the public map). Pure functions: no MapLibre, React or browser imports.
 *
 * Environment variables (both are public by nature, they end up in the browser, so RESTRICT the key by domain in MapTiler):
 *   NEXT_PUBLIC_MAPTILER_KEY   MapTiler API key. Use a DEV key (origin http://localhost:3000) locally and a separate PROD key online.
 *   NEXT_PUBLIC_MAP_STYLE      MapTiler map style id. Optional, default "streets-v2".
 * Attribution "(c) MapTiler (c) OpenStreetMap contributors" is part of the MapTiler style and MapLibre's attribution control
 * shows it. Never hide that control.
 */
import { isFiniteNumber } from "./geo.ts";

export const DEFAULT_STYLE = "streets-v2";
/** Zoom used when no pin exists yet (Baku overview) and when a pin exists (street level). */
export const DEFAULT_ZOOM = 11;
export const PIN_ZOOM = 15;
export const TILE_ATTRIBUTION = "© MapTiler © OpenStreetMap contributors";

const KEY_RE = /^[A-Za-z0-9_-]{8,128}$/;
const STYLE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export type MapConfig = { ok: true; style: string; styleUrl: string } | { ok: false; reason: "missing_key" | "invalid_key" };

/** Builds the MapTiler style URL. A bad style id silently falls back to the default; a missing or malformed key returns a reason code. */
export function getMapConfig(key?: string | null, style?: string | null): MapConfig {
  const k = (key ?? "").trim();
  if (k === "") return { ok: false, reason: "missing_key" };
  if (!KEY_RE.test(k)) return { ok: false, reason: "invalid_key" };
  const s = (style ?? "").trim();
  const id = s !== "" && STYLE_RE.test(s) ? s : DEFAULT_STYLE;
  return { ok: true, style: id, styleUrl: `https://api.maptiler.com/maps/${id}/style.json?key=${encodeURIComponent(k)}` };
}

/** A click on a wrapped world copy can report a longitude beyond +-180; bring it back into range. Values already in range are returned untouched. Returns null for non-numbers. */
export function normalizeLngLat(lng: unknown, lat: unknown): { lat: number; lng: number } | null {
  if (!isFiniteNumber(lng) || !isFiniteNumber(lat)) return null;
  const clampedLat = Math.min(90, Math.max(-90, lat));
  if (lng >= -180 && lng <= 180) return { lat: clampedLat, lng };
  const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180;
  return { lat: clampedLat, lng: wrapped === -180 && lng > 0 ? 180 : wrapped };
}

export const MAP_MESSAGES = {
  open: "Xəritədə seç",
  close: "Xəritəni bağla",
  loading: "Xəritə yüklənir…",
  hint: "Pin qoymaq üçün xəritədə klikləyin, dəqiqləşdirmək üçün pini sürükləyin.",
  hintReadOnly: "Bu sənəd yalnız oxumaq rejimindədir: pini dəyişmək olmur.",
  missing_key: "Xəritə üçün NEXT_PUBLIC_MAPTILER_KEY təyin olunmayıb (.env.local). Koordinatları yuxarıdakı xanalara yaza bilərsiniz.",
  invalid_key: "NEXT_PUBLIC_MAPTILER_KEY düzgün formatda deyil. .env.local faylını yoxlayın. Koordinatları yuxarıdakı xanalara yaza bilərsiniz.",
  failed: "Xəritə yüklənə bilmədi. MapTiler açarını (API key), onun icazə verilən ünvanlarını (localhost:3000) və internet bağlantısını yoxlayın. Koordinatları yuxarıdakı xanalara yaza bilərsiniz.",
  crashed: "Xəritə komponenti yüklənə bilmədi. Koordinat xanalarından istifadə edə bilərsiniz.",
} as const;
