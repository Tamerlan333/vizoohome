"use client";

/**
 * Property detail map: the SAME MapLibre setup as the search map (getMapConfig style, NavigationControl, shared marker
 * look from lib/map-markers), with exactly one marker, the listing's own stored coordinates, centred at PIN_ZOOM.
 * No drawing, no other listings. Rendered by PropertyDetail only when detailMarker(p) found valid coordinates.
 * maplibre-gl is imported inside the effect, so it never runs on the server and only loads on detail pages with a pin.
 */
import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

import { PIN_ZOOM, getMapConfig } from "@/lib/map-config";
import { isValidCoordinate } from "@/lib/geo";
import { markerStyle } from "@/lib/map-markers";
import { useI18n } from "@/lib/i18n/client";

type Status = "loading" | "ready" | "error";

export default function PropertyLocationMap({ lat, lng, title }: { lat: number; lng: number; title: string }) {
  const { t } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const config = getMapConfig(process.env.NEXT_PUBLIC_MAPTILER_KEY, process.env.NEXT_PUBLIC_MAP_STYLE);
  const styleUrl = config.ok ? config.styleUrl : null;
  const valid = isValidCoordinate(lat, lng);
  // Texts for the "use two fingers / Ctrl + scroll" overlay (the map never traps page scrolling).
  const gestureText = {
    win: t("map.gesture.win"),
    mac: t("map.gesture.mac"),
    mobile: t("map.gesture.mobile"),
  };
  const textRef = useRef(gestureText);
  textRef.current = gestureText;

  useEffect(() => {
    if (!styleUrl || !valid || !box.current) return;
    let cancelled = false;
    let map: MapLibreMap | null = null;

    (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (cancelled || !box.current) return;
        const text = textRef.current;
        map = new ml.Map({
          container: box.current,
          style: styleUrl,
          center: [lng, lat],
          zoom: PIN_ZOOM,
          cooperativeGestures: true,
          dragRotate: false,
          locale: {
            "CooperativeGesturesHandler.WindowsHelpText": text.win,
            "CooperativeGesturesHandler.MacHelpText": text.mac,
            "CooperativeGesturesHandler.MobileHelpText": text.mobile,
          },
        });
        map.touchZoomRotate.disableRotation();
        map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");

        const element = document.createElement("div");
        element.setAttribute("role", "img");
        element.setAttribute("aria-label", title);
        Object.assign(element.style, markerStyle(22), { cursor: "default" });
        new ml.Marker({ element, anchor: "center" }).setLngLat([lng, lat]).addTo(map);

        map.on("load", () => { if (!cancelled) setStatus("ready"); });
        map.on("error", () => { if (!cancelled && !map?.loaded()) setStatus("error"); });
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [styleUrl, valid, lat, lng, title]);

  if (!valid) return null;

  if (!config.ok) {
    return (
      <p role="status" className="mt-3 rounded-xl border border-line bg-soft p-4 text-sm text-mute">
        {t(config.reason === "missing_key" ? "map.missingKey" : "map.invalidKey")}
      </p>
    );
  }

  return (
    <div className="relative mt-3 w-full overflow-hidden rounded-2xl border border-line bg-[#F3F4F6]">
      <div ref={box} className="h-[300px] w-full md:h-[420px]" aria-label={t("d.map.aria", { title })} role="region" />
      {status !== "ready" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-mute" role="status">
          {status === "loading" ? t("map.loading") : t("map.failed")}
        </div>
      )}
    </div>
  );
}
