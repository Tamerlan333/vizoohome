"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import PropertyCard from "./PropertyCard";
import { useSaved, removeSaved } from "@/lib/saved";
import { useI18n } from "@/lib/i18n/client";
import type { Property } from "@/lib/property-utils";
import { getSavedProperties } from "@/app/(site)/saved/actions";
export default function SavedList() {
  const { t } = useI18n(); const { ids } = useSaved();
  const [hydrated, setHydrated] = useState(false); const [items, setItems] = useState<Property[]>([]); const [gone, setGone] = useState<string[]>([]); const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => setHydrated(true), []);
  useEffect(() => {
    if (!hydrated) return;
    const need = ids.filter((id) => !items.some((p) => p._id === id) && !gone.includes(id));
    if (!need.length) { setState("ready"); return; }
    let alive = true; setState("loading");
    getSavedProperties(ids).then((r) => { if (!alive) return; setItems(r); setGone(ids.filter((id) => !r.some((p) => p._id === id))); setState("ready"); }).catch(() => alive && setState("error"));
    return () => { alive = false; };
  }, [hydrated, ids.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!hydrated || state === "loading") return <p className="py-10 text-mute" role="status">{t("saved.loading")}</p>;
  if (state === "error") return <p className="py-10 text-[#B91C1C]" role="alert">{t("saved.error")}</p>;
  const visible = items.filter((p) => ids.includes(p._id)); const missing = gone.filter((id) => ids.includes(id));
  return (<>
    {missing.length > 0 && <p className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-soft px-4 py-2 text-sm">{t("saved.missing", { n: missing.length })}<button className="underline" onClick={() => removeSaved(missing)}>{t("saved.cleanup")}</button></p>}
    {visible.length === 0 ? (<div className="anim-up rounded-2xl border border-line bg-soft px-6 py-14 text-center"><Heart className="mx-auto h-10 w-10 text-amber" aria-hidden /><p className="mt-4 text-lg font-semibold text-navy">{t("saved.empty")}</p><p className="mt-1 text-sm text-mute">{t("saved.emptyHint")}</p>
      <Link href="/properties" className="mt-6 inline-block rounded-lg bg-amber px-5 py-3 font-semibold text-navy transition hover:brightness-95 active:scale-[.97]">{t("saved.browse")}</Link></div>)
      : <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{visible.map((p, i) => <PropertyCard key={p._id} p={p} index={i} />)}</div>}</>);
}
