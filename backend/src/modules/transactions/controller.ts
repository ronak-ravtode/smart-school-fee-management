import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/apiResponse";
import * as transactionService from "@/services/transactionService";
import {
  SinglePaymentInput,
  BulkReconcileInput,
  LedgerTransactionsParams,
  ReconcileChequeSchema,
  BounceChequeSchema,
} from "./schemas";

export const recordPayment = asyncHandler(
  async (req: Request, res: Response) => {
    const input = req.body as SinglePaymentInput;
    const actor = req.user ? { id: req.user.id, name: req.user.name, ipAddress: req.ip } : undefined;
    const result = await transactionService.recordSinglePayment(input, actor);
    res.status(201).json(
      sendSuccess(
        {
          transaction: result.transaction,
          ledger: result.ledger,
        },
        "Payment recorded successfully"
      )
    );
  }
);

export const bulkReconcile = asyncHandler(
  async (req: Request, res: Response) => {
    const input = req.body as BulkReconcileInput;
    const actor = req.user ? { id: req.user.id, name: req.user.name, ipAddress: req.ip } : undefined;
    const result = await transactionService.bulkReconcile(input.payments, actor);
    res.status(201).json(
      sendSuccess(
        {
          processed: result.processed,
          results: result.results,
        },
        `Successfully processed ${result.processed} payment(s)`
      )
    );
  }
);

export const getLedgerTransactions = asyncHandler(
  async (req: Request, res: Response) => {
    const { ledgerId } = req.params as LedgerTransactionsParams;
    const transactions =
      await transactionService.getTransactionsByLedger(ledgerId);
    res.json(sendSuccess(transactions, "Transactions fetched"));
  }
);

export const getPendingCheques = asyncHandler(
  async (_req: Request, res: Response) => {
    const cheques = await transactionService.getPendingCheques();
    res.json(sendSuccess(cheques, "Pending cheques fetched"));
  }
);

export const clearCheque = asyncHandler(
  async (req: Request, res: Response) => {
    const { transactionId, actualClearedAmount, reason } = req.body as {
      transactionId: string;
      actualClearedAmount?: number;
      reason?: string;
    };
    const actor = req.user ? { id: req.user.id, name: req.user.name, ipAddress: req.ip } : undefined;
    const result = await transactionService.clearCheque({
      transactionId,
      actualClearedAmount,
      actor,
      reason,
    });
    res.json(
      sendSuccess(
        {
          transaction: result.transaction,
          ledger: result.ledger,
          remainingTransaction: result.remainingTransaction ?? null,
        },
        "Cheque cleared successfully"
      )
    );
  }
);

export const bounceCheque = asyncHandler(
  async (req: Request, res: Response) => {
    const { transactionId, reason } = req.body as { transactionId: string; reason: string };
    const actor = req.user ? { id: req.user.id, name: req.user.name, ipAddress: req.ip } : undefined;
    const result = await transactionService.bounceCheque({
      transactionId,
      actor,
      reason,
    });
    res.json(
      sendSuccess(
        {
          transaction: result.transaction,
          ledger: result.ledger,
        },
        "Cheque marked as bounced. Late fee penalty recalculated from original due date."
      )
    );
  }
);
