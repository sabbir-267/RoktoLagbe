export const notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  let message = err.message || "Server error";

  if (err.type === "entity.too.large") {
    status = 413;
    message = "That file is too large";
  } else if (err.code === 11000) {
    status = 409;
    message = `${Object.keys(err.keyValue || {})[0] || "Value"} already exists`;
  } else if (err.name === "ValidationError") {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(", ");
  } else if (err.name === "CastError") {
    status = 400;
    message = `Invalid ${err.path}`;
  }

  res.status(status).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
};