/**
 * Draw-to-search map query (Stage A: pure; nothing here talks to the network).
 *
 * How it works
 * 1. GROQ keeps listings that match ALL existing filters (the exported FILTER), have coordinates and lie in the polygon's
 *    bounding box. Only $parameters are used, never string-concatenated user input.
 * 2. The exact polygon test is then done in code (lib/geo.ts), so the final result satisfies BOTH the polygon and every filter.
 * 3. Listings without coordinates are never returned as map results; they are only COUNTED (missingCoords).
 * The query never selects contactPhone.
 */
import { FILTER, buildParams } from "./query.ts";
import type { SearchParams } from "./search.ts";
import type { Property } from "./property-utils.ts";
import { AZ_BOUNDS, filterInPolygon, isValidBBox, polygonBBox, type BBox, type GeoPolygon } from "./geo.ts";

export const MAP_LIMIT = 1000;

/** Same listing fields as the listing pages (lib/properties.ts FIELDS, without photos). A unit test fails if the two ever drift apart. */
export const MAP_FIELDS = `_id,"slug":slug.current,title,description,transaction,propertyType,cityId,districtId,settlementId,metroIds,areaId,address,price,currency,rooms,areaM2,floor,totalFloors,buildingType,repairStatus,hasTitleDeed,featured,"videoUrl":video.asset->url`;
export const MAP_PROJECTION = `{${MAP_FIELDS},"lat":location.lat,"lng":location.lng,"photoCount":count(coalesce(photos,[])[defined(asset->url)]),"photos":photos[defined(asset->url)][0...5]{"url":asset->url,alt}}`;

const HAS_POINT = `defined(location.lat) && defined(location.lng)`;
const IN_BOX = `location.lat>=$minLat && location.lat<=$maxLat && location.lng>=$minLng && location.lng<=$maxLng`;
export const MAP_QUERY = `{"items":*[${FILTER} && ${HAS_POINT} && ${IN_BOX}]|order(featured desc,_createdAt desc)[0...$limit]${MAP_PROJECTION},"inBox":count(*[${FILTER} && ${HAS_POINT} && ${IN_BOX}]),"missingCoords":count(*[${FILTER} && !(${HAS_POINT})])}`;

export type MapProperty = Property & { lat: number; lng: number };
export interface MapRaw { items: MapProperty[]; inBox: number; missingCoords: number }
export interface MapResult {
  /** Listings that match the filters, have coordinates and are inside the polygon (all geocoded matches when there is no polygon). */
  items: MapProperty[];
  total: number;
  /** Geocoded listings found in the polygon's bounding box before the exact polygon test. */
  inBox: number;
  /** Listings matching the current filters that have no coordinates (shown as a count; never on the map). */
  missingCoords: number;
  /** True when more geocoded listings exist in the box than were fetched (MAP_LIMIT). */
  truncated: boolean;
}

/** GROQ parameters: every existing filter (via buildParams) + the bounding box + the fetch limit. Without a polygon the box is all of Azerbaijan. */
export function buildMapParams(filters: Partial<SearchParams>, polygon?: GeoPolygon | null, limit: number = MAP_LIMIT) {
  const { from: _from, to: _to, ...rest } = buildParams(filters);
  const box: BBox = polygon ? polygonBBox(polygon) : AZ_BOUNDS;
  const [minLng, minLat, maxLng, maxLat] = isValidBBox(box) ? box : AZ_BOUNDS;
  const safe = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), MAP_LIMIT) : MAP_LIMIT;
  return { ...rest, minLng, minLat, maxLng, maxLat, limit: safe };
}

/** Applies the exact polygon test to the GROQ result. Defensive: rows with unusable coordinates are dropped. */
export function resolveMapResults(raw: MapRaw, polygon?: GeoPolygon | null): MapResult {
  const rows = Array.isArray(raw.items) ? raw.items : [];
  const items = (polygon ? filterInPolygon(rows, polygon) : rows.filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))) as MapProperty[];
  const inBox = Number.isFinite(raw.inBox) ? raw.inBox : rows.length;
  return { items, total: items.length, inBox, missingCoords: Number.isFinite(raw.missingCoords) ? raw.missingCoords : 0, truncated: inBox > rows.length };
}
