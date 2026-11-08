"use client";
/**
 * MapLibre map for the property location pin (Studio). Loaded on demand by PropertyLocationInput (React.lazy), so a map is only
 * created when an editor clicks "Xəritədə seç". Click the map or drag the pin to choose the position.
 *
 * - maplibre-gl is imported dynamically inside the effect: it never runs on the server and never loads until the map opens.
 * - The map is created once per mount (safe with React StrictMode) and removed on unmount.
 * - MapLibre's attribution control stays enabled (MapTiler / OpenStreetMap credit). Do not turn it off.
 */
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { Card, Text } from "@sanity/ui";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import { BAKU_CENTER } from "../../lib/geo.ts";
import { DEFAULT_ZOOM, MAP_MESSAGES, PIN_ZOOM, getMapConfig, normalizeLngLat } from "../../lib/map-config.ts";

export interface LocationPickerMapProps {
  /** The saved pin, or null when the field is empty. */
  point: { lat: number; lng: number } | null;
  readOnly?: boolean;
  /** Called with the chosen position (click or drag). The parent validates, rounds and saves it. */
  onPick: (lat: number, lng: number) => void;
}

type Status = "loading" | "ready" | "error";

export default function LocationPickerMap({ point, readOnly = false, onPick }: LocationPickerMapProps) {
  // NEXT_PUBLIC_* variables must be written out in full so Next.js can inline them into the browser bundle.
  const config = getMapConfig(process.env.NEXT_PUBLIC_MAPTILER_KEY, process.env.NEXT_PUBLIC_MAP_STYLE);
  const styleUrl = config.ok ? config.styleUrl : "";
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<MapLibreMarker | null>(null);
  const markerOnMap = useRef(false);
  const startPoint = useRef(point);            // the pin at the moment the map opened (only used for the first view)
  const latest = useRef({ onPick, readOnly });
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => { latest.current = { onPick, readOnly }; });

  useEffect(() => {
    if (!styleUrl || !box.current) return;
    let cancelled = false;
    const container = box.current;
    (async () => {
      type MapLibre = typeof import("maplibre-gl");
      const loaded: MapLibre = await import("maplibre-gl");
      const ml: MapLibre = (loaded as unknown as { default?: MapLibre }).default ?? loaded;
      if (cancelled) return;
      const start = startPoint.current;
      const map = new ml.Map({ container, style: styleUrl, center: start ? [start.lng, start.lat] : BAKU_CENTER, zoom: start ? PIN_ZOOM : DEFAULT_ZOOM });
      mapRef.current = map;
      map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");

      const marker = new ml.Marker({ draggable: !latest.current.readOnly, color: "#0B192C" });
      markerRef.current = marker;
      if (start) { marker.setLngLat([start.lng, start.lat]).addTo(map); markerOnMap.current = true; }

      const report = (lng: number, lat: number) => {
        const p = normalizeLngLat(lng, lat);
        if (p && !latest.current.readOnly) latest.current.onPick(p.lat, p.lng);
      };
      marker.on("dragend", () => { const p = marker.getLngLat(); report(p.lng, p.lat); });
      map.on("click", (e) => {
        if (latest.current.readOnly) return;
        const target = e.originalEvent?.target;
        if (target instanceof Node && marker.getElement().contains(target)) return;   // a click on the pin itself is not a new position
        report(e.lngLat.lng, e.lngLat.lat);
      });
      map.on("load", () => { if (!cancelled) setStatus("ready"); });
      map.on("error", () => { if (!cancelled) setStatus((s) => (s === "ready" ? s : "error")); });   // a failed style (bad key / origin) shows a message; later tile hiccups are ignored
    })().catch(() => { if (!cancelled) setStatus("error"); });

    return () => {
      cancelled = true;
      markerRef.current?.remove();
      mapRef.current?.remove();
      markerRef.current = null; mapRef.current = null; markerOnMap.current = false;
    };
  }, [styleUrl]);

  // Keep the pin in step with the saved value (typed or pasted coordinates, undo / redo, a pin chosen on the map itself).
  const lat = point?.lat, lng = point?.lng;
  useEffect(() => {
    const map = mapRef.current, marker = markerRef.current;
    if (!map || !marker) return;
    if (lat === undefined || lng === undefined) {
      if (markerOnMap.current) { marker.remove(); markerOnMap.current = false; }
      return;
    }
    marker.setLngLat([lng, lat]);
    if (!markerOnMap.current) { marker.addTo(map); markerOnMap.current = true; }
    if (!map.getBounds().contains([lng, lat])) map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 13), duration: 400 });
  }, [lat, lng, status]);

  if (!config.ok) return <Card padding={3} radius={2} tone="caution" border role="status"><Text size={1}>{MAP_MESSAGES[config.reason]}</Text></Card>;

  return (
    <div data-testid="location-map">
      <div style={{ position: "relative", width: "100%", height: 360, borderRadius: 4, overflow: "hidden", background: "#e5e7eb" }}>
        <div ref={box} style={{ position: "absolute", inset: 0 }} data-testid="location-map-canvas" />
        {status !== "ready" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, pointerEvents: status === "loading" ? "none" : "auto" }}>
            <Card padding={3} radius={2} shadow={1} tone={status === "error" ? "critical" : "default"} role="status">
              <Text size={1}>{status === "error" ? MAP_MESSAGES.failed : MAP_MESSAGES.loading}</Text>
            </Card>
          </div>
        )}
      </div>
      <Text size={1} muted style={{ marginTop: 8 }}>{readOnly ? MAP_MESSAGES.hintReadOnly : MAP_MESSAGES.hint}</Text>
    </div>
  );
}
