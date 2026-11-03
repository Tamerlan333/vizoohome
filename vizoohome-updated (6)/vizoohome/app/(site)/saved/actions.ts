"use server";
import { getByIds } from "@/lib/properties";
import type { Property } from "@/lib/property-utils";
const ID = /^[A-Za-z0-9._-]{1,128}$/;
/** Public data only: the client uses the published perspective, so unpublished listings are never returned. */
export async function getSavedProperties(ids: string[]): Promise<Property[]> {
  if (!Array.isArray(ids)) return [];
  const clean = ids.filter((i) => typeof i === "string" && ID.test(i) && !i.startsWith("drafts.")).slice(0, 100);
  return clean.length ? getByIds(clean) : [];
}
