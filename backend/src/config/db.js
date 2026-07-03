import mongoose from "mongoose";
import { env } from "./env.js";

async function connectDB() {
  const mongoUri = env.mongoUri;

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing in .env file");
  }

  try {
    const connection = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: env.dbConnectTimeoutMs,
      autoIndex: !env.isProduction,
    });

    console.log(`MongoDB connected: ${connection.connection.host}`);
    return connection;
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);

    if (mongoUri.startsWith("mongodb+srv://")) {
      console.error(
        "Atlas SRV lookup failed. Check DNS/network access, Atlas IP access list, database user credentials, and outbound ports 27015-27017.",
      );
    }

    throw error;
  }
}

export default connectDB;
