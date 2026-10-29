/** Single source of truth for the property fields' canonical values. Used by the Sanity schema, the search parser and the tests. */
export const TRANSACTIONS = [{ value: "sale", title: "Satış" }, { value: "rent", title: "Kirayə" }] as const;
export const PROPERTY_TYPES = [{ value: "apartment", title: "Mənzil" }, { value: "yard-house", title: "Həyət / Bağ evi" }, { value: "land", title: "Torpaq" }, { value: "commercial", title: "Kommersiya obyekti" }, { value: "other", title: "Digər" }] as const;
/** Old documents may still hold these; the website treats them as "yard-house" (see normalizeType). */
export const LEGACY_PROPERTY_TYPES = ["house", "villa"] as const;
export const BUILDING_TYPES = [{ value: "new", title: "Yeni tikili" }, { value: "old", title: "Köhnə tikili" }, { value: "not_applicable", title: "Aid deyil" }] as const;
/** Only these two can be searched; "not_applicable" and a missing value never match a building-type filter. */
export const BUILDING_FILTER_VALUES = ["new", "old"] as const;
export const REPAIR_OPTIONS = [{ value: "repaired", title: "Təmirli" }, { value: "unrepaired", title: "Təmirsiz" }] as const;
export const TITLE_DEED_OPTIONS = [{ value: "yes", title: "Çıxarışlı" }, { value: "no", title: "Çıxarışsız" }] as const;
export const CURRENCIES = ["AZN", "USD", "EUR"] as const;
/** Rooms are stored as a real integer. The "5+" choice is stored as 5; the website's 5+ filter matches rooms >= 5, so older real values like 6 or 7 still match. */
export const ROOM_OPTIONS = [{ value: 1, title: "1" }, { value: 2, title: "2" }, { value: 3, title: "3" }, { value: 4, title: "4" }, { value: 5, title: "5+" }] as const;
export const MAX_ROOMS = 20;
export const MAX_FLOOR = 100;
export const TYPES_WITHOUT_BUILDING = ["land"] as const;
export const TYPES_WITH_FLOORS = ["apartment", "commercial"] as const;
