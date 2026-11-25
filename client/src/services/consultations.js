import { api } from "./api";

// "Ask a doctor" questions (see docs/doctor-consultation.md)

export const CONSULTATION_CATEGORIES = [
  "donation_eligibility",
  "after_donation",
  "transfusion",
  "thalassemia",
  "pregnancy",
  "medicines",
  "other",
];
export const CONSULTATION_STATUSES = ["open", "claimed", "answered", "closed"];
export const PATIENT_SEXES = ["male", "female", "other"];

export const SUBJECT_MIN = 5;
export const SUBJECT_MAX = 120;
export const QUESTION_MIN = 20;
export const QUESTION_MAX = 3000;
export const MESSAGE_MAX = 3000;

// Tailwind classes for a consultation status chip
export const CONSULTATION_STATUS_CHIP = {
  open: "bg-amber-50 text-amber-800",
  claimed: "bg-blue-50 text-brand-blue",
  answered: "bg-green-50 text-green-700",
  closed: "bg-gray-100 text-gray-600",
};

// body: { category, subject, question, patientAge?, patientSex?, shareAnonymously? } → { consultation }
export const askQuestion = (body) => api.post("/consultations", body).then((r) => r.data);

// → { consultations: [ConsultationSummary] }
export const listMyConsultations = () => api.get("/consultations/mine").then((r) => r.data);

// Role doctor. params: { category? } → { open, mine }
export const getConsultationQueue = (params) => api.get("/consultations/queue", { params }).then((r) => r.data);

// Public FAQ. params: { q?, category?, page? } → { answers, total, page, pages }
export const listPublicAnswers = (params) => api.get("/consultations/public", { params }).then((r) => r.data);

// → { consultation: ConsultationFull }
export const getConsultation = (id) => api.get(`/consultations/${id}`).then((r) => r.data);

export const claimConsultation = (id) => api.post(`/consultations/${id}/claim`).then((r) => r.data);

export const releaseConsultation = (id) => api.post(`/consultations/${id}/release`).then((r) => r.data);

// → { message, consultation }
export const replyToConsultation = (id, text) =>
  api.post(`/consultations/${id}/messages`, { text }).then((r) => r.data);

export const closeConsultation = (id) => api.post(`/consultations/${id}/close`).then((r) => r.data);

export const setConsultationShare = (id, shareAnonymously) =>
  api.patch(`/consultations/${id}/share`, { shareAnonymously }).then((r) => r.data);

// Admin: hide/show an answer in the public FAQ
export const adminSetConsultationVisibility = (id, hiddenFromPublic) =>
  api.patch(`/admin/consultations/${id}/visibility`, { hiddenFromPublic }).then((r) => r.data);
