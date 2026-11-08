/**
 * Validation and parsing helpers for the property "location" (geopoint) field. Pure functions: no Sanity, React or browser imports,
 * so they run in unit tests. Studio texts are Azerbaijani, like every other Studio label.
 *
 * Stored value: { _type: "geopoint", lat, lng } with 6 decimals (about 10 cm) and no altitude.
 */
import { isFiniteNumber, isValidCoordinate, isWithinAzerbaijan } from "./geo.ts";

export const COORD_DECIMALS = 6;
/** Rounds to 6 decimals; never returns -0. */
export const roundCoord = (n: number): number => Number(n.toFixed(COORD_DECIMALS)) + 0;
export const formatCoord = (n: number): string => n.toFixed(COORD_DECIMALS);
export const toGeopoint = (lat: number, lng: number) => ({ _type: "geopoint" as const, lat: roundCoord(lat), lng: roundCoord(lng) });

export const MESSAGES = {
  incomplete: "Enlik və uzunluq birlikdə doldurulmalıdır.",
  notNumber: "Enlik və uzunluq rəqəm olmalıdır.",
  range: "Enlik -90 ilə 90, uzunluq -180 ilə 180 arasında olmalıdır.",
  outside: "Bu nöqtə Azərbaycan sərhədlərindən kənardadır. Enlik və uzunluğu düzgün yazdığınızı yoxlayın (Bakı: 40.4093, 49.8671).",
  fieldFormat: "Rəqəmi nöqtə ilə yazın, məsələn: 40.4093",
  pasteEmpty: "Koordinatları yazın, məsələn: 40.4093, 49.8671",
  pasteFormat: "Format düzgün deyil. Nöqtə ilə yazın: enlik, uzunluq (məsələn: 40.4093, 49.8671).",
} as const;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const missing = (v: unknown) => v === undefined || v === null;

/** Sanity validation (ERROR level). An empty field is fine: the pin is optional. */
export function checkRange(value: unknown): true | string {
  if (missing(value)) return true;
  if (!isObj(value)) return MESSAGES.notNumber;
  const { lat, lng } = value;
  if (missing(lat) && missing(lng)) return true;
  if (missing(lat) || missing(lng)) return MESSAGES.incomplete;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) return MESSAGES.notNumber;
  return isValidCoordinate(lat, lng) ? true : MESSAGES.range;
}

/** Sanity validation (WARNING level): a valid point that is far outside Azerbaijan (swapped numbers, wrong click, wrong country). */
export function checkInsideAzerbaijan(value: unknown): true | string {
  if (checkRange(value) !== true || !isObj(value) || missing(value.lat) || missing(value.lng)) return true;
  return isWithinAzerbaijan(value.lat, value.lng) ? true : MESSAGES.outside;
}

/** The saved point if the stored value is a usable one, otherwise null. */
export function readPoint(value: unknown): { lat: number; lng: number } | null {
  if (!isObj(value) || !isFiniteNumber(value.lat) || !isFiniteNumber(value.lng) || !isValidCoordinate(value.lat, value.lng)) return null;
  return { lat: value.lat, lng: value.lng };
}

const NUM = /^[+-]?\d{1,3}(\.\d{1,12})?$/;
/** One typed number ("40.4093"). Dot decimals only. Returns null when it is not a plain number. Range is NOT checked here. */
export function parseCoordinate(text: string): number | null {
  const t = text.trim();
  return NUM.test(t) ? Number(t) : null;
}

export type PairResult = { ok: true; lat: number; lng: number } | { ok: false; reason: "empty" | "format" | "range" };
/** "40.4093, 49.8671" (latitude first). Accepts comma, semicolon or spaces and optional brackets. Decimal commas are rejected. */
export function parseCoordinatePair(text: string): PairResult {
  const t = text.trim();
  if (t === "") return { ok: false, reason: "empty" };
  const parts = t.replace(/[()[\]]/g, " ").split(/[\s,;]+/).filter(Boolean);
  if (parts.length !== 2 || !parts.every((p) => NUM.test(p))) return { ok: false, reason: "format" };
  const lat = Number(parts[0]), lng = Number(parts[1]);
  if (!isValidCoordinate(lat, lng)) return { ok: false, reason: "range" };
  return { ok: true, lat: roundCoord(lat), lng: roundCoord(lng) };
}
