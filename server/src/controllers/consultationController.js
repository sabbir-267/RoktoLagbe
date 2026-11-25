import Consultation from "../models/Consultation.js";
import DoctorProfile from "../models/DoctorProfile.js";
import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { notifyConsultation } from "../services/consultationNotify.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const str = (v) => (typeof v === "string" ? v.trim() : "");
const idOf = (v) => (v ? String(v._id ?? v) : null);
const sameId = (a, b) => !!a && !!b && idOf(a) === idOf(b);

const MAX_DOCTORS_NOTIFIED = 30;
const QUEUE_MINE_LIMIT = 50;
const PUBLIC_PAGE_SIZE = 10;
const threadLink = (c) => `/consultations/${c._id}`;

// ---------- Who is looking ----------

// "asker" | "doctor" (assigned) | "admin" | "candidate" (a doctor looking at an unclaimed question) | null
const viewerRole = (c, user) => {
  if (!user) return null;
  if (sameId(c.asker, user._id)) return "asker";
  if (sameId(c.doctor, user._id)) return "doctor";
  if (user.role === "admin") return "admin";
  if (user.role === "doctor" && c.status === "open") return "candidate";
  return null;
};

// ---------- Shapes (see docs/doctor-consultation.md) ----------

// Map of doctor userId → DoctorBrief. Never includes phone or email.
const doctorBriefs = async (userIds) => {
  const ids = [...new Set(userIds.filter(Boolean).map(idOf))];
  if (!ids.length) return new Map();
  const [profiles, users] = await Promise.all([
    DoctorProfile.find({ user: { $in: ids } }).select("user specialty hospital").lean(),
    User.find({ _id: { $in: ids } }).select("name avatar").lean(),
  ]);
  const profileOf = new Map(profiles.map((p) => [String(p.user), p]));
  return new Map(
    users.map((u) => [
      String(u._id),
      {
        userId: u._id,
        name: u.name,
        avatar: u.avatar || null,
        specialty: profileOf.get(String(u._id))?.specialty || null,
        hospital: profileOf.get(String(u._id))?.hospital || null,
      },
    ])
  );
};

const unreadFor = (c, role) => {
  const seen = role === "asker" ? c.askerSeenAt : role === "doctor" ? c.doctorSeenAt : null;
  if (!seen) return role === "doctor" ? true : false;
  return new Date(c.lastActivityAt).getTime() > new Date(seen).getTime();
};

const toSummary = (c, briefs, role) => {
  const out = {
    id: c._id,
    category: c.category,
    subject: c.subject,
    status: c.status,
    createdAt: c.createdAt,
    lastActivityAt: c.lastActivityAt,
    doctor: c.doctor ? briefs.get(idOf(c.doctor)) || null : null,
    messageCount: c.messages?.length || 0,
  };
  if (role === "asker" || role === "doctor") out.unreadForMe = unreadFor(c, role);
  return out;
};

const toFull = (c, briefs, role, user) => {
  const closed = c.status === "closed";
  return {
    ...toSummary(c, briefs, role),
    question: c.question,
    patientAge: c.patientAge ?? null,
    patientSex: c.patientSex || null,
    shareAnonymously: !!c.shareAnonymously,
    hiddenFromPublic: !!c.hiddenFromPublic,
    messages: (c.messages || []).map((m) => ({ id: m._id, from: m.from, text: m.text, createdAt: m.createdAt })),
    // The asker's name is only for the assigned doctor and admins
    asker: role === "doctor" || role === "admin" ? { name: c.asker?.name ?? null } : undefined,
    canReply: !closed && (role === "asker" || (role === "doctor" && user.role === "doctor")),
    canClaim: c.status === "open" && user.role === "doctor" && !sameId(c.asker, user._id),
    canClose: !closed && (role === "asker" || role === "doctor" || role === "admin"),
    canRelease: role === "doctor" && c.status === "claimed",
  };
};

