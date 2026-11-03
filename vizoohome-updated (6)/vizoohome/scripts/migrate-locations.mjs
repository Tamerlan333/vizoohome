// Additive location migration. Reads old `areaId`, writes NEW fields only (settlementId / metroIds). Never edits or deletes old fields.
// Usage (Node 22.6+):  npm run migrate:locations            -> dry run, prints a report
//                      npm run migrate:locations -- --apply  -> writes (needs SANITY_WRITE_TOKEN in your terminal environment)
//                      npm run migrate:locations -- --revert -> removes settlementId/metroIds from documents that still have an old areaId
import { createClient } from "@sanity/client";
import { LEGACY_TO_NEW } from "../lib/legacy-map.ts";
const apply = process.argv.includes("--apply"), revert = process.argv.includes("--revert");
const client = createClient({ projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID, dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production", apiVersion: "2025-01-01", useCdn: false, token: process.env.SANITY_WRITE_TOKEN });
if ((apply || revert) && !process.env.SANITY_WRITE_TOKEN) { console.error("Set SANITY_WRITE_TOKEN first (never commit it)."); process.exit(1); }
const docs = await client.fetch(`*[_type=="property" && defined(areaId)]{_id,areaId,districtId,settlementId,metroIds}`);
let todo = 0, manual = 0;
for (const d of docs) {
  if (revert) { console.log(`${apply ? "" : "[dry] "}revert ${d._id}`); if (process.argv.includes("--apply")) await client.patch(d._id).unset(["settlementId", "metroIds"]).commit(); continue; }
  if (d.settlementId || d.metroIds?.length) { console.log(`skip   ${d._id} (already has new location fields)`); continue; }
  const t = LEGACY_TO_NEW[d.areaId];
  if (!t || t.manual) { manual++; console.log(`MANUAL ${d._id} ${d.areaId}: ${t?.manual ?? "unknown area id"}`); continue; }
  if (t.settlement && d.districtId && t.district && d.districtId !== t.district) { manual++; console.log(`MANUAL ${d._id} ${d.areaId}: district ${d.districtId} differs from ${t.district}`); continue; }
  const set = t.settlement ? { settlementId: t.settlement, ...(d.districtId ? {} : { districtId: t.district }) } : { metroIds: [t.metro] };
  todo++; console.log(`${apply ? "write " : "[dry] "} ${d._id} ${d.areaId} -> ${JSON.stringify(set)}`);
  if (apply) await client.patch(d._id).set(set).commit();
}
console.log(`\n${docs.length} documents with an old areaId; ${todo} ${apply ? "migrated" : "would be migrated"}; ${manual} need manual review (re-select the location in /studio).`);
