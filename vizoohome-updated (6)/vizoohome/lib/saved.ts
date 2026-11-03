"use client";
import { useSyncExternalStore } from "react";
import { SAVED_KEY, parseSaved, toggleId } from "./saved-core";
const EMPTY: string[] = [];
let cache: string[] | null = null;
const listeners = new Set<() => void>();
const read = () => { try { return parseSaved(localStorage.getItem(SAVED_KEY)); } catch { return EMPTY; } };
const snapshot = () => (cache ??= read());
const emit = () => listeners.forEach((l) => l());
export function toggleSaved(id: string) {
  const next = toggleId(snapshot(), id); cache = next;
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /* storage blocked: stays in memory for this tab */ }
  emit();
}
export function removeSaved(ids: string[]) {
  const next = snapshot().filter((x) => !ids.includes(x)); cache = next;
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  emit();
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === SAVED_KEY) { cache = read(); emit(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
}
export function useSaved() {
  const ids = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  return { ids, isSaved: (id: string) => ids.includes(id), toggle: toggleSaved };
}
