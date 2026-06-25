import mongoose from "mongoose";

function maskMongoUri(uri) {
  return uri.replace(/\/\/([^:/@]+):([^@]+)@/, "//$1:****@");
}

function isSrvNetworkError(error) {
  return (
    error.message.includes("querySrv") ||
    ["ECONNREFUSED", "ENOTFOUND", "ETIMEOUT", "ESERVFAIL"].includes(error.code)
  );
}

async function tryConnect(uri, label) {
  const connection = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 8000,
  });

  console.log(`MongoDB connected (${label}): ${connection.connection.host}`);
  return connection;
}

async function connectDB() {
  const primaryUri = process.env.MONGO_URI;

  if (!primaryUri) {
    throw new Error("MONGO_URI is missing in .env file");
  }

  try {
    return await tryConnect(primaryUri, "primary");
  } catch (primaryError) {
    const fallbackUri = process.env.MONGO_FALLBACK_URI;

    if (!fallbackUri || fallbackUri === primaryUri || !isSrvNetworkError(primaryError)) {
      console.error(`MongoDB connection failed: ${primaryError.message}`);
      if (primaryUri.startsWith("mongodb+srv://")) {
        console.error(
          "Atlas SRV lookup failed. Check DNS/network access, Atlas IP access list, database user credentials, and outbound ports 27015-27017."
        );
      }
      throw primaryError;
    }

    console.warn(
      `Primary MongoDB connection failed: ${primaryError.message}`
    );
    console.warn(`Trying fallback MongoDB URI: ${maskMongoUri(fallbackUri)}`);

    try {
      return await tryConnect(fallbackUri, "fallback");
    } catch (fallbackError) {
      console.error(`Fallback MongoDB connection failed: ${fallbackError.message}`);
      console.error(
        "Fix: start local MongoDB or update MONGO_URI to a reachable MongoDB Atlas/local connection string."
      );
      throw fallbackError;
    }
  }
}

export default connectDB;
