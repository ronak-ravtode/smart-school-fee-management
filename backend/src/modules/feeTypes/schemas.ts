import { z } from "zod";

const RuleValueSchema = z.object({
  type: z.enum(["percentage", "flat"], {
    errorMap: () => ({ message: "Rule type must be 'percentage' or 'flat'" }),
  }),
  value: z.number().positive("Rule value must be positive"),
});

const FeeRulesSchema = z
  .object({
    lateFee: RuleValueSchema.optional(),
    waiver: RuleValueSchema.optional(),
    discount: RuleValueSchema.optional(),
  })
  .strict("Fee rules contain invalid keys. Allowed: lateFee, waiver, discount");

export const CreateFeeTypeSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  baseAmount: z.number().positive("Base amount must be positive"),
  rules: FeeRulesSchema.nullable().optional(),
});

export const UpdateFeeTypeSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  baseAmount: z.number().positive().optional(),
  rules: FeeRulesSchema.nullable().optional(),
});

export const FeeTypeQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
});

export const FeeTypeParamsSchema = z.object({
  id: z.string().uuid("Invalid fee type ID"),
});

export const DeleteFeeTypeSchema = z.object({
  reason: z.string().min(10, "Reason is required and must be at least 10 characters"),
});

export type CreateFeeTypeInput = z.infer<typeof CreateFeeTypeSchema>;
export type UpdateFeeTypeInput = z.infer<typeof UpdateFeeTypeSchema>;
export type FeeTypeQueryInput = z.infer<typeof FeeTypeQuerySchema>;
export type FeeTypeParamsInput = z.infer<typeof FeeTypeParamsSchema>;
export type DeleteFeeTypeInput = z.infer<typeof DeleteFeeTypeSchema>;
export type FeeRules = z.infer<typeof FeeRulesSchema>;
