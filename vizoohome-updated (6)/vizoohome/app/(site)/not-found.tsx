import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
export default async function NotFound() {
  const { t } = await getI18n();
  return <div className="mx-auto max-w-site px-4 py-20 md:px-10"><h1 className="text-3xl font-bold text-navy">{t("nf.title")}</h1><Link href="/properties" className="mt-4 inline-block underline">{t("nf.back")}</Link></div>;
}
