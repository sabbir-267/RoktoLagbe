import { api } from "./api";

export const listBatches = (bankId, params) =>
  api.get(`/banks/${bankId}/inventory`, { params }).then((r) => r.data);

export const addBatch = (bankId, payload) =>
  api.post(`/banks/${bankId}/inventory`, payload).then((r) => r.data);

// ASSUMPTION: the route list was cut off before these two. If you get
// "Cannot POST ..." or "Cannot PATCH ...", change the paths here.
export const issueUnits = (bankId, batchId, units) =>
  api.post(`/banks/${bankId}/inventory/${batchId}/issue`, { units }).then((r) => r.data);

export const setBatchStatus = (bankId, batchId, status) =>
  api.patch(`/banks/${bankId}/inventory/${batchId}/status`, { status }).then((r) => r.data);