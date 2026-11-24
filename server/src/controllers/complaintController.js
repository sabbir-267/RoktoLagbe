import Complaint, { makeReference } from "../models/Complaint.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { normalizePhone } from "../utils/phone.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const str = (v) => (typeof v === "string" ? v.trim() : "");

const pageParams = (req, defaultLimit = 20) => ({
  page: Math.max(parseInt(req.query.page, 10) || 1, 1),
  limit: Math.min(Math.max(parseInt(req.query.limit, 10) || defaultLimit, 1), 100),
});
const paged = (page, limit, total) => ({ page, limit, total, pages: Math.ceil(total / limit) });

const STATUS_TEXT = {
  open: "reopened",
  in_review: "being reviewed",
  resolved: "resolved",
  dismissed: "closed without action",
};

// What the reporter sees
const toOwnComplaint = (c) => ({
  id: c._id,
  reference: c.reference,
  category: c.category,
  subject: c.subject,
  message: c.message,
  relatedUrl: c.relatedUrl || "",
  status: c.status,
  adminNote: c.adminNote || "",
  resolvedAt: c.resolvedAt || null,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

// What admins see: adds who reported it and who handled it
const toAdminComplaint = (c) => ({
  ...toOwnComplaint(c),
  reporter: c.reporter
    ? {
        id: c.reporter._id ?? c.reporter,
        name: c.reporter.name,
        phone: c.reporter.phone,
        email: c.reporter.email,
      }
    : null,
  contact: c.reporter
    ? null
    : { name: c.contactName || "", phone: c.contactPhone || "", email: c.contactEmail || "" },
  handledBy: c.handledBy ? { id: c.handledBy._id ?? c.handledBy, name: c.handledBy.name } : null,
});

// POST /api/complaints   (guest or logged in)
export const createComplaint = asyncHandler(async (req, res) => {
  const { category, subject, message, relatedUrl, contactName, contactPhone, contactEmail } = req.body;
  const doc = {
    category,
    subject: str(subject),
    message: str(message),
    relatedUrl: str(relatedUrl) || undefined,
  };
  if (req.user) {
    doc.reporter = req.user._id; // never taken from the body
  } else {
    doc.contactName = str(contactName) || undefined;
    doc.contactPhone = str(contactPhone) ? normalizePhone(contactPhone) : undefined;
    doc.contactEmail = str(contactEmail).toLowerCase() || undefined;
    if (!doc.contactPhone && !doc.contactEmail) {
      throw new ApiError(400, "Give a phone number or email so we can reach you");
    }
  }

  // The reference is random; retry on the rare duplicate
  let complaint;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      complaint = await Complaint.create({ ...doc, reference: makeReference() });
      break;
    } catch (err) {
      if (err?.code !== 11000 || attempt === 4) throw err;
    }
  }
  res.status(201).json({ success: true, complaint: toOwnComplaint(complaint) });
});

// GET /api/complaints/mine
export const myComplaints = asyncHandler(async (req, res) => {
  const rows = await Complaint.find({ reporter: req.user._id }).sort({ createdAt: -1 }).limit(100);
  res.json({ success: true, complaints: rows.map(toOwnComplaint) });
});

// GET /api/complaints?status=&category=&q=&page=   (admin)
export const listComplaints = asyncHandler(async (req, res) => {
  const { page, limit } = pageParams(req);
  const filter = {};
  if (str(req.query.status)) filter.status = req.query.status;
  if (str(req.query.category)) filter.category = req.query.category;
  const q = str(req.query.q);
  if (q) {
    const re = new RegExp(escapeRegex(q), "i");
    const userIds = await User.find({ $or: [{ name: re }, { phone: re }, { email: re }] }).distinct("_id");
    filter.$or = [
      { reference: re },
      { subject: re },
      { message: re },
      { contactName: re },
      { contactPhone: re },
      { contactEmail: re },
      { reporter: { $in: userIds } },
    ];
  }

  const [rows, total] = await Promise.all([
    Complaint.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("reporter", "name phone email")
      .populate("handledBy", "name"),
    Complaint.countDocuments(filter),
  ]);
  res.json({ success: true, ...paged(page, limit, total), complaints: rows.map(toAdminComplaint) });
});

// PATCH /api/complaints/:id   Body: { status?, adminNote? }   (admin)
export const updateComplaint = asyncHandler(async (req, res) => {
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw new ApiError(404, "Complaint not found");

  const { status, adminNote } = req.body;
  const statusChanged = status !== undefined && status !== complaint.status;
  const noteChanged = adminNote !== undefined && str(adminNote) !== (complaint.adminNote || "");

  if (statusChanged) {
    complaint.status = status;
    complaint.resolvedAt = ["resolved", "dismissed"].includes(status) ? new Date() : undefined;
  }
  if (adminNote !== undefined) complaint.adminNote = str(adminNote);
  if (statusChanged || noteChanged) complaint.handledBy = req.user._id;
  await complaint.save();

  if (complaint.reporter && (statusChanged || noteChanged)) {
    await Notification.create({
      user: complaint.reporter,
      type: "system",
      title: `Update on your complaint ${complaint.reference}`,
      message: statusChanged
        ? `Your complaint "${complaint.subject}" is now ${STATUS_TEXT[complaint.status]}.` +
          (complaint.adminNote ? " Open the complaint box to read our reply." : "")
        : `We replied to your complaint "${complaint.subject}". Open the complaint box to read it.`,
    });
  }

  await complaint.populate([
    { path: "reporter", select: "name phone email" },
    { path: "handledBy", select: "name" },
  ]);
  res.json({ success: true, complaint: toAdminComplaint(complaint) });
});
