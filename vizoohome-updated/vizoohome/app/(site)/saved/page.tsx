import SavedList from "@/components/SavedList";
import { getI18n } from "@/lib/i18n/server";
export async function generateMetadata() { const { t } = await getI18n(); return { title: `${t("saved.title")} | VizooHome`, robots: { index: false } }; }
export default async function SavedPage() {
  const { t } = await getI18n();
  return (<div className="mx-auto max-w-site px-4 py-10 md:px-10"><h1 className="text-3xl font-bold text-navy">{t("saved.title")}</h1><p className="mt-2 text-sm text-mute">{t("saved.note")}</p><div className="mt-6"><SavedList /></div></div>);
}
