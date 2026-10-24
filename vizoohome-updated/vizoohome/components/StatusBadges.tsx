import { Check, X } from "lucide-react";
import type { Property } from "@/lib/property-utils";
export default function StatusBadges({ p, t }: { p: Property; t: (k: string) => string }) {
  const base = "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold";
  return (<ul className="flex flex-wrap gap-2">
    {p.repairStatus === "repaired" && <li className={`${base} border-amber bg-amber/10 text-navy`}><Check className="h-3 w-3" aria-hidden />{t("b.repaired")}</li>}
    {p.repairStatus === "unrepaired" && <li className={`${base} border-line bg-soft text-ink`}><X className="h-3 w-3" aria-hidden />{t("b.unrepaired")}</li>}
    {p.hasTitleDeed === "yes" && <li className={`${base} border-navy bg-navy text-white`}><Check className="h-3 w-3" aria-hidden />{t("b.deed")}</li>}
    {p.hasTitleDeed === "no" && <li className={`${base} border-line bg-white text-ink`}><X className="h-3 w-3" aria-hidden />{t("b.nodeed")}</li>}</ul>);
}
