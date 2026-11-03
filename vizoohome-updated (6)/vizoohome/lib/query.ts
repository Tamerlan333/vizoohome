import { expandType } from "./property-utils.ts";
import type { SearchParams } from "./search.ts";
/** GROQ filter. Price limits are in AZN, so they only match AZN listings (no silent currency conversion).  OR inside the geography group (districts/settlements), OR inside metro, AND between all categories. */
export const FILTER = `_type=="property" && defined(slug.current) && ($tx==null||transaction==$tx) && ($city==null||cityId==$city)
 && ((count($districts)==0 && count($settlements)==0) || districtId in $districts || cityId in $districts || settlementId in $settlements)
 && (count($metro)==0 || count(metroIds[@ in $metro])>0)
 && ($types==null||propertyType in $types) && ($building==null||buildingType==$building)
 && ($repair==null||repairStatus==$repair)
 && ($minArea==null||areaM2>=$minArea) && ($maxArea==null||areaM2<=$maxArea)
 && ($minFloor==null||floor>=$minFloor) && ($maxFloor==null||floor<=$maxFloor)
 && ($exFirst==null||floor!=1)
 && ($exTop==null||!(defined(floor)&&defined(totalFloors)&&floor==totalFloors))
 && ($topOnly==null||(defined(floor)&&defined(totalFloors)&&floor==totalFloors))
 && ($rooms==null||($rooms>=5&&rooms>=5)||($rooms<5&&rooms==$rooms)) && ($min==null||(coalesce(currency,"AZN")=="AZN"&&price>=$min)) && ($max==null||(coalesce(currency,"AZN")=="AZN"&&price<=$max))`;
export const PAGE_SIZE = 12;
export function buildParams(f: Partial<SearchParams>) {
  const from = ((f.page ?? 1) - 1) * PAGE_SIZE;
  return { tx: f.transaction ?? null, city: f.city ?? null, districts: f.districts ?? [], settlements: f.settlements ?? [], metro: f.metro ?? [],
    types: f.type ? expandType(f.type) : null, building: f.building ?? null, rooms: f.rooms ?? null, repair: f.repair ?? null, minArea: f.minArea ?? null, maxArea: f.maxArea ?? null, minFloor: f.minFloor ?? null, maxFloor: f.maxFloor ?? null,
    exFirst: f.excludeFirstFloor ? true : null, exTop: f.excludeTopFloor && !f.topFloorOnly ? true : null, topOnly: f.topFloorOnly ? true : null, min: f.minPrice ?? null, max: f.maxPrice ?? null, from, to: from + PAGE_SIZE };
}
