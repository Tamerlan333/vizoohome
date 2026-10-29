import { defineField, defineType } from "sanity";
import { REGIONS, DISTRICTS, SETTLEMENTS, METRO, BAKU_ID, ABSERON_ID, isValidLocation, labelOf } from "../../lib/locations.ts";
import { slugify } from "../../lib/slug.ts";
import { isValidPhone } from "../../lib/phone.ts";
import { BUILDING_TYPES, CURRENCIES, LEGACY_PROPERTY_TYPES, MAX_FLOOR, MAX_ROOMS, PROPERTY_TYPES, REPAIR_OPTIONS, ROOM_OPTIONS, TITLE_DEED_OPTIONS, TRANSACTIONS, TYPES_WITHOUT_BUILDING, TYPES_WITH_FLOORS } from "../../lib/property-fields.ts";
type Doc = Record<string, unknown> | undefined;
const opts = <T extends string | number>(l: readonly { title: string; value: T }[]) => l.map((o) => ({ title: o.title, value: o.value }));
const list = (l: { id: string; label: string }[]) => l.map((o) => ({ title: o.label, value: o.id }));
const isType = (d: Doc, ...t: readonly string[]) => t.includes(String(d?.propertyType));
const baku = (d: Doc) => d?.cityId === BAKU_ID || d?.cityId === ABSERON_ID;
const localized = (name: string, title: string, kind: "string" | "text", az: "required" | "recommended", fieldset: string, description: string) =>
  defineField({ name, title, type: "object", fieldset, description, options: { collapsible: false },
    fields: (["az", "ru", "en"] as const).map((l) => defineField({ name: l, title: { az: "Azərbaycanca", ru: "Русский", en: "English" }[l], type: kind, ...(kind === "text" ? { rows: 4 } : {}),
      validation: (r) => l !== "az" ? r.max(kind === "string" ? 160 : 5000)
        : az === "required" ? r.required().min(3).max(kind === "string" ? 160 : 5000)
        : [r.max(5000), r.custom((v) => (typeof v === "string" && v.trim() ? true : "Azərbaycanca təsvir tövsiyə olunur")).warning()] })) });
