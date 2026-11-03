import "../globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { lang, t } = await getI18n();
  return (<I18nProvider lang={lang}>
    <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">{t("a11y.skip")}</a>
    <SiteHeader /><main id="main">{children}</main><SiteFooter /></I18nProvider>);
}
