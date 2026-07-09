import { Prisma, StudentFeeLedger } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ConflictError } from "@/lib/errors";
import { calculateFee, toPrismaDecimal, FeeRules } from "./feeEngine";

export interface GenerateLedgerInput {
  class: string;
  section?: string;
  academicSession: string;
  month: string;
  dueDate: Date;
  currentDate?: Date;
}

export interface LedgerGenerationResult {
  created: number;
  skipped: number;
  total: number;
  ledgers: StudentFeeLedger[];
}

function buildIdempotencyKey(
  studentId: string,
  feeStructureId: string,
  academicSession: string,
  month: string
): string {
  return `${studentId}:${feeStructureId}:${academicSession}:${month}`;
}

export async function generateLedgersForClass(
  input: GenerateLedgerInput
): Promise<LedgerGenerationResult> {
  const { class: studentClass, section, academicSession, month, dueDate, currentDate } = input;
  const now = currentDate ?? new Date();

  const where: Prisma.StudentWhereInput = { class: studentClass };
  if (section) {
    where.section = section;
  }

  const students = await prisma.student.findMany({ where });
  if (students.length === 0) {
    throw new NotFoundError("Students", `class ${studentClass}${section ? ` section ${section}` : ""}`);
  }

  const feeWhere: Prisma.FeeStructureWhereInput = { class: studentClass };
  if (section) {
    feeWhere.section = section;
  }

  const feeStructures = await prisma.feeStructure.findMany({
    where: feeWhere,
    include: { feeType: true },
  });

  if (feeStructures.length === 0) {
    throw new NotFoundError("FeeStructures", `class ${studentClass}${section ? ` section ${section}` : ""}`);
  }

  const existingLedgers = await prisma.studentFeeLedger.findMany({
    where: {
      studentId: { in: students.map((s) => s.id) },
      feeStructureId: { in: feeStructures.map((fs) => fs.id) },
    },
    select: { studentId: true, feeStructureId: true },
  });

  const existingKeys = new Set(
    existingLedgers.map((l) => buildIdempotencyKey(l.studentId, l.feeStructureId, academicSession, month))
  );

  const ledgerInserts: Prisma.StudentFeeLedgerCreateManyInput[] = [];
  let skipped = 0;

  for (const student of students) {
    for (const fs of feeStructures) {
      const idempotencyKey = buildIdempotencyKey(student.id, fs.id, academicSession, month);

      if (existingKeys.has(idempotencyKey)) {
        skipped++;
        continue;
      }

      const rules = (fs.feeType.rules as FeeRules) ?? null;
      const result = calculateFee(fs.amount, dueDate, now, rules);

      ledgerInserts.push({
        studentId: student.id,
        feeStructureId: fs.id,
        totalAmount: toPrismaDecimal(result.totalAmount),
        waivedAmount: toPrismaDecimal(result.waiverAmount),
        paidAmount: "0.00",
        dueDate,
        status: "PENDING",
      });
    }
  }

  if (ledgerInserts.length === 0) {
    return {
      created: 0,
      skipped,
      total: students.length * feeStructures.length,
      ledgers: [],
    };
  }

  const created = await prisma.$transaction(async (tx) => {
    await tx.studentFeeLedger.createMany({ data: ledgerInserts });

    return tx.studentFeeLedger.findMany({
      where: {
        studentId: { in: students.map((s) => s.id) },
        feeStructureId: { in: feeStructures.map((fs) => fs.id) },
      },
      orderBy: { createdAt: "desc" },
      take: ledgerInserts.length,
    });
  });

  return {
    created: ledgerInserts.length,
    skipped,
    total: students.length * feeStructures.length,
    ledgers: created,
  };
}

export async function getLedgersByStudent(studentId: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) {
    throw new NotFoundError("Student", studentId);
  }

  return prisma.studentFeeLedger.findMany({
    where: { studentId },
    include: {
      feeStructure: { include: { feeType: true } },
      transactions: { where: { status: { in: ["SUCCESS", "CLEARED"] } } },
    },
    orderBy: { dueDate: "desc" },
  });
}

export async function getDefaulters() {
  return prisma.studentFeeLedger.findMany({
    where: { status: "OVERDUE" },
    include: {
      student: true,
      feeStructure: { include: { feeType: true } },
    },
    orderBy: { dueDate: "asc" },
  });
}

export async function updateOverdueStatuses() {
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  return prisma.studentFeeLedger.updateMany({
    where: {
      status: { in: ["PENDING", "PARTIAL"] },
      dueDate: { lt: todayUTC },
    },
    data: { status: "OVERDUE" },
  });
}
