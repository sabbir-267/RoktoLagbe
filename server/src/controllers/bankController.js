import BloodBank from "../models/BloodBank.js";
import InventoryBatch from "../models/InventoryBatch.js";
import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { normalizePhone } from "../utils/phone.js";
import { normalizeBloodGroup } from "../utils/bloodGroup.js";
import { stockSummary } from "../services/inventoryService.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exactCI = (s) => new RegExp(`^${escapeRegex(s.trim())}$`, "i");

const FIELDS = ["name", "licenseNo", "phone", "email", "division", "district", "address", "openingHours", "is24Hours"];

const toBankDto = (b) => ({
  id: b._id,
  name: b.name,
  licenseNo: b.licenseNo,
  phone: b.phone,
  email: b.email,
  division: b.division,
  district: b.district,
  address: b.address,
  openingHours: b.openingHours,
  is24Hours: b.is24Hours,
  coordinates: b.location?.coordinates?.length === 2 ? b.location.coordinates : undefined,
  isApproved: b.isApproved,
});

const pickFields = (body, allowed) => {
  const out = {};
  for (const k of allowed) if (body[k] !== undefined) out[k] = body[k];
  if (!out.licenseNo) delete out.licenseNo; // empty string would collide in the sparse unique index
  return out;
};

const readCoords = (body) => {
  const { latitude, longitude } = body;
  if ((latitude === undefined) !== (longitude === undefined)) {
    throw new ApiError(400, "Provide both latitude and longitude, or neither");
  }
  return latitude === undefined
    ? null
    : { type: "Point", coordinates: [Number(longitude), Number(latitude)] };
};

export const createBank = asyncHandler(async (req, res) => {
  const coords = readCoords(req.body);
  const bank = new BloodBank({ ...pickFields(req.body, FIELDS), isApproved: true });
  if (coords) bank.location = coords;
  await bank.save();
  res.status(201).json({ success: true, bank: toBankDto(bank) });
});

export const listBanks = asyncHandler(async (req, res) => {
  const { district, division, q, is24Hours, hasBloodGroup } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 50);

  const filter = { isApproved: true };
  if (district) filter.district = exactCI(district);
  if (division) filter.division = exactCI(division);
  if (q) filter.name = new RegExp(escapeRegex(q.trim()), "i");
  if (is24Hours === "true") filter.is24Hours = true;
  if (hasBloodGroup) {
    filter._id = {
      $in: await InventoryBatch.distinct("bloodBank", {
        bloodGroup: normalizeBloodGroup(hasBloodGroup),
        status: "available",
        units: { $gt: 0 },
        expiresAt: { $gt: new Date() },
      }),
    };
  }

  const [banks, total] = await Promise.all([
    BloodBank.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit),
    BloodBank.countDocuments(filter),
  ]);

  res.json({
    success: true,
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
    banks: banks.map(toBankDto),
  });
});

export const getBank = asyncHandler(async (req, res) => {
  const bank = await BloodBank.findById(req.params.id);
  if (!bank || (!bank.isApproved && req.user?.role !== "admin")) {
    throw new ApiError(404, "Blood bank not found");
  }
  res.json({ success: true, bank: toBankDto(bank), stock: await stockSummary(bank._id) });
});

export const updateBank = asyncHandler(async (req, res) => {
  const bank = await BloodBank.findById(req.params.id);
  if (!bank) throw new ApiError(404, "Blood bank not found");

  // Only admins may change the license number; staff values for it are ignored
  const allowed = req.user.role === "admin" ? FIELDS : FIELDS.filter((f) => f !== "licenseNo");
  bank.set(pickFields(req.body, allowed));
  const coords = readCoords(req.body);
  if (coords) bank.location = coords;

  await bank.save();
  res.json({ success: true, bank: toBankDto(bank) });
});

export const listStaff = asyncHandler(async (req, res) => {
  const staff = await User.find({ bloodBank: req.params.id, role: "bank_staff" }).select("name phone");
  res.json({ success: true, staff: staff.map((u) => ({ id: u._id, name: u.name, phone: u.phone })) });
});

export const assignStaff = asyncHandler(async (req, res) => {
  const bank = await BloodBank.findById(req.params.id);
  if (!bank) throw new ApiError(404, "Blood bank not found");

  const user = await User.findOne({ phone: normalizePhone(req.body.phone) });
  if (!user) throw new ApiError(404, "No user with that phone number");
  if (user.role === "admin") throw new ApiError(400, "Admins cannot be assigned as bank staff");
  if (user.bloodBank && !user.bloodBank.equals(bank._id)) {
    throw new ApiError(409, "This user is already staff at another blood bank");
  }

  user.role = "bank_staff";
  user.bloodBank = bank._id;
  await user.save();
  res.json({ success: true, staff: { id: user._id, name: user.name, phone: user.phone, role: user.role } });
});

export const removeStaff = asyncHandler(async (req, res) => {
  const staff = await User.findOne({ _id: req.params.userId, bloodBank: req.params.id });
  if (!staff) throw new ApiError(404, "Staff member not found at this blood bank");
  if (staff.role === "admin") throw new ApiError(400, "Cannot remove an admin from here");

  staff.role = "user";
  staff.bloodBank = undefined;
  await staff.save();
  res.json({ success: true, message: "Staff member removed" });
});