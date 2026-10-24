import { defineField, defineType } from "sanity";
import { REGIONS, DISTRICTS, SETTLEMENTS, METRO, BAKU_ID, isValidLocation } from "../../lib/locations.ts";
import { slugify } from "../../lib/slug.ts";

type Doc = Record<string, unknown> | undefined;
type Opt<T extends string | number> = { title: string; value: T };

// Canonical values: identical to what the website's search filters and GROQ queries use.
const TRANSACTIONS: Opt<string>[] = [{ title: "Satış", value: "sale" }, { title: "Kirayə", value: "rent" }];
const PROPERTY_TYPES: Opt<string>[] = [
  { title: "Mənzil", value: "apartment" }, { title: "Həyət / Bağ evi", value: "yard-house" }, { title: "Torpaq", value: "land" },
  { title: "Kommersiya obyekti", value: "commercial" }, { title: "Digər", value: "other" },
];
const LEGACY_TYPES = ["house", "villa"]; // old values: the website already treats them as "yard-house"
const BUILDING_TYPES: Opt<string>[] = [{ title: "Yeni tikili", value: "new" }, { title: "Köhnə tikili", value: "old" }];
const REPAIR: Opt<string>[] = [{ title: "Təmirli", value: "repaired" }, { title: "Təmirsiz", value: "unrepaired" }];
const DEED: Opt<string>[] = [{ title: "Bəli (çıxarışlı)", value: "yes" }, { title: "Xeyr (çıxarışsız)", value: "no" }];
const ROOMS: Opt<number>[] = [{ title: "1", value: 1 }, { title: "2", value: 2 }, { title: "3", value: 3 }, { title: "4", value: 4 }, { title: "5+", value: 5 }];
const MAX_ROOMS = 20;
const MAX_FLOOR = 100;

const isType = (d: Doc, ...t: string[]) => t.includes(String(d?.propertyType));
const hasFloors = (d: Doc) => isType(d, "apartment", "commercial");
// Settlements/metro exist for Bakı and for any region that has settlements in locations.ts (e.g. Abşeron rayonu).
const hasSettlements = (d: Doc) => d?.cityId === BAKU_ID || SETTLEMENTS.some((s) => s.parent === d?.cityId);
const nameOf = (id: unknown) => [...REGIONS, ...DISTRICTS].find((o) => o.id === id)?.label ?? "";
const list = (l: { id: string; label: string }[]) => l.map((o) => ({ title: o.label, value: o.id }));

const localized = (name: string, title: string, kind: "string" | "text", azRequired: boolean, description: string) =>
  defineField({
    name, title, type: "object", fieldset: "i18n", description, options: { collapsible: false },
    fields: (["az", "ru", "en"] as const).map((l) =>
      defineField({
        name: l, title: { az: "Azərbaycanca", ru: "Русский", en: "English" }[l], type: kind, ...(kind === "text" ? { rows: 4 } : {}),
        validation: (r) => {
          const max = kind === "string" ? 160 : 5000;
          if (l !== "az") return r.max(max);
          return azRequired ? r.required().min(3).max(max) : [r.max(max), r.custom((v) => (typeof v === "string" && v.trim() ? true : "Azərbaycanca təsvir tövsiyə olunur")).warning()];
        },
      }),
    ),
  });

