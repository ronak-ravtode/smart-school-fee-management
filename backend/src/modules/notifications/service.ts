import { Student, StudentFeeLedger } from "@/models";
import { NotFoundError } from "@/lib/errors";
import { createAuditLog, ActorInfo } from "@/services/auditService";

export interface SendReminderInput {
  studentId: string;
  type: "STANDARD" | "URGENT";
  message?: string;
  actor?: ActorInfo;
}

export async function sendReminder(input: SendReminderInput) {
  const student = await Student.findOne({ _id: input.studentId, isDeleted: false });
  if (!student) throw new NotFoundError("Student", input.studentId);

  const overdueLedgers = await StudentFeeLedger.find({
    studentId: input.studentId,
    status: { $in: ["OVERDUE", "PARTIAL"] },
    isDeleted: false,
  }).populate({ path: "feeStructureId", populate: { path: "feeTypeId" } }).sort({ dueDate: 1 });

  const totalRemaining = overdueLedgers.reduce(
    (sum, l) => sum + l.totalAmount - l.paidAmount - l.waivedAmount, 0
  );

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
        message: input.message ?? (input.type === "URGENT"
          ? `URGENT: Rs. ${totalRemaining.toLocaleString("en-IN")} overdue for ${overdueLedgers.length} fee(s).`
          : `Reminder: Rs. ${totalRemaining.toLocaleString("en-IN")} pending for ${overdueLedgers.length} fee(s).`),
      },
      ipAddress: input.actor.ipAddress,
    });
  }

  return {
    studentId: student._id.toString(),
    studentName: student.name,
    email: student.email,
    type: input.type,
    overdueLedgerCount: overdueLedgers.length,
    totalRemaining,
    logged: true,
  };
}
