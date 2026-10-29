# VizooHome: setup for beginners (Windows)

## One-time setup
1. Install Node.js LTS from https://nodejs.org (accept the defaults), then restart your computer.
2. Unzip the project. In the project folder, click the address bar, type `cmd`, press Enter.
3. Run: `copy .env.example .env.local`   (it already contains your public Sanity project ID and dataset)
4. Run: `npm install`   (takes a few minutes)
5. At sanity.io/manage > your project > API > CORS origins: add `http://localhost:3000` (tick "Allow credentials"), and later your real website address.
6. Revoke the API token you pasted in chat (API > Tokens). The site does not need it.

## Every time
- Run: `npm run dev`, then open http://localhost:3000 (site) and http://localhost:3000/studio (editor; log in with your Sanity account).

## Checks
- `npm test` (logic tests), `npm run build` (full build; fix anything it reports before deploying).

## Existing listings
Old listings with type "Ev" or "Villa" still show up under Həyət/Bağ evi. Open them in /studio and re-select "Həyət/Bağ evi" when convenient.

## Location filter (districts, settlements, metro)
- URL parameters: `city` (single region), `district` (comma list), `area` (comma list of settlement ids), `metro` (comma list). Ids are stable slugs, never translated labels.
- Filtering: OR inside the geography group (districts + settlements), OR inside metro, AND between geography, metro and every other filter. A selected district includes all its settlements automatically. Abşeron rayonu is matched by `cityId`, so it never mixes with Bakı city.
- Old listings: they keep working (district still matches). Their old single `areaId` is not searched anymore. To carry it over safely:
  1. `npm run migrate:locations`  (dry run, prints what would change)
  2. In your terminal: `set SANITY_WRITE_TOKEN=<a token with Editor rights>`  then `npm run migrate:locations -- --apply`  (needs Node 22.6+)
  3. Entries marked MANUAL ("28 May", "Sahil", "Montin") must be re-selected in /studio.
  4. Undo: `npm run migrate:locations -- --revert --apply`. The script only adds `settlementId` / `metroIds`; it never edits or deletes old fields. Delete the token afterwards.
- Browser tests (not run yet): `npx playwright install chromium` then `npm run test:e2e`.

## Advanced search filters (Ətraflı Axtarış)
- No Sanity schema change and no migration: it uses the fields that already exist: `repairStatus`, `areaM2`, `floor`, `totalFloors`. Listings missing a field are never counted as matching that filter.
- URL parameters (only active ones appear): `repair=repaired|unrepaired`, `minArea`, `maxArea`, `minFloor`, `maxFloor`, `excludeFirstFloor=true`, `excludeTopFloor=true`, `topFloorOnly=true`. They sit next to the existing location, `type`, `building`, `rooms`, `minPrice`, `maxPrice` parameters, and a new search always starts at page 1.
- Rules: a repair pill that is already active goes back to "Fərqi yoxdur" when clicked; "Ən üst olmasın" and "Yalnız ən üst" switch each other off; "1-ci olmasın" combines with either. If a link has both top options, "Yalnız ən üst" wins. Invalid numbers and a minimum above the maximum are dropped from the URL; the form shows an inline message and does not search.
- Top floor = `floor == totalFloors` on the same listing. "Yalnız ən üst" needs both fields filled in /studio. "1-ci olmasın" and "Ən üst olmasın" only remove listings known to match, so a listing with no floor data still appears there.
- Land listings ignore the repair and floor filters (those groups are hidden); the area filter still applies.

## Studio <-> website field mapping (single source: lib/property-fields.ts + lib/locations.ts)
| Studio section / field (name) | Saved values | Website filter / display |
|---|---|---|
| 1 Elanın növü (`transaction`) | `sale`, `rent` | Satış / Kirayə tabs |
| 1 Əmlakın tipi (`propertyType`) | `apartment`, `yard-house`, `land`, `commercial`, `other` (old `house`/`villa` still work) | `type=` |
| 2 Tikilinin növü (`buildingType`) | `new`, `old`, `not_applicable` (empty = unknown) | `building=new|old`; the other values never match |
| 2 Sahə (`areaM2`) | number | `minArea`, `maxArea` |
| 2 Çıxarış (`hasTitleDeed`) | `yes`, `no` | badge on the listing page |
| 3 Qiymət / Valyuta (`price`, `currency`) | positive number, AZN/USD/EUR | `minPrice`, `maxPrice` (AZN listings only, no conversion) |
| 3 Otaq sayı (`rooms`) | integer; "5+" is saved as 5 | `rooms=1..5`; 5 means 5 or more |
| 4 Şəhər / rayon / qəsəbə / metro (`cityId`, `districtId`, `settlementId`, `metroIds`) | ids from lib/locations.ts | `city`, `district`, `area`, `metro` |
| 5 Təmir (`repairStatus`) | `repaired`, `unrepaired` (empty = unknown) | `repair=` |
| 5 Mərtəbə / bina mərtəbəsi (`floor`, `totalFloors`) | integers 1-100 | `minFloor`, `maxFloor`, `excludeFirstFloor`, `excludeTopFloor`, `topFloorOnly` (top = floor equals totalFloors) |
| 6 Şəkillər / video (`photos`, `video`) | image array (drag to reorder, first = cover), one file | cards and gallery |
| 7 Başlıq / təsvir (`title`, `description`, each az/ru/en) | text | shown in the chosen language, falls back to AZ |
| 8 Seçilmiş (`featured`) | true/false | listed first |

No migration is required: field names did not change. To see what needs attention in your data, run the read-only check: `npm run audit:properties` (it changes nothing). Typical findings: old `house`/`villa` types (re-select "Həyət / Bağ evi"), apartments without floor / total floors, floor 0, old `areaId` (see the location migration above).
Open the editor at http://localhost:3000/studio, create an apartment, and check that the eight sections appear in that order, that "Torpaq" hides rooms, floors, repair and building type, and that choosing a Bakı district limits the settlement/metro lists logically (a mismatched settlement shows a red error and cannot be published).

## Contact phone per listing (Əlaqə nömrəsi)
- Studio: section "8. Əlaqə və digər məlumatlar" -> field `contactPhone` (placeholder `+994 XX XXX XX XX`). Accepted: `+994 50 123 45 67`, `050 123 45 67`, `(012) 123-45-67`, `50 123 45 67`, or an international number starting with `+`. Anything else shows a red message and cannot be published. The text you type is saved as typed; the website normalizes it for display and links.
- Website: only the listing's detail page shows it, in a "Ev sahibi ilə əlaqə" card with a `tel:` link, a "Zəng et" button and a "WhatsApp ilə yaz" button (same number, opens `wa.me/<number>` with a message naming the listing). No number or an invalid number: the card is hidden, nothing else changes. The description is never touched.
- Privacy: the phone is requested only by the detail page query. Listing cards, search results, the saved page, related listings, the sitemap and page metadata never request it. Note that your Sanity dataset is public-read, so anyone who knows the project id can still query published documents directly, including this field. That is the same exposure as the number being visible on the page; do not enter numbers you do not want public.
- Existing listings have no phone and keep working. Fill the field in /studio per listing. No migration, no default number.
