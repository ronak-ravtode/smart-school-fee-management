import { Request, Response } from "express";
import { sendSuccess } from "@/utils/apiResponse";
import { asyncHandler } from "@/utils/asyncHandler";

export const getLedgers = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json(sendSuccess([], "Ledgers fetched"));
  }
);

export const getLedgerById = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json(sendSuccess(null, "Ledger fetched"));
  }
);

export const getLedgersByStudent = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json(sendSuccess([], "Student ledgers fetched"));
  }
);
