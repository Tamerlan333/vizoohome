import { defineField, defineType } from "sanity";
import { REGIONS, DISTRICTS, SETTLEMENTS, METRO, BAKU_ID, ABSERON_ID, isValidLocation, labelOf } from "../../lib/locations.ts";
import { slugify } from "../../lib/slug.ts";
const list = (l: { id: string; label: string }[]) => l.map((o) => ({ title: o.label, value: o.id }));
const localized = (name: string, title: string, kind: "string" | "text", required: boolean) =>
  defineField({ name, title, type: "object", validation: (r) => (required ? r.required() : r),
    fields: (["az", "ru", "en"] as const).map((l) => defineField({ name: l, title: l.toUpperCase(), type: kind, ...(kind === "text" ? { rows: 4 } : {}),
      validation: (r) => (l === "az" && required ? r.required().min(3).max(kind === "string" ? 160 : 5000) : r.max(kind === "string" ? 160 : 5000)) })) });
export const property = defineType({
  name: "property", title: "Əmlak", type: "document",
  fields: [
    localized("title", "Başlıq", "string", true),
    defineField({ name: "slug", title: "Slug (URL)", type: "slug", options: { source: "title.az", slugify, maxLength: 80 }, validation: (r) => r.required() }),
    defineField({ name: "transaction", title: "Əməliyyat", type: "string", initialValue: "sale", validation: (r) => r.required(),
      options: { list: [{ title: "Satış", value: "sale" }, { title: "Kirayə", value: "rent" }], layout: "radio" } }),
    defineField({ name: "propertyType", title: "Əmlak tipi", type: "string", initialValue: "apartment", validation: (r) => r.required(),
      options: { list: [{ title: "Mənzil", value: "apartment" }, { title: "Həyət/Bağ evi", value: "yard-house" }, { title: "Torpaq", value: "land" }, { title: "Kommersiya obyekti", value: "commercial" }, { title: "Digər", value: "other" }] } }),
    defineField({ name: "cityId", title: "Şəhər / Rayon", type: "string", options: { list: list(REGIONS) },
      validation: (r) => r.required().custom((_v, ctx) => { const d = (ctx.document ?? {}) as Record<string, string | undefined>; return isValidLocation(d.cityId ?? "", d.districtId ?? "", d.settlementId ?? "") || "Ərazi seçimi uyğun deyil (rayon və qəsəbə uyğun olmalıdır)"; }) }),
    defineField({ name: "districtId", title: "Bakı rayonu", type: "string", options: { list: list(DISTRICTS) }, hidden: ({ document }) => document?.cityId !== BAKU_ID }),
    defineField({ name: "settlementId", title: "Qəsəbə / Mikrorayon (rayon adı ilə birlikdə göstərilir)", type: "string",
      options: { list: SETTLEMENTS.map((x) => ({ title: `${labelOf(x.parent)} · ${x.label}`, value: x.id })) }, hidden: ({ document }) => document?.cityId !== BAKU_ID && document?.cityId !== ABSERON_ID }),
    defineField({ name: "metroIds", title: "Yaxınlıqdakı metro stansiyaları", type: "array", of: [{ type: "string" }], options: { list: list(METRO) }, validation: (r) => r.unique().max(25), hidden: ({ document }) => document?.cityId !== BAKU_ID && document?.cityId !== ABSERON_ID }),
    defineField({ name: "areaId", title: "Köhnə ərazi sahəsi (artıq istifadə olunmur; yalnız köhnə elanlarda)", type: "string", readOnly: true, hidden: ({ document }) => !document?.areaId }),
    defineField({ name: "address", title: "Tam ünvan (istəyə bağlı)", type: "string" }),
    defineField({ name: "buildingType", title: "Tikilinin növü", type: "string", options: { list: [{ title: "Yeni tikili", value: "new" }, { title: "Köhnə tikili", value: "old" }], layout: "radio" }, hidden: ({ document }) => document?.propertyType === "land" }),
    defineField({ name: "floor", title: "Mərtəbə", type: "number", validation: (r) => r.integer().min(0).max(100), hidden: ({ document }) => !["apartment", "commercial"].includes(String(document?.propertyType)) }),
    defineField({ name: "totalFloors", title: "Binanın mərtəbə sayı", type: "number",
      validation: (r) => r.integer().min(1).max(100).custom((v, ctx) => { const f = (ctx.document as { floor?: number } | undefined)?.floor; return v === undefined || f === undefined || f <= v || "Mərtəbə binanın mərtəbə sayından çox ola bilməz"; }),
      hidden: ({ document }) => !["apartment", "commercial"].includes(String(document?.propertyType)) }),
    defineField({ name: "repairStatus", title: "Təmir vəziyyəti (bilinmirsə boş buraxın)", type: "string", options: { list: [{ title: "Təmirli", value: "repaired" }, { title: "Təmirsiz", value: "unrepaired" }], layout: "radio" }, hidden: ({ document }) => document?.propertyType === "land" }),
    defineField({ name: "hasTitleDeed", title: "Sənəd (bilinmirsə boş buraxın)", type: "string", options: { list: [{ title: "Çıxarışlı", value: "yes" }, { title: "Çıxarışsız", value: "no" }], layout: "radio" } }),
    defineField({ name: "price", title: "Qiymət", type: "number", validation: (r) => r.required().min(0) }),
    defineField({ name: "currency", title: "Valyuta", type: "string", initialValue: "AZN", options: { list: ["AZN", "USD", "EUR"] }, validation: (r) => r.required() }),
    defineField({ name: "rooms", title: "Otaq sayı", type: "number", hidden: ({ document }) => document?.propertyType === "land", validation: (r) => r.integer().min(1).max(20) }),
    defineField({ name: "areaM2", title: "Sahə (m²)", type: "number", validation: (r) => r.positive() }),
    localized("description", "Təsvir", "text", false),
    defineField({ name: "video", title: "Əsas video (1 ədəd, mp4/webm)", type: "file", options: { accept: "video/mp4,video/webm" } }),
    defineField({ name: "photos", title: "Fotolar", type: "array", validation: (r) => r.max(30),
      of: [{ type: "image", options: { hotspot: true, accept: "image/jpeg,image/png,image/webp" }, fields: [{ name: "alt", title: "Alt mətn", type: "string" }] }] }),
    defineField({ name: "featured", title: "Seçilmiş", type: "boolean", initialValue: false }),
  ],
  preview: { select: { title: "title.az", subtitle: "cityId", media: "photos.0" } },
});
