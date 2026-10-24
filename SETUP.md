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
