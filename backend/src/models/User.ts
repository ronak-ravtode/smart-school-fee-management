import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: "ADMIN" | "CASHIER";
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["ADMIN", "CASHIER"], default: "CASHIER" },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", userSchema);
