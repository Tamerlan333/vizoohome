"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Boxes, Building2, Home, LayoutGrid, Mountain, Sparkles, Landmark, Store } from "lucide-react";
import LocationPicker from "./LocationPicker";
import { emptySelection, normalize, serializeSelection, type Selection } from "@/lib/location-selection";
import { useI18n } from "@/lib/i18n/client";
const TYPES = [["", "search.allTypes", LayoutGrid], ["apartment", "ty.apartment", Building2], ["yard-house", "ty.yard-house", Home], ["land", "ty.land", Mountain], ["commercial", "ty.commercial", Store], ["other", "ty.other", Boxes]] as const;
const BUILDINGS = [["new", "bt.new", Sparkles], ["old", "bt.old", Landmark]] as const;
const inp = "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink";
const tile = (on: boolean) => `flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition duration-150 ${on ? "scale-[1.02] border-amber bg-amber/10 font-semibold text-navy" : "border-line bg-white hover:bg-soft"}`;
const sticker = (on: boolean) => `grid h-6 w-6 place-items-center rounded-md transition-colors duration-150 ${on ? "bg-amber/25 text-navy" : "bg-navy/10 text-navy"}`;
export interface Initial { transaction?: string; city?: string; districts?: string[]; settlements?: string[]; metro?: string[]; type?: string; building?: string; rooms?: number; minPrice?: number; maxPrice?: number }
export default function PropertySearch({ initial = {} }: { initial?: Initial }) {
  const { t } = useI18n(); const r = useRouter();
  const [tx, setTx] = useState(initial.transaction === "rent" ? "rent" : "sale");
  const [sel, setSel] = useState<Selection>(() => normalize({ city: initial.city, districts: initial.districts, settlements: initial.settlements, metro: initial.metro }));
  const [type, setType] = useState(initial.type ?? ""); const [building, setBuilding] = useState(initial.building ?? ""); const [rooms, setRooms] = useState(initial.rooms ? String(initial.rooms) : "");
  const [mn, setMn] = useState(initial.minPrice?.toString() ?? ""); const [mx, setMx] = useState(initial.maxPrice?.toString() ?? ""); const [err, setErr] = useState("");
  const land = type === "land";
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if ((mn && +mn < 0) || (mx && +mx < 0)) return setErr(t("err.neg"));
    if (mn && mx && +mx < +mn) return setErr(t("err.range"));
    setErr(""); const q = new URLSearchParams({ transaction: tx });
    Object.entries({ ...serializeSelection(sel), type, building: land ? "" : building, rooms: land ? "" : rooms, minPrice: mn, maxPrice: mx }).forEach(([k, v]) => v && q.set(k, v));
    r.push(`/properties?${q}`);
  }
  function reset() { setTx("sale"); setSel(emptySelection()); setType(""); setBuilding(""); setRooms(""); setMn(""); setMx(""); setErr(""); r.push("/properties"); }
  return (<form onSubmit={submit} className="rounded-xl bg-white p-4 text-ink shadow-sm" aria-label={t("search.aria")}>
    <div role="tablist" className="mb-4 flex gap-2">{(["sale", "rent"] as const).map((v) => <button key={v} type="button" role="tab" aria-selected={tx === v} onClick={() => setTx(v)} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${tx === v ? "bg-navy text-white" : "bg-soft"}`}>{t(`tab.${v}`)}</button>)}</div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><div className="sm:col-span-2"><LocationPicker value={sel} onChange={setSel} /></div></div>
    <fieldset className="mt-4"><legend className="text-xs font-medium text-mute">{t("search.type")}</legend>
      <div role="radiogroup" className="mt-1 flex flex-wrap gap-2">{TYPES.map(([v, k, Icon]) => <button key={v} type="button" role="radio" aria-checked={type === v} onClick={() => setType(v)} className={tile(type === v)}><span className={sticker(type === v)}><Icon className="h-3.5 w-3.5" aria-hidden /></span>{t(k)}</button>)}</div></fieldset>
    {!land && <fieldset className="anim-up mt-4"><legend className="text-xs font-medium text-mute">{t("search.building")}</legend>
      <div role="radiogroup" className="mt-1 flex flex-wrap gap-2">{BUILDINGS.map(([v, k, Icon]) => <button key={v} type="button" role="radio" aria-checked={building === v} onClick={() => setBuilding(building === v ? "" : v)} className={tile(building === v)}><span className={sticker(building === v)}><Icon className="h-3.5 w-3.5" aria-hidden /></span>{t(k)}</button>)}</div></fieldset>}
    {!land && <div className="anim-up mt-4"><p id="rl" className="text-xs font-medium text-mute">{t("search.rooms")}</p>
      <div role="radiogroup" aria-labelledby="rl" className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-6">{["", "1", "2", "3", "4", "5"].map((v) => <button key={v} type="button" role="radio" aria-checked={rooms === v} onClick={() => setRooms(v)} className={`rounded-lg border px-2 py-2 text-sm transition duration-150 ${rooms === v ? "scale-[1.02] border-amber bg-amber/10 font-semibold" : "border-line bg-white hover:bg-soft"}`}>{v ? (v === "5" ? t("rooms.5") : t("rooms.n", { n: v })) : t("rooms.any")}</button>)}</div></div>}
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <label className="text-xs font-medium text-mute">{t("search.min")}<input type="number" min={0} value={mn} onChange={(e) => setMn(e.target.value)} className={inp} /></label>
      <label className="text-xs font-medium text-mute">{t("search.max")}<input type="number" min={0} value={mx} onChange={(e) => setMx(e.target.value)} className={inp} /></label>
      <div className="flex items-end gap-2"><button className="flex-1 rounded-lg bg-amber px-4 py-2.5 font-semibold text-navy transition hover:brightness-95 active:scale-[.97]">{t("search.go")}</button>
        <button type="button" onClick={reset} className="rounded-lg border border-line px-3 py-2.5 text-sm transition active:scale-95">{t("search.reset")}</button></div></div>
    <p role="alert" className="mt-2 min-h-5 text-sm text-[#B91C1C]">{err}</p></form>);
}
