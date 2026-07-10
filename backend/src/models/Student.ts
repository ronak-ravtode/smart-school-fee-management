import mongoose, { Schema, Document } from "mongoose";

export interface IStudent extends Document {
  name: string;
  email: string;
  class: string;
  section: string;
  rollNumber: string;
  status: "ACTIVE" | "TRANSFERRED" | "ALUMNI";
  isDeleted: boolean;
  deletedAt?: Date;
}

const studentSchema = new Schema<IStudent>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    class: { type: String, required: true },
    section: { type: String, required: true },
    rollNumber: { type: String, required: true },
    status: { type: String, enum: ["ACTIVE", "TRANSFERRED", "ALUMNI"], default: "ACTIVE" },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

studentSchema.index({ rollNumber: 1, class: 1, section: 1 }, { unique: true });
studentSchema.index({ isDeleted: 1 });

export const Student = mongoose.model<IStudent>("Student", studentSchema);
