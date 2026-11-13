
import { sanityFetch } from "@/lib/sanity/client";
import {
  MAP_QUERY,
  buildMapParams,
  resolveMapResults,
  type MapRaw,
  type MapResult,
} from "@/lib/map-query";
import type { SearchParams } from "@/lib/search";
import type { GeoPolygon } from "@/lib/geo";

/**
 * Fetches published property listings for the public map.
 * Uses the same filters as the existing property search.
 * Listings without valid coordinates are counted, not displayed.
 */
export async function listMapProperties(
  filters: Partial<SearchParams>,
  polygon?: GeoPolygon | null
): Promise<MapResult> {
  if (filters.badLocation) {
    return {
      items: [],
      total: 0,
      inBox: 0,
      missingCoords: 0,
      truncated: false,
    };
  }

  const raw = await sanityFetch<MapRaw>(
    MAP_QUERY,
    buildMapParams(filters, polygon)
  );

  return resolveMapResults(raw, polygon);
}
