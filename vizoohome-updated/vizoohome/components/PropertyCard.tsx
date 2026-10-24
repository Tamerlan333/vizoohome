"use client";
import Link from "next/link";
import SaveButton from "./SaveButton";
import { formatPrice } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { img, locationOf, normalizeType, titleOf, type Property } from "@/lib/property-utils";
export default function PropertyCard({ p, index = 0 }: { p: Property; index?: number }) {
  const { t, lang } = useI18n(); const photo = p.photos?.[0]; const type = normalizeType(p.propertyType);
  const meta = [locationOf(p, lang), t(`ty.${type}`), type !== "land" && p.rooms ? t("rooms.n", { n: p.rooms }) : "", p.areaM2 ? `${p.areaM2} ${t("u.m2")}` : ""].filter(Boolean).join(" · ");
  return (<article className="card anim-up relative overflow-hidden rounded-xl border border-line bg-white shadow-sm" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
    <Link href={`/properties/${p.slug}`} className="block">
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-200">{photo && <img src={img(photo.url, 800)} alt={photo.alt || titleOf(p, lang)} loading="lazy" className="im h-full w-full object-cover" />}
        <span className="absolute left-3 top-3 rounded bg-white px-2 py-1 text-xs font-semibold text-navy">{t(`tx.${p.transaction}`)}</span>
        {p.videoUrl && <span className="absolute bottom-3 left-3 rounded bg-amber px-2 py-1 text-xs font-semibold text-navy">{t("card.video")}</span>}</div>
      <div className="space-y-1 p-4"><p className="text-2xl font-bold text-navy">{formatPrice(p.price, p.currency, lang, p.transaction === "rent" ? t("price.month") : "")}</p>
        <h3 className="break-words font-medium">{titleOf(p, lang)}</h3><p className="text-sm text-mute">{meta}</p></div></Link>
    <div className="absolute right-3 top-3"><SaveButton id={p._id} /></div></article>);
}
