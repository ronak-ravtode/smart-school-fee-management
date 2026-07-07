import { Request, Response } from "express";
import { sendSuccess } from "@/utils/apiResponse";
import { asyncHandler } from "@/utils/asyncHandler";

export const getFeeTypes = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json(sendSuccess([], "Fee types fetched"));
  }
);

export const getFeeTypeById = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json(sendSuccess(null, "Fee type fetched"));
  }
);

export const createFeeType = asyncHandler(
  async (_req: Request, res: Response) => {
    res.status(201).json(sendSuccess(null, "Fee type created"));
  }
);

export const updateFeeType = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json(sendSuccess(null, "Fee type updated"));
  }
);

export const deleteFeeType = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json(sendSuccess(null, "Fee type deleted"));
  }
);
