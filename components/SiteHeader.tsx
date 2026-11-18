import Link from "next/link";
import LanguageSwitcher from "./LanguageSwitcher";
import SavedLink from "./SavedLink";
import { getI18n } from "@/lib/i18n/server";
import { ownerWhatsAppUrl } from "@/lib/whatsapp";
export default async function SiteHeader() {
  const { t } = await getI18n();
  // 3-column grid with equal outer tracks keeps the logo centred on the full header width.
  // The nav only fits beside the logo from xl up (longest locale, RU, is ~505px); below that it takes its own row.
  return (<header className="sticky top-0 z-40 border-b border-line bg-white"><div className="mx-auto grid max-w-site grid-cols-[1fr_auto_1fr] items-center gap-x-2 gap-y-2 px-4 py-3 sm:gap-x-4 md:px-10">
    <div className="justify-self-start"><LanguageSwitcher /></div>
    <Link href="/" className="col-start-2 justify-self-center text-xl font-bold text-navy">Vizoo<span className="text-amber">Home</span></Link>
    <nav className="col-span-3 flex flex-wrap items-center justify-self-end gap-x-5 gap-y-1 text-sm font-medium xl:col-span-1 xl:col-start-3">
      <Link href="/properties?transaction=sale" className="nl py-2">{t("nav.buy")}</Link>
      <Link href="/properties?transaction=rent" className="nl py-2">{t("nav.rent")}</Link>
      <SavedLink />
      <a href={ownerWhatsAppUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-amber px-4 py-2.5 font-semibold text-navy transition hover:brightness-95 active:scale-[.97]">{t("nav.submit")}</a>
    </nav></div></header>);
}
