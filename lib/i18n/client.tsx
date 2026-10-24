"use client";
import { createContext, useContext, useEffect } from "react";
import { translate, type Lang } from "./dict";
const Ctx = createContext<Lang>("az");
export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}
export function useI18n() {
  const lang = useContext(Ctx);
  return { lang, t: (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars) };
}
