import { z } from "zod";

export const ReceiptParamsSchema = z.object({
  transactionId: z.string().uuid("Invalid transaction ID"),
});

export type ReceiptParamsInput = z.infer<typeof ReceiptParamsSchema>;
