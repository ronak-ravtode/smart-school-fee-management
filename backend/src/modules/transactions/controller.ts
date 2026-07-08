import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/apiResponse";
import * as transactionService from "@/services/transactionService";
import {
  SinglePaymentInput,
  BulkReconcileInput,
  LedgerTransactionsParams,
} from "./schemas";

export const recordPayment = asyncHandler(
  async (req: Request, res: Response) => {
    const input = req.body as SinglePaymentInput;
    const result = await transactionService.recordSinglePayment(input);
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
    const result = await transactionService.bulkReconcile(input.payments);
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
