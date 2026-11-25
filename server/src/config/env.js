// server/src/config/env.js
//
// Checks the environment before the server starts. Unsafe configuration (such as
// a placeholder JWT secret) stops the server with a clear message, so a mistake
// is caught on your machine and not after deployment.

const PLACEHOLDER = /paste|your_?key|change_?me|replace_?me|example|<[^>]+>/i;

export const validateEnv = (env = process.env) => {
  const problems = [];
  const warnings = [];
  const production = env.NODE_ENV === "production";

  // Database
  if (!env.MONGO_URI) {
    problems.push("MONGO_URI is missing");
  } else if (!/^mongodb(\+srv)?:\/\//.test(env.MONGO_URI)) {
    problems.push("MONGO_URI must start with mongodb:// or mongodb+srv://");
  } else if (/<[^>]+>/.test(env.MONGO_URI)) {
    problems.push("MONGO_URI still contains a <placeholder>, such as <db_password>");
  }

  // Token signing: a weak or known secret lets anyone forge logins
  const secret = env.JWT_SECRET;
  if (!secret) {
    problems.push("JWT_SECRET is missing. Generate one with: openssl rand -hex 48");
  } else if (secret.length < 32) {
    problems.push("JWT_SECRET is shorter than 32 characters. Generate one with: openssl rand -hex 48");
  } else if (PLACEHOLDER.test(secret)) {
    problems.push("JWT_SECRET is still a placeholder. Generate one with: openssl rand -hex 48");
  }

  if (production) {
    if (!env.CLIENT_URL) problems.push("CLIENT_URL is required in production (your frontend's address)");
    else if (/localhost|127\.0\.0\.1/.test(env.CLIENT_URL)) warnings.push("CLIENT_URL still points at localhost in production");
  }

  // Optional features: warn, never block
  // No AI key is fine: request parsing and the assistant use the free offline versions.
  // A placeholder key is treated as no key, so it never causes failing API calls.
  const aiDisabled = Boolean(env.ANTHROPIC_API_KEY) && PLACEHOLDER.test(env.ANTHROPIC_API_KEY);
  if (!env.GOOGLE_CLIENT_ID) warnings.push("GOOGLE_CLIENT_ID is not set: Google login is disabled");

  const smtpVars = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"];
  const smtpSet = smtpVars.filter((k) => env[k]);
  const relaySet = ["EMAIL_RELAY_URL", "EMAIL_RELAY_SECRET"].filter((k) => env[k]);
  if (relaySet.length === 1) {
    warnings.push("Email relay is half-configured: set both EMAIL_RELAY_URL and EMAIL_RELAY_SECRET");
  } else if (relaySet.length === 2) {
    // The HTTPS relay sends the emails, so the SMTP settings are not needed
  } else if (smtpSet.length && smtpSet.length < smtpVars.length) {
    warnings.push(`Email is half-configured: set all of ${smtpVars.join(", ")}`);
  } else if (!smtpSet.length) {
    warnings.push(
      production
        ? "SMTP is not configured: email verification and email password reset are disabled"
        : "SMTP is not configured: emails will be printed in this console instead of sent"
    );
  }

  return { problems, warnings, aiDisabled };
};

export const checkEnv = () => {
  const { problems, warnings, aiDisabled } = validateEnv();

  // A placeholder key would only produce confusing 502 errors, so treat it as "not configured"
  if (aiDisabled) delete process.env.ANTHROPIC_API_KEY;

  for (const w of warnings) console.warn(`⚠️  ${w}`);
  if (problems.length) {
    console.error("❌ Unsafe or missing configuration. Fix server/.env and restart:");
    for (const p of problems) console.error(`   - ${p}`);
    process.exit(1);
  }
};