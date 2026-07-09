import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ConflictError } from "@/lib/errors";
import { createAuditLog, ActorInfo } from "@/services/auditService";
import {
  CreateFeeStructureInput,
  FeeStructureQueryInput,
} from "./schemas";

const SOFT_DELETE_WHERE = { isDeleted: false } as const;

export async function createFeeStructure(data: CreateFeeStructureInput, actor?: ActorInfo) {
  const feeType = await prisma.feeType.findFirst({
    where: { id: data.feeTypeId, ...SOFT_DELETE_WHERE },
  });
  if (!feeType) {
    throw new NotFoundError("FeeType", data.feeTypeId);
  }

  const existing = await prisma.feeStructure.findFirst({
    where: {
      feeTypeId: data.feeTypeId,
      class: data.class,
      section: data.section,
      ...SOFT_DELETE_WHERE,
    },
  });
  if (existing) {
    throw new ConflictError(
      `A fee structure already exists for this fee type in class ${data.class} section ${data.section}`
    );
  }

  return prisma.$transaction(async (tx) => {
    const feeStructure = await tx.feeStructure.create({
      data: {
        feeTypeId: data.feeTypeId,
        class: data.class,
        section: data.section,
        amount: data.amount,
      },
      include: { feeType: true },
    });

    await createAuditLog({
      actorId: actor?.actorId ?? "system",
      actorName: actor?.actorName ?? "System",
      action: "CREATED",
      entityType: "FeeStructure",
      entityId: feeStructure.id,
      newValue: {
        feeTypeId: feeStructure.feeTypeId,
        className: feeStructure.class,
        section: feeStructure.section,
        amount: Number(feeStructure.amount),
      },
      ipAddress: actor?.ipAddress,
    }, tx);

    return feeStructure;
  });
}

export async function getFeeStructures(query: FeeStructureQueryInput) {
  const { page, limit, class: studentClass, section } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.FeeStructureWhereInput = { ...SOFT_DELETE_WHERE };

  if (studentClass) {
    where.class = studentClass;
  }
  if (section) {
    where.section = section;
  }

  const [feeStructures, total] = await Promise.all([
    prisma.feeStructure.findMany({
      where,
      skip,
      take: limit,
      include: { feeType: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.feeStructure.count({ where }),
  ]);

  return { feeStructures, total, page, limit };
}

export async function getFeeStructureById(id: string) {
  const feeStructure = await prisma.feeStructure.findFirst({
    where: { id, ...SOFT_DELETE_WHERE },
    include: { feeType: true },
  });
  if (!feeStructure) {
    throw new NotFoundError("FeeStructure", id);
  }
  return feeStructure;
}

export async function getFeeStructuresByClass(
  studentClass: string,
  section?: string
) {
  const where: Prisma.FeeStructureWhereInput = { class: studentClass, ...SOFT_DELETE_WHERE };
  if (section) {
    where.section = section;
  }

  return prisma.feeStructure.findMany({
    where,
    include: { feeType: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteFeeStructure(id: string, actor?: ActorInfo, reason?: string) {
  const existing = await getFeeStructureById(id);

  // Check for linked ledgers before soft-deleting
  const linkedLedgers = await prisma.studentFeeLedger.count({
    where: { feeStructureId: id, ...SOFT_DELETE_WHERE },
  });
  if (linkedLedgers > 0) {
    throw new ConflictError(
      `Cannot delete fee structure: ${linkedLedgers} ledger(s) still reference it. Remove them first.`
    );
  }

  return prisma.$transaction(async (tx) => {
    // Edge Case 1: Soft delete — UPDATE instead of DELETE
    await tx.feeStructure.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    await createAuditLog({
      actorId: actor?.actorId ?? "system",
      actorName: actor?.actorName ?? "System",
      action: "DELETED",
      entityType: "FeeStructure",
      entityId: id,
      previousValue: {
        feeTypeId: existing.feeTypeId,
        className: existing.class,
        section: existing.section,
        amount: Number(existing.amount),
      },
      reason,
      ipAddress: actor?.ipAddress,
    }, tx);
  });
}
