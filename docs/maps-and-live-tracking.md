# Maps, location confirmation and live donor tracking – design and API contract

Free stack: **Leaflet 1.9 + react-leaflet 5** with **OpenStreetMap** tiles
(`https://tile.openstreetmap.org/{z}/{x}/{y}.png`, attribution "© OpenStreetMap contributors"
is mandatory), **Nominatim** for search / reverse geocoding (free, max ~1 request/second,
use `countrycodes=bd`, `accept-language` = site language; never call it on every keystroke).
No API keys. Distances are straight-line (haversine); ETA is an estimate.

Coordinates in the database are GeoJSON `[longitude, latitude]`. In API bodies they are
sent as `latitude` / `longitude` numbers (already accepted by `POST/PATCH /api/requests`
and `PUT /api/donors/me`).

## 1. Confirming locations (client only, server already supports it)
- **Blood request**: optional hospital pin in the request form → `latitude`, `longitude` on create.
  The requester can set or fix it later on the request page (`PATCH /api/requests/:id` with
  `latitude`, `longitude`).
- **Donor profile**: optional "my usual area" pin → `latitude`, `longitude` in `PUT /api/donors/me`.
  Used only for distance matching; the exact point is never shown to other users.

## 2. Live trip tracking

### Data
Each `BloodRequest.matchedDonors[]` entry gets an optional `trip` sub-document:

| field | type | notes |
|---|---|---|
| status | `"on_the_way"` \| `"arrived"` \| `"stopped"` | |
| startedAt | Date | |
| updatedAt | Date | last location update or status change |
| endedAt | Date | set on arrived/stopped |
| lat, lng | Number | **only while `on_the_way`**; cleared (unset) when the trip ends |
| accuracy | Number | metres, from the browser |

A trip older than **4 hours** (from `startedAt`) still marked `on_the_way` is treated as
`stopped` and its coordinates are cleared the next time anything reads or writes it.

### Who
- Only a donor whose `response` on that request is `"accepted"` can start/update/end their trip,
  and only while the request is `open` or `in_progress`.
- Only the requester (and admins) can see trips. The donor can read their own trip.
- Coordinates are never included anywhere else (not in request DTOs, not in matches, not public).

### Endpoints (under `/api/requests`, all `protect`)
- `POST /api/requests/:id/trip` body `{ action: "start" | "arrived" | "stop" }` → `{ trip: TripOwn }`
  - `start`: status `on_the_way`, `startedAt`/`updatedAt` now, clears old coords. 409 if the request is closed, 403 if not an accepted donor.
  - `arrived` / `stop`: ends the trip, clears `lat`/`lng`/`accuracy`, sets `endedAt`.
  - Notifies the requester (`request_update` notification with `relatedRequest`): "<name> is on the way" / "<name> has arrived". (Not on `stop`.)
- `PUT /api/requests/:id/trip/location` body `{ latitude, longitude, accuracy? }` → `{ trip: TripOwn }`
  - only while `on_the_way`; validates ranges; accuracy 0–5000.
  - Throttle: updates arriving less than 4 s after the previous one are accepted but not saved (respond 200 with the current trip). Plus a per-user rate limit of 40/minute.
- `GET /api/requests/:id/trips` → for the requester/admin: `{ hospital: { lat, lng } | null, trips: [TripView] }`; for an accepted donor: `{ hospital, trips: [their own TripView] }`; anyone else 403/404.

Shapes:
- `TripOwn = { status, startedAt, updatedAt, endedAt, lat?, lng?, accuracy?, distanceKm, etaMinutes }`
- `TripView = TripOwn + { donorId, name, avatar, bloodGroup, phone }` (phone is already shared with the requester once a donor accepts)
- `distanceKm` = straight-line distance from the donor's last position to the hospital pin (null if either is missing).
- `etaMinutes` = `round(distanceKm * 1.35 / speed * 60)` with `speed = Number(process.env.TRIP_AVG_KMH) || 18` (city traffic), null if distance is null; 0 when arrived.

### Real time
After every saved change the server emits to the requester's socket room:
`trip:update` → `{ requestId, trip: TripView }` (using `emitToUser` from `services/socket.js`).
The client also polls `GET /trips` every 30 s as a fallback.

## 3. Client UI
- `components/map/BaseMap.jsx` – Leaflet map with OSM tiles and attribution; custom `L.divIcon`
  markers (hospital, donor, "you") so no image assets are needed.
- `components/map/LocationPicker.jsx` – "Use my current location" (Geolocation API, high accuracy,
  accuracy circle), click / drag to adjust the pin, Nominatim search box (button-triggered, Bangladesh only),
  reverse-geocoded address under the map, "Clear" button, `value={ lat, lng } | null`, `onChange`.
- Request form: optional "Hospital location" picker. Donor profile: optional "My usual area" picker.
- Request page, **accepted donor**: "Going to donate?" card → **I'm on my way** (starts `watchPosition`,
  sends updates at most every 5 s or after moving 25 m), map with you + hospital, distance + ETA,
  **I've arrived**, **Stop sharing**; clear "Only the requester can see your live location" notice and
  "keep this page open while travelling". Sharing stops when the page is closed (last position stays
  visible to the requester with its time).
- Request page, **requester**: "Donors on the way" live map (hospital + every donor on a trip),
  list with status, distance, ETA, "updated x min ago", call button; live via socket `trip:update`.
  If the request has no hospital pin: a prompt with the LocationPicker to set it (PATCH).
- All text English + Bangla.