// Builds the full view for `user`, loading what it needs
const fullFor = async (c, user) => {
  const role = viewerRole(c, user);
  if ((role === "doctor" || role === "admin") && !c.populated?.("asker")) {
    await c.populate({ path: "asker", select: "name" });
  }
  const briefs = await doctorBriefs([c.doctor]);
  return toFull(c, briefs, role, user);
};

const toPublicAnswer = (c, briefs) => ({
  id: c._id,
  category: c.category,
  subject: c.subject,
  question: c.question,
  answeredAt: c.answeredAt,
  doctor: briefs.get(idOf(c.doctor)) || null,
  messages: (c.messages || []).map((m) => ({ from: m.from, text: m.text, createdAt: m.createdAt })),
});

// Loads a consultation the user may see, or throws 404 (so outsiders can't tell it exists)
const loadVisible = async (id, user) => {
  const c = await Consultation.findById(id);
  if (!c || !viewerRole(c, user)) throw new ApiError(404, "Question not found");
  return c;
};

// ---------- Asking ----------

// POST /api/consultations
export const createConsultation = asyncHandler(async (req, res) => {
  const { category, subject, question, patientAge, patientSex, shareAnonymously } = req.body;
  const now = new Date();
  const c = await Consultation.create({
    asker: req.user._id,
    category,
    subject: str(subject),
    question: str(question),
    patientAge: patientAge === undefined || patientAge === null || patientAge === "" ? undefined : Number(patientAge),
    patientSex: patientSex || undefined,
    shareAnonymously: shareAnonymously === true,
    status: "open",
    lastActivityAt: now,
    askerSeenAt: now,
  });

  // Tell the most active available doctors (never the asker themselves)
  try {
    const profiles = await DoctorProfile.find({ status: "approved", acceptingQuestions: true, user: { $ne: req.user._id } })
      .sort({ answeredCount: -1 })
      .limit(MAX_DOCTORS_NOTIFIED * 2)
      .select("user")
      .lean();
    const active = await User.find({
      _id: { $in: profiles.map((p) => p.user) },
      role: "doctor",
      isActive: true,
    }).distinct("_id");
    const activeSet = new Set(active.map(String));
    const recipients = profiles.map((p) => String(p.user)).filter((id) => activeSet.has(id)).slice(0, MAX_DOCTORS_NOTIFIED);
    await notifyConsultation(recipients, {
      title: "New health question",
      message: `A new question is waiting for a doctor: "${c.subject}"`,
      link: "/doctor-portal",
    });
  } catch (err) {
    console.error("Could not notify doctors about a new question:", err.message);
  }

  res.status(201).json({ success: true, consultation: await fullFor(c, req.user) });
});

// GET /api/consultations/mine
export const myConsultations = asyncHandler(async (req, res) => {
  const rows = await Consultation.find({ asker: req.user._id }).sort({ lastActivityAt: -1 }).limit(100);
  const briefs = await doctorBriefs(rows.map((c) => c.doctor));
  res.json({ success: true, consultations: rows.map((c) => toSummary(c, briefs, "asker")) });
});

// ---------- Doctors ----------

// GET /api/consultations/queue?category=   (role doctor)
export const doctorQueue = asyncHandler(async (req, res) => {
  const openFilter = { status: "open", asker: { $ne: req.user._id } };
  if (str(req.query.category)) openFilter.category = req.query.category;

  const [openRows, mineRows] = await Promise.all([
    Consultation.find(openFilter).sort({ createdAt: 1 }).limit(100),
    Consultation.find({ doctor: req.user._id, status: { $in: ["claimed", "answered", "closed"] } })
      .sort({ lastActivityAt: -1 })
      .limit(QUEUE_MINE_LIMIT),
  ]);
  const briefs = await doctorBriefs(mineRows.map((c) => c.doctor));

  res.json({
    success: true,
    open: openRows.map((c) => ({
      ...toSummary(c, briefs, null),
      question: c.question.length > 300 ? `${c.question.slice(0, 300)}…` : c.question,
      patientAge: c.patientAge ?? null,
      patientSex: c.patientSex || null,
    })),
    mine: mineRows.map((c) => toSummary(c, briefs, "doctor")),
  });
});

