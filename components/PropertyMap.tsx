
"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  Marker as MapLibreMarker,
} from "maplibre-gl";
import type { GeoJSONStoreFeatures, TerraDraw } from "terra-draw";

import {
  AREA_DECIMALS,
  BAKU_CENTER,
  polygonAreaKm2,
  polygonBBox,
  polygonToParam,
  validateSearchArea,
  type GeoPolygon,
  type LngLat,
} from "@/lib/geo";
import { DEFAULT_ZOOM, getMapConfig, normalizeLngLat } from "@/lib/map-config";
import {
  createDrawController,
  type DrawController,
  type DrawPreview,
  type DrawState,
} from "@/lib/draw-controller";
import { useI18n } from "@/lib/i18n/client";
import { areaResultsState, cancelsAreaWrite, urlSyncAction } from "@/lib/area-results";
import { useAreaSelection } from "@/components/AreaResults";

export interface PropertyMapItem {
  _id: string;
  title?: {
    az?: string;
    ru?: string;
    en?: string;
  };
  lat: number;
  lng: number;
  price?: number;
  currency?: string;
}

interface PropertyMapProps {
  items?: PropertyMapItem[];
  className?: string;
  /** Area from the "poly" URL parameter (already validated on the server). */
  initialPolygon?: GeoPolygon | null;
}

type MapStatus = "loading" | "ready" | "error";
/** idle: no area · drawing: the free-line tool is active · editing: vertex handles are shown · done: an area exists. */
type UiMode = "idle" | "drawing" | "editing" | "done";
type Notice = { kind: "error" | "info"; key: string } | null;

interface MapApi {
  startDrawing(): void;
  cancelDrawing(): void;
  editArea(): void;
  finishEditing(): void;
  clearArea(): void;
  /** Shows the area from the URL (initial load, Reset, filter submit, history), without writing the URL back. */
  applyExternal(polygon: GeoPolygon | null): void;
}

const NAVY = "#0B192C";
const AMBER = "#FF9D23";
const PREVIEW_SOURCE = "vh-draw-preview";
const L_FLASH = "vh-draw-flash";
const L_LINE = "vh-draw-line";
const L_HINT = "vh-draw-hint";
const L_HALO = "vh-draw-start-halo";
const L_START = "vh-draw-start";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const LOCALES: Record<string, string> = { az: "az-AZ", ru: "ru-RU", en: "en-US" };
/** Edits are written to the URL after this pause, so dragging several vertices causes one navigation. */
const URL_DEBOUNCE_MS = 350;
/** Sent by PropertySearch right before it navigates (same name there; a test checks they match). */
const AREA_SYNC_EVENT = "vh:area-sync";
type AreaSyncDetail = { reason: "reset" | "submit"; poly?: string };

const lineFeature = (kind: string, coordinates: LngLat[]): GeoJSON.Feature => ({
  type: "Feature",
  properties: { kind },
  geometry: { type: "LineString", coordinates },
});
const pointFeature = (kind: string, coordinates: LngLat): GeoJSON.Feature => ({
  type: "Feature",
  properties: { kind },
  geometry: { type: "Point", coordinates },
});

/** The single search-area feature in the Terra Draw store, if any. */
function findAreaFeature(draw: TerraDraw): GeoJSONStoreFeatures | undefined {
  return draw
    .getSnapshot()
    .find(
      (feature) =>
        feature.properties.mode === "polygon" &&
        feature.geometry.type === "Polygon"
    );
}

