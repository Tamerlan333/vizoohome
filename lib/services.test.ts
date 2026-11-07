import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
import { SERVICE_MESSAGES, serviceWhatsAppUrl, ownerWhatsAppUrl, OWNER_MESSAGE, buyerWhatsAppUrl } from "./whatsapp.ts"; import { DICT, LANGS } from "./i18n/dict.ts";
const keys = ["presentation", "shooting", "realtor"] as const; const BASE = "https://wa.me/994993632026?text=";
test("three WhatsApp links: correct business number and the exact messages", () => {
  const exp = { presentation: "Salam! VizooHome əmlakın peşəkar təqdimatı xidməti ilə maraqlanıram. Ətraflı məlumat verə bilərsiniz?", shooting: "Salam! VizooHome çəkiliş paketi ilə maraqlanıram. Ətraflı məlumat verə bilərsiniz?", realtor: "Salam! VizooHome Rieltor paketi ilə maraqlanıram. Ətraflı məlumat verə bilərsiniz?" };
  for (const k of keys) { const u = serviceWhatsAppUrl(k); assert.ok(u.startsWith(BASE), k); assert.equal(decodeURIComponent(u.slice(BASE.length)), exp[k]); assert.equal(SERVICE_MESSAGES[k], exp[k]); }
  assert.equal(new Set(keys.map(serviceWhatsAppUrl)).size, 3, "each card has a different message"); });
test("no price anywhere in the messages or URLs; Azerbaijani letters are URL-encoded", () => {
  for (const k of keys) { const u = serviceWhatsAppUrl(k), m = SERVICE_MESSAGES[k]; assert.ok(!/350|650|AZN|manat/i.test(u + m), k); assert.ok(!/\d/.test(u.slice(BASE.length).replace(/%[0-9A-F]{2}/g, "")), "no digits in the message text"); assert.ok(!/[əıöüçşğƏİÖÜÇŞĞ ]/.test(u), "no raw special characters or spaces in the URL"); assert.ok(u.includes("%C9%99")); } });
test("existing WhatsApp links are unchanged", () => { assert.equal(ownerWhatsAppUrl, BASE + encodeURIComponent("Salam!Mən evimi satmaq istəyirəm.")); assert.equal(OWNER_MESSAGE, "Salam!Mən evimi satmaq istəyirəm."); assert.equal(buyerWhatsAppUrl("X"), BASE + encodeURIComponent("Salam! X elanı haqqında məlumat almaq istəyirəm.")); });
test("Azerbaijani texts are exactly as specified; RU and EN exist for every key", () => {
  const az: Record<string, string> = { "svc.title": "Xidmətlərimiz və Paketlərimiz", "svc.sub": "Əmlakınızı daha effektiv təqdim edin və satış prosesində peşəkar dəstək əldə edin.", "svc.1.title": "Əmlakın Peşəkar Təqdimatı", "svc.1.desc": "Əmlakınızı VizooHome platformasında təqdim edin və potensial alıcılara daha rahat çatın.", "svc.1.cta": "Müraciət et",
    "svc.2.title": "Çəkiliş Paketi", "svc.2.desc": "Əmlakınızın təqdimatı üçün peşəkar çəkiliş xidməti.", "svc.2.cta": "Paketi seç", "svc.3.title": "Rieltor Paketi", "svc.3.desc": "Əmlakınızın təqdimatı və satış prosesində rieltor dəstəyi üçün premium xidmət paketi.", "svc.3.cta": "Paketi seç" };
  for (const [k, v] of Object.entries(az)) assert.equal(DICT.az[k], v, k); for (const l of LANGS) for (const k of [...Object.keys(az), "svc.newTab"]) assert.ok(DICT[l][k]?.trim(), `${l}:${k}`);
  for (const l of LANGS) for (const k of Object.keys(az)) assert.ok(!/350|650/.test(DICT[l][k]), "prices are not translated text"); });
