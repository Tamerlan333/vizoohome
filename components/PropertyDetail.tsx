import Link from "next/link";
import Gallery from "@/components/Gallery";
import PropertyCard from "@/components/PropertyCard";
import SaveButton from "@/components/SaveButton";
import StatusBadges from "@/components/StatusBadges";
import { formatPrice } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { labelOf } from "@/lib/locations";
import { descOf, locationOf, normalizeType, titleOf, type Property } from "@/lib/property-utils";
import { contactOf } from "@/lib/phone";
import { whatsappUrl } from "@/lib/whatsapp";
export default async function PropertyDetail({ p, related }: { p: Property; related: Property[] }) {
  const { t, lang } = await getI18n();
  const title = titleOf(p, lang), photos = p.photos ?? [], type = normalizeType(p.propertyType), land = type === "land";
  const rows: [string, string][] = [[t("d.type"), t(`ty.${type}`)], [t("d.tx"), t(`tx.${p.transaction}`)]];
  if (!land && p.rooms) rows.push([t("d.rooms"), String(p.rooms)]);
  if (p.areaM2) rows.push([t("d.area"), `${p.areaM2} ${t("u.m2")}`]);
  if (p.floor !== undefined && p.floor !== null) rows.push([t("d.floor"), p.totalFloors ? `${p.floor} / ${p.totalFloors}` : String(p.floor)]);
  if (!land && (p.buildingType === "new" || p.buildingType === "old")) rows.push([t("d.building"), t(`bt.${p.buildingType}`)]);
  if (p.address) rows.push([t("d.address"), p.address]);
  const loc = locationOf(p, lang); if (loc) rows.push([t("d.loc"), loc]);
  if (p.metroIds?.length) rows.push([t("d.metro"), p.metroIds.map((id) => labelOf(id, lang)).filter(Boolean).join(", ")]);
  const cta = <a href={whatsappUrl(t("wa.prop", { t: title }))} target="_blank" rel="noopener noreferrer" className="inline-block rounded-lg bg-amber px-5 py-3 font-semibold text-navy transition hover:brightness-95 active:scale-[.97]">{t("d.contact")}</a>;
  const desc = descOf(p, lang);
  const contact = contactOf(p.contactPhone, t("wa.prop", { t: title })); // null when missing/invalid -> block hidden
  return (<article className="mx-auto max-w-site px-4 py-8 md:px-10">
    <Link href="/properties" className="text-sm underline">{t("d.back")}</Link>
    <h1 className="mt-4 text-[clamp(1.6rem,3.5vw,2.4rem)] font-bold text-navy">{title}</h1>
    <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3"><p className="text-3xl font-bold text-navy">{formatPrice(p.price, p.currency, lang, p.transaction === "rent" ? t("price.month") : "")}</p>{cta}<SaveButton id={p._id} variant="full" /></div>
    <div className="mt-4"><StatusBadges p={p} t={t} /></div>
    <h2 className="mt-8 text-xl font-semibold text-navy">{t("d.gallery")}</h2><div className="mt-3"><Gallery photos={photos} title={title} /></div>
    <h2 className="mt-8 text-xl font-semibold text-navy">{t("d.video")}</h2>
    {p.videoUrl ? <video controls preload="none" playsInline poster={photos[0] ? `${photos[0].url}?w=1200&auto=format` : undefined} src={p.videoUrl} className="mt-3 aspect-video w-full rounded-xl bg-navy" />
      : <div className="mt-3 flex aspect-video w-full items-center justify-center rounded-xl border border-line bg-soft text-sm text-mute">{t("d.novideo")}</div>}
    <div className="mt-8 grid gap-8 md:grid-cols-2"><div><h2 className="text-xl font-semibold text-navy">{t("d.about")}</h2>{desc && <p className="mt-3 whitespace-pre-line text-sm">{desc}</p>}
      <dl className="mt-4 space-y-1 text-sm">{rows.map(([a, b]) => <div key={a} className="flex justify-between gap-4 border-b border-line py-1"><dt className="text-mute">{a}</dt><dd className="text-right">{b}</dd></div>)}</dl></div>
      {contact && (<aside aria-labelledby="owner-contact" className="rounded-xl border border-line bg-soft p-5 md:self-start">
        <h2 id="owner-contact" className="text-xl font-semibold text-navy">{t("contact.title")}</h2>
        <p className="mt-3 text-xs text-mute">{t("contact.phone")}</p>
        <a href={contact.tel} className="break-all text-2xl font-bold text-navy transition-colors hover:text-amber">{contact.display}</a>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href={contact.tel} className="inline-flex min-h-[44px] items-center rounded-lg bg-navy px-5 text-sm font-semibold text-white transition active:scale-[.97]">{t("contact.call")}</a>
          <a href={contact.wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center rounded-lg bg-amber px-5 text-sm font-semibold text-navy transition hover:brightness-95 active:scale-[.97]">{t("contact.whatsapp")}</a></div></aside>)}</div>
    <div className="mt-8">{cta}</div>
    {related.length > 0 && <><h2 className="mt-12 text-2xl font-bold text-navy">{t("d.related")}</h2><div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{related.map((r, i) => <PropertyCard key={r._id} p={r} index={i} />)}</div></>}</article>);
}
