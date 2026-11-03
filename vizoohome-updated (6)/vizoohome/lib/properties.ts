import { sanityFetch } from "@/lib/sanity/client";
import { expandType, type Property } from "@/lib/property-utils";
import { FILTER, PAGE_SIZE, buildParams } from "@/lib/query";
import type { SearchParams } from "@/lib/search";
export { PAGE_SIZE };
const BASE = `_id,"slug":slug.current,title,description,transaction,propertyType,cityId,districtId,settlementId,metroIds,areaId,address,price,currency,rooms,areaM2,floor,totalFloors,buildingType,repairStatus,hasTitleDeed,featured,"videoUrl":video.asset->url,"photos":photos[defined(asset)]{"url":asset->url,alt}`;
/** List/related/saved results never include contactPhone. */
export const PROJ = `{${BASE}}`;
/** Detail page only: the owner's phone is fetched here and nowhere else. */
export const PROJ_DETAIL = `{${BASE},contactPhone}`;
export async function listPublished(f: Partial<SearchParams>) {
  if (f.badLocation) return { rows: [] as Property[], total: 0 }; // malformed location filter: show nothing, never everything
  const r = await sanityFetch<{ items: Property[]; total: number }>(`{"items":*[${FILTER}]|order(featured desc,_createdAt desc)[$from...$to]${PROJ},"total":count(*[${FILTER}])}`, buildParams(f));
  return { rows: r.items, total: r.total };
}
export const getBySlug = (slug: string) => sanityFetch<Property | null>(`*[_type=="property" && slug.current==$slug][0]${PROJ_DETAIL}`, { slug });
export const getRelated = (p: Property) => sanityFetch<Property[]>(`*[_type=="property" && defined(slug.current) && _id!=$id && transaction==$tx && propertyType in $types][0...3]${PROJ}`, { id: p._id, tx: p.transaction, types: expandType(p.propertyType === "house" || p.propertyType === "villa" ? "yard-house" : p.propertyType) });
export const getByIds = (ids: string[]) => sanityFetch<Property[]>(`*[_type=="property" && defined(slug.current) && _id in $ids]${PROJ}`, { ids });
export const allSlugs = () => sanityFetch<{ slug: string; _updatedAt: string }[]>(`*[_type=="property" && defined(slug.current)]{"slug":slug.current,_updatedAt}`);