// POST /api/consultations/:id/claim   (role doctor; atomic)
export const claimConsultation = asyncHandler(async (req, res) => {
  const now = new Date();
  const c = await Consultation.findOneAndUpdate(
    { _id: req.params.id, status: "open", asker: { $ne: req.user._id } },
    { $set: { status: "claimed", doctor: req.user._id, claimedAt: now, lastActivityAt: now, doctorSeenAt: now } },
    { new: true }
  );
  if (!c) {
    const existing = await Consultation.findById(req.params.id).select("status asker doctor");
    if (!existing) throw new ApiError(404, "Question not found");
    if (sameId(existing.asker, req.user._id)) throw new ApiError(400, "You can't answer your own question");
    if (sameId(existing.doctor, req.user._id)) throw new ApiError(409, "You are already handling this question");
    throw new ApiError(409, "Another doctor has already taken this question");
  }

  await notifyConsultation(c.asker, {
    title: "A doctor is reviewing your question",
    message: `Dr. ${req.user.name} is reviewing your question "${c.subject}".`,
    link: threadLink(c),
  });
  res.json({ success: true, consultation: await fullFor(c, req.user) });
});

// POST /api/consultations/:id/release   (assigned doctor, status claimed)
export const releaseConsultation = asyncHandler(async (req, res) => {
  const c = await Consultation.findOneAndUpdate(
    { _id: req.params.id, doctor: req.user._id, status: "claimed" },
    { $set: { status: "open", lastActivityAt: new Date() }, $unset: { doctor: 1, claimedAt: 1, doctorSeenAt: 1 } },
    { new: true }
  );
  if (!c) {
    const existing = await Consultation.findById(req.params.id);
    if (!existing || !viewerRole(existing, req.user)) throw new ApiError(404, "Question not found");
    throw new ApiError(409, "Only the doctor who took this question can release it, and only before replying");
  }
  res.json({ success: true, consultation: await fullFor(c, req.user) });
});

// ---------- Thread ----------

