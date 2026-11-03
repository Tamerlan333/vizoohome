import Link from "next/link";
import LanguageSwitcher from "./LanguageSwitcher";
import SavedLink from "./SavedLink";
import { getI18n } from "@/lib/i18n/server";
import { ownerWhatsAppUrl } from "@/lib/whatsapp";
export default async function SiteHeader() {
  const { t } = await getI18n();
  return (<header className="sticky top-0 z-40 border-b border-line bg-white"><div className="mx-auto flex max-w-site flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-10">
    <LanguageSwitcher />
    <Link href="/" className="text-xl font-bold text-navy">Vizoo<span className="text-amber">Home</span></Link>
    <nav className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-medium">
      <Link href="/properties?transaction=sale" className="nl py-2">{t("nav.buy")}</Link>
      <Link href="/properties?transaction=rent" className="nl py-2">{t("nav.rent")}</Link>
      <SavedLink />
      <a href={ownerWhatsAppUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-amber px-4 py-2.5 font-semibold text-navy transition hover:brightness-95 active:scale-[.97]">{t("nav.submit")}</a>
    </nav></div></header>);
}
