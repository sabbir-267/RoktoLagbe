import BloodBank from "../models/BloodBank.js";
import InventoryBatch from "../models/InventoryBatch.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { normalizeBloodGroup } from "../utils/bloodGroup.js";
import { defaultExpiry } from "../utils/shelfLife.js";
import { stockSummary } from "../services/inventoryService.js";

const DAY = 24 * 60 * 60 * 1000;

const toBatchDto = (b) => ({
  id: b._id,
  bloodGroup: b.bloodGroup,
  component: b.component,
  units: b.units,
  collectedAt: b.collectedAt,
  expiresAt: b.expiresAt,
  status: b.status,
  daysLeft: Math.ceil((new Date(b.expiresAt) - Date.now()) / DAY),
});

const loadBank = async (id) => {
  const bank = await BloodBank.findById(id);
  if (!bank) throw new ApiError(404, "Blood bank not found");
  return bank;
};

export const getStock = asyncHandler(async (req, res) => {
  const bank = await BloodBank.findById(req.params.id).select("isApproved");
  if (!bank || (!bank.isApproved && req.user?.role !== "admin")) {
    throw new ApiError(404, "Blood bank not found");
  }
  res.json({
    success: true,
    bankId: bank._id,
    asOf: new Date().toISOString(),
    stock: await stockSummary(bank._id),
  });
});

export const addBatch = asyncHandler(async (req, res) => {
  const bank = await loadBank(req.params.id);
  const component = req.body.component || "whole_blood";
  const collected = req.body.collectedAt ? new Date(req.body.collectedAt) : new Date();
  const expires = req.body.expiresAt ? new Date(req.body.expiresAt) : defaultExpiry(collected, component);

  if (expires <= collected) throw new ApiError(400, "Expiry date must be after the collection date");
  if (expires <= new Date()) throw new ApiError(400, "This batch is already expired");

  const batch = await InventoryBatch.create({
    bloodBank: bank._id,
    bloodGroup: normalizeBloodGroup(req.body.bloodGroup),
    component,
    units: Number(req.body.units),
    collectedAt: collected,
    expiresAt: expires,
    addedBy: req.user._id,
  });
  res.status(201).json({ success: true, batch: toBatchDto(batch) });
});

export const listBatches = asyncHandler(async (req, res) => {
  await loadBank(req.params.id);
  const { status, bloodGroup, component, expiringInDays } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  const filter = { bloodBank: req.params.id };
  if (status) filter.status = status;
  if (bloodGroup) filter.bloodGroup = normalizeBloodGroup(bloodGroup);
  if (component) filter.component = component;
  if (expiringInDays) {
    const now = Date.now();
    filter.expiresAt = { $gt: new Date(now), $lte: new Date(now + Number(expiringInDays) * DAY) };
    if (!status) filter.status = "available";
  }

  const [batches, total] = await Promise.all([
    InventoryBatch.find(filter).sort({ expiresAt: 1 }).skip((page - 1) * limit).limit(limit),
    InventoryBatch.countDocuments(filter),
  ]);

  res.json({
    success: true,
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
    batches: batches.map(toBatchDto),
  });
});

// Atomic: the deduction only happens if enough unexpired units exist right now
export const issueUnits = asyncHandler(async (req, res) => {
  const { id, batchId } = req.params;
  const n = Number(req.body.units);

  const batch = await InventoryBatch.findOneAndUpdate(
    { _id: batchId, bloodBank: id, status: "available", expiresAt: { $gt: new Date() }, units: { $gte: n } },
    { $inc: { units: -n } },
    { new: true }
  );

  if (!batch) {
    const existing = await InventoryBatch.findOne({ _id: batchId, bloodBank: id });
    if (!existing) throw new ApiError(404, "Batch not found");
    if (existing.status !== "available" || existing.expiresAt <= new Date()) {
      throw new ApiError(409, "This batch is not available (expired, reserved, or used up)");
    }
    throw new ApiError(409, `Only ${existing.units} unit(s) left in this batch`);
  }

  if (batch.units === 0) {
    batch.status = "used";
    await batch.save();
  }
  res.json({ success: true, batch: toBatchDto(batch) });
});

export const setBatchStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const batch = await InventoryBatch.findOne({ _id: req.params.batchId, bloodBank: req.params.id });
  if (!batch) throw new ApiError(404, "Batch not found");

  if (batch.status === "used") throw new ApiError(409, "This batch is already used up");
  if (batch.status === "expired") throw new ApiError(409, "An expired batch cannot be changed");
  if (status !== "expired" && batch.expiresAt <= new Date()) {
    throw new ApiError(409, "This batch has passed its expiry date");
  }

  batch.status = status;
  await batch.save();
  res.json({ success: true, batch: toBatchDto(batch) });
});