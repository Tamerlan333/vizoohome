"use client";
import { useEffect, useRef } from "react";
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
  const listRef = useRef<HTMLUListElement>(null);

  // Fade-up each card once, the first time it enters the viewport. This writes a data attribute straight to the DOM
  // (no React state, so no re-render), stops watching each card once it is revealed, and disconnects when all are done.
  // Without IntersectionObserver or with reduced motion, every card is shown immediately.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const items = Array.from(list.children) as HTMLElement[];
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      items.forEach((li) => li.setAttribute("data-in", ""));
      return;
    }
    let pending = items.length;
    const io = new IntersectionObserver((entries) => {
      let order = 0; // stagger only cards that appear together (all 3 on desktop; one at a time when stacked on mobile)
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const li = entry.target as HTMLElement;
        li.style.setProperty("--i", String(order++));
        li.setAttribute("data-in", "");
        io.unobserve(li);
        if (--pending === 0) io.disconnect();
      }
    }, { threshold: 0.15 });
    items.forEach((li) => io.observe(li));
    return () => io.disconnect();
  }, []);

  return (
    <section aria-labelledby="svc-title" className="svc mx-auto mt-16 max-w-site px-4 md:px-10">
      <noscript><style>{".svc-list>li{opacity:1!important;transform:none!important}"}</style></noscript>
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="svc-title" className="text-[clamp(1.6rem,3.5vw,2.25rem)] font-bold text-navy">{t("svc.title")}</h2>
        </div>
        <ul ref={listRef} className="svc-list mt-8 grid gap-6 md:mt-10 md:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map(({ n, key, Icon, price, was }) => {
            const title = t(`svc.${n}.title`);
            const cta = t(`svc.${n}.cta`);
            // Only card 1 has the "first month" note; cards 2 and 3 keep an empty spacer (from md up) so titles line up.
            const hasNote = n === 1;
            return (
              <li key={key} className={n === 3 ? "md:col-span-2 lg:col-span-1" : ""}>
                <article
                  className="svc-card relative flex h-full flex-col rounded-2xl border bg-white p-6 md:p-8"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-xl bg-navy text-amber">
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
                    className="svc-btn mt-8 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold active:scale-[.98]"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden />
                    {cta}
                  </a>
                </article>
              </li>
            );
          })}
        </ul>
    </section>
  );
}
