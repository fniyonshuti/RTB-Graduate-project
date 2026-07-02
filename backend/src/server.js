import dotenv from "dotenv";
import app from "./app.js";
import connectDB from "./config/db.js";
import { cleanupRateLimitBuckets } from "./middleware/securityMiddleware.js";
import { env, validateRuntimeConfig } from "./config/env.js";

dotenv.config();

const PORT = env.port;
const HOST = env.host;

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
    console.log(`Server running on http://localhost:${PORT}/api`);
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
