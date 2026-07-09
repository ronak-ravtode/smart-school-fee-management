import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import { createAuditLog } from "@/services/auditService";
import type { ActorInfo } from "@/services/auditService";

const SOFT_DELETE_WHERE = { isDeleted: false } as const;

export interface SendReminderInput {
  studentId: string;
  type: "STANDARD" | "URGENT";
  message?: string;
  actor?: ActorInfo;
}

export async function sendReminder(input: SendReminderInput) {
  const student = await prisma.student.findFirst({
    where: { id: input.studentId, ...SOFT_DELETE_WHERE },
  });
  if (!student) {
    throw new NotFoundError("Student", input.studentId);
  }

  // Find the student's overdue ledgers for context
  const overdueLedgers = await prisma.studentFeeLedger.findMany({
    where: {
      studentId: input.studentId,
      status: { in: ["OVERDUE", "PARTIAL"] },
      ...SOFT_DELETE_WHERE,
    },
    include: {
      feeStructure: { include: { feeType: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const totalRemaining = overdueLedgers.reduce(
    (sum, l) =>
      sum +
      Number(l.totalAmount) -
      Number(l.paidAmount) -
      Number(l.waivedAmount),
    0
  );

  // Log to audit trail
  if (input.actor) {
    await createAuditLog({
      actorId: input.actor.actorId,
      actorName: input.actor.actorName,
      action: "REMINDER_SENT",
      entityType: "Student",
      entityId: input.studentId,
      newValue: {
        studentName: student.name,
        studentEmail: student.email,
        type: input.type,
        overdueLedgerCount: overdueLedgers.length,
        totalRemaining,
        message:
          input.message ??
          (input.type === "URGENT"
            ? `URGENT: Rs. ${totalRemaining.toLocaleString("en-IN")} overdue for ${overdueLedgers.length} fee(s).`
            : `Reminder: Rs. ${totalRemaining.toLocaleString("en-IN")} pending for ${overdueLedgers.length} fee(s).`),
      },
      ipAddress: input.actor.ipAddress,
    });
  }

  return {
    studentId: student.id,
    studentName: student.name,
    email: student.email,
    type: input.type,
    overdueLedgerCount: overdueLedgers.length,
    totalRemaining,
    logged: true,
  };
}
