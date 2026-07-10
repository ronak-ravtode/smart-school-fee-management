import mongoose from "mongoose";
import { FeeType, FeeStructure, StudentFeeLedger } from "@/models";
import { NotFoundError, ConflictError } from "@/lib/errors";
import { createAuditLog, ActorInfo } from "@/services/auditService";
import { CreateFeeStructureInput, FeeStructureQueryInput } from "./schemas";

export async function createFeeStructure(data: CreateFeeStructureInput, actor?: ActorInfo) {
  const feeType = await FeeType.findOne({ _id: data.feeTypeId, isDeleted: false });
  if (!feeType) throw new NotFoundError("FeeType", data.feeTypeId);

  const existing = await FeeStructure.findOne({
    feeTypeId: data.feeTypeId, class: data.class, section: data.section, isDeleted: false,
  });
  if (existing) throw new ConflictError(`A fee structure already exists for this fee type in class ${data.class} section ${data.section}`);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const [feeStructure] = await FeeStructure.create([{
      feeTypeId: data.feeTypeId, class: data.class, section: data.section, amount: data.amount,
    }], { session });
    await feeStructure.populate("feeTypeId");

    await createAuditLog({
      actorId: actor?.actorId ?? "system",
      actorName: actor?.actorName ?? "System",
      action: "CREATED",
      entityType: "FeeStructure",
      entityId: feeStructure._id.toString(),
      newValue: { feeTypeId: data.feeTypeId, className: data.class, section: data.section, amount: data.amount },
      ipAddress: actor?.ipAddress,
    }, session);

    await session.commitTransaction();
    return feeStructure;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function getFeeStructures(query: FeeStructureQueryInput) {
  const { page, limit, class: studentClass, section } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, any> = { isDeleted: false };
  if (studentClass) filter.class = studentClass;
  if (section) filter.section = section;

  const [feeStructures, total] = await Promise.all([
    FeeStructure.find(filter).populate("feeTypeId").sort({ createdAt: -1 }).skip(skip).limit(limit),
    FeeStructure.countDocuments(filter),
  ]);

  return { feeStructures, total, page, limit };
}

export async function getFeeStructureById(id: string) {
  const fs = await FeeStructure.findOne({ _id: id, isDeleted: false }).populate("feeTypeId");
  if (!fs) throw new NotFoundError("FeeStructure", id);
  return fs;
}

export async function getFeeStructuresByClass(studentClass: string, section?: string) {
  const filter: Record<string, any> = { class: studentClass, isDeleted: false };
  if (section) filter.section = section;
  return FeeStructure.find(filter).populate("feeTypeId").sort({ createdAt: -1 });
}

export async function deleteFeeStructure(id: string, actor?: ActorInfo, reason?: string) {
  const existing = await getFeeStructureById(id);

  const linkedLedgers = await StudentFeeLedger.countDocuments({ feeStructureId: id, isDeleted: false });
  if (linkedLedgers > 0) {
    throw new ConflictError(`Cannot delete fee structure: ${linkedLedgers} ledger(s) still reference it.`);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await FeeStructure.findByIdAndUpdate(id, { isDeleted: true, deletedAt: new Date() }, { session });

    await createAuditLog({
      actorId: actor?.actorId ?? "system",
      actorName: actor?.actorName ?? "System",
      action: "DELETED",
      entityType: "FeeStructure",
      entityId: id,
      previousValue: { feeTypeId: existing.feeTypeId.toString(), className: existing.class, section: existing.section, amount: existing.amount },
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
