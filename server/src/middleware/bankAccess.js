import { ApiError } from "../utils/ApiError.js";
import BloodBank from "../models/BloodBank.js";

const isOwnStaff = (user, bankId) =>
  user.role === "bank_staff" && !!user.bloodBank && user.bloodBank.equals(bankId);

// Read access and bank-profile editing: admins and this bank's own staff.
// Must run after protect and after the :id param has been validated.
export const requireBankAccess = (req, res, next) => {
  const { user } = req;
  if (user.role === "admin" || isOwnStaff(user, req.params.id)) return next();
  next(new ApiError(403, "You do not have access to this blood bank"));
};

// Changing blood stock (adding/issuing batches, recording donations): only verified
// staff, meaning staff of THIS bank after an admin has approved the bank.
// Admins can oversee banks but cannot change stock.
export const requireVerifiedBankStaff = async (req, res, next) => {
  try {
    const { user } = req;
    if (user.role === "admin") {
      throw new ApiError(403, "Admins cannot change blood stock. Only the blood bank's verified staff can.");
    }
    if (!isOwnStaff(user, req.params.id)) {
      throw new ApiError(403, "Only this blood bank's staff can manage its stock");
    }
    const bank = await BloodBank.findById(req.params.id).select("isApproved").lean();
    if (!bank) throw new ApiError(404, "Blood bank not found");
    if (!bank.isApproved) {
      throw new ApiError(403, "Your blood bank is waiting for admin approval. You can manage stock once it is verified.");
    }
    next();
  } catch (err) {
    next(err);
  }
};
