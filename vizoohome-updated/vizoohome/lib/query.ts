import { expandType } from "./property-utils.ts";
import type { SearchParams } from "./search.ts";
/** GROQ filter. OR inside the geography group (districts/settlements), OR inside metro, AND between all categories. */
export const FILTER = `_type=="property" && defined(slug.current) && ($tx==null||transaction==$tx) && ($city==null||cityId==$city)
 && ((count($districts)==0 && count($settlements)==0) || districtId in $districts || cityId in $districts || settlementId in $settlements)
 && (count($metro)==0 || count(metroIds[@ in $metro])>0)
 && ($types==null||propertyType in $types) && ($building==null||buildingType==$building)
 && ($rooms==null||($rooms>=5&&rooms>=5)||($rooms<5&&rooms==$rooms)) && ($min==null||price>=$min) && ($max==null||price<=$max)`;
export const PAGE_SIZE = 12;
export function buildParams(f: Partial<SearchParams>) {
  const from = ((f.page ?? 1) - 1) * PAGE_SIZE;
  return { tx: f.transaction ?? null, city: f.city ?? null, districts: f.districts ?? [], settlements: f.settlements ?? [], metro: f.metro ?? [],
    types: f.type ? expandType(f.type) : null, building: f.building ?? null, rooms: f.rooms ?? null, min: f.minPrice ?? null, max: f.maxPrice ?? null, from, to: from + PAGE_SIZE };
}
