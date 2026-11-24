import { api } from "./api";

export const listBanks = (params) => api.get("/banks", { params }).then((r) => r.data);

export const getBank = (id) => api.get(`/banks/${id}`).then((r) => r.data);
// ---------- Blood bank portal ----------
export const getMyBank = () => api.get("/banks/mine").then((r) => r.data);

export const applyForBank = (payload) => api.post("/banks/apply", payload).then((r) => r.data);

export const updateBank = (id, payload) => api.patch(`/banks/${id}`, payload).then((r) => r.data);

// Admin only
export const createBank = (payload) => api.post("/banks", payload).then((r) => r.data);

export const listStaff = (id) => api.get(`/banks/${id}/staff`).then((r) => r.data);

// Admin only
export const assignStaff = (id, phone) => api.post(`/banks/${id}/staff`, { phone }).then((r) => r.data);

// Admin only
export const removeStaff = (id, userId) => api.delete(`/banks/${id}/staff/${userId}`).then((r) => r.data);

// ---------- Donations (bank staff) ----------
export const lookupDonor = (id, phone) =>
  api.get(`/banks/${id}/donors/lookup`, { params: { phone } }).then((r) => r.data);

export const recordDonation = (id, payload) => api.post(`/banks/${id}/donations`, payload).then((r) => r.data);

export const listBankDonations = (id, params) =>
  api.get(`/banks/${id}/donations`, { params }).then((r) => r.data);
