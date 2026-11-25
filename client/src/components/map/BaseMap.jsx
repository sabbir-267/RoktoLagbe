import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "./map.css";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { DHAKA, isPoint } from "./geo";
import useT from "../../i18n/useT";
import mapDict from "../../i18n/map";

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Phones and tablets: one-finger drags should scroll the page until the map is tapped
const isTouch = () =>
  typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;

// Scroll-wheel zoom (and, on touch screens, dragging) stays off until the map is
// clicked/tapped or focused, so the map never hijacks page scrolling.
function Interaction({ touch, onActive }) {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const enable = () => {
      map.scrollWheelZoom.enable();
      if (touch) map.dragging.enable();
      onActive(true);
    };
    const disable = () => {
      map.scrollWheelZoom.disable();
      if (touch) map.dragging.disable();
      onActive(false);
    };
    const onLeave = () => map.scrollWheelZoom.disable();
    map.on("click focus", enable);
    map.on("blur", disable);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      map.off("click focus", enable);
      map.off("blur", disable);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [map, touch, onActive]);
  return null;
}

// Leaflet measures its box once; re-measure when the layout changes (e.g. a section expands)
function AutoResize() {
  const map = useMap();
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

// Fits the view to the given points whenever fitKey changes (not on every position update)
export function FitPoints({ points, fitKey, maxZoom = 16 }) {
  const map = useMap();
  const latest = useRef(points);
  useEffect(() => {
    latest.current = points;
  });
  useEffect(() => {
    const pts = (latest.current || []).filter(isPoint);
    if (!pts.length) return;
    if (pts.length === 1) map.setView([pts[0].lat, pts[0].lng], Math.min(maxZoom, 15));
    else map.fitBounds(pts.map((p) => [p.lat, p.lng]), { padding: [36, 36], maxZoom });
  }, [map, fitKey, maxZoom]);
  return null;
}

// Moves the view to a point whenever flyKey changes
export function FlyTo({ point, flyKey, zoom = 16 }) {
  const map = useMap();
  const latest = useRef(point);
  useEffect(() => {
    latest.current = point;
  });
  useEffect(() => {
    if (!flyKey || !isPoint(latest.current)) return;
    map.setView([latest.current.lat, latest.current.lng], Math.max(map.getZoom(), zoom));
  }, [map, flyKey, zoom]);
  return null;
}

/**
 * OpenStreetMap base map. Children are react-leaflet layers (Marker, Circle, FitPoints…).
 * props: center {lat,lng}, zoom, height (px), label (accessible name), className
 */
export default function BaseMap({ center, zoom = 13, height = 280, label, className = "", children }) {
  const { t } = useT(mapDict);
  const [touch] = useState(isTouch);
  const [active, setActive] = useState(false);
  const start = isPoint(center) ? center : DHAKA;

  return (
    <div
      role="region"
      aria-label={label || t("mapLabel")}
      className={`rl-map relative isolate z-0 w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100 ${className}`}
      style={{ height }}
    >
      <MapContainer
        center={[start.lat, start.lng]}
        zoom={zoom}
        scrollWheelZoom={false}
        dragging={!touch}
        className="h-full w-full"
      >
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} maxZoom={19} />
        <Interaction touch={touch} onActive={setActive} />
        <AutoResize />
        {children}
      </MapContainer>
      {touch && !active && (
        <p className="pointer-events-none absolute inset-x-0 top-2 z-[1000] mx-auto w-fit rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
          {t("tapToMove")}
        </p>
      )}
    </div>
  );
}
