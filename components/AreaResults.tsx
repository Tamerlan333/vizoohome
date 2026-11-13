"use client";
/**
 * Shared draw-to-search state for /properties: the map publishes the area it holds, the results follow it instantly.
 * Listings are only shown when the server-rendered results belong to the area currently on the map (lib/area-results.ts),
 * so clearing hides everything at once and a newly drawn area never shows the previous area's results.
 */
import { createContext, useContext, useState, type ComponentProps, type ReactNode } from "react";
import Link from "next/link";
import { Map as MapIcon } from "lucide-react";
import { areaResultsState, type AreaResultsState } from "@/lib/area-results";
import { useI18n } from "@/lib/i18n/client";

interface AreaSelection {
  /** "poly" value of the area on the map ("" = none). */
  clientParam: string;
  /** "poly" value the current server results were rendered for ("" = none). */
  serverParam: string;
  setClientParam: (param: string) => void;
}

const Ctx = createContext<AreaSelection | null>(null);

/** Starts from the server's value, so the first client render matches the server HTML (no hydration mismatch). */
export function AreaProvider({ serverParam, children }: { serverParam: string; children: ReactNode }) {
  const [clientParam, setClientParam] = useState(serverParam);
  return <Ctx.Provider value={{ clientParam, serverParam, setClientParam }}>{children}</Ctx.Provider>;
}

/** null outside an AreaProvider (the map then behaves as before and shows every item it receives). */
export const useAreaSelection = () => useContext(Ctx);

function useAreaState(): AreaResultsState {
  const ctx = useContext(Ctx);
  return ctx ? areaResultsState(ctx.clientParam, ctx.serverParam) : "ready";
}

/** Renders its children only when the results belong to the selected area (nothing otherwise). */
export function AreaGate({ children }: { children: ReactNode }) {
  return useAreaState() === "ready" ? <>{children}</> : null;
}

/** The listing section: the "select an area" message, an "updating" status, or the results. */
export function AreaResults({ children }: { children: ReactNode }) {
  const state = useAreaState();
  const { t } = useI18n();

  if (state === "ready") return <>{children}</>;

  if (state === "pending") {
    return (
      <div role="status" className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-6 text-sm text-mute">
        <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-amber border-t-transparent" />
        {t("map.status.updating")}
      </div>
    );
  }

  return (
    <div role="status" className="anim-up flex flex-col items-center gap-3 rounded-xl border border-dashed border-line bg-white px-6 py-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-amber/15 text-navy">
        <MapIcon className="h-6 w-6" aria-hidden />
      </span>
      <h2 className="text-lg font-semibold text-navy">{t("map.empty.title")}</h2>
      <p className="max-w-md text-sm text-mute">{t("map.empty.body")}</p>
    </div>
  );
}

/** "Remove area" link: hides the results immediately, then navigates to the URL without "poly". */
export function ClearAreaLink({ onClick, ...props }: ComponentProps<typeof Link>) {
  const ctx = useContext(Ctx);
  return (
    <Link
      {...props}
      onClick={(e) => {
        onClick?.(e);
        // A plain click navigates in this tab; modified clicks (new tab/window) must not hide this tab's results.
        if (!e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) ctx?.setClientParam("");
      }}
    />
  );
}
