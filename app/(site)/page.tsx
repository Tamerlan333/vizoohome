import PropertySearch from "@/components/PropertySearch";
import PropertyCard from "@/components/PropertyCard";
import { getI18n } from "@/lib/i18n/server";
import { listPublished } from "@/lib/properties";
import ServicesSection from "@/components/ServicesSection";
export default async function Home() {
  const { t } = await getI18n();
  const { rows } = await listPublished({});
  return (<>
    <section className="bg-navy px-4 pb-10 pt-14 text-white md:px-10"><div className="mx-auto max-w-site">
      <h1 className="max-w-3xl text-[clamp(2.1rem,5vw,4rem)] font-bold leading-tight">{t("hero.title")}</h1>
      <p className="mt-4 max-w-xl text-slate-300">{t("hero.sub")}</p><div className="mt-8"><PropertySearch /></div></div></section>
    <section className="mx-auto max-w-site px-4 pt-16 md:px-10"><h2 className="text-3xl font-bold text-navy">{t("list.title")}</h2><p className="mt-2 text-mute">{t("list.sub")}</p>
      {rows.length === 0 ? <p className="anim-up mt-8 rounded-xl border border-line bg-soft p-8 text-center text-mute">{t("home.empty")}</p>
        : <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{rows.slice(0, 6).map((p, i) => <PropertyCard key={p._id} p={p} index={i} />)}</div>}</section>
    <ServicesSection /></>);
}
