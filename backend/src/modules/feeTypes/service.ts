import mongoose from "mongoose";
import { FeeType, FeeStructure } from "@/models";
import { NotFoundError, ConflictError } from "@/lib/errors";
import { createAuditLog, ActorInfo } from "@/services/auditService";
import { CreateFeeTypeInput, UpdateFeeTypeInput, FeeTypeQueryInput } from "./schemas";

export async function createFeeType(data: CreateFeeTypeInput, actor?: ActorInfo) {
  const existing = await FeeType.findOne({ name: data.name, isDeleted: false });
  if (existing) throw new ConflictError("A fee type with this name already exists");

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const [feeType] = await FeeType.create([{ name: data.name, baseAmount: data.baseAmount, rules: data.rules ?? undefined }], { session });

    await createAuditLog({
      actorId: actor?.actorId ?? "system",
      actorName: actor?.actorName ?? "System",
      action: "CREATED",
      entityType: "FeeType",
      entityId: feeType._id.toString(),
      newValue: { name: feeType.name, baseAmount: feeType.baseAmount, rules: feeType.rules },
      ipAddress: actor?.ipAddress,
    }, session);

    await session.commitTransaction();
    return feeType;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function getFeeTypes(query: FeeTypeQueryInput) {
  const { page, limit, search } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, any> = { isDeleted: false };
  if (search) filter.name = { $regex: search, $options: "i" };

  const [feeTypes, total] = await Promise.all([
    FeeType.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    FeeType.countDocuments(filter),
  ]);

  return { feeTypes, total, page, limit };
}

export async function getFeeTypeById(id: string) {
  const feeType = await FeeType.findOne({ _id: id, isDeleted: false });
  if (!feeType) throw new NotFoundError("FeeType", id);
  return feeType;
}

export async function updateFeeType(id: string, data: UpdateFeeTypeInput, actor?: ActorInfo) {
  const existing = await getFeeTypeById(id);

  if (data.name) {
    const dup = await FeeType.findOne({ name: data.name, _id: { $ne: id }, isDeleted: false });
    if (dup) throw new ConflictError("A fee type with this name already exists");
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.baseAmount !== undefined) updateData.baseAmount = data.baseAmount;
    if (data.rules !== undefined) updateData.rules = data.rules;

    const updated = await FeeType.findByIdAndUpdate(id, updateData, { new: true, session });

    await createAuditLog({
      actorId: actor?.actorId ?? "system",
      actorName: actor?.actorName ?? "System",
      action: "UPDATED",
      entityType: "FeeType",
      entityId: id,
      previousValue: { name: existing.name, baseAmount: existing.baseAmount, rules: existing.rules },
      newValue: { name: updated!.name, baseAmount: updated!.baseAmount, rules: updated!.rules },
      ipAddress: actor?.ipAddress,
    }, session);

    await session.commitTransaction();
    return updated;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function deleteFeeType(id: string, actor?: ActorInfo, reason?: string) {
  const existing = await getFeeTypeById(id);

  const linkedStructures = await FeeStructure.countDocuments({ feeTypeId: id, isDeleted: false });
  if (linkedStructures > 0) {
    throw new ConflictError(`Cannot delete fee type: ${linkedStructures} fee structure(s) still reference it.`);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await FeeType.findByIdAndUpdate(id, { isDeleted: true, deletedAt: new Date() }, { session });

    await createAuditLog({
      actorId: actor?.actorId ?? "system",
      actorName: actor?.actorName ?? "System",
      action: "DELETED",
      entityType: "FeeType",
      entityId: id,
      previousValue: { name: existing.name, baseAmount: existing.baseAmount, rules: existing.rules },
      reason,
      ipAddress: actor?.ipAddress,
    }, session);

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
