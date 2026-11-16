import mongoose from "mongoose";

export const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not defined in .env");

  mongoose.connection.on("disconnected", () => console.warn("⚠️  MongoDB disconnected"));
  mongoose.connection.on("reconnected", () => console.log("🔄 MongoDB reconnected"));
  mongoose.connection.on("error", (err) => console.error("❌ MongoDB error:", err.message));

  const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log(`✅ MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
};