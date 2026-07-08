import { z } from "zod";

export const GenerateLedgerSchema = z.object({
  class: z.string().min(1, "Class is required").max(20),
  section: z.string().max(10).optional(),
  academicSession: z.string().min(1, "Academic session is required").max(50),
  month: z.string().min(1, "Month is required").max(20),
  dueDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid due date format",
  }),
});

export const StudentLedgerParamsSchema = z.object({
  studentId: z.string().uuid("Invalid student ID"),
});

export const LedgerQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["PENDING", "PARTIAL", "PAID", "OVERDUE"]).optional(),
});

export type GenerateLedgerInput = z.infer<typeof GenerateLedgerSchema>;
export type StudentLedgerParamsInput = z.infer<typeof StudentLedgerParamsSchema>;
export type LedgerQueryInput = z.infer<typeof LedgerQuerySchema>;
