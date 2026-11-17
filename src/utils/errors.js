export function parseError(err) {
  if (!err.response) {
    return {
      message: "Cannot reach the server. Please check that the backend is running.",
      fields: {},
    };
  }

  const { status, data } = err.response;

  // Backend sends: { success:false, message, errors:[{ field, message }] }
  const fields = {};
  (data?.errors || []).forEach((e) => {
    if (e.field && !fields[e.field]) fields[e.field] = e.message;
  });

  let message = data?.message || "Something went wrong. Please try again.";
  if (status === 429) {
    message = "Too many attempts. Please wait a few minutes and try again.";
  }
  return { message, fields };
}