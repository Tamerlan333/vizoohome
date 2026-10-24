"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
export default function Gallery({ photos, title }: { photos: { url: string; alt?: string | null }[]; title: string }) {
  const { t } = useI18n(); const [open, setOpen] = useState<number | null>(null); const n = photos.length;
  useEffect(() => {
    if (open === null) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); if (e.key === "ArrowRight") setOpen((i) => ((i ?? 0) + 1) % n); if (e.key === "ArrowLeft") setOpen((i) => ((i ?? 0) - 1 + n) % n); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [open, n]);
  if (!n) return <p className="text-sm text-mute">{t("d.nophoto")}</p>;
  const src = (u: string, w: number) => `${u}?w=${w}&auto=format`;
  return (<>
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">{photos.map((p, i) => (<li key={p.url} className={i === 0 ? "col-span-2 md:row-span-2" : ""}>
      <button type="button" onClick={() => setOpen(i)} className="block w-full overflow-hidden rounded-lg bg-slate-200" aria-label={t("g.open", { i: i + 1, n })}>
        <img src={src(p.url, i === 0 ? 1200 : 600)} alt={p.alt || `${title} ${i + 1}`} loading={i === 0 ? "eager" : "lazy"} className="aspect-[3/2] w-full object-cover transition duration-200 hover:scale-[1.03]" /></button></li>))}</ul>
    {open !== null && (<div role="dialog" aria-modal="true" aria-label={title} className="anim-page fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setOpen(null)}>
      <img key={open} src={src(photos[open].url, 1800)} alt={photos[open].alt || `${title} ${open + 1}`} className="anim-page max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
      <p className="absolute left-4 top-4 rounded bg-white px-3 py-1 text-sm" aria-live="polite">{t("g.counter", { i: open + 1, n })}</p>
      <button autoFocus className="absolute right-4 top-4 rounded bg-white px-3 py-1 text-sm" onClick={() => setOpen(null)}>{t("g.close")}</button>
      {n > 1 && <><button className="absolute left-4 rounded bg-white px-3 py-2 text-lg" aria-label={t("g.prev")} onClick={(e) => { e.stopPropagation(); setOpen((open - 1 + n) % n); }}>‹</button>
        <button className="absolute right-4 rounded bg-white px-3 py-2 text-lg" aria-label={t("g.next")} onClick={(e) => { e.stopPropagation(); setOpen((open + 1) % n); }}>›</button></>}</div>)}</>);
}
