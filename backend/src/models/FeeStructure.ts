import mongoose, { Schema, Document, Types } from "mongoose";

export interface IFeeStructure extends Document {
  feeTypeId: Types.ObjectId;
  class: string;
  section: string;
  amount: number;
  isDeleted: boolean;
  deletedAt?: Date;
}

const feeStructureSchema = new Schema<IFeeStructure>(
  {
    feeTypeId: { type: Schema.Types.ObjectId, ref: "FeeType", required: true },
    class: { type: String, required: true },
    section: { type: String, required: true },
    amount: { type: Number, required: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

feeStructureSchema.index({ feeTypeId: 1, class: 1, section: 1 }, { unique: true });
feeStructureSchema.index({ class: 1, section: 1 });
feeStructureSchema.index({ isDeleted: 1 });

export const FeeStructure = mongoose.model<IFeeStructure>("FeeStructure", feeStructureSchema);