test("homepage: old banner replaced, new section in place, unrelated files untouched", () => {
  const page = fs.readFileSync("app/(site)/page.tsx", "utf8"); assert.ok(page.includes("<ServicesSection />") && !page.includes('t("sub.title")') && !page.includes("ownerWhatsAppUrl")); assert.ok(page.trimEnd().endsWith("</>);\n}".trimEnd()) || page.includes("<ServicesSection /></>"));
  assert.ok(page.indexOf("PropertyCard key") < page.indexOf("<ServicesSection />"), "after the listings, before the footer (footer lives in the layout)");
  const c = fs.readFileSync("components/ServicesSection.tsx", "utf8"); assert.ok(c.includes('target="_blank"') && c.includes('rel="noopener noreferrer"')); assert.equal((c.match(/serviceWhatsAppUrl\(/g) ?? []).length, 1); assert.ok(!/350|650/.test(c.replace(/price: "(350|650)"/g, "")), "package prices appear only in the data table"); });
test("styles: reveal never leaves content hidden under reduced motion", () => {
  const css = fs.readFileSync("app/globals.css", "utf8"); assert.ok(/@media \(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{transition:none!important;animation:none!important/.test(css));
  assert.ok(css.includes('.svc[data-shown="false"] .svc-card{opacity:0')); assert.ok(css.includes("backwards"), "hover transform must not be overridden by a filled animation"); });

test("pricing: all three cards show promo price + struck-through original price, exact values", () => {
  const c = fs.readFileSync("components/ServicesSection.tsx", "utf8");
  assert.ok(c.includes('{ n: 1, key: "presentation", Icon: Building2, price: "15", was: "30" }')); assert.ok(c.includes('{ n: 2, key: "shooting", Icon: Camera, price: "350", was: "450" }')); assert.ok(c.includes('{ n: 3, key: "realtor", Icon: Handshake, price: "650", was: "850", premium: true }'));
  assert.equal((c.match(/was: "/g) ?? []).length, 3); assert.ok(c.includes("line-through") && c.includes('<span className={WAS}>{was} AZN</span>') && c.includes('<span className={AMOUNT}>{price}</span>')); });
test("labels and badge: exact Azerbaijani, natural RU/EN, first-month note on card 1 only", () => {
  const az: Record<string, string> = { "svc.1.badge": "50% ENDİRİM", "svc.1.label": "İLK AY ÜÇÜN XÜSUSİ TƏKLİF", "svc.1.note": "15 AZN yalnız ilk ay üçün keçərlidir.", "svc.2.label": "XÜSUSİ TƏKLİF", "svc.3.label": "PREMIUM TƏKLİF", "svc.was": "Əvvəlki qiymət" };
  for (const [k, v] of Object.entries(az)) assert.equal(DICT.az[k], v, k); for (const l of LANGS) for (const k of Object.keys(az)) assert.ok(DICT[l][k]?.trim(), `${l}:${k}`);
  assert.equal(DICT.ru["svc.1.badge"], "СКИДКА 50%"); assert.equal(DICT.en["svc.1.badge"], "50% OFF"); assert.equal(DICT.ru["svc.2.label"], "СПЕЦИАЛЬНОЕ ПРЕДЛОЖЕНИЕ"); assert.equal(DICT.en["svc.2.label"], "SPECIAL OFFER"); assert.equal(DICT.ru["svc.3.label"], "ПРЕМИУМ-ПРЕДЛОЖЕНИЕ"); assert.equal(DICT.en["svc.3.label"], "PREMIUM OFFER");
  assert.ok(/15/.test(DICT.ru["svc.1.note"]) && /15/.test(DICT.en["svc.1.note"])); assert.ok(!("svc.2.note" in DICT.az) && !("svc.3.note" in DICT.az), "no invented conditions for cards 2 and 3");
  for (const l of LANGS) for (const k of ["svc.2.label", "svc.3.label"]) assert.ok(!/\d/.test(DICT[l][k]), "no numbers or percentages invented for cards 2 and 3"); });
test("pricing typography: one shared, lighter style for all three prices", () => {
  const c = fs.readFileSync("components/ServicesSection.tsx", "utf8"); const get = (n: string) => new RegExp(`const ${n} = "([^"]+)"`).exec(c)?.[1] ?? "";
  const amount = get("AMOUNT"), cur = get("CURRENCY"), was = get("WAS"); assert.ok(amount && cur && was);
  assert.ok(/font-medium/.test(amount) && !/font-(bold|extrabold|black|semibold)/.test(amount), "amount is medium weight (500)"); assert.ok(/text-\[2\.5rem\]/.test(amount));
  assert.ok(/font-normal/.test(cur) && /text-sm/.test(cur) && /font-normal/.test(was) && /text-sm/.test(was), "currency and old price are smaller and lighter");
  assert.equal((c.match(/className=\{AMOUNT\}/g) ?? []).length, 1, "one shared amount element for every card"); assert.ok(!c.includes("text-5xl") && !c.includes("font-extrabold")); });
test("WhatsApp messages still contain no price (including the discount numbers)", () => {
  for (const k of ["presentation", "shooting", "realtor"] as const) { const m = SERVICE_MESSAGES[k]; assert.ok(!/\d|AZN|ENDİRİM/i.test(m), k); assert.ok(!/(^|[^0-9])(15|30|350|450|650|850)([^0-9]|$)/.test(decodeURIComponent(serviceWhatsAppUrl(k)))); } });
