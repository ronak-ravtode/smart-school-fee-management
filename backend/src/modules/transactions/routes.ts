import { Router } from "express";
import { validate } from "@/middleware/validate";
import {
  SinglePaymentSchema,
  BulkReconcileSchema,
  LedgerTransactionsParamsSchema,
  ReconcileChequeSchema,
  BounceChequeSchema,
} from "./schemas";
import {
  recordPayment,
  bulkReconcile,
  getLedgerTransactions,
  getPendingCheques,
  clearCheque,
  bounceCheque,
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

router.get("/pending-cheques", getPendingCheques);

router.post(
  "/clear-cheque",
  validate(ReconcileChequeSchema, "body"),
  clearCheque
);

router.post(
  "/bounce-cheque",
  validate(BounceChequeSchema, "body"),
  bounceCheque
);

export { router as transactionModuleRoutes };
