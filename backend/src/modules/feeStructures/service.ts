import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ConflictError } from "@/lib/errors";
import {
  CreateFeeStructureInput,
  FeeStructureQueryInput,
} from "./schemas";

export async function createFeeStructure(data: CreateFeeStructureInput) {
  const feeType = await prisma.feeType.findUnique({
    where: { id: data.feeTypeId },
  });
  if (!feeType) {
    throw new NotFoundError("FeeType", data.feeTypeId);
  }

  const existing = await prisma.feeStructure.findUnique({
    where: {
      feeTypeId_class_section: {
        feeTypeId: data.feeTypeId,
        class: data.class,
        section: data.section,
      },
    },
  });
  if (existing) {
    throw new ConflictError(
      `A fee structure already exists for this fee type in class ${data.class} section ${data.section}`
    );
  }

  return prisma.feeStructure.create({
    data: {
      feeTypeId: data.feeTypeId,
      class: data.class,
      section: data.section,
      amount: data.amount,
    },
    include: { feeType: true },
  });
}

export async function getFeeStructures(query: FeeStructureQueryInput) {
  const { page, limit, class: studentClass, section } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.FeeStructureWhereInput = {};

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
  const feeStructure = await prisma.feeStructure.findUnique({
    where: { id },
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
  const where: Prisma.FeeStructureWhereInput = { class: studentClass };
  if (section) {
    where.section = section;
  }

  return prisma.feeStructure.findMany({
    where,
    include: { feeType: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteFeeStructure(id: string) {
  await getFeeStructureById(id);
  return prisma.feeStructure.delete({ where: { id } });
}
