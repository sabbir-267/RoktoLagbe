import { api } from "./api";

export const getAdminStats = () => api.get("/admin/stats").then((r) => r.data);

export const listUsers = (params) => api.get("/admin/users", { params }).then((r) => r.data);

// patch: { role?: "user" | "admin", isActive?: boolean }
export const updateUser = (id, patch) => api.patch(`/admin/users/${id}`, patch).then((r) => r.data);

export const listAllBanks = (params) => api.get("/admin/banks", { params }).then((r) => r.data);

export const setBankApproval = (id, isApproved) =>
  api.patch(`/admin/banks/${id}/approval`, { isApproved }).then((r) => r.data);

export const listAllDonors = (params) => api.get("/admin/donors", { params }).then((r) => r.data);

export const verifyDonor = (id, isVerified) =>
  api.patch(`/donors/${id}/verify`, { isVerified }).then((r) => r.data);
