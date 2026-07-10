import mongoose from "mongoose";
import { Student, FeeStructure, StudentFeeLedger, Transaction } from "@/models";
import { NotFoundError } from "@/lib/errors";
import { calculateFee, FeeRules } from "./feeEngine";

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
  ledgers: any[];
}

function buildIdempotencyKey(studentId: string, feeStructureId: string, academicSession: string, month: string): string {
  return `${studentId}:${feeStructureId}:${academicSession}:${month}`;
}

export async function generateLedgersForClass(input: GenerateLedgerInput): Promise<LedgerGenerationResult> {
  const { class: studentClass, section, academicSession, month, dueDate, currentDate } = input;
  const now = currentDate ?? new Date();

  const studentFilter: Record<string, any> = { class: studentClass, isDeleted: false };
  if (section) studentFilter.section = section;

  const students = await Student.find(studentFilter);
  if (students.length === 0) {
    throw new NotFoundError("Students", `class ${studentClass}${section ? ` section ${section}` : ""}`);
  }

  const feeFilter: Record<string, any> = { class: studentClass, isDeleted: false };
  if (section) feeFilter.section = section;

  const feeStructures = await FeeStructure.find(feeFilter).populate("feeTypeId");
  if (feeStructures.length === 0) {
    throw new NotFoundError("FeeStructures", `class ${studentClass}${section ? ` section ${section}` : ""}`);
  }

  const studentIds = students.map((s) => s._id);
  const fsIds = feeStructures.map((fs) => fs._id);

  const existingLedgers = await StudentFeeLedger.find({
    studentId: { $in: studentIds },
    feeStructureId: { $in: fsIds },
    isDeleted: false,
  }).select("studentId feeStructureId");

  const existingKeys = new Set(
    existingLedgers.map((l) => buildIdempotencyKey(l.studentId.toString(), l.feeStructureId.toString(), academicSession, month))
  );

  const ledgerInserts: any[] = [];
  let skipped = 0;

  for (const student of students) {
    for (const fs of feeStructures) {
      const idempotencyKey = buildIdempotencyKey(student._id.toString(), fs._id.toString(), academicSession, month);
      if (existingKeys.has(idempotencyKey)) {
        skipped++;
        continue;
      }

      const ft = fs.feeTypeId as any;
      const rules = (ft?.rules as FeeRules) ?? null;
      const result = calculateFee(fs.amount, dueDate, now, rules);

      ledgerInserts.push({
        studentId: student._id,
        feeStructureId: fs._id,
        totalAmount: result.totalAmount.toNumber(),
        waivedAmount: result.waiverAmount.toNumber(),
        paidAmount: 0,
        dueDate,
        feeIssuedDate: now,
        status: "PENDING",
      });
    }
  }

  if (ledgerInserts.length === 0) {
    return { created: 0, skipped, total: students.length * feeStructures.length, ledgers: [] };
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const created = await StudentFeeLedger.insertMany(ledgerInserts, { session });
    await session.commitTransaction();
    return { created: ledgerInserts.length, skipped, total: students.length * feeStructures.length, ledgers: created };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function getLedgersByStudent(studentId: string) {
  const student = await Student.findOne({ _id: studentId, isDeleted: false });
  if (!student) throw new NotFoundError("Student", studentId);

  const ledgers = await StudentFeeLedger.find({ studentId, isDeleted: false })
    .populate({ path: "feeStructureId", populate: { path: "feeTypeId" } })
    .sort({ dueDate: -1 });

  const ledgerIds = ledgers.map((l) => l._id);
  const transactions = await Transaction.find({
    ledgerId: { $in: ledgerIds },
    status: { $in: ["SUCCESS", "CLEARED"] },
    isDeleted: false,
  });

  const txMap = new Map<string, any[]>();
  for (const tx of transactions) {
    const lid = tx.ledgerId.toString();
    if (!txMap.has(lid)) txMap.set(lid, []);
    txMap.get(lid)!.push(tx);
  }

  return ledgers.map((l) => ({ ...l.toObject(), transactions: txMap.get(l._id.toString()) ?? [] }));
}

export async function getDefaulters() {
  return StudentFeeLedger.find({ status: "OVERDUE", isDeleted: false })
    .populate("studentId")
    .populate({ path: "feeStructureId", populate: { path: "feeTypeId" } })
    .sort({ dueDate: 1 });
}

export async function updateOverdueStatuses() {
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  return StudentFeeLedger.updateMany(
    { status: { $in: ["PENDING", "PARTIAL"] }, dueDate: { $lt: todayUTC }, isDeleted: false },
    { $set: { status: "OVERDUE" } }
  );
}
