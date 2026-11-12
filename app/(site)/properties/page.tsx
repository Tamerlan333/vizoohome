
import Link from "next/link";
import PropertySearch from "@/components/PropertySearch";
import PropertyCard from "@/components/PropertyCard";
import PropertyMap from "@/components/PropertyMap";
import { AreaGate, AreaProvider, AreaResults, ClearAreaLink } from "@/components/AreaResults";
import { getI18n } from "@/lib/i18n/server";
import { PAGE_SIZE } from "@/lib/properties";
import { listMapProperties } from "@/lib/map-properties";
import { MAP_LIMIT, pagePolygonResults, type MapProperty, type MapResult } from "@/lib/map-query";
import { areaParamOf } from "@/lib/area-results";
import { parseSearch } from "@/lib/search";

const NO_AREA: MapResult = { items: [], total: 0, inBox: 0, missingCoords: 0, truncated: false };

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: `${t("results.title")} | VizooHome` };
}

export default async function Results({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t } = await getI18n();
  const q = await searchParams;
  const f = parseSearch(q);

  const polygon = f.polygon ?? null;
  const areaParam = areaParamOf(polygon);

  // Listings are shown ONLY for a selected area (every entry point: nav links, home search, shared or filtered URLs).
  // Without a valid "poly" nothing is fetched from Sanity. With one, the cards come from the exact polygon result
  // (same order as the listing query), so the map and the list always agree.
  let rows: MapProperty[] = [];
  let total = 0;
  let mapResult = NO_AREA;
  if (polygon) {
    mapResult = await listMapProperties(f, polygon);
    ({ rows, total } = pagePolygonResults(mapResult, f.page));
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const withoutArea = () => {
    const p = new URLSearchParams();

    Object.entries(q).forEach(([k, v]) => {
      if (typeof v === "string" && k !== "page" && k !== "poly") {
        p.set(k, v);
      }
    });

    const s = p.toString();
    return s ? `/properties?${s}` : "/properties";
  };

  const href = (page: number) => {
    const p = new URLSearchParams();

    Object.entries(q).forEach(([k, v]) => {
      if (typeof v === "string" && k !== "page") {
        p.set(k, v);
      }
    });

    p.set("page", String(page));
    return `/properties?${p}`;
  };

  return (
    <div className="mx-auto max-w-site space-y-6 px-4 py-10 md:px-10">
      <h1 className="text-3xl font-bold text-navy">
        {t("results.title")}
      </h1>

      <PropertySearch key={JSON.stringify(f)} initial={f} />

      <AreaProvider serverParam={areaParam}>
        <section aria-label="Elanların xəritəsi" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-navy">
              Xəritədə elanlar
            </h2>
            <AreaGate>
              <p className="text-sm text-mute">
                Xəritədə {mapResult.items.length} elan göstərilir
              </p>
            </AreaGate>
          </div>

          <PropertyMap items={mapResult.items} initialPolygon={polygon} />

          <AreaGate>
            {mapResult.missingCoords > 0 && (
              <p className="text-sm text-mute">
                {mapResult.missingCoords} elanın xəritədə göstərilməsi üçün
                koordinatı yoxdur.
              </p>
            )}
          </AreaGate>
        </section>

        {f.badLocation && (
          <p role="alert" className="anim-up text-[#B91C1C]">
            {t("list.badLocation")}
          </p>
        )}

        {/* Empty state (no area), "updating" (new area loading) or the results of the selected area: never stale results. */}
        <AreaResults>
          <div className="space-y-6">
            <div className="anim-up flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber/40 bg-amber/10 px-4 py-2.5 text-sm text-navy">
              <span>{t("map.area.active")}</span>
              <ClearAreaLink href={withoutArea()} scroll={false} className="font-semibold underline">
                {t("map.area.remove")}
              </ClearAreaLink>
            </div>

            {mapResult.truncated && (
              <p role="status" className="text-sm text-amber-700">
                {t("map.area.truncated", { n: MAP_LIMIT })}
              </p>
            )}

            <p aria-live="polite" className="text-mute">
              {t("list.count", { n: total })}
            </p>

            {rows.length === 0 && !f.badLocation && (
              <p className="anim-up">
                {t("list.none")}{" "}
                <Link href="/properties" className="underline">
                  {t("list.reset")}
                </Link>
              </p>
            )}

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((p, i) => (
                <PropertyCard key={p._id} p={p} index={i} />
              ))}
            </div>

            {pages > 1 && (
              <nav
                aria-label={t("page.aria")}
                className="flex items-center gap-4 text-sm"
              >
                {f.page > 1 && (
                  <Link href={href(f.page - 1)} className="underline">
                    {t("page.prev")}
                  </Link>
                )}

                <span>
                  {f.page} / {pages}
                </span>

                {f.page < pages && (
                  <Link href={href(f.page + 1)} className="underline">
                    {t("page.next")}
                  </Link>
                )}
              </nav>
            )}
          </div>
        </AreaResults>
      </AreaProvider>
    </div>
  );
}
