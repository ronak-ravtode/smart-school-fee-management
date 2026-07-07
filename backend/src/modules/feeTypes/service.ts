import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ConflictError } from "@/lib/errors";
import {
  CreateFeeTypeInput,
  UpdateFeeTypeInput,
  FeeTypeQueryInput,
} from "./schemas";

export async function createFeeType(data: CreateFeeTypeInput) {
  const existing = await prisma.feeType.findUnique({
    where: { name: data.name },
  });
  if (existing) {
    throw new ConflictError("A fee type with this name already exists");
  }

  return prisma.feeType.create({
    data: {
      name: data.name,
      baseAmount: data.baseAmount,
      rules: data.rules ?? Prisma.JsonNull,
    },
  });
}

export async function getFeeTypes(query: FeeTypeQueryInput) {
  const { page, limit, search } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.FeeTypeWhereInput = {};

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
  const feeType = await prisma.feeType.findUnique({ where: { id } });
  if (!feeType) {
    throw new NotFoundError("FeeType", id);
  }
  return feeType;
}

export async function updateFeeType(id: string, data: UpdateFeeTypeInput) {
  await getFeeTypeById(id);

  if (data.name) {
    const existing = await prisma.feeType.findFirst({
      where: { name: data.name, NOT: { id } },
    });
    if (existing) {
      throw new ConflictError("A fee type with this name already exists");
    }
  }

  const updateData: Prisma.FeeTypeUpdateInput = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.baseAmount !== undefined) updateData.baseAmount = data.baseAmount;
  if (data.rules !== undefined) {
    updateData.rules = data.rules === null ? Prisma.JsonNull : data.rules;
  }

  return prisma.feeType.update({ where: { id }, data: updateData });
}

export async function deleteFeeType(id: string) {
  await getFeeTypeById(id);

  const linkedStructures = await prisma.feeStructure.count({
    where: { feeTypeId: id },
  });
  if (linkedStructures > 0) {
    throw new ConflictError(
      `Cannot delete fee type: ${linkedStructures} fee structure(s) still reference it. Remove them first.`
    );
  }

  return prisma.feeType.delete({ where: { id } });
}
