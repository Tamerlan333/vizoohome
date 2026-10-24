"use client";
import { Check, ChevronDown } from "lucide-react";
import { countActive, pickRepair, toggleTop, validateAdvanced, type AdvancedForm } from "@/lib/advanced-filters";
import { useI18n } from "@/lib/i18n/client";
const pill = (on: boolean) => `inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors duration-150 ${on ? "border-navy bg-navy font-semibold text-white" : "border-line bg-white text-ink hover:bg-soft"}`;
const num = "w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2.5 text-base text-ink md:text-sm";
function Pill({ on, onClick, children, radio }: { on: boolean; onClick: () => void; children: React.ReactNode; radio?: boolean }) {
  return <button type="button" {...(radio ? { role: "radio", "aria-checked": on } : { "aria-pressed": on })} onClick={onClick} className={pill(on)}>{on && <Check className="h-4 w-4" aria-hidden />}{children}</button>;
}
export default function AdvancedFilters({ value, onChange, open, onToggle, land, onApply, onReset }: { value: AdvancedForm; onChange: (v: AdvancedForm) => void; open: boolean; onToggle: () => void; land: boolean; onApply: () => void; onReset: () => void }) {
  const { t } = useI18n(); const err = validateAdvanced(value, { land }); const n = countActive(value, { land });
  const set = (p: Partial<AdvancedForm>) => onChange({ ...value, ...p });
  const field = (id: string, label: string, minK: "minArea" | "minFloor", maxK: "maxArea" | "maxFloor", e: string | undefined, int: boolean) => (
    <fieldset className="min-w-0"><legend className="text-xs font-medium text-mute">{label}</legend>
      <div className="mt-1 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
        <input type="number" inputMode={int ? "numeric" : "decimal"} min={0} step={int ? 1 : "any"} value={value[minK]} onChange={(ev) => onChange({ ...value, [minK]: ev.target.value })} placeholder={t("adv.min")} aria-label={`${label} ${t("adv.min")}`} aria-invalid={!!e} aria-describedby={e ? `${id}-err` : undefined} className={num} />
        <input type="number" inputMode={int ? "numeric" : "decimal"} min={0} step={int ? 1 : "any"} value={value[maxK]} onChange={(ev) => onChange({ ...value, [maxK]: ev.target.value })} placeholder={t("adv.max")} aria-label={`${label} ${t("adv.max")}`} aria-invalid={!!e} aria-describedby={e ? `${id}-err` : undefined} className={num} /></div>
      <p id={`${id}-err`} role={e ? "alert" : undefined} className="mt-1 min-h-4 text-xs text-[#B91C1C]">{e ? t(e) : ""}</p></fieldset>);
  return (<div className="mt-4">
    <button type="button" onClick={onToggle} aria-expanded={open} aria-controls="adv-panel" className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-1 text-sm font-semibold text-navy transition-colors hover:text-amber">
      {t(open ? "adv.hide" : "adv.toggle")}{n > 0 && !open && <span className="rounded-full bg-amber px-2 text-xs text-navy" aria-label={t("adv.active", { n })}>{n}</span>}
      <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden /></button>
    <div id="adv-panel" role="region" aria-label={t("adv.panel")} inert={!open} className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
      <div className="min-h-0 overflow-hidden"><div className="mt-2 rounded-xl border border-line bg-soft p-4">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {!land && <fieldset><legend className="text-xs font-medium text-mute">{t("adv.repair")}</legend>
            <div role="radiogroup" aria-label={t("adv.repair")} className="mt-1 flex flex-wrap gap-2">
              <Pill radio on={value.repair === ""} onClick={() => onChange(pickRepair(value, ""))}>{t("adv.any")}</Pill>
              <Pill radio on={value.repair === "repaired"} onClick={() => onChange(pickRepair(value, "repaired"))}>{t("b.repaired")}</Pill>
              <Pill radio on={value.repair === "unrepaired"} onClick={() => onChange(pickRepair(value, "unrepaired"))}>{t("b.unrepaired")}</Pill></div></fieldset>}
          {field("adv-area", t("adv.area"), "minArea", "maxArea", err.area, false)}
          {!land && <div className="min-w-0 sm:col-span-2 lg:col-span-1">{field("adv-floor", t("adv.floor"), "minFloor", "maxFloor", err.floor, true)}
            <div className="mt-1 flex flex-wrap gap-2">
              <Pill on={value.excludeFirstFloor} onClick={() => set({ excludeFirstFloor: !value.excludeFirstFloor })}>{t("adv.notFirst")}</Pill>
              <Pill on={value.excludeTopFloor} onClick={() => onChange(toggleTop(value, "excludeTopFloor"))}>{t("adv.notTop")}</Pill>
              <Pill on={value.topFloorOnly} onClick={() => onChange(toggleTop(value, "topFloorOnly"))}>{t("adv.onlyTop")}</Pill></div>
            <p className="mt-2 text-xs text-mute">{t("adv.dataNote")}</p></div>}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-line pt-3">
          <button type="button" onClick={onReset} aria-label={t("adv.resetAria")} className="min-h-[44px] px-3 text-sm text-mute underline">{t("adv.reset")}</button>
          <button type="button" onClick={onApply} className="min-h-[44px] rounded-lg bg-navy px-5 text-sm font-semibold text-white transition active:scale-[.97]">{t("adv.apply")}</button></div>
      </div></div></div></div>);
}
