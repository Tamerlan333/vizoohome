"use client";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useSaved } from "@/lib/saved";
import { useI18n } from "@/lib/i18n/client";
export default function SavedLink() {
  const { ids } = useSaved(); const { t } = useI18n();
  return (<Link href="/saved" className="nl inline-flex items-center gap-1.5 py-2"><Heart className="h-4 w-4" aria-hidden />{t("nav.saved")}
    {ids.length > 0 && <span className="rounded-full bg-amber px-1.5 text-xs font-semibold text-navy" aria-label={String(ids.length)}>{ids.length}</span>}</Link>);
}