export const property = defineType({
  name: "property",
  title: "Əmlak",
  type: "document",
  fieldsets: [
    { name: "main", title: "1. Elanın əsas məlumatları" }, { name: "features", title: "2. Əmlakın xüsusiyyətləri" }, { name: "price", title: "3. Qiymət və otaqlar" },
    { name: "place", title: "4. Ünvan və məkan" }, { name: "repairFloor", title: "5. Təmir və mərtəbə" }, { name: "media", title: "6. Şəkillər və video" },
    { name: "i18n", title: "7. Başlıq və təsvir (AZ / RU / EN)" }, { name: "other", title: "8. Digər məlumatlar" },
  ].map((f) => ({ ...f, options: { collapsible: true, collapsed: false } })),
  fields: [
    // 1. Elanın əsas məlumatları  (website filter: Satış / Kirayə, əmlak tipi)
    defineField({ name: "transaction", title: "Elanın növü", type: "string", fieldset: "main", initialValue: "sale", validation: (r) => r.required(), options: { list: TRANSACTIONS, layout: "radio", direction: "horizontal" } }),
    defineField({
      name: "propertyType", title: "Əmlakın tipi", type: "string", fieldset: "main", initialValue: "apartment", options: { list: PROPERTY_TYPES, layout: "radio" },
      description: "Saytdakı axtarışla eyni dəyərlər. «Həyət / Bağ evi» tək kateqoriyadır.",
      validation: (r) => [r.required(), r.custom((v) => !LEGACY_TYPES.includes(String(v)) || "Köhnə dəyər: «Həyət / Bağ evi» seçin (sayt hələ də düzgün göstərir).").warning()],
    }),
    // 2. Əmlakın xüsusiyyətləri  (building type, area, deed)
    defineField({ name: "buildingType", title: "Tikilinin növü", type: "string", fieldset: "features", options: { list: BUILDING_TYPES, layout: "radio", direction: "horizontal" }, description: "Torpaq üçün göstərilmir. Boş buraxsanız, «Yeni/Köhnə tikili» süzgəci bu elanı göstərməz.", hidden: ({ document }) => isType(document, "land") }),
    defineField({ name: "areaM2", title: "Sahə (m²)", type: "number", fieldset: "features", description: "Axtarışdakı «Sahə (m²)» süzgəci bu sahəyə baxır.", validation: (r) => r.positive() }),
    defineField({ name: "hasTitleDeed", title: "Sənəd / Kupça (çıxarış)", type: "string", fieldset: "features", options: { list: DEED, layout: "radio", direction: "horizontal" }, description: "Bilinmirsə boş buraxın; sayt heç bir status göstərməz." }),
    // 3. Qiymət və otaqlar
    defineField({ name: "price", title: "Qiymət", type: "number", fieldset: "price", description: "Yalnız rəqəm (məs. 250000).", validation: (r) => r.required().positive() }),
    defineField({ name: "currency", title: "Valyuta", type: "string", fieldset: "price", initialValue: "AZN", options: { list: ["AZN", "USD", "EUR"], layout: "radio", direction: "horizontal" }, description: "Saytın qiymət süzgəci AZN-dir və yalnız AZN elanlarına tətbiq olunur.", validation: (r) => r.required() }),
    defineField({
      name: "rooms", title: "Otaq sayı", type: "number", fieldset: "price", options: { list: ROOMS, layout: "radio", direction: "horizontal" }, hidden: ({ document }) => isType(document, "land"),
      description: "«5+» = 5 və daha çox (5 kimi saxlanılır; sayt ≥5 axtarır).", validation: (r) => r.integer().min(1).max(MAX_ROOMS),
    }),
    // 4. Ünvan və məkan  (ids come from lib/locations.ts)
    defineField({
      name: "cityId", title: "Şəhər / Rayon", type: "string", fieldset: "place", options: { list: list(REGIONS) },
      validation: (r) => r.required().custom((_v, ctx) => { const d = (ctx.document ?? {}) as Record<string, string | undefined>; return isValidLocation(d.cityId ?? "", d.districtId ?? "", d.settlementId ?? "") || "Ərazi seçimi uyğun deyil (rayon və qəsəbə uyğun olmalıdır)"; }),
    }),
    defineField({ name: "districtId", title: "Bakı rayonu", type: "string", fieldset: "place", options: { list: list(DISTRICTS) }, hidden: ({ document }) => document?.cityId !== BAKU_ID }),
    defineField({
      name: "settlementId", title: "Qəsəbə / Mikrorayon", type: "string", fieldset: "place", hidden: ({ document }) => !hasSettlements(document),
      description: "Siyahıda rayonun adı qabaqda yazılır; seçilmiş rayona aid olmayan qəsəbə saxlanmır.",
      options: { list: SETTLEMENTS.map((s) => ({ title: `${nameOf(s.parent)} · ${s.label}`, value: s.id })) },
    }),
    defineField({ name: "metroIds", title: "Yaxınlıqdakı metro stansiyaları", type: "array", of: [{ type: "string" }], fieldset: "place", options: { list: list(METRO) }, validation: (r) => r.unique().max(METRO.length), hidden: ({ document }) => !hasSettlements(document) }),
    defineField({ name: "address", title: "Tam ünvan (istəyə bağlı)", type: "string", fieldset: "place" }),
    defineField({ name: "areaId", title: "Köhnə ərazi sahəsi (artıq istifadə olunmur; yalnız köhnə elanlarda)", type: "string", fieldset: "place", readOnly: true, hidden: ({ document }) => !document?.areaId }),
    // 5. Təmir və mərtəbə
    defineField({ name: "repairStatus", title: "Təmir", type: "string", fieldset: "repairFloor", options: { list: REPAIR, layout: "radio", direction: "horizontal" }, description: "Bilinmirsə boş buraxın.", hidden: ({ document }) => isType(document, "land") }),
    defineField({
      name: "floor", title: "Mərtəbə", type: "number", fieldset: "repairFloor", description: "Elanın yerləşdiyi mərtəbə (1 və yuxarı).", hidden: ({ document }) => !hasFloors(document),
      validation: (r) => [
        r.integer().min(1).max(MAX_FLOOR).custom((v, ctx) => { const t = (ctx.document as { totalFloors?: number } | undefined)?.totalFloors; return v === undefined || t === undefined || v <= t || "Mərtəbə binanın mərtəbə sayından çox ola bilməz"; }),
        r.custom((v, ctx) => v !== undefined || !isType(ctx.document as Doc, "apartment") || "Mərtəbə süzgəcləri üçün mərtəbəni doldurun").warning(),
      ],
    }),
    defineField({
      name: "totalFloors", title: "Binanın mərtəbə sayı", type: "number", fieldset: "repairFloor", description: "Ən üst mərtəbə: mərtəbə = binanın mərtəbə sayı.", hidden: ({ document }) => !hasFloors(document),
      validation: (r) => [
        r.integer().min(1).max(MAX_FLOOR).custom((v, ctx) => { const f = (ctx.document as { floor?: number } | undefined)?.floor; return v === undefined || f === undefined || f <= v || "Binanın mərtəbə sayı mərtəbədən az ola bilməz"; }),
        r.custom((v, ctx) => v !== undefined || !isType(ctx.document as Doc, "apartment") || "«Yalnız ən üst» süzgəci üçün binanın mərtəbə sayını doldurun").warning(),
      ],
    }),
    // 6. Şəkillər və video
    defineField({
      name: "photos", title: "Şəkillər", type: "array", fieldset: "media", description: "Birinci şəkil kartlarda əsas şəkildir. Sıranı dəyişmək üçün sürükləyin.", validation: (r) => r.max(30), options: { layout: "grid" },
      of: [{ type: "image", options: { hotspot: true, accept: "image/jpeg,image/png,image/webp" }, fields: [{ name: "alt", title: "Alt mətn (təsvir)", type: "string" }], preview: { select: { media: "asset", title: "alt" } } }],
    }),
    defineField({ name: "video", title: "Əsas video (1 ədəd, mp4/webm)", type: "file", fieldset: "media", options: { accept: "video/mp4,video/webm" } }),
    // 7. Başlıq, slug, təsvir
    localized("title", "Başlıq", "string", true, "Azərbaycanca başlıq məcburidir; RU/EN boş qala bilər (sayt Azərbaycanca göstərir)."),
    defineField({ name: "slug", title: "Slug (URL)", type: "slug", fieldset: "i18n", options: { source: "title.az", slugify, maxLength: 80 }, validation: (r) => r.required() }),
    localized("description", "Təsvir", "text", false, "Yazdığınız mətn dəyişdirilmədən göstərilir; tərcümə yoxdursa Azərbaycanca göstərilir."),
    // 8. Digər
    defineField({ name: "featured", title: "Seçilmiş elan", type: "boolean", fieldset: "other", initialValue: false, description: "Ana səhifədə və siyahıda önə çıxarılır." }),
  ],
  preview: {
    select: { title: "title.az", tx: "transaction", price: "price", currency: "currency", city: "cityId", media: "photos.0" },
    prepare: ({ title, tx, price, currency, city, media }) => ({
      title: title || "(başlıqsız)", media,
      subtitle: [tx === "rent" ? "Kirayə" : "Satış", price ? `${price} ${currency ?? "AZN"}` : "", nameOf(city)].filter(Boolean).join(" · "),
    }),
  },
});