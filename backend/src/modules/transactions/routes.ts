import { Router } from "express";
import { validate } from "@/middleware/validate";
import {
  SinglePaymentSchema,
  BulkReconcileSchema,
  LedgerTransactionsParamsSchema,
} from "./schemas";
import {
  recordPayment,
  bulkReconcile,
  getLedgerTransactions,
} from "./controller";

const router = Router();

router.post(
  "/pay",
  validate(SinglePaymentSchema, "body"),
  recordPayment
);

router.post(
  "/bulk-reconcile",
  validate(BulkReconcileSchema, "body"),
  bulkReconcile
);

router.get(
  "/ledger/:ledgerId",
  validate(LedgerTransactionsParamsSchema, "params"),
  getLedgerTransactions
);

export { router as transactionModuleRoutes };
