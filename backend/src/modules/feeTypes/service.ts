import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ConflictError } from "@/lib/errors";
import { createAuditLog, ActorInfo } from "@/services/auditService";
import {
  CreateFeeTypeInput,
  UpdateFeeTypeInput,
  FeeTypeQueryInput,
} from "./schemas";

const SOFT_DELETE_WHERE = { isDeleted: false } as const;

export async function createFeeType(data: CreateFeeTypeInput, actor?: ActorInfo) {
  const existing = await prisma.feeType.findFirst({
    where: { name: data.name, ...SOFT_DELETE_WHERE },
  });
  if (existing) {
    throw new ConflictError("A fee type with this name already exists");
  }

  return prisma.$transaction(async (tx) => {
    const feeType = await tx.feeType.create({
      data: {
        name: data.name,
        baseAmount: data.baseAmount,
        rules: data.rules ?? Prisma.JsonNull,
      },
    });

    await createAuditLog({
      actorId: actor?.actorId ?? "system",
      actorName: actor?.actorName ?? "System",
      action: "CREATED",
      entityType: "FeeType",
      entityId: feeType.id,
      newValue: {
        name: feeType.name,
        baseAmount: Number(feeType.baseAmount),
        rules: feeType.rules,
      },
      ipAddress: actor?.ipAddress,
    }, tx);

    return feeType;
  });
}

export async function getFeeTypes(query: FeeTypeQueryInput) {
  const { page, limit, search } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.FeeTypeWhereInput = { ...SOFT_DELETE_WHERE };

  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  const [feeTypes, total] = await Promise.all([
    prisma.feeType.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.feeType.count({ where }),
  ]);

  return { feeTypes, total, page, limit };
}

export async function getFeeTypeById(id: string) {
  const feeType = await prisma.feeType.findFirst({ where: { id, ...SOFT_DELETE_WHERE } });
  if (!feeType) {
    throw new NotFoundError("FeeType", id);
  }
  return feeType;
}

export async function updateFeeType(id: string, data: UpdateFeeTypeInput, actor?: ActorInfo) {
  const existing = await getFeeTypeById(id);

  if (data.name) {
    const duplicate = await prisma.feeType.findFirst({
      where: { name: data.name, NOT: { id }, ...SOFT_DELETE_WHERE },
    });
    if (duplicate) {
      throw new ConflictError("A fee type with this name already exists");
    }
  }

  return prisma.$transaction(async (tx) => {
    const updateData: Prisma.FeeTypeUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.baseAmount !== undefined) updateData.baseAmount = data.baseAmount;
    if (data.rules !== undefined) {
      updateData.rules = data.rules === null ? Prisma.JsonNull : data.rules;
    }

    const updated = await tx.feeType.update({ where: { id }, data: updateData });

    await createAuditLog({
      actorId: actor?.actorId ?? "system",
      actorName: actor?.actorName ?? "System",
      action: "UPDATED",
      entityType: "FeeType",
      entityId: id,
      previousValue: {
        name: existing.name,
        baseAmount: Number(existing.baseAmount),
        rules: existing.rules,
      },
      newValue: {
        name: updated.name,
        baseAmount: Number(updated.baseAmount),
        rules: updated.rules,
      },
      ipAddress: actor?.ipAddress,
    }, tx);

    return updated;
  });
}

export async function deleteFeeType(id: string, actor?: ActorInfo, reason?: string) {
  const existing = await getFeeTypeById(id);

  const linkedStructures = await prisma.feeStructure.count({
    where: { feeTypeId: id, ...SOFT_DELETE_WHERE },
  });
  if (linkedStructures > 0) {
    throw new ConflictError(
      `Cannot delete fee type: ${linkedStructures} fee structure(s) still reference it. Remove them first.`
    );
  }

  return prisma.$transaction(async (tx) => {
    // Edge Case 1: Soft delete — UPDATE instead of DELETE
    await tx.feeType.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    await createAuditLog({
      actorId: actor?.actorId ?? "system",
      actorName: actor?.actorName ?? "System",
      action: "DELETED",
      entityType: "FeeType",
      entityId: id,
      previousValue: {
        name: existing.name,
        baseAmount: Number(existing.baseAmount),
        rules: existing.rules,
      },
      reason,
      ipAddress: actor?.ipAddress,
    }, tx);
  });
}
