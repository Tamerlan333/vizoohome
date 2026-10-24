"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLanguage } from "@/lib/i18n/actions";
import { useI18n } from "@/lib/i18n/client";
import { LANGS, LANG_NAMES } from "@/lib/i18n/dict";
export default function LanguageSwitcher() {
  const { lang } = useI18n(); const router = useRouter(); const [pending, start] = useTransition();
  return (<div role="group" aria-label="Language" className={`flex shrink-0 gap-0.5 ${pending ? "opacity-60" : ""}`}>
    {LANGS.map((l) => <button key={l} type="button" className="lg" aria-pressed={lang === l} aria-label={LANG_NAMES[l]} lang={l}
      onClick={() => start(async () => { await setLanguage(l); router.refresh(); })}>{l.toUpperCase()}</button>)}</div>);
}
