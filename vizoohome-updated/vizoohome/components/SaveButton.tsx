"use client";
import { useState } from "react";
import { Heart } from "lucide-react";
import { useSaved } from "@/lib/saved";
import { useI18n } from "@/lib/i18n/client";
export default function SaveButton({ id, variant = "icon" }: { id: string; variant?: "icon" | "full" }) {
  const { isSaved, toggle } = useSaved(); const { t } = useI18n(); const [pop, setPop] = useState(false);
  const saved = isSaved(id);
  const label = t(saved ? "save.aria.remove" : "save.aria.add");
  const onClick = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); toggle(id); setPop(true); };
  const icon = <Heart aria-hidden className={`h-4 w-4 ${pop ? "anim-pop" : ""} ${saved ? "fill-amber text-amber" : "text-navy"}`} onAnimationEnd={() => setPop(false)} />;
  return variant === "icon"
    ? <button type="button" aria-pressed={saved} aria-label={label} onClick={onClick} className="rounded-full bg-white p-2 shadow transition active:scale-90">{icon}</button>
    : <button type="button" aria-pressed={saved} aria-label={label} onClick={onClick} className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-3 text-sm font-semibold text-navy transition hover:bg-soft active:scale-[.97]">{icon}{t(saved ? "save.on" : "save.add")}</button>;
}
