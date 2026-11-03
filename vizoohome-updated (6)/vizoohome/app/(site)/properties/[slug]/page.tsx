import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PropertyDetail from "@/components/PropertyDetail";
import { getI18n } from "@/lib/i18n/server";
import { getBySlug, getRelated } from "@/lib/properties";
import { descOf, titleOf } from "@/lib/property-utils";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await getI18n(); const p = await getBySlug((await params).slug); if (!p) return {};
  return { title: `${titleOf(p, lang)} | VizooHome`, description: descOf(p, lang).slice(0, 160) || undefined, openGraph: p.photos?.[0] ? { images: [`${p.photos[0].url}?w=1200&auto=format`] } : undefined };
}
export default async function Page({ params }: Props) {
  const p = await getBySlug((await params).slug); if (!p) notFound();
  return <PropertyDetail p={p} related={await getRelated(p)} />;
}
