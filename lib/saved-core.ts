export const SAVED_KEY = "vizoohome-saved";
export const toggleId = (cur: string[], id: string): string[] => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
export function parseSaved(raw: string | null): string[] {
  try { const v = JSON.parse(raw || "[]"); return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 200) : []; } catch { return []; }
}
