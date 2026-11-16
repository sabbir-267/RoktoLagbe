import { ApiError } from "../utils/ApiError.js";

// Must run after protect and after the :id param has been validated
export const requireBankAccess = (req, res, next) => {
  const { user } = req;
  if (user.role === "admin") return next();
  if (user.role === "bank_staff" && user.bloodBank && user.bloodBank.equals(req.params.id)) {
    return next();
  }
  next(new ApiError(403, "You do not have access to this blood bank"));
};