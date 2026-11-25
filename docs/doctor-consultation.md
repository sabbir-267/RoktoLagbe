# Doctor consultation ("Ask a doctor") – design and API contract

Volunteer doctors register, an admin verifies them, then they answer health questions
from users (donors, patients, families). Questions are **private by default**: only the
asker, the assigned doctor and admins can see them. If the asker ticks
`shareAnonymously`, the answered question appears in a public FAQ with the asker hidden.

Safety rules shown in the UI and enforced in copy:
- Not for emergencies: call **999** or go to the nearest hospital.
- General guidance only; not a diagnosis or prescription. In-person care decides.
- Blood donation is free; doctors never ask for money; report abuse via /complaints.
- Doctors' phone numbers / emails are never exposed by these APIs.

## Roles
- `User.role` enum gains **`"doctor"`** (alongside `user`, `bank_staff`, `admin`).
- A `user` applies → `DoctorProfile.status = "pending"` (role unchanged).
- Admin approves → status `approved` and `User.role = "doctor"`.
- Admin rejects / suspends → status `rejected` / `suspended` and `User.role = "user"`.
- Admins can see and moderate everything but don't answer as doctors.

## Models

### DoctorProfile (`doctorprofiles`)
| field | type | notes |
|---|---|---|
| user | ObjectId User | unique |
| bmdcNo | String | required, 3–20 chars, `^[A-Za-z0-9-]+$`, unique (Bangladesh Medical & Dental Council registration no.) |
| specialty | String enum | `hematology`, `transfusion_medicine`, `internal_medicine`, `pediatrics`, `gynecology`, `surgery`, `general_practice`, `other` |
| hospital | String | required, 2–120 |
| district | String | required, canonical English district |
| bio | String | optional ≤ 500 |
| languages | [String] | subset of `["bn","en"]`, default `["bn","en"]` |
| status | String enum | `pending` (default), `approved`, `rejected`, `suspended` |
| reviewNote | String | ≤ 300, admin's note shown to the applicant |
| reviewedBy / reviewedAt | ObjectId User / Date | |
| acceptingQuestions | Boolean | default true |
| answeredCount | Number | default 0 (incremented when a doctor's first reply is posted) |
| timestamps | | |

### Consultation (`consultations`)
| field | type | notes |
|---|---|---|
| asker | ObjectId User | required |
| category | String enum | `donation_eligibility`, `after_donation`, `transfusion`, `thalassemia`, `pregnancy`, `medicines`, `other` |
| subject | String | 5–120 |
| question | String | 20–3000 |
| patientAge | Number | optional 0–120 |
| patientSex | String enum | optional `male`, `female`, `other` |
| shareAnonymously | Boolean | default false |
| hiddenFromPublic | Boolean | default false (admin moderation) |
| status | String enum | `open` (no doctor yet), `claimed` (doctor assigned, no reply yet), `answered` (doctor replied at least once), `closed` |
| doctor | ObjectId User | set on claim |
| messages | [{ author: ObjectId User, from: "asker"\|"doctor", text: String 1–3000, createdAt: Date }] | the first entry is NOT the question; the question lives in `question` |
| claimedAt / answeredAt / closedAt / lastActivityAt | Date | |
| timestamps | | |

Notification `type` enum gains **`"consultation"`** (Notification model). Notifications for
consultations set `title`, `message` and — since `relatedRequest` doesn't fit — a new optional
field `link` (String, a site path like `/consultations/<id>`). The client shows a button for `link`.

## API (all JSON, `{ success, ... }`, errors `{ success:false, message, errors? }`)

### Doctors – `/api/doctors`
- `GET /api/doctors` (public) → `{ doctors: [DoctorPublic] }` approved doctors, sorted by answeredCount desc then name. Query: `specialty`, `district`.
  `DoctorPublic = { id (DoctorProfile id), userId, name, avatar, specialty, hospital, district, bio, languages, answeredCount, acceptingQuestions }`
- `POST /api/doctors/apply` (logged in, role `user`, must have phone) body `{ bmdcNo, specialty, hospital, district, bio?, languages? }` → 201 `{ doctor: DoctorOwn }`. 409 if already applied (any status except `rejected`, which may re-apply by updating).
- `GET /api/doctors/me` (logged in) → `{ doctor: DoctorOwn | null }`
  `DoctorOwn = DoctorPublic + { bmdcNo, status, reviewNote, createdAt }`
- `PATCH /api/doctors/me` (role `doctor`) body `{ bio?, hospital?, district?, languages?, acceptingQuestions? }` → `{ doctor: DoctorOwn }`

### Consultations – `/api/consultations`
Shapes:
- `ConsultationSummary = { id, category, subject, status, createdAt, lastActivityAt, doctor: DoctorBrief|null, messageCount, unreadForMe?: boolean }`
- `DoctorBrief = { userId, name, avatar, specialty, hospital }`
- `ConsultationFull = ConsultationSummary + { question, patientAge, patientSex, shareAnonymously, hiddenFromPublic, messages: [{ id, from, text, createdAt }], asker: { name } | undefined (only for the assigned doctor and admins), canReply, canClaim, canClose, canRelease }`
- `PublicAnswer = { id, category, subject, question, answeredAt, doctor: DoctorBrief, messages: [{ from, text, createdAt }] }` (asker never included)

Endpoints:
- `POST /api/consultations` (logged in, rate limit 5 per 24h per user) body `{ category, subject, question, patientAge?, patientSex?, shareAnonymously? }` → 201 `{ consultation: ConsultationFull }`. Notifies approved doctors with `acceptingQuestions` (max 30, most answered first) with a `consultation` notification linking to `/doctor-portal`, plus a socket `notification:new` event.
- `GET /api/consultations/mine` (logged in) → `{ consultations: [ConsultationSummary] }` newest activity first (the asker's own).
- `GET /api/consultations/queue` (role `doctor`) query `category?` → `{ open: [ConsultationSummary + { question (first 300 chars), patientAge, patientSex }], mine: [ConsultationSummary] }` — `open` = status open; `mine` = claimed/answered/closed by me (last 50).
- `GET /api/consultations/public` (public) query `q?`, `category?`, `page?` → `{ answers: [PublicAnswer], total, page, pages }` — status `answered`/`closed`, `shareAnonymously` true, not `hiddenFromPublic`, has ≥1 doctor message.
- `GET /api/consultations/:id` (asker, assigned doctor, admin) → `{ consultation: ConsultationFull }` (404 for anyone else).
- `POST /api/consultations/:id/claim` (role `doctor`, status `open`, atomic) → `{ consultation }`; 409 if someone else claimed it first. Notifies the asker ("Dr. X is reviewing your question").
- `POST /api/consultations/:id/release` (assigned doctor, status `claimed`) → back to `open`, doctor unset.
- `POST /api/consultations/:id/messages` (asker or assigned doctor; not when `closed`; rate limit 30/10min) body `{ text }` → 201 `{ message, consultation }`. Doctor's first reply sets `answered`, `answeredAt`, increments `answeredCount`. Notifies the other party (`consultation` notification + socket `notification:new`).
- `POST /api/consultations/:id/close` (asker, assigned doctor or admin) → `{ consultation }`.
- `PATCH /api/consultations/:id/share` (asker) body `{ shareAnonymously }` → `{ consultation }`.

### Admin – `/api/admin`
- `GET /api/admin/doctors?status=pending|approved|rejected|suspended&q=&page=` → `{ doctors: [DoctorOwn + { user: { id, name, phone, email } }], total, page, pages }`
- `PATCH /api/admin/doctors/:id` body `{ status: "approved"|"rejected"|"suspended", reviewNote? }` → sets role as described, notifies the applicant.
- `PATCH /api/admin/consultations/:id/visibility` body `{ hiddenFromPublic }` → moderation of the public FAQ.
- `GET /api/admin/stats` adds `stats.doctors = { approved, pending }` and `stats.consultations = { open, answered }`.

## Client routes
| route | who | page |
|---|---|---|
| `/doctors` | everyone | "Ask a doctor" landing: safety notice, how it works, verified doctors, public FAQ with search/category filter, CTA buttons |
| `/doctors/ask` | logged in | question form |
| `/doctors/join` | logged in | doctor application form / application status |
| `/consultations` | logged in | my questions |
| `/consultations/:id` | asker / doctor / admin | thread: question, messages, reply box, close, share toggle (asker), claim/release (doctor) |
| `/doctor-portal` | role `doctor` | open questions queue (claim), my cases, profile & "accepting questions" toggle |
| `/admin?tab=doctors` | admin | review applications (approve/reject/suspend with note), list doctors |
