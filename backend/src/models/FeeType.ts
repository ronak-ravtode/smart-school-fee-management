import mongoose, { Schema, Document } from "mongoose";

export interface IFeeType extends Document {
  name: string;
  baseAmount: number;
  rules?: Record<string, any>;
  isDeleted: boolean;
  deletedAt?: Date;
}

const feeTypeSchema = new Schema<IFeeType>(
  {
    name: { type: String, required: true, unique: true },
    baseAmount: { type: Number, required: true },
    rules: { type: Schema.Types.Mixed },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

feeTypeSchema.index({ isDeleted: 1 });

export const FeeType = mongoose.model<IFeeType>("FeeType", feeTypeSchema);
