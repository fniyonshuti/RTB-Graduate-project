import mongoose from "mongoose";

async function connectDB() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing in .env file");
  }

  try {
    const connection = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 8000,
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