export default function PropertyMap({
  items = [],
  className = "",
  initialPolygon = null,
}: PropertyMapProps) {
  const { t, lang } = useI18n();

  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const focusToolbarRef = useRef(false);
  const mapRef = useRef<MapLibreMap | null>(null);
  const moduleRef = useRef<typeof import("maplibre-gl") | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const apiRef = useRef<MapApi | null>(null);
  const uiRef = useRef<UiMode>("idle");
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const initialPolygonRef = useRef(initialPolygon);
  initialPolygonRef.current = initialPolygon;
  /** "poly" value of the area currently shown ("" = none). */
  const paramRef = useRef("");
  /** Values this component wrote recently: when the server echoes an older one back, it must not replace a newer edit. */
  const writtenRef = useRef(new Set<string>());
  /** True while a URL write is waiting for its debounce; the navigation itself is tracked by `updating`. */
  const urlPendingRef = useRef(false);
  /** Shares the area the map holds with the listing section (AreaResults), so results follow it without waiting for the server. */
  const areaSelection = useAreaSelection();
  const publishRef = useRef(areaSelection?.setClientParam);
  publishRef.current = areaSelection?.setClientParam;
  const [updating, startTransition] = useTransition();

  const [status, setStatus] = useState<MapStatus>("loading");
  const [ui, setUiState] = useState<UiMode>("idle");
  const [phase, setPhase] = useState<DrawState>("idle");
  const [nearStart, setNearStart] = useState(false);
  const [area, setArea] = useState<GeoPolygon | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const config = getMapConfig(
    process.env.NEXT_PUBLIC_MAPTILER_KEY,
    process.env.NEXT_PUBLIC_MAP_STYLE
  );

  const styleUrl = config.ok ? config.styleUrl : null;

  useEffect(() => {
    if (styleUrl === null || !containerRef.current) return;

    let cancelled = false;
    let map: MapLibreMap | null = null;
    let draw: TerraDraw | null = null;
    let controller: DrawController | null = null;
    let detachPointer: (() => void) | null = null;
    let restoreInteractions: (() => void) | null = null;
    let previewFrame = 0;
    let pendingPreview: DrawPreview | null = null;
    let featureId: string | number | null = null;
    /** Last area that passed validateSearchArea: restored when editing ends on an invalid shape. */
    let lastValid: GeoPolygon | null = null;
    let urlTimer: ReturnType<typeof setTimeout> | null = null;
    let flashPolygon: GeoPolygon | null = null;
    const flashTimers: ReturnType<typeof setTimeout>[] = [];
    let lastPreview: DrawPreview | null = null;
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

    const setUi = (mode: UiMode) => {
      uiRef.current = mode;
      setUiState(mode);
    };

    function setPreviewData(data: GeoJSON.FeatureCollection) {
      const source = map?.getSource(PREVIEW_SOURCE) as GeoJSONSource | undefined;
      source?.setData(data);
    }

    function renderPreview(preview: DrawPreview) {
      if (!map) return;
      lastPreview = preview;
      const features: GeoJSON.Feature[] = [];
      if (flashPolygon) {
        features.push({ type: "Feature", properties: { kind: "flash" }, geometry: flashPolygon });
      }
      const active = preview.state === "stroking" || preview.state === "openLine";

      if (active && preview.line.length >= 2) {
        features.push(lineFeature("line", preview.line));
      }
      if (preview.state === "openLine" && preview.line.length >= 1) {
        const end = preview.line[preview.line.length - 1];
        const target = preview.nearStart ? preview.line[0] : preview.cursor;
        if (target) features.push(lineFeature("hint", [end, target]));
      }
      if (active && preview.line.length >= 1) {
        features.push(pointFeature("start", preview.line[0]));
      }

      setPreviewData({ type: "FeatureCollection", features });
      map.setPaintProperty(L_HALO, "circle-radius", preview.nearStart ? 18 : 11);
      map.setPaintProperty(L_HALO, "circle-opacity", preview.nearStart ? 0.35 : 0.18);
      map.setPaintProperty(L_START, "circle-radius", preview.nearStart ? 8 : 6);
      if (active) map.getCanvas().style.cursor = preview.nearStart ? "pointer" : "crosshair";
    }

    /** At most one GeoJSON update per animation frame while the pointer moves. */
    function schedulePreview(preview: DrawPreview) {
      pendingPreview = preview;
      setNearStart(preview.nearStart);
      if (previewFrame) return;
      previewFrame = requestAnimationFrame(() => {
        previewFrame = 0;
        if (pendingPreview) renderPreview(pendingPreview);
        pendingPreview = null;
      });
    }

    /** Turns off the map gestures that would fight with drawing; returns a function that restores them exactly. */
    function suspendInteractions(m: MapLibreMap) {
      const container = m.getCanvasContainer();
      const saved = {
        dragPan: m.dragPan.isEnabled(),
        dragRotate: m.dragRotate.isEnabled(),
        touchZoomRotate: m.touchZoomRotate.isEnabled(),
        touchPitch: m.touchPitch.isEnabled(),
        doubleClickZoom: m.doubleClickZoom.isEnabled(),
        boxZoom: m.boxZoom.isEnabled(),
        touchAction: container.style.touchAction,
      };
      m.dragPan.disable();
      m.dragRotate.disable();
      m.touchZoomRotate.disable();
      m.touchPitch.disable();
      m.doubleClickZoom.disable();
      m.boxZoom.disable();
      // Without MapLibre's touch handlers the browser would scroll the page instead of letting the finger draw.
      container.style.touchAction = "none";
      m.getCanvas().style.cursor = "crosshair";

      return () => {
        if (saved.dragPan) m.dragPan.enable();
        if (saved.dragRotate) m.dragRotate.enable();
        if (saved.touchZoomRotate) m.touchZoomRotate.enable();
        if (saved.touchPitch) m.touchPitch.enable();
        if (saved.doubleClickZoom) m.doubleClickZoom.enable();
        if (saved.boxZoom) m.boxZoom.enable();
        container.style.touchAction = saved.touchAction;
        m.getCanvas().style.removeProperty("cursor");
      };
    }

    function endDrawingSession() {
      restoreInteractions?.();
      restoreInteractions = null;
      setNearStart(false);
    }

    function attachPointer(m: MapLibreMap) {
      const container = m.getCanvasContainer();

      const toPointer = (event: PointerEvent) => {
        const rect = container.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const lngLat = m.unproject([x, y]);
        const normalized = normalizeLngLat(lngLat.lng, lngLat.lat);
        return {
          x,
          y,
          lng: normalized?.lng ?? Number.NaN,
          lat: normalized?.lat ?? Number.NaN,
          pointerId: event.pointerId,
          button: event.button,
        };
      };
      const drawing = () => uiRef.current === "drawing" && controller !== null;

      const onDown = (event: PointerEvent) => {
        if (!drawing()) return;
        if (controller!.pointerDown(toPointer(event))) {
          event.preventDefault();
          event.stopPropagation();
          try {
            container.setPointerCapture(event.pointerId);
          } catch {
            /* capture is best effort */
          }
        }
      };
      const onMove = (event: PointerEvent) => {
        if (drawing()) controller!.pointerMove(toPointer(event));
      };
      const onUp = (event: PointerEvent) => {
        if (!drawing()) return;
        controller!.pointerUp(toPointer(event));
        try {
          if (container.hasPointerCapture(event.pointerId)) {
            container.releasePointerCapture(event.pointerId);
          }
        } catch {
          /* already released */
        }
      };
      const onCancel = (event: PointerEvent) => {
        if (drawing()) controller!.pointerCancel(event.pointerId);
      };
      const onLeave = () => {
        if (drawing()) controller!.pointerLeave();
      };
      const onKey = (event: KeyboardEvent) => {
        if (event.key === "Escape" && uiRef.current === "drawing") {
          apiRef.current?.cancelDrawing();
        }
      };

      container.addEventListener("pointerdown", onDown);
      container.addEventListener("pointermove", onMove);
      container.addEventListener("pointerup", onUp);
      container.addEventListener("pointercancel", onCancel);
      container.addEventListener("lostpointercapture", onCancel);
      container.addEventListener("pointerleave", onLeave);
      document.addEventListener("keydown", onKey);

      return () => {
        container.removeEventListener("pointerdown", onDown);
        container.removeEventListener("pointermove", onMove);
        container.removeEventListener("pointerup", onUp);
        container.removeEventListener("pointercancel", onCancel);
        container.removeEventListener("lostpointercapture", onCancel);
        container.removeEventListener("pointerleave", onLeave);
        document.removeEventListener("keydown", onKey);
      };
    }

    /** Writes the area to the "poly" URL parameter (debounced). The server then filters the map and the cards by it. */
    function commit(polygon: GeoPolygon | null) {
      const param = polygon ? polygonToParam(polygon) : "";
      if (param === paramRef.current) return;
      paramRef.current = param;
      writtenRef.current.add(param);
      publishRef.current?.(param);                      // results react now (hide on clear); the URL follows after the debounce

      if (urlTimer) clearTimeout(urlTimer);
      urlPendingRef.current = true;
      urlTimer = setTimeout(() => {
        urlTimer = null;
        urlPendingRef.current = false;                  // from here on the transition (`updating`) covers the write
        const params = new URLSearchParams(window.location.search);
        if (param) params.set("poly", param);
        else params.delete("poly");
        params.delete("page");                          // a new area starts at page 1
        const query = params.toString();
        const href = query
          ? `${window.location.pathname}?${query}`
          : window.location.pathname;
        startTransition(() => {
          routerRef.current.replace(href, { scroll: false });
        });
      }, URL_DEBOUNCE_MS);
    }

    /** A short amber glow over a freshly closed area (fade in, fade out via MapLibre paint transitions). */
    function flashArea(polygon: GeoPolygon) {
      if (!map || reducedMotion) return;
      const m = map;
      flashTimers.splice(0).forEach(clearTimeout);
      flashPolygon = polygon;
      m.setPaintProperty(L_FLASH, "fill-opacity", 0);
      renderPreview(lastPreview ?? { state: "idle", line: [], cursor: null, nearStart: false });
      requestAnimationFrame(() => {
        if (!cancelled) m.setPaintProperty(L_FLASH, "fill-opacity", 0.38);
      });
      flashTimers.push(
        setTimeout(() => m.setPaintProperty(L_FLASH, "fill-opacity", 0), 320),
        setTimeout(() => {
          flashPolygon = null;
          renderPreview(lastPreview ?? { state: "idle", line: [], cursor: null, nearStart: false });
        }, 720)
      );
    }

    function fitToArea(polygon: GeoPolygon) {
      if (!map) return;
      const [minLng, minLat, maxLng, maxLat] = polygonBBox(polygon);
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 48, maxZoom: 15, duration: reducedMotion ? 0 : 700 }
      );
    }

    /** Called by the controller with the simplified open ring. Returning false keeps the line open. */
    function closeArea(ring: LngLat[]): boolean {
      if (!draw) return false;

      const result = validateSearchArea({
        type: "Polygon",
        coordinates: [[...ring, ring[0]]],
      });
      if (!result.ok) {
        setNotice({ kind: "error", key: `map.err.${result.error}` });
        return false;
      }

      const previousId = featureId;
      const added = draw.addFeatures([
        {
          type: "Feature",
          properties: { mode: "polygon" },
          geometry: result.polygon,
        } as GeoJSONStoreFeatures,
      ]);
      if (added.length === 0 || added.some((item) => !item.valid)) {
        setNotice({ kind: "error", key: "map.err.add" });
        return false;
      }

      // The new area replaces the previous one only once it was created successfully.
      if (previousId !== null) draw.removeFeatures([previousId]);
      featureId = findAreaFeature(draw)?.id ?? null;

      endDrawingSession();
      lastValid = result.polygon;
      setArea(result.polygon);
      setNotice(null);
      setUi("done");
      commit(result.polygon);
      flashArea(result.polygon);
      enterEditing();                                   // the finished area is editable right away
      return true;
    }

    function enterEditing() {
      if (!draw || featureId === null) return;
      draw.setMode("select");
      draw.selectFeature(featureId);
      setUi("editing");
    }

    function leaveEditing() {
      if (!draw || uiRef.current !== "editing") return;
      setUi("done");                                    // first, so the deselect event fired below does not re-enter
      draw.setMode("static");
      const feature = findAreaFeature(draw);
      if (feature && featureId !== null && lastValid && !validateSearchArea(feature).ok) {
        draw.updateFeatureGeometry(featureId, lastValid);
        setArea(lastValid);
        setNotice({ kind: "info", key: "map.info.reverted" });
      }
    }

    /** After every finished edit (vertex moved, added or deleted): keep the area only if it is still valid. */
    function onEditFinished() {
      if (!draw || uiRef.current !== "editing") return;
      const feature = findAreaFeature(draw);
      if (!feature) {
        api.clearArea();
        return;
      }
      const result = validateSearchArea(feature);
      if (result.ok) {
        lastValid = result.polygon;
        setArea(result.polygon);
        setNotice(null);
        commit(result.polygon);
      } else {
        setNotice({ kind: "error", key: `map.err.${result.error}` });
      }
    }

    const api: MapApi = {
      startDrawing() {
        if (!map || !draw || !controller) return;
        if (uiRef.current === "drawing") return;
        leaveEditing();
        draw.setMode("static");
        restoreInteractions = suspendInteractions(map);
        setNotice(null);
        setUi("drawing");
        controller.arm();
      },
      cancelDrawing() {
        if (!controller || uiRef.current !== "drawing") return;
        controller.cancel();
        endDrawingSession();
        setUi(featureId !== null ? "done" : "idle");
      },
      editArea() {
        if (uiRef.current === "done") enterEditing();
      },
      finishEditing() {
        leaveEditing();
      },
      clearArea() {
        if (!draw) return;
        setUi("idle");                                  // first, so Terra Draw events fired below are ignored
        controller?.cancel();
        endDrawingSession();
        draw.setMode("static");
        draw.clear();
        featureId = null;
        lastValid = null;
        setArea(null);
        setNotice({ kind: "info", key: "map.status.cleared" });
        setUi("idle");
        commit(null);
      },
      applyExternal(polygon) {
        // An outside URL change (Reset, link, Back/Forward) wins: drop this map's pending delayed URL write first,
        // otherwise it would fire afterwards and put the replaced area back into the URL.
        if (urlTimer) {
          clearTimeout(urlTimer);
          urlTimer = null;
        }
        urlPendingRef.current = false;
        if (!draw) return;
        if (uiRef.current === "drawing") {
          controller?.cancel();
          endDrawingSession();
        }
        setUi("idle");
        draw.setMode("static");
        draw.clear();
        featureId = null;
        lastValid = null;
        paramRef.current = polygon ? polygonToParam(polygon) : "";
        setNotice(null);

        if (!polygon) {
          setArea(null);
          publishRef.current?.("");
          return;
        }

        // The server accepts up to 8 decimals in "poly", Terra Draw only AREA_DECIMALS (5): round and re-check
        // the same way a drawn area is checked. paramRef keeps the URL's own value (set above), so simply
        // loading a hand-made link never rewrites the URL; the next edit writes the rounded area.
        const checked = validateSearchArea(polygon);
        if (!checked.ok) {
          setArea(null);
          publishRef.current?.("");                     // no area on the map: show no listings either
          setNotice({ kind: "error", key: `map.err.${checked.error}` });
          return;
        }
        const shown = checked.polygon;

        const added = draw.addFeatures([
          {
            type: "Feature",
            properties: { mode: "polygon" },
            geometry: shown,
          } as GeoJSONStoreFeatures,
        ]);
        if (added.length === 0 || added.some((item) => !item.valid)) {
          setArea(null);
          publishRef.current?.("");
          setNotice({ kind: "error", key: "map.err.add" });
          return;
        }

        featureId = findAreaFeature(draw)?.id ?? null;
        lastValid = shown;
        setArea(shown);
        publishRef.current?.(paramRef.current);         // the URL's own value: the server rendered the results for it
        setUi("done");
        fitToArea(shown);
      },
    };

    async function initializeMap() {
      try {
        const [ml, terra, adapterModule] = await Promise.all([
          import("maplibre-gl"),
          import("terra-draw"),
          import("terra-draw-maplibre-gl-adapter"),
        ]);

        if (cancelled || !containerRef.current) return;

        moduleRef.current = ml;

        map = new ml.Map({
          container: containerRef.current,
          style: styleUrl ?? undefined,
          center: BAKU_CENTER,
          zoom: DEFAULT_ZOOM,
        });

        mapRef.current = map;

        map.addControl(
          new ml.NavigationControl({ showCompass: false }),
          "top-right"
        );

        map.on("load", () => {
          if (cancelled || !map) return;

          try {
            map.addSource(PREVIEW_SOURCE, { type: "geojson", data: EMPTY });
            // Paint transitions animate the closing ring and the close glow; none with reduced motion.
            const ease = { duration: reducedMotion ? 0 : 180, delay: 0 };
            const fade = { duration: reducedMotion ? 0 : 300, delay: 0 };
            map.addLayer({
              id: L_FLASH,
              type: "fill",
              source: PREVIEW_SOURCE,
              filter: ["==", ["get", "kind"], "flash"],
              paint: {
                "fill-color": AMBER,
                "fill-opacity": 0,
                "fill-opacity-transition": fade,
              },
            });
            map.addLayer({
              id: L_LINE,
              type: "line",
              source: PREVIEW_SOURCE,
              filter: ["==", ["get", "kind"], "line"],
              layout: { "line-cap": "round", "line-join": "round" },
              paint: { "line-color": NAVY, "line-width": 3 },
            });
            map.addLayer({
              id: L_HINT,
              type: "line",
              source: PREVIEW_SOURCE,
              filter: ["==", ["get", "kind"], "hint"],
              layout: { "line-cap": "round" },
              paint: {
                "line-color": NAVY,
                "line-width": 2,
                "line-opacity": 0.55,
                "line-dasharray": [1.5, 1.5],
              },
            });
            map.addLayer({
              id: L_HALO,
              type: "circle",
              source: PREVIEW_SOURCE,
              filter: ["==", ["get", "kind"], "start"],
              paint: {
                "circle-color": AMBER,
                "circle-opacity": 0.18,
                "circle-opacity-transition": ease,
                "circle-radius": 11,
                "circle-radius-transition": ease,
              },
            });
            map.addLayer({
              id: L_START,
              type: "circle",
              source: PREVIEW_SOURCE,
              filter: ["==", ["get", "kind"], "start"],
              paint: {
                "circle-color": AMBER,
                "circle-radius": 6,
                "circle-radius-transition": ease,
                "circle-stroke-color": "#FFFFFF",
                "circle-stroke-width": 2.5,
              },
            });

            draw = new terra.TerraDraw({
              adapter: new adapterModule.TerraDrawMapLibreGLAdapter({
                map,
                // Same precision as the URL form, so Terra Draw accepts the area and edits stay round-trip exact.
                coordinatePrecision: AREA_DECIMALS,
              }),
              modes: [
                new terra.TerraDrawPolygonMode({
                  styles: {
                    fillColor: AMBER,
                    fillOpacity: 0.16,
                    outlineColor: NAVY,
                    outlineWidth: 2.5,
                  },
                }),
                new terra.TerraDrawSelectMode({
                  // Delete would remove the whole area and the rotate/scale shortcuts are not wanted:
                  // vertices are deleted with a right-click instead. Escape still ends editing.
                  keyEvents: {
                    deselect: "Escape",
                    delete: null,
                    rotate: null,
                    scale: null,
                  },
                  flags: {
                    polygon: {
                      feature: {
                        draggable: false,
                        // Refuses an edit (for example a dragged vertex that makes the border cross itself) while it happens.
                        validation: (feature) => {
                          const result = validateSearchArea(feature);
                          return result.ok
                            ? { valid: true }
                            : { valid: false, reason: result.error };
                        },
                        coordinates: {
                          draggable: true,
                          deletable: true,
                          midpoints: { draggable: true },
                        },
                      },
                    },
                  },
                  styles: {
                    selectedPolygonColor: AMBER,
                    selectedPolygonFillOpacity: 0.2,
                    selectedPolygonOutlineColor: NAVY,
                    selectedPolygonOutlineWidth: 3,
                    selectionPointColor: "#FFFFFF",
                    selectionPointOutlineColor: NAVY,
                    selectionPointWidth: 6,
                    selectionPointOutlineWidth: 2.5,
                    midPointColor: AMBER,
                    midPointOutlineColor: "#FFFFFF",
                    midPointWidth: 4,
                    midPointOutlineWidth: 2,
                  },
                }),
              ],
            });
            draw.start();
            draw.setMode("static");

            draw.on("finish", (_id, context) => {
              if (context.action !== "draw") onEditFinished();
            });
            draw.on("deselect", () => {
              // A click outside the area (or Escape) ends editing.
              if (uiRef.current === "editing") leaveEditing();
            });

            const m = map;
            controller = createDrawController({
              project: (lng, lat) => {
                const point = m.project([lng, lat]);
                return { x: point.x, y: point.y };
              },
              onPreview: schedulePreview,
              onStateChange: setPhase,
              onClose: closeArea,
              onCloseRejected: () =>
                setNotice({ kind: "error", key: "map.err.short" }),
            });
            detachPointer = attachPointer(map);
            apiRef.current = api;

            setStatus("ready");
          } catch {
            setStatus("error");
          }
        });

        map.on("error", () => {
          if (!cancelled && !map?.loaded()) {
            setStatus("error");
          }
        });
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    // The search form is about to navigate (Reset or filter submit). Runs synchronously BEFORE that navigation starts:
    // drop the pending delayed URL write so it can never override the form's navigation, however slow its response.
    // Reset: also clear the map now, WITHOUT writing a URL (Reset's own navigation does that; a write here could restore
    // the old filters). Needed when the area was never written: Reset then lands on the same URL and nothing else
    // would clear it. Submit: answer with the map's latest area, so the form's URL carries it.
    function onAreaSync(event: Event) {
      const detail = (event as CustomEvent<AreaSyncDetail>).detail;
      if (!detail) return;
      if (urlTimer) {
        clearTimeout(urlTimer);
        urlTimer = null;
      }
      urlPendingRef.current = false;
      // Only a ready map holds its own area; before that the form keeps the server's area and the URL decides.
      if (apiRef.current !== api) return;
      if (detail.reason === "reset") api.applyExternal(null);
      else detail.poly = paramRef.current;
    }
    window.addEventListener(AREA_SYNC_EVENT, onAreaSync);

    // A same-site link click (header Buy/Rent, "Ərazini sil", no-results Reset, pagination...) starts a navigation.
    // Capture phase on window: runs before React and before next/link navigates, so the pending delayed URL write is
    // dropped before it could fire later and override that navigation. The area itself is left alone: the
    // destination page decides (URL -> map effect below).
    function onLinkClick(event: MouseEvent) {
      if (!urlTimer) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      const navigates = cancelsAreaWrite({
        button: event.button, metaKey: event.metaKey, ctrlKey: event.ctrlKey, shiftKey: event.shiftKey, altKey: event.altKey,
        defaultPrevented: event.defaultPrevented, href: target.href, target: target.target,
        download: target.hasAttribute("download"), currentHref: window.location.href,
      });
      if (!navigates) return;
      clearTimeout(urlTimer);
      urlTimer = null;
      urlPendingRef.current = false;
    }
    window.addEventListener("click", onLinkClick, true);

    void initializeMap();

    return () => {
      cancelled = true;
      window.removeEventListener(AREA_SYNC_EVENT, onAreaSync);
      window.removeEventListener("click", onLinkClick, true);
      apiRef.current = null;
      uiRef.current = "idle";
      paramRef.current = "";
      writtenRef.current.clear();

      if (urlTimer) clearTimeout(urlTimer);           // leaving the page: drop a pending URL write
      urlPendingRef.current = false;
      flashTimers.splice(0).forEach(clearTimeout);
      if (previewFrame) cancelAnimationFrame(previewFrame);
      detachPointer?.();
      restoreInteractions = null;
      controller = null;

      draw?.stop();

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      map?.remove();

      if (mapRef.current === map) {
        mapRef.current = null;
      }

      moduleRef.current = null;
    };
  }, [styleUrl]);

  // Markers only for the results of the area currently on the map: none before an area is selected, none the moment
  // it is cleared, and never the previous area's markers while a new area is being loaded.
  const showMarkers =
    !areaSelection ||
    areaResultsState(areaSelection.clientParam, areaSelection.serverParam) === "ready";

  useEffect(() => {
    const map = mapRef.current;
    const ml = moduleRef.current;

    if (!map || !ml || status !== "ready") return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (!showMarkers) return;

    for (const item of items) {
      if (
        !Number.isFinite(item.lat) ||
        !Number.isFinite(item.lng) ||
        item.lat < -90 ||
        item.lat > 90 ||
        item.lng < -180 ||
        item.lng > 180
      ) {
        continue;
      }

      const title =
        item.title?.az ||
        item.title?.ru ||
        item.title?.en ||
        "Elan xəritədə";

      const element = document.createElement("button");
      element.type = "button";
      element.setAttribute("aria-label", title);

      Object.assign(element.style, {
        width: "18px",
        height: "18px",
        borderRadius: "50%",
        background: "#FF9D23",
        border: "3px solid white",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        cursor: "pointer",
      });

      const popupContent = document.createElement("div");
      popupContent.textContent = title;

      const popup = new ml.Popup({
        closeButton: true,
        closeOnClick: true,
      }).setDOMContent(popupContent);

      const marker = new ml.Marker({
        element,
        anchor: "center",
      })
        .setLngLat([item.lng, item.lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    }

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [items, status, showMarkers]);

  // URL -> map. Runs when the map becomes ready (restores a shared/reloaded area) and when the server sends a
  // different area (Reset, filter submit, hand-edited URL, Back/Forward). Echoes of this component's own older writes
  // are ignored only while a newer write is still outstanding. While this component's own navigation runs
  // (`updating`) nothing is decided (the server's area is still the old one); it is re-checked when that navigation
  // ends, so a superseded write can never leave the results waiting for a response that will not come.
  const initialParam = initialPolygon ? polygonToParam(initialPolygon) : "";
  useEffect(() => {
    if (status !== "ready" || updating) return;
    const action = urlSyncAction(initialParam, paramRef.current, writtenRef.current, urlPendingRef.current);
    if (action === "in-sync") {
      writtenRef.current.clear();
      return;
    }
    if (action === "ignore-echo") return;
    writtenRef.current.clear();                       // the server's area wins: older own writes no longer matter
    apiRef.current?.applyExternal(initialPolygonRef.current ?? null);
  }, [initialParam, status, updating]);

  // While the map is not ready (loading, failed, missing key) it cannot hold its own area: the URL's area is the selection.
  useEffect(() => {
    if (status !== "ready") publishRef.current?.(initialParam);
  }, [initialParam, status]);

  // Markers sit above the map canvas: while drawing or editing they must not catch the pointer.
  useEffect(() => {
    const interactive = ui === "idle" || ui === "done";
    markersRef.current.forEach((marker) => {
      marker.getElement().style.pointerEvents = interactive ? "" : "none";
    });
  }, [ui, items, status, showMarkers]);                 // showMarkers: markers can be re-created without new items

  // When the toolbar swaps its buttons (start/cancel/close), the focused button disappears:
  // move focus to the first button of the new toolbar instead of losing it to the page.
  // Only after a toolbar click (never on page load or URL restores, which must not steal focus).
  useEffect(() => {
    if (!focusToolbarRef.current) return;
    focusToolbarRef.current = false;
    const toolbar = toolbarRef.current;
    if (!toolbar || toolbar.contains(document.activeElement)) return;
    toolbar.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({
      preventScroll: true,
    });
  }, [ui]);

  /** Runs a toolbar action and remembers that focus may need to follow the toolbar. */
  const act = (action: (api: MapApi) => void) => {
    focusToolbarRef.current = true;
    if (apiRef.current) action(apiRef.current);
  };

  const ready = status === "ready";
  const areaText = area
    ? `${new Intl.NumberFormat(LOCALES[lang] ?? "az-AZ", {
        maximumFractionDigits: polygonAreaKm2(area) < 10 ? 2 : 1,
      }).format(polygonAreaKm2(area))} km²`
    : "";

  const hintKey =
    ui === "drawing"
      ? phase === "stroking"
        ? "map.hint.stroking"
        : phase === "openLine"
          ? nearStart
            ? "map.hint.near"
            : "map.hint.open"
          : "map.hint.armed"
      : ui === "editing"
        ? "map.hint.edit"
        : null;

  if (!config.ok) {
    const message =
      config.reason === "missing_key"
        ? t("map.missingKey")
        : t("map.invalidKey");

    return (
      <div
        role="status"
        className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-slate-800"
      >
        {message}
      </div>
    );
  }

  const primaryBtn =
    "flex items-center gap-2 rounded-lg bg-amber px-4 py-2.5 text-sm font-semibold text-navy transition hover:brightness-95 disabled:opacity-50";
  const secondaryBtn =
    "rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-soft disabled:opacity-50";

  const pencil = (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m16 4 4 4L8 20H4v-4L16 4Z" />
      <path d="m14 6 4 4" />
    </svg>
  );

  return (
    <section
      aria-label={t("map.aria")}
      className={`space-y-3 ${className}`}
    >
      <div
        ref={toolbarRef}
        key={ui === "drawing" ? "toolbar-drawing" : "toolbar-main"}
        className="anim-up flex flex-wrap items-center gap-2"
      >
        {ui === "drawing" ? (
          <button
            type="button"
            onClick={() => act((api) => api.cancelDrawing())}
            className={secondaryBtn}
          >
            {t("map.cancel")}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={!ready}
              onClick={() => act((api) => api.startDrawing())}
              className={primaryBtn}
            >
              {pencil}
              <span>{area ? t("map.redraw") : t("map.draw")}</span>
            </button>

            <button
              type="button"
              disabled={!ready || !area}
              aria-pressed={ui === "editing"}
              onClick={() =>
                act((api) =>
                  ui === "editing" ? api.finishEditing() : api.editArea()
                )
              }
              className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 ${
                ui === "editing"
                  ? "border-amber bg-amber/10 text-navy"
                  : "border-line bg-white text-ink hover:bg-soft"
              }`}
            >
              {ui === "editing" ? `✓ ${t("map.done")}` : `↗ ${t("map.edit")}`}
            </button>

            <button
              type="button"
              disabled={!ready || !area}
              onClick={() => act((api) => api.clearArea())}
              className={secondaryBtn}
            >
              {t("map.clear")}
            </button>
          </>
        )}

        {area && (ui === "done" || ui === "editing") && (
          <span className="text-sm font-medium text-green-700">
            {t(ui === "editing" ? "map.status.editing" : "map.status.done", {
              area: areaText,
            })}
          </span>
        )}
      </div>

      <p aria-live="polite" className="sr-only">
        {hintKey ? t(hintKey) : notice?.kind === "info" ? t(notice.key) : ""}
      </p>

      {notice?.kind === "error" && (
        <p role="alert" className="text-sm text-red-600">
          {t(notice.key)}
        </p>
      )}

      {notice?.kind === "info" && (
        <p className="text-sm text-mute">{t(notice.key)}</p>
      )}

      <div className="relative w-full overflow-hidden rounded-2xl bg-slate-100">
        <div
          ref={containerRef}
          className="h-[420px] w-full md:h-[560px]"
        />

        {hintKey && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
            <p
              key={hintKey}
              className="anim-up max-w-xl rounded-full bg-navy/90 px-4 py-2 text-center text-xs font-medium text-white shadow-lg"
            >
              {t(hintKey)}
            </p>
          </div>
        )}

        {updating && (
          <div
            role="status"
            className="anim-up pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-ink shadow"
          >
            <span
              aria-hidden="true"
              className="h-3 w-3 animate-spin rounded-full border-2 border-amber border-t-transparent"
            />
            {t("map.status.updating")}
          </div>
        )}

        {status !== "ready" && (
          <div
            role="status"
            className="absolute inset-0 flex items-center justify-center p-4"
          >
            <div className="rounded-xl bg-white p-4 text-sm shadow-lg">
              {status === "error" ? t("map.failed") : t("map.loading")}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
