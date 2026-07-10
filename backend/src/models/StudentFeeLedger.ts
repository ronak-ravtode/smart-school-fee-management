import mongoose, { Schema, Document, Types } from "mongoose";

export interface IStudentFeeLedger extends Document {
  studentId: Types.ObjectId;
  feeStructureId: Types.ObjectId;
  totalAmount: number;
  waivedAmount: number;
  paidAmount: number;
  dueDate: Date;
  feeIssuedDate?: Date;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const studentFeeLedgerSchema = new Schema<IStudentFeeLedger>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    feeStructureId: { type: Schema.Types.ObjectId, ref: "FeeStructure", required: true },
    totalAmount: { type: Number, required: true },
    waivedAmount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    dueDate: { type: Date, required: true },
    feeIssuedDate: { type: Date },
    status: { type: String, enum: ["PENDING", "PARTIAL", "PAID", "OVERDUE"], default: "PENDING" },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

studentFeeLedgerSchema.index({ studentId: 1 });
studentFeeLedgerSchema.index({ status: 1 });
studentFeeLedgerSchema.index({ studentId: 1, status: 1 });
studentFeeLedgerSchema.index({ dueDate: 1 });
studentFeeLedgerSchema.index({ isDeleted: 1 });

export const StudentFeeLedger = mongoose.model<IStudentFeeLedger>("StudentFeeLedger", studentFeeLedgerSchema);
