import { Request, Response } from "express";
import { sendSuccess } from "@/utils/apiResponse";
import { asyncHandler } from "@/utils/asyncHandler";

export const healthController = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json(
      sendSuccess(
        { status: "OK", timestamp: new Date().toISOString() },
        "Server is running"
      )
    );
  }
);
