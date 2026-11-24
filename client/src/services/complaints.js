import { api } from "./api";

// body: { category, subject, message, relatedUrl?, contactName?, contactPhone?, contactEmail? }
export const createComplaint = (body) => api.post("/complaints", body).then((r) => r.data);

export const myComplaints = () => api.get("/complaints/mine").then((r) => r.data);

// Admin only
export const listComplaints = (params) => api.get("/complaints", { params }).then((r) => r.data);

// patch: { status?, adminNote? }
export const updateComplaint = (id, patch) => api.patch(`/complaints/${id}`, patch).then((r) => r.data);

export const COMPLAINT_CATEGORIES = [
  "fake_request",
  "asked_for_money",
  "donor_behaviour",
  "requester_behaviour",
  "blood_bank",
  "app_problem",
  "other",
];
export const COMPLAINT_STATUSES = ["open", "in_review", "resolved", "dismissed"];

export const STATUS_CHIP = {
  open: "bg-amber-50 text-amber-800",
  in_review: "bg-blue-50 text-brand-blue",
  resolved: "bg-green-50 text-green-700",
  dismissed: "bg-gray-100 text-gray-600",
};

// Same rule as the server: a path on this site, no scheme and no "//"
export const isSitePath = (v) =>
  typeof v === "string" &&
  v.length <= 300 &&
  v.startsWith("/") &&
  !v.includes("//") &&
  !v.includes("\\") &&
  !/^\/*[a-z][a-z0-9+.-]*:/i.test(v) &&
  !/[\s<>"'`]/.test(v);
