"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import SaveButton from "./SaveButton";
import { formatPrice } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { clampIndex, hasControls, move, previewPhotos, rightMode, showLeft, swipeDirection, toMount, totalPhotos } from "@/lib/preview-photos";
import { img, locationOf, normalizeType, titleOf, type Property } from "@/lib/property-utils";

// Round, minimal controls over the picture.
// Desktop: hidden until the picture is hovered or contains keyboard focus; 32px circle + 6px invisible padding = 44px hit area.
// Touch screens ((hover:none) or (pointer:coarse)): always visible, no hover needed, real 44px size.
const ARROW =
  "absolute top-1/2 z-10 inline-flex h-8 min-w-8 -translate-y-1/2 items-center justify-center rounded-full shadow ring-1 ring-black/5 backdrop-blur-sm transition duration-150 before:absolute before:-inset-1.5 hover:scale-105 active:scale-95 " +
  "opacity-0 group-hover/img:opacity-100 group-focus-within/img:opacity-100 focus-visible:opacity-100 " +
  "[@media(hover:none)]:opacity-100 [@media(pointer:coarse)]:opacity-100 [@media(hover:none)]:h-11 [@media(hover:none)]:min-w-11 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:min-w-11";
const ARROW_NEUTRAL = "bg-white/90 text-navy hover:bg-white";
const ARROW_DETAILS = "gap-1 bg-amber px-3 text-xs font-semibold text-navy hover:brightness-95";

export default function PropertyCard({ p, index = 0 }: { p: Property; index?: number }) {
  const { t, lang } = useI18n();
  const type = normalizeType(p.propertyType);
  const href = `/properties/${p.slug}`;
  const photos = useMemo(() => previewPhotos(p.photos), [p.photos]); // at most 5, valid URLs only
  const n = photos.length;
  const total = totalPhotos(p.photoCount, p.photos?.length ?? n);
  // Per-card state: current photo, which photos are mounted (loaded) and which failed to load.
  const [pos, setPos] = useState(0);
  const idx = clampIndex(pos, n);
  const [mounted, setMounted] = useState<number[]>([0]);
  const [failed, setFailed] = useState<number[]>([]);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const swipedAt = useRef(0);
  const warm = (i: number) => setMounted((m) => { const need = toMount(i, n); return need.every((x) => m.includes(x)) ? m : [...new Set([...m, ...need])]; });
  const go = (dir: -1 | 1) => { const next = move(idx, n, dir); setPos(next); warm(next); };
  const controls = hasControls(n);
  const mode = rightMode(idx, n, total);
  const alt = (i: number) => `${photos[i].alt || titleOf(p, lang)}${n > 1 ? ` (${i + 1}/${n})` : ""}`;
  const meta = [locationOf(p, lang), t(`ty.${type}`), type !== "land" && p.rooms ? t("rooms.n", { n: p.rooms }) : "", p.areaM2 ? `${p.areaM2} ${t("u.m2")}` : ""].filter(Boolean).join(" · ");
  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); }; // controls never trigger the parent link

  // Touch: a horizontal swipe changes the photo; a tap still opens the detail page. A swipe never opens it.
  const onTouchStart = (e: React.TouchEvent) => { warm(idx); const f = e.touches[0]; touch.current = f ? { x: f.clientX, y: f.clientY } : null; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current; touch.current = null; const f = e.changedTouches[0];
    if (!s || !f || !controls) return;
    const dir = swipeDirection(f.clientX - s.x, f.clientY - s.y);
    if (dir === 0) return;
    swipedAt.current = Date.now();
    if ((dir === 1 && mode === "next") || (dir === -1 && showLeft(idx))) go(dir);
  };
  // Keyboard: Left/Right arrow keys while focus is inside the picture area.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!controls) return;
    if (e.key === "ArrowRight" && mode === "next") { e.preventDefault(); go(1); }
    else if (e.key === "ArrowLeft" && showLeft(idx)) { e.preventDefault(); go(-1); }
  };

  return (<article className="card anim-up relative overflow-hidden rounded-xl border border-line bg-white shadow-sm" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
    <div className={`group/img relative aspect-[4/3] overflow-hidden bg-slate-200 ${controls ? "touch-pan-y" : ""}`}
      {...(controls ? { role: "group", "aria-roledescription": "carousel", "aria-label": titleOf(p, lang) } : {})}
      onPointerEnter={() => warm(idx)} onFocusCapture={() => warm(idx)} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onKeyDown={onKeyDown}>
      {/* Clicking or tapping the picture opens the detail page. Keyboard users use the title link below, so this one is not a tab stop. */}
      <Link href={href} tabIndex={-1} aria-hidden="true" className="absolute inset-0 block" onClick={(e) => { if (Date.now() - swipedAt.current < 400) e.preventDefault(); }}>
        {photos.map((ph, i) => (mounted.includes(i) && !failed.includes(i) ? (
          <img key={ph.url} src={img(ph.url, 800)} alt={alt(i)} aria-hidden={i !== idx} loading={i === 0 ? "lazy" : "eager"} decoding="async" draggable={false}
            onError={() => setFailed((f) => [...f, i])} className="im absolute inset-0 h-full w-full object-cover"
            style={{ opacity: i === idx ? 1 : 0, transition: "opacity .2s ease, transform .25s ease" }} />) : null))}
        <span className="absolute left-3 top-3 rounded bg-white px-2 py-1 text-xs font-semibold text-navy">{t(`tx.${p.transaction}`)}</span>
        {p.videoUrl && <span className="absolute bottom-3 left-3 rounded bg-amber px-2 py-1 text-xs font-semibold text-navy">{t("card.video")}</span>}
        {controls && (mode === "more"
          ? <span className="absolute bottom-3 right-3 rounded bg-navy/80 px-2 py-1 text-[11px] font-semibold text-white">{t("card.moreCount", { n: total - n })}</span>
          : <span className="absolute bottom-3 right-3 rounded bg-navy/70 px-2 py-1 text-[11px] font-medium tabular-nums text-white">{idx + 1}/{n}{total > n ? "+" : ""}</span>)}
      </Link>
      {controls && <span className="sr-only" aria-live="polite">{t("g.counter", { i: idx + 1, n })}</span>}
      {controls && showLeft(idx) && (
        <button type="button" aria-label={t("card.prev")} onClick={(e) => { stop(e); go(-1); }} className={`${ARROW} ${ARROW_NEUTRAL} left-2`}><ChevronLeft className="h-4 w-4" aria-hidden /></button>)}
      {controls && (mode === "next"
        ? <button type="button" aria-label={t("card.next")} onClick={(e) => { stop(e); go(1); }} className={`${ARROW} ${ARROW_NEUTRAL} right-2`}><ChevronRight className="h-4 w-4" aria-hidden /></button>
        : <Link href={href} aria-label={t("card.details")} className={`${ARROW} ${ARROW_DETAILS} right-2`}>{t("card.details")}<ChevronRight className="h-4 w-4 shrink-0" aria-hidden /></Link>)}
    </div>
    <Link href={href} className="block">
      <div className="space-y-1 p-4"><p className="text-2xl font-bold text-navy">{formatPrice(p.price, p.currency, lang, p.transaction === "rent" ? t("price.month") : "")}</p>
        <h3 className="break-words font-medium">{titleOf(p, lang)}</h3><p className="text-sm text-mute">{meta}</p></div></Link>
    <div className="absolute right-3 top-3"><SaveButton id={p._id} /></div></article>);
}
