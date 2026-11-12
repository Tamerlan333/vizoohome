/**
 * Draw-to-search results gate (pure; no React, no network).
 *
 * The /properties page shows listings ONLY for a selected area. Two values decide what is shown:
 *   clientParam  "poly" value of the area the map currently holds ("" = none). Updated instantly on draw / edit / clear.
 *   serverParam  "poly" value the server rendered the current results for ("" = no area, nothing was fetched).
 * Both are produced by polygonToParam (5 decimals), which round-trips exactly through polygonFromParam.
 */
import { polygonToParam, type GeoPolygon } from "./geo.ts";

export type AreaResultsState = "empty" | "pending" | "ready";

/** "poly" form of an optional polygon ("" = no area). */
export const areaParamOf = (polygon: GeoPolygon | null | undefined): string => (polygon ? polygonToParam(polygon) : "");

/**
 * empty   no area selected: show the "select an area" message, no cards, no count, no markers.
 * pending an area is selected but the server has not rendered results for it yet: never show the previous (stale) results.
 * ready   the server results belong to the selected area: show them.
 */
export function areaResultsState(clientParam: string, serverParam: string): AreaResultsState {
  if (!clientParam) return "empty";
  return clientParam === serverParam ? "ready" : "pending";
}

/** What PropertyMap reads from a click to decide whether it starts a same-site page navigation. */
export interface LinkClick {
  button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean;
  /** href of the clicked <a> (null: not on a link). */
  href: string | null;
  target: string;
  download: boolean;
  /** Current page URL (window.location.href). */
  currentHref: string;
}

/**
 * True when a click on a link will navigate this tab to another page of this site. The map's pending (debounced) URL
 * write must then be dropped, or it fires after the link's navigation started and overrides it ("latest navigation
 * wins"). Ignored: modified / non-left clicks, already prevented clicks, new-tab targets, downloads, other origins or
 * protocols, and links to the same path+query (only the #hash changes: no page navigation).
 */
export function cancelsAreaWrite(c: LinkClick): boolean {
  if (c.defaultPrevented || c.button !== 0 || c.metaKey || c.ctrlKey || c.shiftKey || c.altKey) return false;
  if (!c.href || c.download || (c.target !== "" && c.target !== "_self")) return false;
  let dest: URL, here: URL;
  try { here = new URL(c.currentHref); dest = new URL(c.href, here); } catch { return false; }
  if (dest.protocol !== "http:" && dest.protocol !== "https:") return false;
  if (dest.origin !== here.origin) return false;
  return dest.pathname !== here.pathname || dest.search !== here.search;
}

export type UrlSyncAction = "in-sync" | "ignore-echo" | "apply";

/**
 * URL -> map decision when the server renders an area ("poly") that may differ from the one on the map.
 *   in-sync      the server rendered the map's area.
 *   ignore-echo  a late response for an area the map wrote earlier, while the map's NEWER write is still waiting
 *                (debounce) or navigating: keep the map's area; the newer response is on its way.
 *   apply        anything else: a real URL change (Reset, filter submit, Back/Forward, edited link), or an old echo
 *                with no newer write outstanding (that write was superseded and will never arrive). The map takes the
 *                server's area, so map and results agree again; without this, results would wait forever ("Updating…").
 */
export function urlSyncAction(serverParam: string, mapParam: string, written: ReadonlySet<string>, writeOutstanding: boolean): UrlSyncAction {
  if (serverParam === mapParam) return "in-sync";
  if (written.has(serverParam) && writeOutstanding) return "ignore-echo";
  return "apply";
}
