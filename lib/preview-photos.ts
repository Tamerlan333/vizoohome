/** Pure helpers for the listing-card photo preview (max 5 photos, never more). */
export const MAX_PREVIEW = 5;
export const SWIPE_MIN = 40; // px of horizontal finger travel that counts as a swipe
export interface PreviewPhoto { url: string; alt?: string | null }
export type RightMode = "next" | "more" | "details";
const okUrl = (u: unknown): u is string => typeof u === "string" && /^(https?:\/\/|\/)\S+$/.test(u.trim());
/** First MAX_PREVIEW photos that have a usable URL. Empty/invalid input -> []. The 6th and later photos are never returned. */
export function previewPhotos(photos: readonly { url?: unknown; alt?: string | null }[] | null | undefined): PreviewPhoto[] {
  const out: PreviewPhoto[] = [];
  if (!Array.isArray(photos)) return out;
  for (const p of photos) { if (out.length >= MAX_PREVIEW) break; if (p && okUrl(p.url)) out.push({ url: p.url.trim(), alt: p.alt ?? null }); }
  return out;
}
/** Arrows only make sense with at least two preview photos. */
export const hasControls = (n: number) => n >= 2;
export const showLeft = (idx: number) => idx > 0;
/** "next": show the next preview photo. On the last preview photo the right control becomes a link to the detail page:
 *  "more" when the listing has additional photos, "details" when it does not. */
export const rightMode = (idx: number, n: number, total: number): RightMode => (idx < n - 1 ? "next" : total > n ? "more" : "details");
/** Moves within the preview only; it can never go below 0 or past the last preview photo. */
export const move = (idx: number, n: number, dir: -1 | 1): number => Math.min(Math.max(idx + dir, 0), Math.max(n - 1, 0));
/** Keeps a stored index valid if the photo list ever shrinks. */
export const clampIndex = (idx: number, n: number): number => Math.min(Math.max(idx, 0), Math.max(n - 1, 0));
/** Photos worth loading now: the current one and the next one (never more than the preview). */
export const toMount = (idx: number, n: number): number[] => [idx, idx + 1].filter((i) => i >= 0 && i < n);
export const totalPhotos = (photoCount: unknown, listed: number): number => (typeof photoCount === "number" && photoCount > listed ? photoCount : listed);
/** Finger travel -> direction: 1 = next (swipe left), -1 = previous (swipe right), 0 = a tap, a scroll or too short. */
export function swipeDirection(dx: number, dy: number): -1 | 0 | 1 { return Math.abs(dx) >= SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.5 ? (dx < 0 ? 1 : -1) : 0; }
