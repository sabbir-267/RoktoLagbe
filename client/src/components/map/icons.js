import L from "leaflet";

// Markers are plain HTML (L.divIcon), so no image files are needed. Styles live in map.css.

const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const CROSS =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z"/></svg>';

// Red square with a white cross
export const hospitalIcon = L.divIcon({
  className: "rl-marker",
  html: `<div class="rl-hospital">${CROSS}</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -16],
  tooltipAnchor: [16, 0],
});

// Blue dot with a soft pulse: "you are here"
export const youIcon = L.divIcon({
  className: "rl-marker",
  html: '<div class="rl-you"><span class="rl-you-pulse"></span><span class="rl-you-dot"></span></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  tooltipAnchor: [12, 0],
});

// Teardrop pin used by the location picker (anchor at the tip)
export const pinIcon = L.divIcon({
  className: "rl-marker",
  html: '<div class="rl-pin"><span></span></div>',
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  tooltipAnchor: [16, -24],
});

// Round badge with the donor's initials; colour follows the trip status
const donorCache = new Map();
export function donorIcon(label, status = "on_the_way") {
  const key = `${label}|${status}`;
  if (!donorCache.has(key)) {
    donorCache.set(
      key,
      L.divIcon({
        className: "rl-marker",
        html: `<div class="rl-donor rl-donor--${escapeHtml(status)}">${escapeHtml(label)}</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        tooltipAnchor: [18, 0],
      })
    );
  }
  return donorCache.get(key);
}

export function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((p) => Array.from(p)[0])
    .join("")
    .toUpperCase();
}
