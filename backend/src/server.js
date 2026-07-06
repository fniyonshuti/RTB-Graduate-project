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

function emailDomain(email = "") {
  const [, domain = ""] = String(email).split("@");
  return domain.toLowerCase();
}

function validateRuntimeConfig() {
  const errors = [];
  const warnings = [];
  const nodeEnv = process.env.NODE_ENV || "development";
  const isProduction = nodeEnv === "production";
  const mongoUri = process.env.MONGO_DIRECT_URI || process.env.MONGO_URI || "";
  const jwtSecret = String(process.env.JWT_SECRET || "").trim();
  const frontendUrl = process.env.FRONTEND_URL || "";
  const corsOrigins = listEnv("CORS_ORIGINS", [frontendUrl]);
  const localDevelopmentHosts = listEnv("LOCAL_DEVELOPMENT_HOSTS");
  const emailProvider = process.env.EMAIL_PROVIDER || "generic";
  const emailApiUrl = process.env.EMAIL_API_URL || "";
  const emailApiKey = process.env.EMAIL_API_KEY || "";
  const emailFrom = process.env.EMAIL_FROM || "";
  const githubToken = process.env.GITHUB_TOKEN || "";
  const exposePasswordResetLinkInResponse = booleanEnv(
    "EXPOSE_PASSWORD_RESET_LINK_IN_RESPONSE",
    nodeEnv !== "production",
  );
  const enableUnsafeLocalRepositoryExecution = booleanEnv(
    "ENABLE_UNSAFE_LOCAL_REPOSITORY_EXECUTION",
    false,
  );

  if (!mongoUri) errors.push("MONGO_URI or MONGO_DIRECT_URI is required");
  if (!jwtSecret) errors.push("JWT_SECRET is required");
  if (!frontendUrl) {
    warnings.push(
      "FRONTEND_URL is missing; password reset links will fail until it is set to the deployed frontend URL",
    );
  }
  if (corsOrigins.length === 0) {
    warnings.push(
      "CORS_ORIGINS is missing; browser requests from the frontend will be rejected until it is configured",
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

    if (
      corsOrigins.some((origin) =>
        localDevelopmentHosts.some((host) => origin.includes(host)),
      )
    ) {
      errors.push("CORS_ORIGINS must not include local development hosts in production");
    }

    if (!process.env.GEMINI_API_KEY) {
      warnings.push("GEMINI_API_KEY is missing; recommendation generation will fail");
    }

    if (!githubToken) {
      errors.push("GITHUB_TOKEN is required in production for reliable repository review");
    }

    if (enableUnsafeLocalRepositoryExecution) {
      errors.push("ENABLE_UNSAFE_LOCAL_REPOSITORY_EXECUTION must be false in production");
    }

    if (exposePasswordResetLinkInResponse) {
      errors.push("EXPOSE_PASSWORD_RESET_LINK_IN_RESPONSE must be false in production");
    }

    if (!emailApiKey || !emailFrom) {
      errors.push("EMAIL_API_KEY and EMAIL_FROM are required in production");
    }

    if (emailProvider === "generic" && !emailApiUrl) {
      errors.push("EMAIL_API_URL is required when EMAIL_PROVIDER=generic");
    }

    if (
      emailProvider === "resend" &&
      ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "resend.dev"].includes(
        emailDomain(emailFrom),
      )
    ) {
      warnings.push(
        "EMAIL_FROM should use your verified Resend domain in production; password reset emails to normal users may fail until the sender domain is verified",
      );
    }
  } else if (
    emailProvider === "resend" &&
    ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "resend.dev"].includes(
      emailDomain(emailFrom),
    )
  ) {
    warnings.push(
      "Resend can only send to any recipient after you verify a domain and set EMAIL_FROM to that domain",
    );
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
