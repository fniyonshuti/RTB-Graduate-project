import dotenv from "dotenv";
import app from "./app.js";
import connectDB from "./config/db.js";
import { cleanupRateLimitBuckets } from "./middleware/securityMiddleware.js";

dotenv.config({ quiet: true });

const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || "0.0.0.0";

function booleanEnv(name, fallback = false) {
  const value = String(process.env[name] || "").toLowerCase();
  if (["true", "1", "yes"].includes(value)) return true;
  if (["false", "0", "no"].includes(value)) return false;
  return fallback;
}

function listEnv(name, fallback = []) {
  const value = process.env[name];
  if (!value) return fallback;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateRuntimeConfig() {
  const errors = [];
  const warnings = [];
  const nodeEnv = process.env.NODE_ENV || "development";
  const isProduction = nodeEnv === "production";
  const mongoUri = process.env.MONGO_DIRECT_URI || process.env.MONGO_URI || "";
  const jwtSecret = String(process.env.JWT_SECRET || "").trim();
  const frontendUrl = process.env.FRONTEND_URL || "";
  const localDevelopmentHosts = listEnv("LOCAL_DEVELOPMENT_HOSTS");
  const emailProvider = String(process.env.EMAIL_PROVIDER || "brevo").toLowerCase();
  const emailApiUrl = process.env.EMAIL_API_URL || "";
  const emailBrevoApiUrl = process.env.EMAIL_BREVO_API_URL || "";
  const emailApiKey = process.env.EMAIL_API_KEY || "";
  const emailFrom = process.env.EMAIL_FROM || "";
  const githubToken = process.env.GITHUB_TOKEN || "";
  const exposePasswordResetLinkInResponse = booleanEnv(
    "EXPOSE_PASSWORD_RESET_LINK_IN_RESPONSE",
    nodeEnv !== "production",
  );

  if (!mongoUri) errors.push("MONGO_URI or MONGO_DIRECT_URI is required");
  if (!jwtSecret) errors.push("JWT_SECRET is required");
  if (!frontendUrl) {
    warnings.push(
      "FRONTEND_URL is missing; password reset links will fail until it is set to the deployed frontend URL",
    );
  }
  if (jwtSecret && jwtSecret.length < 32) {
    errors.push("JWT_SECRET must be at least 32 characters");
  }

  if (isProduction) {
    if (localDevelopmentHosts.some((host) => mongoUri.includes(host))) {
      errors.push("MONGO_URI must use a production database host in production");
    }

    if (localDevelopmentHosts.some((host) => frontendUrl.includes(host))) {
      errors.push("FRONTEND_URL must not use a local development host in production");
    }

    if (!process.env.GEMINI_API_KEY) {
      warnings.push("GEMINI_API_KEY is missing; recommendation generation will fail");
    }

    if (!githubToken) {
      errors.push("GITHUB_TOKEN is required in production for reliable repository review");
    }

    if (!process.env.E2B_API_KEY) {
      errors.push("E2B_API_KEY is required in production for isolated repository assessment");
    }

    if (exposePasswordResetLinkInResponse) {
      errors.push("EXPOSE_PASSWORD_RESET_LINK_IN_RESPONSE must be false in production");
    }

    if (!emailApiKey || !emailFrom) {
      errors.push("EMAIL_API_KEY and EMAIL_FROM are required in production");
    }

    if (!["brevo", "generic"].includes(emailProvider)) {
      errors.push("EMAIL_PROVIDER must be brevo or generic");
    }

    if (emailProvider === "generic" && !emailApiUrl) {
      errors.push("EMAIL_API_URL is required when EMAIL_PROVIDER=generic");
    }


    if (emailProvider === "brevo" && !emailBrevoApiUrl) {
      errors.push("EMAIL_BREVO_API_URL is required when EMAIL_PROVIDER=brevo");
    }

  }

  return { errors, warnings };
}

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

async function startServer() {
  const { errors, warnings } = validateRuntimeConfig();

  warnings.forEach((warning) => {
    console.warn(`Configuration warning: ${warning}`);
  });

  if (errors.length > 0) {
    throw new Error(`Invalid runtime configuration: ${errors.join("; ")}`);
  }

  await connectDB();

  const server = app.listen(PORT, HOST, () => {
    console.log(`Server running on ${process.env.API_PUBLIC_URL || `port ${PORT}`}`);
  });

  const cleanupInterval = setInterval(cleanupRateLimitBuckets, 60 * 1000);

  function shutdown(signal) {
    console.log(`${signal} received. Closing server...`);
    clearInterval(cleanupInterval);
    server.close(() => {
      console.log("HTTP server closed");
      process.exit(0);
    });
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
