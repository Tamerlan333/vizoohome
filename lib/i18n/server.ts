import "server-only";
import { cookies } from "next/headers";
import { isLang, translate, type Lang } from "./dict";
export const LANG_COOKIE = "vh-lang";
export async function getI18n() {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  const lang: Lang = isLang(v) ? v : "az";
  return { lang, t: (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars) };
}