// GET /api/consultations/public?q=&category=&page=   (public FAQ)
export const publicAnswers = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = PUBLIC_PAGE_SIZE;
  const filter = {
    shareAnonymously: true,
    hiddenFromPublic: false,
    status: { $in: ["answered", "closed"] },
    "messages.from": "doctor",
  };
  if (str(req.query.category)) filter.category = req.query.category;
  const q = str(req.query.q);
  if (q) {
    const re = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ subject: re }, { question: re }];
  }

  const [rows, total] = await Promise.all([
    Consultation.find(filter)
      .sort({ answeredAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("category subject question answeredAt doctor messages.from messages.text messages.createdAt"),
    Consultation.countDocuments(filter),
  ]);
  const briefs = await doctorBriefs(rows.map((c) => c.doctor));
  res.json({
    success: true,
    answers: rows.map((c) => toPublicAnswer(c, briefs)),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

// GET /api/consultations/:id   (asker, assigned doctor, admin)
export const getConsultation = asyncHandler(async (req, res) => {
  const c = await loadVisible(req.params.id, req.user);
  const role = viewerRole(c, req.user);
  const seenField = role === "asker" ? "askerSeenAt" : role === "doctor" ? "doctorSeenAt" : null;
  if (seenField) {
    c[seenField] = new Date();
    Consultation.updateOne({ _id: c._id }, { $set: { [seenField]: c[seenField] } }).catch(() => {});
  }
  res.json({ success: true, consultation: await fullFor(c, req.user) });
});

// POST /api/consultations/:id/messages   Body: { text }   (asker or assigned doctor)
export const postMessage = asyncHandler(async (req, res) => {
  const c0 = await loadVisible(req.params.id, req.user);
  const role = viewerRole(c0, req.user);
  if (role !== "asker" && !(role === "doctor" && req.user.role === "doctor")) {
    throw new ApiError(403, "Only the person who asked and the doctor handling this question can reply");
  }
  if (c0.status === "closed") throw new ApiError(409, "This conversation is closed");

  const now = new Date();
  const message = { author: req.user._id, from: role, text: str(req.body.text), createdAt: now };
  const seenField = role === "asker" ? "askerSeenAt" : "doctorSeenAt";
  const base = { $push: { messages: message }, $set: { lastActivityAt: now, [seenField]: now } };

  let c = null;
  let firstAnswer = false;
  if (role === "doctor") {
    // First reply: claimed → answered (atomic, so answeredCount is counted once)
    c = await Consultation.findOneAndUpdate(
      { _id: c0._id, doctor: req.user._id, status: "claimed" },
      { ...base, $set: { ...base.$set, status: "answered", answeredAt: now } },
      { new: true }
    );
    firstAnswer = !!c;
    if (!c) {
      c = await Consultation.findOneAndUpdate(
        { _id: c0._id, doctor: req.user._id, status: "answered" },
        base,
        { new: true }
      );
    }
  } else {
    c = await Consultation.findOneAndUpdate({ _id: c0._id, asker: req.user._id, status: { $ne: "closed" } }, base, {
      new: true,
    });
  }
  if (!c) throw new ApiError(409, "This conversation changed. Please reload and try again.");

  if (firstAnswer) {
    await DoctorProfile.updateOne({ user: req.user._id }, { $inc: { answeredCount: 1 } }).catch((err) =>
      console.error("answeredCount update failed:", err.message)
    );
  }

  const other = role === "doctor" ? c.asker : c.doctor;
  if (other) {
    await notifyConsultation(other, {
      title: role === "doctor" ? "The doctor replied to your question" : "New reply on a question you're handling",
      message:
        role === "doctor"
          ? `Dr. ${req.user.name} replied to "${c.subject}".`
          : `The person who asked "${c.subject}" sent a new message.`,
      link: threadLink(c),
    });
  }

  const saved = c.messages[c.messages.length - 1];
  res.status(201).json({
    success: true,
    message: { id: saved._id, from: saved.from, text: saved.text, createdAt: saved.createdAt },
    consultation: await fullFor(c, req.user),
  });
});

// POST /api/consultations/:id/close   (asker, assigned doctor or admin)
export const closeConsultation = asyncHandler(async (req, res) => {
  const c0 = await loadVisible(req.params.id, req.user);
  const role = viewerRole(c0, req.user);
  if (role === "candidate") throw new ApiError(403, "Only the person who asked, the assigned doctor or an admin can close this");
  if (c0.status === "closed") throw new ApiError(409, "This conversation is already closed");

  const now = new Date();
  const set = { status: "closed", closedAt: now, lastActivityAt: now };
  if (role === "asker") set.askerSeenAt = now;
  if (role === "doctor") set.doctorSeenAt = now;
  const c = await Consultation.findOneAndUpdate({ _id: c0._id, status: { $ne: "closed" } }, { $set: set }, { new: true });
  if (!c) throw new ApiError(409, "This conversation is already closed");
  res.json({ success: true, consultation: await fullFor(c, req.user) });
});

// PATCH /api/consultations/:id/share   Body: { shareAnonymously }   (asker)
export const setShare = asyncHandler(async (req, res) => {
  const c0 = await loadVisible(req.params.id, req.user);
  if (viewerRole(c0, req.user) !== "asker") {
    throw new ApiError(403, "Only the person who asked can change this");
  }
  const c = await Consultation.findOneAndUpdate(
    { _id: c0._id, asker: req.user._id },
    { $set: { shareAnonymously: req.body.shareAnonymously } },
    { new: true }
  );
  res.json({ success: true, consultation: await fullFor(c, req.user) });
});

// ---------- Admin ----------

// PATCH /api/admin/consultations/:id/visibility   Body: { hiddenFromPublic }
export const setVisibility = asyncHandler(async (req, res) => {
  const c = await Consultation.findByIdAndUpdate(
    req.params.id,
    { $set: { hiddenFromPublic: req.body.hiddenFromPublic } },
    { new: true }
  );
  if (!c) throw new ApiError(404, "Question not found");
  res.json({ success: true, consultation: await fullFor(c, req.user) });
});
