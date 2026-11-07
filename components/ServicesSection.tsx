"use client";
import { useEffect, useRef, useState } from "react";
import { Building2, Camera, Handshake, MessageCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { serviceWhatsAppUrl, type ServiceKey } from "@/lib/whatsapp";

// Prices are display-only. They are never part of a WhatsApp message or URL.
// price = current promotional price (main), was = original price (struck through).
const SERVICES: { n: 1 | 2 | 3; key: ServiceKey; Icon: typeof Camera; price: string; was: string; premium?: boolean }[] = [
  { n: 1, key: "presentation", Icon: Building2, price: "15", was: "30" },
  { n: 2, key: "shooting", Icon: Camera, price: "350", was: "450" },
  { n: 3, key: "realtor", Icon: Handshake, price: "650", was: "850", premium: true },
];

// One typography for every price, so all three cards match: medium weight, tight tracking, aligned digits.
const AMOUNT = "text-[2.5rem] font-medium leading-none tracking-tight tabular-nums text-navy";
const CURRENCY = "text-sm font-normal tracking-wide text-amber";
const WAS = "text-sm font-normal tabular-nums text-mute line-through decoration-1";
const KICKER = "text-[11px] font-semibold uppercase leading-4 tracking-[0.08em] text-amber";

export default function ServicesSection() {
  const { t } = useI18n();
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  // Fade-up when the section scrolls into view. Without IntersectionObserver or with reduced motion, show immediately.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    const safety = setTimeout(() => setShown(true), 3000); // never leave content hidden
    return () => { io.disconnect(); clearTimeout(safety); };
  }, []);

  return (
    <section ref={ref} data-shown={shown} aria-labelledby="svc-title" className="svc mx-auto mt-16 max-w-site px-4 md:px-10">
      <noscript><style>{".svc .svc-card{opacity:1!important;transform:none!important}"}</style></noscript>
      <div className="rounded-3xl bg-soft px-5 py-10 md:px-10 md:py-14">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="svc-title" className="text-[clamp(1.6rem,3.5vw,2.25rem)] font-bold text-navy">{t("svc.title")}</h2>
          <p className="mt-3 text-mute">{t("svc.sub")}</p>
        </div>
        <ul className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map(({ n, key, Icon, price, was, premium }, i) => {
            const title = t(`svc.${n}.title`);
            const cta = t(`svc.${n}.cta`);
            // Only card 1 has the "first month" note; cards 2 and 3 keep an empty spacer (from md up) so titles line up.
            const hasNote = n === 1;
            return (
              <li key={key} className={n === 3 ? "md:col-span-2 lg:col-span-1" : ""}>
                <article
                  style={{ "--i": i } as React.CSSProperties}
                  className={`svc-card relative flex h-full flex-col rounded-2xl border bg-white p-6 md:p-8 ${premium ? "svc-premium border-transparent" : "border-line shadow-sm"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className={`grid h-12 w-12 place-items-center rounded-xl ${premium ? "bg-amber text-navy" : "bg-navy text-amber"}`}>
                      <Icon className="h-6 w-6" aria-hidden />
                    </span>
                    {n === 1 && <span className="rounded-full bg-amber/15 px-3 py-1 text-xs font-semibold tracking-wide text-navy ring-1 ring-amber/40">{t("svc.1.badge")}</span>}
                  </div>
                  <div className="mt-6">
                    <p className={KICKER}>{t(`svc.${n}.label`)}</p>
                    <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className={AMOUNT}>{price}</span>
                      <span className={CURRENCY}>AZN</span>
                      <span className="ml-1 inline-flex items-baseline gap-1">
                        <span className="sr-only">{t("svc.was")}:</span>
                        <span className={WAS}>{was} AZN</span>
                      </span>
                    </p>
                    <p className={`mt-2 text-xs leading-snug text-mute md:min-h-[2.25rem] ${hasNote ? "" : "hidden md:block"}`} aria-hidden={hasNote ? undefined : true}>{hasNote ? t("svc.1.note") : null}</p>
                  </div>
                  <h3 className="mt-3 text-xl font-bold text-navy">{title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-mute">{t(`svc.${n}.desc`)}</p>
                  <a
                    href={serviceWhatsAppUrl(key)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${cta}: ${title} (${t("svc.newTab")})`}
                    className={`mt-8 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition duration-150 active:scale-[.98] ${premium ? "bg-amber text-navy hover:brightness-95" : "bg-navy text-white hover:bg-[#13294a]"}`}
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden />
                    {cta}
                  </a>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
