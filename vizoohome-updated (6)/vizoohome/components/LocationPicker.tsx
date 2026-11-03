"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronRight, MapPin, Train, X } from "lucide-react";
import { ABSERON, BAKU_ID, DISTRICTS, METRO, REGIONS, fold, labelOf, settlementsOf } from "@/lib/locations";
import { chipsOf, clearMetro, countSelected, districtState, emptySelection, isSettlementChecked, removeChip, selectAllBaku, selectAllMetro, setAllBaku, setCity, toggleDistrict, toggleMetro, toggleSettlement, type CheckState, type Selection } from "@/lib/location-selection";
import { useI18n } from "@/lib/i18n/client";
type Tab = "baku" | "metro" | "other";
const MQ = "(max-width: 767px)";
function useMobile() {
  return useSyncExternalStore((cb) => { const m = window.matchMedia(MQ); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); }, () => window.matchMedia(MQ).matches, () => false);
}
function Box({ state, label, onChange, strong, hint }: { state: CheckState; label: string; onChange: () => void; strong?: boolean; hint?: string }) {
  return (<label className="flex min-h-[44px] flex-1 cursor-pointer items-center gap-3 rounded-md px-2 text-sm transition-colors hover:bg-soft">
    <input type="checkbox" className="h-5 w-5 shrink-0 accent-amber" checked={state === "checked"} ref={(el) => { if (el) el.indeterminate = state === "partial"; }} onChange={onChange} />
    <span className={strong ? "font-semibold text-navy" : ""}>{label}{hint && <span className="ml-2 text-xs font-normal text-mute">{hint}</span>}</span></label>);
}
export default function LocationPicker({ value, onChange }: { value: Selection; onChange: (s: Selection) => void }) {
  const { t, lang } = useI18n(); const mobile = useMobile();
  const [open, setOpen] = useState(false); const [tab, setTab] = useState<Tab>("baku"); const [q, setQ] = useState(""); const [draft, setDraft] = useState<Selection>(value); const [expanded, setExpanded] = useState<string[]>([]);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), dialog = useRef<HTMLDivElement>(null);
  const cur = open && mobile ? draft : value; const fq = fold(q.trim());
  const commit = (n: Selection) => { if (mobile) setDraft(n); else onChange(n); };
  const openPanel = () => { setDraft(value); setQ(""); setTab(value.city && value.city !== BAKU_ID ? "other" : value.metro.length && !value.districts.length && !value.settlements.length ? "metro" : "baku"); setOpen(true); };
  const close = (apply: boolean) => { if (apply && mobile) onChange(draft); setOpen(false); trigger.current?.focus(); };
  useEffect(() => { if (!open || mobile) return; const h = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, [open, mobile]);
  useEffect(() => { if (!(open && mobile)) return; const o = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = o; }; }, [open, mobile]);
  function keys(e: React.KeyboardEvent) {
    if (e.key === "Escape") { e.stopPropagation(); close(false); return; }
    if (e.key !== "Tab" || !mobile) return;
    const f = dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input,[href],[tabindex]:not([tabindex="-1"])'); if (!f?.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  const m = (label: string) => !fq || fold(label).includes(fq);
  const toggleOpen = (id: string) => setExpanded((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const district = (id: string, label: string) => {
    const kids = settlementsOf(id); const selfHit = m(label); const shown = selfHit ? kids : kids.filter((k) => m(k.label));
    if (!selfHit && !shown.length) return null;
    const isOpen = expanded.includes(id) || !!fq;
    return (<li key={id}><div className="flex items-center"><Box state={districtState(cur, id)} label={label} strong onChange={() => commit(toggleDistrict(cur, id))} />
      <button type="button" onClick={() => toggleOpen(id)} aria-expanded={isOpen} aria-label={t(isOpen ? "loc.collapse" : "loc.expand", { name: label })} className="grid h-11 w-11 shrink-0 place-items-center rounded-md hover:bg-soft"><ChevronRight className={`h-4 w-4 transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`} aria-hidden /></button></div>
      {isOpen && <ul className="ml-6 border-l border-line pl-2">{shown.map((k) => <li key={k.id}><Box state={isSettlementChecked(cur, k.id) ? "checked" : "none"} label={k.label} onChange={() => commit(toggleSettlement(cur, k.id))} /></li>)}</ul>}</li>);
  };
  const tabs: [Tab, string][] = [["baku", t("loc.tabBaku")], ["metro", t("loc.tabMetro")], ["other", t("loc.tabOther")]];
  const metroShown = METRO.filter((x) => m(x.label));
  const body = (<>
    <div className="px-3 pt-3"><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search.find")} aria-label={t("search.find")} autoFocus enterKeyHint="search" className="w-full rounded-lg border border-line px-3 py-2.5 text-base md:text-sm" /></div>
    <div role="tablist" aria-label={t("loc.tabs")} className="mt-2 flex gap-1 border-b border-line px-3">{tabs.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-[44px] border-b-2 px-3 text-sm font-medium transition-colors ${tab === k ? "border-amber text-navy" : "border-transparent text-mute"}`}>{l}</button>)}</div>
    <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
      {tab === "baku" && (<>
        <div className="flex items-center justify-between gap-2"><label className="flex min-h-[44px] flex-1 cursor-pointer items-center gap-3 rounded-md px-2 text-sm hover:bg-soft"><input type="radio" name="all-baku" className="h-5 w-5 accent-amber" checked={cur.city === BAKU_ID} onChange={() => commit(setAllBaku(cur))} /><span className="font-semibold text-navy">{t("loc.bakuAll")}</span></label>
          <button type="button" onClick={() => commit(selectAllBaku(cur))} className="min-h-[44px] px-2 text-sm text-navy underline">{t("loc.selectAll")}</button></div>
        <p className="px-2 pt-2 text-xs font-semibold uppercase text-mute">{t("loc.districts")}</p>
        <ul>{DISTRICTS.map((d) => district(d.id, d.label))}</ul>
        <p className="px-2 pt-3 text-xs font-semibold uppercase text-mute">{t("loc.abseron")}</p><ul>{district(ABSERON.id, ABSERON.label)}</ul></>)}
      {tab === "metro" && (<>
        <div className="flex items-center justify-between px-2"><p className="flex items-center gap-2 text-xs font-semibold uppercase text-mute"><Train className="h-4 w-4" aria-hidden />{t("loc.tabMetro")}</p>
          <button type="button" onClick={() => commit(cur.metro.length === METRO.length ? clearMetro(cur) : selectAllMetro(cur, metroShown.map((x) => x.id)))} className="min-h-[44px] px-2 text-sm text-navy underline">{t("loc.selectAll")}</button></div>
        <ul>{metroShown.map((x) => <li key={x.id}><Box state={cur.metro.includes(x.id) ? "checked" : "none"} label={x.label} onChange={() => commit(toggleMetro(cur, x.id))} /></li>)}</ul>
        {metroShown.length === 0 && <p className="px-3 py-4 text-sm text-mute">{t("search.none")}</p>}</>)}
      {tab === "other" && (<ul role="radiogroup">{REGIONS.filter((r) => r.id !== BAKU_ID && r.id !== ABSERON.id && m(r.label)).map((r) => <li key={r.id}><label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md px-2 text-sm hover:bg-soft"><input type="radio" name="region" className="h-5 w-5 accent-amber" checked={cur.city === r.id} onChange={() => { commit(setCity(cur, r.id)); if (!mobile) setOpen(false); }} />{r.label}</label></li>)}</ul>)}
    </div></>);
  const footer = (<div className={`flex items-center gap-3 border-t border-line px-3 pt-3 ${mobile ? "pb-[max(0.75rem,env(safe-area-inset-bottom))]" : "pb-3"}`}>
    <button type="button" onClick={() => commit(emptySelection())} className="min-h-[44px] px-2 text-sm text-mute underline">{t("loc.clear")}</button>
    <span className="ml-auto text-sm text-mute" aria-live="polite">{t("loc.selected", { n: countSelected(cur) })}</span>
    {mobile && <button type="button" onClick={() => close(true)} className="min-h-[48px] rounded-lg bg-amber px-6 font-semibold text-navy active:scale-[.97]">{t("loc.apply")}</button>}</div>);
  const n = countSelected(value); const chips = chipsOf(value, lang);
  const name = (c: (typeof chips)[number]) => c.kind === "metro" ? `${t("loc.metroShort")} ${c.label}` : c.detail ? `${c.label} · ${c.detail}` : c.label;
  return (<div ref={root} className="relative" onKeyDown={open && !mobile ? keys : undefined}>
    <span id="loc-l" className="block text-xs font-medium text-mute">{t("search.location")}</span>
    <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} aria-labelledby="loc-l" onClick={() => (open ? close(false) : openPanel())} className="mt-1 flex min-h-[44px] w-full items-center gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-left text-sm text-ink">
      <MapPin className="h-4 w-4 shrink-0 text-amber" aria-hidden />{n === 0 ? <span className="truncate text-mute">{t("search.locationPh")}</span> : <span className="truncate">{n === 1 ? name(chips[0]) : t("loc.selected", { n })}</span>}<ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-mute transition-transform duration-150 ${open ? "rotate-180" : ""}`} aria-hidden /></button>
    {n > 0 && <ul aria-label={t("loc.chips")} className="mt-2 flex max-h-24 flex-wrap gap-2 overflow-y-auto">{chips.map((c) => <li key={`${c.kind}-${c.id}`}><button type="button" onClick={() => onChange(removeChip(value, c.kind, c.id))} aria-label={t("loc.remove", { name: name(c) })} className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-amber bg-amber/10 px-3 py-1 text-xs text-navy transition-colors hover:bg-amber/20">{name(c)}<X className="h-3 w-3" aria-hidden /></button></li>)}</ul>}
    {open && mobile ? (<div ref={dialog} role="dialog" aria-modal="true" aria-label={t("loc.title")} onKeyDown={keys} className="anim-page fixed inset-0 z-50 flex h-[100dvh] flex-col bg-white">
      <div className="flex items-center justify-between border-b border-line px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]"><h2 className="text-lg font-bold text-navy">{t("loc.title")}</h2>
        <button type="button" onClick={() => close(false)} aria-label={t("loc.close")} className="grid h-11 w-11 place-items-center rounded-md"><X className="h-5 w-5" aria-hidden /></button></div>
      <div className="flex min-h-0 flex-1 flex-col">{body}</div>{footer}</div>)
      : (<div className="pnl absolute left-0 z-30 mt-1 flex max-h-[min(32rem,70vh)] w-[min(32rem,calc(100vw-2rem))] flex-col rounded-lg border border-line bg-white shadow-lg" data-open={open} role="dialog" aria-label={t("loc.title")}>{body}{footer}</div>)}
  </div>);
}
