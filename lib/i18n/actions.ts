"use server";
import { cookies } from "next/headers";
import { isLang } from "./dict";
export async function setLanguage(lang: string) {
  if (!isLang(lang)) return;
  (await cookies()).set("vh-lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
