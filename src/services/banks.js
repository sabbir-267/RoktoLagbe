import { api } from "./api";

export const listBanks = (params) => api.get("/banks", { params }).then((r) => r.data);

export const getBank = (id) => api.get(`/banks/${id}`).then((r) => r.data);