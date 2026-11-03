// READ-ONLY audit: lists documents whose data will not behave as expected with the website filters. Changes nothing, needs no token for a public dataset.
// Usage: npm run audit:properties   (Node 22.6+)
import { createClient } from "@sanity/client";
import { PROPERTY_TYPES, LEGACY_PROPERTY_TYPES, MAX_ROOMS } from "../lib/property-fields.ts";
const client = createClient({ projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID, dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production", apiVersion: "2025-01-01", useCdn: false, token: process.env.SANITY_API_READ_TOKEN || undefined, perspective: "raw" });
const docs = await client.fetch(`*[_type=="property"]{_id,"slug":slug.current,"title":title.az,transaction,propertyType,buildingType,cityId,districtId,settlementId,areaId,price,currency,rooms,floor,totalFloors,"photos":count(photos)}`);
const known = PROPERTY_TYPES.map((o) => o.value); const issues = [];
for (const d of docs) {
  const w = (m) => issues.push(`${d._id} (${d.title || d.slug || "no title"}): ${m}`);
  if (!d.title) w("missing Azerbaijani title"); if (!d.slug) w("missing slug"); if (!d.cityId) w("missing cityId");
  if (!["sale", "rent"].includes(d.transaction)) w(`transaction is "${d.transaction}" (expected sale/rent)`);
  if (LEGACY_PROPERTY_TYPES.includes(d.propertyType)) w(`legacy propertyType "${d.propertyType}": re-select "Həyət / Bağ evi" (site already treats it correctly)`);
  else if (!known.includes(d.propertyType)) w(`unknown propertyType "${d.propertyType}"`);
  if (!(d.price > 0)) w("price missing or not positive");
  if (d.rooms > MAX_ROOMS) w(`rooms ${d.rooms} above ${MAX_ROOMS}`); if (d.rooms > 5) w(`rooms ${d.rooms}: shows no selected option in Studio but matches the 5+ filter (fine)`);
  if (d.floor !== undefined && d.floor !== null && d.floor < 1) w(`floor ${d.floor} (Studio now requires 1 or more)`);
  if (d.floor > d.totalFloors) w(`floor ${d.floor} is higher than totalFloors ${d.totalFloors}`);
  if (d.propertyType === "apartment" && (d.floor == null || d.totalFloors == null)) w("apartment without floor/totalFloors: excluded from top-floor and floor-range filters");
  if (d.areaId && !d.settlementId) w(`old areaId "${d.areaId}" without settlementId: run npm run migrate:locations or re-select the place`);
  if (d.currency && d.currency !== "AZN") w(`currency ${d.currency}: not matched by AZN price filters`);
}
console.log(issues.length ? issues.join("\n") : "No issues found."); console.log(`\n${docs.length} documents checked, ${issues.length} notes. Nothing was changed.`);