export const property = defineType({
  name: "property", title: "Əmlak", type: "document",
  fieldsets: [
    { name: "main", title: "1. Elanın əsas məlumatları" }, { name: "features", title: "2. Əmlakın xüsusiyyətləri" }, { name: "price", title: "3. Qiymət və otaqlar" },
    { name: "place", title: "4. Ünvan və məkan" }, { name: "repairFloor", title: "5. Təmir və mərtəbə" }, { name: "media", title: "6. Şəkillər və video" },
    { name: "i18n", title: "7. Çoxdilli başlıq və təsvir" }, { name: "other", title: "8. Əlaqə və digər məlumatlar" },
  ].map((f) => ({ ...f, options: { collapsible: true, collapsed: false } })),
  fields: [
    defineField({ name: "transaction", title: "Elanın növü", type: "string", fieldset: "main", initialValue: "sale", validation: (r) => r.required(), options: { list: opts(TRANSACTIONS), layout: "radio", direction: "horizontal" } }),
    defineField({ name: "propertyType", title: "Əmlakın tipi", type: "string", fieldset: "main", initialValue: "apartment",
      description: "Saytdakı axtarış süzgəci ilə eyni dəyərlər. «Həyət / Bağ evi» tək kateqoriyadır.", options: { list: opts(PROPERTY_TYPES), layout: "radio" },
      validation: (r) => [r.required(), r.custom((v) => !(LEGACY_PROPERTY_TYPES as readonly string[]).includes(String(v)) || "Köhnə dəyər: «Həyət / Bağ evi» seçin (sayt hələ də düzgün göstərir).").warning()] }),
    defineField({ name: "buildingType", title: "Tikilinin növü", type: "string", fieldset: "features", options: { list: opts(BUILDING_TYPES), layout: "radio", direction: "horizontal" },
      description: "Boş buraxsanız, saytdakı «Yeni/Köhnə tikili» süzgəci bu elanı göstərməz. Uyğun deyilsə «Aid deyil» seçin.", hidden: ({ document }) => isType(document, ...TYPES_WITHOUT_BUILDING) }),
    defineField({ name: "areaM2", title: "Sahə (m²)", type: "number", fieldset: "features", description: "Axtarışdakı «Sahə» süzgəci bu sahəyə baxır.", validation: (r) => r.positive() }),
    defineField({ name: "hasTitleDeed", title: "Sənəd (çıxarış)", type: "string", fieldset: "features", description: "Bilinmirsə boş buraxın; sayt heç bir status göstərməz.", options: { list: opts(TITLE_DEED_OPTIONS), layout: "radio", direction: "horizontal" } }),
    defineField({ name: "price", title: "Qiymət", type: "number", fieldset: "price", description: "Yalnız rəqəm (məs. 250000). Sayt qiyməti avtomatik formatlayır.", validation: (r) => r.required().positive() }),
    defineField({ name: "currency", title: "Valyuta", type: "string", fieldset: "price", initialValue: "AZN", options: { list: [...CURRENCIES], layout: "radio", direction: "horizontal" }, description: "Qiymət süzgəci AZN-dir və yalnız AZN elanlarına tətbiq olunur; məzənnə çevrilməsi aparılmır.", validation: (r) => r.required() }),
    defineField({ name: "rooms", title: "Otaq sayı", type: "number", fieldset: "price", options: { list: opts(ROOM_OPTIONS), layout: "radio", direction: "horizontal" }, hidden: ({ document }) => isType(document, "land"),
      description: "«5+» = 5 və daha çox (5 kimi saxlanılır; sayt ≥5 axtarır). Köhnə 6, 7... dəyərləri olduğu kimi qalır.", validation: (r) => r.integer().min(1).max(MAX_ROOMS) }),
    defineField({ name: "cityId", title: "Şəhər / Rayon", type: "string", fieldset: "place", options: { list: list(REGIONS) },
      validation: (r) => r.required().custom((_v, ctx) => { const d = (ctx.document ?? {}) as Record<string, string | undefined>; return isValidLocation(d.cityId ?? "", d.districtId ?? "", d.settlementId ?? "") || "Ərazi seçimi uyğun deyil (rayon və qəsəbə uyğun olmalıdır)"; }) }),
    defineField({ name: "districtId", title: "Bakı rayonu", type: "string", fieldset: "place", options: { list: list(DISTRICTS) }, hidden: ({ document }) => document?.cityId !== BAKU_ID }),
    defineField({ name: "settlementId", title: "Qəsəbə / Mikrorayon", type: "string", fieldset: "place", description: "Siyahıda rayonun adı qabaqda yazılır; rayona uyğun olmayan seçim saxlanmır.",
      options: { list: SETTLEMENTS.map((x) => ({ title: `${labelOf(x.parent)} · ${x.label}`, value: x.id })) }, hidden: ({ document }) => !baku(document) }),
    defineField({ name: "metroIds", title: "Yaxınlıqdakı metro stansiyaları", type: "array", of: [{ type: "string" }], fieldset: "place", options: { list: list(METRO) }, validation: (r) => r.unique().max(25), hidden: ({ document }) => !baku(document) }),
    defineField({ name: "address", title: "Tam ünvan (istəyə bağlı)", type: "string", fieldset: "place" }),
    defineField({ name: "areaId", title: "Köhnə ərazi sahəsi (artıq istifadə olunmur; yalnız köhnə elanlarda)", type: "string", fieldset: "place", readOnly: true, hidden: ({ document }) => !document?.areaId }),
    defineField({ name: "repairStatus", title: "Təmir", type: "string", fieldset: "repairFloor", options: { list: opts(REPAIR_OPTIONS), layout: "radio", direction: "horizontal" }, description: "Bilinmirsə boş buraxın; şəkil və ya təsvirdən təxmin edilmir.", hidden: ({ document }) => isType(document, "land") }),
    defineField({ name: "floor", title: "Mərtəbə", type: "number", fieldset: "repairFloor", description: "Elanın yerləşdiyi mərtəbə (1 və yuxarı).", hidden: ({ document }) => !isType(document, ...TYPES_WITH_FLOORS),
      validation: (r) => [r.integer().min(1).max(MAX_FLOOR).custom((v, ctx) => { const t = (ctx.document as { totalFloors?: number } | undefined)?.totalFloors; return v === undefined || t === undefined || v <= t || "Mərtəbə binanın mərtəbə sayından çox ola bilməz"; }),
        r.custom((v, ctx) => v !== undefined || !isType(ctx.document as Doc, "apartment") || "«Yalnız ən üst» və mərtəbə süzgərləri üçün mərtəbəni doldurun").warning()] }),
    defineField({ name: "totalFloors", title: "Binanın mərtəbə sayı", type: "number", fieldset: "repairFloor", description: "Ən üst mərtəbə: mərtəbə = binanın mərtəbə sayı.", hidden: ({ document }) => !isType(document, ...TYPES_WITH_FLOORS),
      validation: (r) => [r.integer().min(1).max(MAX_FLOOR).custom((v, ctx) => { const f = (ctx.document as { floor?: number } | undefined)?.floor; return v === undefined || f === undefined || f <= v || "Binanın mərtəbə sayı mərtəbədən az ola bilməz"; }),
        r.custom((v, ctx) => v !== undefined || !isType(ctx.document as Doc, "apartment") || "«Yalnız ən üst» süzgəci üçün binanın mərtəbə sayını doldurun").warning()] }),
    defineField({ name: "photos", title: "Şəkillər", type: "array", fieldset: "media", description: "Birinci şəkil kartlarda əsas şəkildir. Sıranı dəyişmək üçün sürükləyin.", validation: (r) => r.max(30), options: { layout: "grid" },
      of: [{ type: "image", options: { hotspot: true, accept: "image/jpeg,image/png,image/webp" }, fields: [{ name: "alt", title: "Alt mətn (təsvir)", type: "string" }], preview: { select: { media: "asset", title: "alt" } } }] }),
    defineField({ name: "video", title: "Əsas video (1 ədəd, mp4/webm)", type: "file", fieldset: "media", options: { accept: "video/mp4,video/webm" } }),
    localized("title", "Başlıq", "string", "required", "i18n", "Azərbaycanca başlıq məcburidir; RU/EN boş qala bilər (sayt Azərbaycanca göstərir)."),
    defineField({ name: "slug", title: "Slug (URL)", type: "slug", fieldset: "i18n", options: { source: "title.az", slugify, maxLength: 80 }, validation: (r) => r.required() }),
    localized("description", "Təsvir", "text", "recommended", "i18n", "Siz yazdığınız mətn dəyişdirilmədən göstərilir; tərcümə olunmayıbsa Azərbaycanca göstərilir."),
    defineField({
  name: "contactPhone",
  title: "Əlaqə nömrəsi",
  type: "string",
  fieldset: "other",
  placeholder: "+994 XX XXX XX XX",
  description: "Bu elan üçün elan sahibinin və ya səlahiyyətli əlaqə şəxsin telefon nömrəsini daxil edin.",
  validation: (r) =>
    r.custom((v) =>
      typeof v !== "string" || !v.trim() || isValidPhone(v)
        ? true
        : "Düzgün nömrə daxil edin (məs. +994 50 123 45 67 və ya 050 123 45 67)"
    ),
}),
defineField({
  name: "featured",
  title: "Seçilmiş elan",
  type: "boolean",
  fieldset: "other",
  initialValue: false,
  description: "Ana səhifədə və siyahıda önə çıxarılır.",
}),
