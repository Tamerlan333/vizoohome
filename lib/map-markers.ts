/**
 * Property markers for the public maps (search results map and the property detail map). Pure functions: no React,
 * DOM or MapLibre imports, so the marker rules are unit-tested (lib/map-markers.test.ts).
 *
 * A listing gets a marker only from its own stored Sanity "location" geopoint (projected as lat/lng): nothing is
 * guessed or approximated. Listings without valid coordinates simply get no marker.
 */
import { hasCoordinates, type MaybeLocated } from "./geo.ts";

type Loc = { az?: string; ru?: string; en?: string };

export interface MarkerSource extends MaybeLocated {
  _id: string;
  slug?: string | null;
  title?: Loc;
  price?: number;
  currency?: string;
}

export interface PropertyMarker {
  /** The listing's Sanity _id: one marker per listing. */
  id: string;
  lng: number;
  lat: number;
  /** Detail page of THIS listing, or null when it has no slug (then the marker shows no link). */
  href: string | null;
  title: Loc | undefined;
  price?: number;
  currency?: string;
}

/** Detail page URL of a listing (same path as the listing cards). */
export function propertyHref(slug: string | null | undefined): string | null {
  const s = typeof slug === "string" ? slug.trim() : "";
  return s ? `/properties/${encodeURIComponent(s)}` : null;
}

function toMarker(p: MarkerSource & { lat: number; lng: number }): PropertyMarker {
  return { id: p._id, lng: p.lng, lat: p.lat, href: propertyHref(p.slug), title: p.title, price: p.price, currency: p.currency };
}

/** One marker per listing with valid coordinates, in the given order; listings without coordinates (or repeated ids) are skipped. */
export function toMapMarkers(items: readonly MarkerSource[]): PropertyMarker[] {
  const seen = new Set<string>();
  const out: PropertyMarker[] = [];
  for (const item of items) {
    if (!item || typeof item._id !== "string" || seen.has(item._id) || !hasCoordinates(item)) continue;
    seen.add(item._id);
    out.push(toMarker(item));
  }
  return out;
}

/** The detail map's only marker: the listing itself, or null when it has no valid coordinates (the map is then hidden). */
export function detailMarker(p: MarkerSource | null | undefined): PropertyMarker | null {
  return p && typeof p._id === "string" && hasCoordinates(p) ? toMarker(p) : null;
}

/** Shared marker look (VizooHome orange dot, white ring), so both maps match. */
export function markerStyle(size = 18): Record<string, string> {
  return {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "50%",
    background: "#FF9D23",
    border: "3px solid #FFFFFF",
    boxShadow: "0 2px 8px rgba(11,25,44,0.35)",
    cursor: "pointer",
    padding: "0",
  };
}
