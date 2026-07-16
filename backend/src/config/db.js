import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

async function connectDB() {
  const mongoUri = process.env.MONGO_DIRECT_URI || process.env.MONGO_URI;
  console.log(`DB URI: ${mongoUri}`);
  const dbConnectTimeoutMs = Number(process.env.DB_CONNECT_TIMEOUT_MS) || 8000;

  if (!mongoUri) {
    throw new Error("MONGO_URI or MONGO_DIRECT_URI is missing in .env file");
  }

  try {
    const connection = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: dbConnectTimeoutMs,
      autoIndex: process.env.NODE_ENV !== "production",
    });

    console.log(`MongoDB connected: ${connection.connection.host}`);
    return connection;
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);

    if (mongoUri.includes("+srv")) {
      console.error(
        "Atlas SRV lookup failed. Check DNS/network access, Atlas IP access list, database user credentials, and outbound ports 27015-27017.",
      );
      console.error(
        "If Windows can resolve Atlas but Node.js cannot, use the standard Atlas direct connection string instead of the SRV connection string in MONGO_URI.",
      );
    }

    throw error;
  }
}

export default connectDB;
