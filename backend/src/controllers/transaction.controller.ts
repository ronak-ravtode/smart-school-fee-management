import { Request, Response } from "express";
import { sendSuccess } from "@/utils/apiResponse";
import { asyncHandler } from "@/utils/asyncHandler";

export const getTransactions = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json(sendSuccess([], "Transactions fetched"));
  }
);

export const getTransactionById = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json(sendSuccess(null, "Transaction fetched"));
  }
);

export const createTransaction = asyncHandler(
  async (_req: Request, res: Response) => {
    res.status(201).json(sendSuccess(null, "Transaction created"));
  }
);
