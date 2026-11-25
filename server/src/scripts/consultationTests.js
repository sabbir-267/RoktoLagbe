// server/src/scripts/consultationTests.js
//
// Live checks for "Ask a doctor" (docs/doctor-consultation.md).
// Needs the API running (npm run dev in another terminal).
// Creates its own "ZZ Test" users directly in MongoDB (including a throwaway admin),
// logs them in through the API, and deletes everything it created at the end.
//
// Run:  npm run test:consult
// Optional env: BASE_URL

import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import DoctorProfile from "../models/DoctorProfile.js";
import Consultation from "../models/Consultation.js";
import Notification from "../models/Notification.js";

const BASE = process.env.BASE_URL || "http://localhost:5000";
const PASSWORD = "password123";
const RUN = Date.now().toString(36).toUpperCase();

let passed = 0;
let failed = 0;

const check = (name, ok, detail = "") => {
  ok ? passed++ : failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? `\n     → ${detail}` : ""}`);
};

const api = async (method, path, token, body) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429) {
    throw new Error(`Rate limited (429) on ${method} ${path}. Restart the server to reset the in-memory limiter.`);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }
  return { status: res.status, data };
};

const created = { userIds: [] };

const freePhone = async () => {
  for (let i = 0; i < 50; i++) {
    const phone = "0199999" + String(Math.floor(Math.random() * 1e4)).padStart(4, "0");
    if (!(await User.exists({ phone }))) return phone;
  }
  throw new Error("Could not find a free test phone number");
};

// Creates a user directly in the DB, then logs in through the API
const makeUser = async (label, role = "user") => {
  const phone = await freePhone();
  const user = await User.create({
    name: `ZZ Test ${label} ${RUN}`,
    phone,
    passwordHash: await bcrypt.hash(PASSWORD, 10),
    role,
  });
  created.userIds.push(user._id);
  const r = await api("POST", "/api/auth/login", null, { phone, password: PASSWORD });
  if (r.status !== 200) throw new Error(`Could not log in ${label}: ${r.status} ${JSON.stringify(r.data)}`);
  return { id: String(user._id), phone, name: user.name, token: r.data.token };
};

const hasContact = (obj) => {
  const s = JSON.stringify(obj);
  return /"phone"|"email"/.test(s);
};

const run = async () => {
  const health = await api("GET", "/api/health").catch(() => null);
  if (!health || health.status !== 200) {
    throw new Error(`API is not reachable at ${BASE}. Start it with "npm run dev" first.`);
  }
  await connectDB();

  const admin = await makeUser("Admin", "admin");
  const doc1 = await makeUser("Doctor One");
  const doc2 = await makeUser("Doctor Two");
  const asker = await makeUser("Asker");
  const outsider = await makeUser("Outsider");
  const plain = await makeUser("Plain");
  console.log(`\nSetup done (run ${RUN})\n`);

  // ---------- Applying ----------
  console.log("— Doctor applications —");
  const pub0 = await api("GET", "/api/doctors");
  check("1    GET /api/doctors is public → 200", pub0.status === 200 && Array.isArray(pub0.data?.doctors), `status ${pub0.status}`);

  const noAuth = await api("POST", "/api/doctors/apply", null, {});
  check("2    apply without login → 401", noAuth.status === 401, `status ${noAuth.status}`);

  const badApply = await api("POST", "/api/doctors/apply", doc1.token, {
    bmdcNo: "a b", specialty: "astrology", hospital: "X", district: "Atlantis", languages: ["fr"],
  });
  const badFields = (badApply.data?.errors || []).map((e) => e.field);
  check("3    invalid application → 400", badApply.status === 400, `status ${badApply.status}`);
  check(
    "3    errors for bmdcNo, specialty, hospital, district, languages",
    ["bmdcNo", "specialty", "hospital", "district"].every((f) => badFields.includes(f)) &&
      badFields.some((f) => f.startsWith("languages")),
    `fields: ${badFields.join(", ")}`
  );

  const bmdc1 = `ZZ${RUN}A`.slice(0, 20);
  const apply1 = await api("POST", "/api/doctors/apply", doc1.token, {
    bmdcNo: bmdc1.toLowerCase(), specialty: "hematology", hospital: "  Dhaka Medical College  ", district: "dhaka",
    bio: "Hematologist", languages: ["en"],
  });
  const d1 = apply1.data?.doctor;
  check("4    valid application → 201", apply1.status === 201, `status ${apply1.status} ${JSON.stringify(apply1.data)}`);
  check('4    status "pending", district canonical, text trimmed, bmdc upper-case',
    d1?.status === "pending" && d1?.district === "Dhaka" && d1?.hospital === "Dhaka Medical College" && d1?.bmdcNo === bmdc1,
    JSON.stringify(d1));
  check("4    DoctorOwn has no phone/email", d1 && !hasContact(d1));

  const again = await api("POST", "/api/doctors/apply", doc1.token, {
    bmdcNo: `ZZ${RUN}X`, specialty: "hematology", hospital: "Somewhere", district: "Dhaka",
  });
  check("5    applying twice → 409", again.status === 409, `status ${again.status}`);

  const dupBmdc = await api("POST", "/api/doctors/apply", outsider.token, {
    bmdcNo: bmdc1, specialty: "other", hospital: "Somewhere", district: "Dhaka",
  });
  check("5    duplicate BMDC number → 409", dupBmdc.status === 409, `status ${dupBmdc.status}`);

  const apply2 = await api("POST", "/api/doctors/apply", doc2.token, {
    bmdcNo: `ZZ${RUN}B`, specialty: "general_practice", hospital: "Sylhet MAG Osmani", district: "Sylhet",
  });
  check("6    second doctor applies → 201", apply2.status === 201, `status ${apply2.status}`);

  const me1 = await api("GET", "/api/doctors/me", doc1.token);
  check("7    GET /doctors/me shows the application", me1.data?.doctor?.status === "pending");
  const meNone = await api("GET", "/api/doctors/me", plain.token);
  check("7    GET /doctors/me is null for non-applicants", meNone.status === 200 && meNone.data?.doctor === null);

  // ---------- Admin review ----------
  console.log("\n— Admin review —");
  const notAdmin = await api("GET", "/api/admin/doctors", plain.token);
  check("8    non-admin GET /admin/doctors → 403", notAdmin.status === 403, `status ${notAdmin.status}`);

  const list = await api("GET", `/api/admin/doctors?status=pending&q=${encodeURIComponent(RUN)}`, admin.token);
  const row1 = (list.data?.doctors || []).find((d) => d.id === d1?.id);
  check("9    admin list finds the pending application", list.status === 200 && !!row1, `status ${list.status}`);
  check("9    admin list includes user phone", row1?.user?.phone === doc1.phone, JSON.stringify(row1?.user));
  check("9    admin list is paginated", typeof list.data?.total === "number" && typeof list.data?.pages === "number");

  const badReview = await api("PATCH", `/api/admin/doctors/${d1?.id}`, admin.token, { status: "pending" });
  check("10   review with invalid status → 400", badReview.status === 400, `status ${badReview.status}`);

  const approve1 = await api("PATCH", `/api/admin/doctors/${d1?.id}`, admin.token, { status: "approved", reviewNote: "Welcome" });
  check("10   approve → 200, status approved", approve1.status === 200 && approve1.data?.doctor?.status === "approved",
    `status ${approve1.status} ${JSON.stringify(approve1.data)}`);
  const approve2 = await api("PATCH", `/api/admin/doctors/${apply2.data?.doctor?.id}`, admin.token, { status: "approved" });
  check("10   approve second doctor → 200", approve2.status === 200);
  const roles = await User.find({ _id: { $in: [doc1.id, doc2.id] } }).select("role").lean();
  check('10   both users now have role "doctor"', roles.length === 2 && roles.every((u) => u.role === "doctor"),
    roles.map((u) => u.role).join(","));
  const appNote = await Notification.findOne({ user: doc1.id, type: "consultation" }).lean();
  check("10   applicant gets a consultation notification with a link", appNote?.link === "/doctor-portal", JSON.stringify(appNote));

  const pub1 = await api("GET", "/api/doctors?district=dhaka", null);
  const pd1 = (pub1.data?.doctors || []).find((d) => d.id === d1?.id);
  check("11   approved doctor is listed publicly", !!pd1);
  check("11   public listing hides phone/email/bmdc", pd1 && !hasContact(pd1) && pd1.bmdcNo === undefined, JSON.stringify(pd1));

  const roleChange = await api("PATCH", `/api/admin/users/${doc1.id}`, admin.token, { role: "user" });
  check("12   admin can't change a doctor's role from Users → 409", roleChange.status === 409, `status ${roleChange.status}`);

  const patchPlain = await api("PATCH", "/api/doctors/me", plain.token, { acceptingQuestions: false });
  check("13   non-doctor PATCH /doctors/me → 403", patchPlain.status === 403, `status ${patchPlain.status}`);
  const patchDoc = await api("PATCH", "/api/doctors/me", doc1.token, { bio: "  Blood doctor  ", acceptingQuestions: true });
  check("13   doctor PATCH /doctors/me → 200", patchDoc.status === 200 && patchDoc.data?.doctor?.bio === "Blood doctor",
    `status ${patchDoc.status} ${JSON.stringify(patchDoc.data)}`);
  const patchBad = await api("PATCH", "/api/doctors/me", doc1.token, { acceptingQuestions: "yes" });
  check("13   invalid PATCH → 400", patchBad.status === 400, `status ${patchBad.status}`);

  // ---------- Asking ----------
  console.log("\n— Asking —");
  const badAsk = await api("POST", "/api/consultations", asker.token, {
    category: "nope", subject: "Hi", question: "too short", patientAge: 200, patientSex: "x",
  });
  const askFields = (badAsk.data?.errors || []).map((e) => e.field);
  check("14   invalid question → 400", badAsk.status === 400, `status ${badAsk.status}`);
  check("14   errors for category, subject, question, patientAge, patientSex",
    ["category", "subject", "question", "patientAge", "patientSex"].every((f) => askFields.includes(f)),
    `fields: ${askFields.join(", ")}`);

  const subject = `ZZ ${RUN} can I donate after flu`;
  const ask = await api("POST", "/api/consultations", asker.token, {
    category: "donation_eligibility",
    subject: `  ${subject}  `,
    question: "I had the flu two weeks ago and feel fine now. Can I donate blood this week?",
    patientAge: 28,
    patientSex: "male",
  });
  const c1 = ask.data?.consultation;
  check("15   valid question → 201", ask.status === 201, `status ${ask.status} ${JSON.stringify(ask.data)}`);
  check('15   status "open", subject trimmed, private by default',
    c1?.status === "open" && c1?.subject === subject && c1?.shareAnonymously === false && c1?.doctor === null,
    JSON.stringify(c1));
  check("15   asker's own view has no asker block and canClaim false",
    c1 && c1.asker === undefined && c1.canClaim === false && c1.canReply === true && c1.canClose === true);
  const cid = c1?.id;

  const docNote = await Notification.findOne({ user: doc1.id, type: "consultation", link: "/doctor-portal", title: /question/i }).lean();
  check("16   approved doctor notified about the new question", !!docNote);
  const selfNote = await Notification.findOne({ user: asker.id, link: "/doctor-portal" }).lean();
  check("16   asker is not notified about their own question", !selfNote);

  const mine = await api("GET", "/api/consultations/mine", asker.token);
  const mineRow = (mine.data?.consultations || []).find((c) => c.id === cid);
  check("17   asker sees it in /mine", !!mineRow && mineRow.messageCount === 0, JSON.stringify(mine.data));

  // ---------- Queue and claiming ----------
  console.log("\n— Queue and claiming —");
  const queue = await api("GET", "/api/consultations/queue", doc1.token);
  const qrow = (queue.data?.open || []).find((c) => c.id === cid);
  check("18   doctor sees it in the open queue", queue.status === 200 && !!qrow, `status ${queue.status}`);
  check("18   queue row has question + patient info, no asker", qrow?.patientAge === 28 && !!qrow?.question && qrow.asker === undefined);
  const queuePlain = await api("GET", "/api/consultations/queue", plain.token);
  check("18   non-doctor queue → 403", queuePlain.status === 403, `status ${queuePlain.status}`);

  const outsiderGet = await api("GET", `/api/consultations/${cid}`, outsider.token);
  check("19   outsider GET /:id → 404", outsiderGet.status === 404, `status ${outsiderGet.status}`);
  const candidate = await api("GET", `/api/consultations/${cid}`, doc2.token);
  check("19   a doctor can preview an OPEN question (canClaim, no asker name)",
    candidate.status === 200 && candidate.data?.consultation?.canClaim === true && candidate.data?.consultation?.asker === undefined,
    `status ${candidate.status}`);

  const plainClaim = await api("POST", `/api/consultations/${cid}/claim`, plain.token);
  check("20   non-doctor claim → 403", plainClaim.status === 403, `status ${plainClaim.status}`);

  const [claimA, claimB] = await Promise.all([
    api("POST", `/api/consultations/${cid}/claim`, doc1.token),
    new Promise((r) => setTimeout(r, 300)).then(() => api("POST", `/api/consultations/${cid}/claim`, doc2.token)),
  ]);
  check("20   first doctor claims → 200, status claimed",
    claimA.status === 200 && claimA.data?.consultation?.status === "claimed", `status ${claimA.status} ${JSON.stringify(claimA.data)}`);
  check("20   second doctor's claim → 409", claimB.status === 409, `status ${claimB.status}`);
  check("20   claim view shows asker name to the doctor", claimA.data?.consultation?.asker?.name === asker.name);
  check("20   claim view has canRelease", claimA.data?.consultation?.canRelease === true);
  const claimNote = await Notification.findOne({ user: asker.id, link: `/consultations/${cid}` }).lean();
  check("20   asker notified that a doctor is reviewing", !!claimNote && /Dr\./.test(claimNote.message || ""), JSON.stringify(claimNote));

  const doc2After = await api("GET", `/api/consultations/${cid}`, doc2.token);
  check("21   other doctor can't open it once claimed → 404", doc2After.status === 404, `status ${doc2After.status}`);
  const askerView = await api("GET", `/api/consultations/${cid}`, asker.token);
  const av = askerView.data?.consultation;
  check("21   asker sees doctor brief, never own name block", av?.doctor?.name === doc1.name && av?.doctor?.specialty === "hematology" && av.asker === undefined,
    JSON.stringify(av?.doctor));
  check("21   doctor brief has no phone/email", av && !hasContact(av.doctor));
  const adminView = await api("GET", `/api/consultations/${cid}`, admin.token);
  check("21   admin can open it and sees the asker name", adminView.status === 200 && adminView.data?.consultation?.asker?.name === asker.name);
  check("21   admin can't reply", adminView.data?.consultation?.canReply === false);

  // ---------- Messages ----------
  console.log("\n— Messages —");
  const emptyMsg = await api("POST", `/api/consultations/${cid}/messages`, doc1.token, { text: "   " });
  check("22   empty message → 400", emptyMsg.status === 400, `status ${emptyMsg.status}`);
  const longMsg = await api("POST", `/api/consultations/${cid}/messages`, doc1.token, { text: "x".repeat(3001) });
  check("22   3001-char message → 400", longMsg.status === 400, `status ${longMsg.status}`);

  const reply1 = await api("POST", `/api/consultations/${cid}/messages`, doc1.token, {
    text: "  If you have no fever and feel well, you can usually donate 2 weeks after recovery.  ",
  });
  check("23   doctor reply → 201, status answered",
    reply1.status === 201 && reply1.data?.consultation?.status === "answered", `status ${reply1.status} ${JSON.stringify(reply1.data)}`);
  check("23   message shape { id, from: doctor, text trimmed }",
    reply1.data?.message?.from === "doctor" && !!reply1.data?.message?.id && reply1.data?.message?.text.startsWith("If you"));
  let prof1 = await DoctorProfile.findOne({ user: doc1.id }).lean();
  check("23   answeredCount = 1", prof1?.answeredCount === 1, `answeredCount ${prof1?.answeredCount}`);

  const reply2 = await api("POST", `/api/consultations/${cid}/messages`, doc1.token, { text: "Drink plenty of water before donating." });
  prof1 = await DoctorProfile.findOne({ user: doc1.id }).lean();
  check("24   second doctor reply doesn't count again", reply2.status === 201 && prof1?.answeredCount === 1, `answeredCount ${prof1?.answeredCount}`);

  const askerReply = await api("POST", `/api/consultations/${cid}/messages`, asker.token, { text: "Thank you, doctor!" });
  check("25   asker reply → 201 (from: asker)", askerReply.status === 201 && askerReply.data?.message?.from === "asker",
    `status ${askerReply.status}`);
  const docNoteReply = await Notification.findOne({ user: doc1.id, link: `/consultations/${cid}` }).lean();
  check("25   doctor notified about the asker's reply", !!docNoteReply);

  const outsiderMsg = await api("POST", `/api/consultations/${cid}/messages`, outsider.token, { text: "hello" });
  check("26   outsider reply → 404", outsiderMsg.status === 404, `status ${outsiderMsg.status}`);
  const doc2Msg = await api("POST", `/api/consultations/${cid}/messages`, doc2.token, { text: "hello" });
  check("26   other doctor reply → 404", doc2Msg.status === 404, `status ${doc2Msg.status}`);

  const notes = await api("GET", "/api/notifications", asker.token);
  const withLink = (notes.data?.notifications || []).find((n) => n.link === `/consultations/${cid}`);
  check("27   notification DTO includes link", !!withLink && withLink.type === "consultation", JSON.stringify(notes.data?.notifications?.[0]));

  const queue2 = await api("GET", "/api/consultations/queue", doc1.token);
  check("27   doctor's queue 'mine' has it, 'open' doesn't",
    (queue2.data?.mine || []).some((c) => c.id === cid) && !(queue2.data?.open || []).some((c) => c.id === cid));

  // ---------- Public FAQ ----------
  console.log("\n— Public FAQ —");
  const faqPath = `/api/consultations/public?q=${encodeURIComponent(RUN)}`;
  const faq0 = await api("GET", faqPath);
  check("28   private answer is NOT in the public FAQ", faq0.status === 200 && !(faq0.data?.answers || []).some((a) => a.id === cid));

  const shareDoc = await api("PATCH", `/api/consultations/${cid}/share`, doc1.token, { shareAnonymously: true });
  check("29   doctor can't change sharing → 403", shareDoc.status === 403, `status ${shareDoc.status}`);
  const shareBad = await api("PATCH", `/api/consultations/${cid}/share`, asker.token, { shareAnonymously: "yes" });
  check("29   invalid share body → 400", shareBad.status === 400, `status ${shareBad.status}`);
  const share = await api("PATCH", `/api/consultations/${cid}/share`, asker.token, { shareAnonymously: true });
  check("29   asker shares anonymously → 200", share.status === 200 && share.data?.consultation?.shareAnonymously === true);

  const faq1 = await api("GET", faqPath);
  const ans = (faq1.data?.answers || []).find((a) => a.id === cid);
  check("30   shared answer IS in the public FAQ", !!ans, JSON.stringify(faq1.data));
  const json = JSON.stringify(ans || {});
  check("30   public answer never includes the asker",
    ans && ans.asker === undefined && !json.includes(asker.name) && !json.includes(asker.id) && !json.includes(asker.phone), json);
  check("30   public answer has doctor brief and messages without ids/authors",
    ans?.doctor?.name === doc1.name && ans?.messages?.length === 3 && ans.messages.every((m) => m.author === undefined && m.id === undefined));
  check("30   FAQ is paginated", typeof faq1.data?.total === "number" && faq1.data?.page === 1 && typeof faq1.data?.pages === "number");

  const hideNotAdmin = await api("PATCH", `/api/admin/consultations/${cid}/visibility`, asker.token, { hiddenFromPublic: true });
  check("31   non-admin hide → 403", hideNotAdmin.status === 403, `status ${hideNotAdmin.status}`);
  const hide = await api("PATCH", `/api/admin/consultations/${cid}/visibility`, admin.token, { hiddenFromPublic: true });
  check("31   admin hides it → 200", hide.status === 200 && hide.data?.consultation?.hiddenFromPublic === true, `status ${hide.status}`);
  const faq2 = await api("GET", faqPath);
  check("31   hidden answer is not in the public FAQ", !(faq2.data?.answers || []).some((a) => a.id === cid));
  await api("PATCH", `/api/admin/consultations/${cid}/visibility`, admin.token, { hiddenFromPublic: false });
  const faq3 = await api("GET", `/api/consultations/public?q=${encodeURIComponent(RUN)}&category=donation_eligibility`);
  check("31   un-hidden answer is back (with category filter)", (faq3.data?.answers || []).some((a) => a.id === cid));

  // ---------- Closing ----------
  console.log("\n— Closing —");
  const closeOut = await api("POST", `/api/consultations/${cid}/close`, outsider.token);
  check("32   outsider close → 404", closeOut.status === 404, `status ${closeOut.status}`);
  const close = await api("POST", `/api/consultations/${cid}/close`, asker.token);
  check("32   asker closes → 200, status closed",
    close.status === 200 && close.data?.consultation?.status === "closed" && close.data?.consultation?.canReply === false,
    `status ${close.status}`);
  const afterClose = await api("POST", `/api/consultations/${cid}/messages`, doc1.token, { text: "One more thing" });
  check("32   message after close → 409", afterClose.status === 409, `status ${afterClose.status}`);
  const closeAgain = await api("POST", `/api/consultations/${cid}/close`, doc1.token);
  check("32   closing twice → 409", closeAgain.status === 409, `status ${closeAgain.status}`);
  const faq4 = await api("GET", faqPath);
  check("32   closed shared answer stays in the FAQ", (faq4.data?.answers || []).some((a) => a.id === cid));

  // ---------- Release / suspend ----------
  console.log("\n— Release and suspension —");
  const ask2 = await api("POST", "/api/consultations", asker.token, {
    category: "after_donation",
    subject: `ZZ ${RUN} dizzy after donating`,
    question: "I felt dizzy for an hour after donating yesterday. Is that normal?",
    patientAge: "",
    shareAnonymously: true,
  });
  const cid2 = ask2.data?.consultation?.id;
  check("33   second question (empty age allowed) → 201", ask2.status === 201, `status ${ask2.status} ${JSON.stringify(ask2.data)}`);
  const claim2 = await api("POST", `/api/consultations/${cid2}/claim`, doc2.token);
  check("33   doctor two claims → 200", claim2.status === 200);
  const relWrong = await api("POST", `/api/consultations/${cid2}/release`, doc1.token);
  check("33   another doctor can't release → 404", relWrong.status === 404, `status ${relWrong.status}`);
  const rel = await api("POST", `/api/consultations/${cid2}/release`, doc2.token);
  check("33   assigned doctor releases → open, doctor unset",
    rel.status === 200 && rel.data?.consultation?.status === "open" && rel.data?.consultation?.doctor === null, `status ${rel.status}`);
  const faq5 = await api("GET", faqPath);
  check("33   unanswered shared question is not in the FAQ", !(faq5.data?.answers || []).some((a) => a.id === cid2));

  await api("POST", `/api/consultations/${cid2}/claim`, doc2.token);
  const suspend = await api("PATCH", `/api/admin/doctors/${apply2.data?.doctor?.id}`, admin.token, { status: "suspended", reviewNote: "Test" });
  const u2 = await User.findById(doc2.id).select("role").lean();
  check('34   suspend → status suspended, role "user"', suspend.data?.doctor?.status === "suspended" && u2?.role === "user",
    `role ${u2?.role}`);
  const c2doc = await Consultation.findById(cid2).lean();
  check("34   their unanswered claimed question goes back to open", c2doc?.status === "open" && !c2doc?.doctor, `status ${c2doc?.status}`);
  const q2 = await api("GET", "/api/consultations/queue", doc2.token);
  check("34   suspended doctor's queue → 403", q2.status === 403, `status ${q2.status}`);
  const pub2 = await api("GET", "/api/doctors");
  check("34   suspended doctor is not listed publicly", !(pub2.data?.doctors || []).some((d) => d.userId === doc2.id));

  const stats = await api("GET", "/api/admin/stats", admin.token);
  const s = stats.data?.stats;
  check("35   admin stats include doctors and consultations",
    typeof s?.doctors?.approved === "number" && typeof s?.doctors?.pending === "number" &&
      typeof s?.consultations?.open === "number" && typeof s?.consultations?.answered === "number",
    JSON.stringify({ doctors: s?.doctors, consultations: s?.consultations }));

  const badId = await api("GET", "/api/consultations/not-an-id", asker.token);
  check("36   invalid id → 400", badId.status === 400, `status ${badId.status}`);
};

const cleanup = async () => {
  try {
    if (!created.userIds.length) return;
    const ids = created.userIds;
    const [c1, c2, n, d, u] = await Promise.all([
      Consultation.deleteMany({ asker: { $in: ids } }),
      Consultation.deleteMany({ doctor: { $in: ids } }),
      Notification.deleteMany({ user: { $in: ids } }),
      DoctorProfile.deleteMany({ user: { $in: ids } }),
      User.deleteMany({ _id: { $in: ids }, name: /^ZZ Test / }),
    ]);
    console.log(
      `\n🧹 Test data removed: ${u.deletedCount} users, ${d.deletedCount} doctor profiles, ` +
        `${c1.deletedCount + c2.deletedCount} consultations, ${n.deletedCount} notifications`
    );
  } catch (err) {
    console.error(`Cleanup failed (delete users named "ZZ Test ... ${RUN}" and their data manually):`, err.message);
  }
};

try {
  await run();
} catch (err) {
  failed++;
  console.error(`\n❌ ${err.message}`);
} finally {
  if (mongoose.connection.readyState === 1) {
    await cleanup();
    await mongoose.disconnect();
  }
  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
}
