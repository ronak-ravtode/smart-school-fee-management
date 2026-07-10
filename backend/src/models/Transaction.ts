import mongoose, { Schema, Document, Types } from "mongoose";

export interface ITransaction extends Document {
  ledgerId: Types.ObjectId;
  amount: number;
  paymentMethod: string;
  transactionRef?: string;
  receiptNumber?: string;
  gatewayPaymentId?: string;
  status: string;
  chequeNumber?: string;
  chequeBank?: string;
  chequeIssueDate?: Date;
  actualClearedAmount?: number;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    ledgerId: { type: Schema.Types.ObjectId, ref: "StudentFeeLedger", required: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ["UPI", "CASH", "CHEQUE"], required: true },
    transactionRef: { type: String },
    receiptNumber: { type: String, unique: true, sparse: true },
    gatewayPaymentId: { type: String, unique: true, sparse: true },
    status: { type: String, enum: ["PENDING", "SUCCESS", "FAILED", "PENDING_CLEARANCE", "CLEARED", "PARTIALLY_CLEARED", "BOUNCED"], default: "PENDING" },
    chequeNumber: { type: String },
    chequeBank: { type: String },
    chequeIssueDate: { type: Date },
    actualClearedAmount: { type: Number },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

transactionSchema.index({ ledgerId: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ isDeleted: 1 });

export const Transaction = mongoose.model<ITransaction>("Transaction", transactionSchema);
