import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";
export const metadata: Metadata = { metadataBase: new URL(siteConfig.url),
  title: "VizooHome | Video təqdimatlı premium əmlak", description: "Peşəkar video çəkilişlər və detallı baxışla premium mənzillər.",
  openGraph: { title: "VizooHome", description: "Xəyalınızdakı evi vizual təqdimatla tapın.", locale: "az_AZ" } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="az"><body>{children}</body></html>;
}
