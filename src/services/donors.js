import { api } from "./api";

export const getMyProfile = () => api.get("/donors/me").then((r) => r.data);

// PUT creates the profile if it doesn't exist, otherwise updates it
export const saveMyProfile = (payload) => api.put("/donors/me", payload).then((r) => r.data);

// Assumption: the body field is "available". Change it here if the backend uses another name.
export const setAvailability = (available) =>
  api.patch("/donors/me/availability", { isAvailable: available }).then((r) => r.data);

// Used in Step 6B (Find Donors)
export const searchDonors = (params) => api.get("/donors", { params }).then((r) => r.data);