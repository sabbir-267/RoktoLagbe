import { api } from "./api";

// Live donor trips (docs/maps-and-live-tracking.md, section 2). All return { trip: TripOwn }.
const tripAction = (id, action) => api.post(`/requests/${id}/trip`, { action }).then((r) => r.data);

export const startTrip = (id) => tripAction(id, "start");
export const arriveTrip = (id) => tripAction(id, "arrived");
export const stopTrip = (id) => tripAction(id, "stop");

// body: { latitude, longitude, accuracy? }
export const sendTripLocation = (id, { latitude, longitude, accuracy }) =>
  api
    .put(`/requests/${id}/trip/location`, accuracy == null ? { latitude, longitude } : { latitude, longitude, accuracy })
    .then((r) => r.data);

// -> { hospital: { lat, lng } | null, trips: [TripView] }
export const getTrips = (id) => api.get(`/requests/${id}/trips`).then((r) => r.data);

// Set or fix the hospital pin of a request
export const updateRequestLocation = (id, { latitude, longitude }) =>
  api.patch(`/requests/${id}`, { latitude, longitude }).then((r) => r.data);
