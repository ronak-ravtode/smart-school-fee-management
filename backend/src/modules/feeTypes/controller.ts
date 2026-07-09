import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess, sendPaginatedSuccess } from "@/utils/apiResponse";
import * as feeTypeService from "./service";
import {
  CreateFeeTypeInput,
  UpdateFeeTypeInput,
  FeeTypeQueryInput,
  FeeTypeParamsInput,
} from "./schemas";

export const createFeeType = asyncHandler(
  async (req: Request, res: Response) => {
    const data = req.body as CreateFeeTypeInput;
    const actor = req.user ? { actorId: req.user.id, actorName: req.user.name, ipAddress: req.ip } : undefined;
    const feeType = await feeTypeService.createFeeType(data, actor);
    res.status(201).json(sendSuccess(feeType, "Fee type created"));
  }
);

export const getFeeTypes = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as FeeTypeQueryInput;
    const result = await feeTypeService.getFeeTypes(query);
    res.json(
      sendPaginatedSuccess(
        result.feeTypes,
        {
          page: result.page,
          limit: result.limit,
          total: result.total,
        },
        "Fee types fetched"
      )
    );
  }
);

export const getFeeTypeById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as FeeTypeParamsInput;
    const feeType = await feeTypeService.getFeeTypeById(id);
    res.json(sendSuccess(feeType, "Fee type fetched"));
  }
);

export const updateFeeType = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as FeeTypeParamsInput;
    const data = req.body as UpdateFeeTypeInput;
    const actor = req.user ? { actorId: req.user.id, actorName: req.user.name, ipAddress: req.ip } : undefined;
    const feeType = await feeTypeService.updateFeeType(id, data, actor);
    res.json(sendSuccess(feeType, "Fee type updated"));
  }
);

export const deleteFeeType = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as FeeTypeParamsInput;
    const { reason } = req.body as { reason?: string };
    const actor = req.user ? { actorId: req.user.id, actorName: req.user.name, ipAddress: req.ip } : undefined;
    await feeTypeService.deleteFeeType(id, actor, reason);
    res.json(sendSuccess(null, "Fee type deleted"));
  }
);
