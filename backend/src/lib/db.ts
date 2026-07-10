import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";

const MONGODB_URI = process.env.DATABASE_URL!;

let isConnected = false;

export async function connectDB(): Promise<void> {
  if (isConnected) return;

  mongoose.set("strictQuery", true);

  await mongoose.connect(MONGODB_URI);
  isConnected = true;
  console.log("MongoDB connected");
}

export async function disconnectDB(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
}
