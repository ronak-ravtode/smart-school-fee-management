import { z } from "zod";

const PaymentMethodEnum = z.enum(["UPI", "CASH", "CHEQUE"]);

export const SinglePaymentSchema = z.object({
  ledgerId: z.string().uuid("Invalid ledger ID"),
  amount: z.number().positive("Amount must be positive"),
  paymentMethod: PaymentMethodEnum,
  transactionRef: z.string().max(100).optional(),
  receiptNumber: z.string().max(50).optional(),
  chequeNumber: z.string().max(50).optional(),
  chequeBank: z.string().max(100).optional(),
  chequeIssueDate: z.string().optional(),
}).refine(
  (data) => {
    if (data.paymentMethod === "CHEQUE") {
      return !!data.chequeNumber && !!data.chequeBank && !!data.chequeIssueDate;
    }
    return true;
  },
  { message: "Cheque number, bank name, and issue date are required for cheque payments" }
);

const BulkPaymentItemSchema = z.object({
  ledgerId: z.string().uuid("Invalid ledger ID"),
  amount: z.number().positive("Amount must be positive"),
  paymentMethod: PaymentMethodEnum,
  transactionRef: z.string().max(100).optional(),
  receiptNumber: z.string().max(50).optional(),
  chequeNumber: z.string().max(50).optional(),
  chequeBank: z.string().max(100).optional(),
  chequeIssueDate: z.string().optional(),
}).refine(
  (data) => {
    if (data.paymentMethod === "CHEQUE") {
      return !!data.chequeNumber && !!data.chequeBank && !!data.chequeIssueDate;
    }
    return true;
  },
  { message: "Cheque number, bank name, and issue date are required for cheque payments" }
);

export const BulkReconcileSchema = z.object({
  payments: z
    .array(BulkPaymentItemSchema)
    .min(1, "At least one payment required")
    .max(100, "Cannot exceed 100 payments per batch"),
});

export const LedgerTransactionsParamsSchema = z.object({
  ledgerId: z.string().uuid("Invalid ledger ID"),
});

export const ReconcileChequeSchema = z.object({
  transactionId: z.string().uuid("Invalid transaction ID"),
});

export type SinglePaymentInput = z.infer<typeof SinglePaymentSchema>;
export type BulkReconcileInput = z.infer<typeof BulkReconcileSchema>;
export type LedgerTransactionsParams = z.infer<
  typeof LedgerTransactionsParamsSchema
>;
export type ReconcileChequeInput = z.infer<typeof ReconcileChequeSchema>;
