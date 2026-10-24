import Link from "next/link";
import PropertySearch from "@/components/PropertySearch";
import PropertyCard from "@/components/PropertyCard";
import { getI18n } from "@/lib/i18n/server";
import { listPublished, PAGE_SIZE } from "@/lib/properties";
import { parseSearch } from "@/lib/search";
export async function generateMetadata() { const { t } = await getI18n(); return { title: `${t("results.title")} | VizooHome` }; }
export default async function Results({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t } = await getI18n(); const q = await searchParams; const f = parseSearch(q);
  const { rows, total } = await listPublished(f); const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (page: number) => { const p = new URLSearchParams(); Object.entries(q).forEach(([k, v]) => typeof v === "string" && k !== "page" && p.set(k, v)); p.set("page", String(page)); return `/properties?${p}`; };
  return (<div className="mx-auto max-w-site space-y-6 px-4 py-10 md:px-10"><h1 className="text-3xl font-bold text-navy">{t("results.title")}</h1>
    <PropertySearch key={JSON.stringify(f)} initial={f} /><p aria-live="polite" className="text-mute">{t("list.count", { n: total })}</p>
    {f.badLocation && <p role="alert" className="anim-up text-[#B91C1C]">{t("list.badLocation")}</p>}
    {rows.length === 0 && !f.badLocation && <p className="anim-up">{t("list.none")} <Link href="/properties" className="underline">{t("list.reset")}</Link></p>}
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{rows.map((p, i) => <PropertyCard key={p._id} p={p} index={i} />)}</div>
    {pages > 1 && <nav aria-label={t("page.aria")} className="flex items-center gap-4 text-sm">{f.page > 1 && <Link href={href(f.page - 1)} className="underline">{t("page.prev")}</Link>}<span>{f.page} / {pages}</span>{f.page < pages && <Link href={href(f.page + 1)} className="underline">{t("page.next")}</Link>}</nav>}</div>);
}
