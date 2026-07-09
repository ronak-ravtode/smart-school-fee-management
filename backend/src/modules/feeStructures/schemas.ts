import { z } from "zod";

export const CreateFeeStructureSchema = z.object({
  feeTypeId: z.string().uuid("Invalid fee type ID"),
  class: z.string().min(1, "Class is required").max(20),
  section: z.string().min(1, "Section is required").max(10),
  amount: z.number().positive("Amount must be positive"),
});

export const FeeStructureQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  class: z.string().optional(),
  section: z.string().optional(),
});

export const FeeStructureParamsSchema = z.object({
  id: z.string().uuid("Invalid fee structure ID"),
});

export const FeeStructureByClassParamsSchema = z.object({
  class: z.string().min(1),
  section: z.string().optional(),
});

export const DeleteFeeStructureSchema = z.object({
  reason: z.string().min(10, "Reason is required and must be at least 10 characters"),
});

export type CreateFeeStructureInput = z.infer<typeof CreateFeeStructureSchema>;
export type FeeStructureQueryInput = z.infer<typeof FeeStructureQuerySchema>;
export type FeeStructureParamsInput = z.infer<typeof FeeStructureParamsSchema>;
export type FeeStructureByClassParamsInput = z.infer<
  typeof FeeStructureByClassParamsSchema
>;
export type DeleteFeeStructureInput = z.infer<typeof DeleteFeeStructureSchema>;
