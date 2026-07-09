import { z } from "zod";

export const AuditLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  action: z.enum([
    "CREATED", "UPDATED", "DELETED", "WAIVED", "PENALTY_APPLIED",
    "CHEQUE_CLEARED", "CHEQUE_BOUNCED", "PAYMENT_RECORDED", "PAYMENT_REVERSED",
    "BULK_PAYMENT",
  ]).optional(),
  entityType: z.string().optional(),
  actorName: z.string().optional(),
  entityId: z.string().uuid().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export type AuditLogQueryInput = z.infer<typeof AuditLogQuerySchema>;
