import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { siteConfig } from "@/lib/config";
import { ownerWhatsAppUrl } from "@/lib/whatsapp";
export default async function SiteFooter() {
  const { t } = await getI18n();
  const social = Object.entries(siteConfig.social).filter(([, u]) => u);
  return (<footer className="mt-20 bg-navy text-white"><div className="mx-auto grid max-w-site gap-8 px-4 py-12 md:grid-cols-3 md:px-10">
    <div><p className="text-xl font-bold">VizooHome</p><p className="mt-2 text-sm text-slate-300">{t("foot.desc")}</p></div>
    <nav className="flex flex-col gap-2 text-sm"><Link href="/properties?transaction=sale">{t("nav.buy")}</Link><Link href="/properties?transaction=rent">{t("nav.rent")}</Link><Link href="/saved">{t("nav.saved")}</Link>
      <a href={ownerWhatsAppUrl} target="_blank" rel="noopener noreferrer">{t("nav.submit")}</a></nav>
    <div className="text-sm text-slate-300">{siteConfig.email || siteConfig.phone ? <>{siteConfig.email && <p>{siteConfig.email}</p>}{siteConfig.phone && <p>{siteConfig.phone}</p>}</> : <p>{t("foot.contact")}</p>}
      <ul className="mt-2 flex gap-4">{social.map(([n, u]) => <li key={n}><a href={u} target="_blank" rel="noopener noreferrer" className="capitalize underline">{n}</a></li>)}</ul></div>
  </div><p className="border-t border-white/10 py-4 text-center text-xs text-slate-400">© {new Date().getFullYear()} VizooHome</p></footer>);
}
