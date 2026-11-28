import { api } from "./api";

export const listRequests = (params) => api.get("/requests", { params }).then((r) => r.data);

export const listMyRequests = (params) => api.get("/requests/mine", { params }).then((r) => r.data);

export const getRequest = (id) => api.get(`/requests/${id}`).then((r) => r.data);

export const createRequest = (payload) => api.post("/requests", payload).then((r) => r.data);

// Returns a DRAFT only. Nothing is saved until the person submits the form.
export const parseRequestText = (text) =>
  api.post("/requests/parse", { text }).then((r) => r.data);

// donorIds: when fulfilling, the accepted donors who actually gave blood (their donations get recorded)
export const setRequestStatus = (id, status, fulfilledUnits, donorIds) =>
  api
    .patch(`/requests/${id}/status`, {
      status,
      ...(fulfilledUnits ? { fulfilledUnits } : {}),
      ...(Array.isArray(donorIds) ? { donorIds } : {}),
    })
    .then((r) => r.data);

// Donor matching
export const getMatches = (id, params) =>
  api.get(`/requests/${id}/matches`, { params }).then((r) => r.data);

export const notifyMatches = (id, body) =>
  api.post(`/requests/${id}/notify`, body).then((r) => r.data);

export const getResponses = (id) => api.get(`/requests/${id}/responses`).then((r) => r.data);

export const respondToRequest = (id, response) =>
  api.post(`/requests/${id}/respond`, { response }).then((r) => r.data);

// The requester confirms an accepted donor actually gave blood (resets their last donation date)
export const confirmDonation = (requestId, donorId, donatedAt) =>
  api.post(`/requests/${requestId}/donations/${donorId}`, donatedAt ? { donatedAt } : {}).then((r) => r.data);

export const undoDonation = (requestId, donorId) =>
  api.delete(`/requests/${requestId}/donations/${donorId}`).then((r) => r.data);
