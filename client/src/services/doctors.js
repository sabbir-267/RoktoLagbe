import { api } from "./api";

// Doctor directory, applications and the admin review (see docs/doctor-consultation.md)

export const DOCTOR_SPECIALTIES = [
  "hematology",
  "transfusion_medicine",
  "internal_medicine",
  "pediatrics",
  "gynecology",
  "surgery",
  "general_practice",
  "other",
];
export const DOCTOR_STATUSES = ["pending", "approved", "rejected", "suspended"];
export const DOCTOR_LANGUAGES = ["bn", "en"];

// Tailwind classes for a doctor application status chip
export const DOCTOR_STATUS_CHIP = {
  pending: "bg-amber-50 text-amber-800",
  approved: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-brand-red",
  suspended: "bg-gray-100 text-gray-600",
};

// Public. params: { specialty?, district? } → { doctors: [DoctorPublic] }
export const listDoctors = (params) => api.get("/doctors", { params }).then((r) => r.data);

// body: { bmdcNo, specialty, hospital, district, bio?, languages? } → { doctor: DoctorOwn }
export const applyDoctor = (body) => api.post("/doctors/apply", body).then((r) => r.data);

// → { doctor: DoctorOwn | null }
export const getMyDoctorProfile = () => api.get("/doctors/me").then((r) => r.data);

// Role doctor. patch: { bio?, hospital?, district?, languages?, acceptingQuestions? } → { doctor }
export const updateMyDoctorProfile = (patch) => api.patch("/doctors/me", patch).then((r) => r.data);

// Admin. params: { status?, q?, page? } → { doctors, total, page, pages }
export const adminListDoctors = (params) => api.get("/admin/doctors", { params }).then((r) => r.data);

// Admin. body: { status: "approved" | "rejected" | "suspended", reviewNote? }
export const adminReviewDoctor = (id, body) => api.patch(`/admin/doctors/${id}`, body).then((r) => r.data);
