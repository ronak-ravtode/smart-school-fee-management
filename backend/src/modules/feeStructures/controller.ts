import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess, sendPaginatedSuccess } from "@/utils/apiResponse";
import * as feeStructureService from "./service";
import {
  CreateFeeStructureInput,
  FeeStructureQueryInput,
  FeeStructureParamsInput,
  FeeStructureByClassParamsInput,
} from "./schemas";

export const createFeeStructure = asyncHandler(
  async (req: Request, res: Response) => {
    const data = req.body as CreateFeeStructureInput;
    const actor = req.user ? { actorId: req.user.id, actorName: req.user.name, ipAddress: req.ip } : undefined;
    const feeStructure = await feeStructureService.createFeeStructure(data, actor);
    res.status(201).json(sendSuccess(feeStructure, "Fee structure created"));
  }
);

export const getFeeStructures = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as FeeStructureQueryInput;
    const result = await feeStructureService.getFeeStructures(query);
    res.json(
      sendPaginatedSuccess(
        result.feeStructures,
        {
          page: result.page,
          limit: result.limit,
          total: result.total,
        },
        "Fee structures fetched"
      )
    );
  }
);

export const getFeeStructureById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as FeeStructureParamsInput;
    const feeStructure = await feeStructureService.getFeeStructureById(id);
    res.json(sendSuccess(feeStructure, "Fee structure fetched"));
  }
);

export const getFeeStructuresByClass = asyncHandler(
  async (req: Request, res: Response) => {
    const { class: studentClass, section } =
      req.params as FeeStructureByClassParamsInput;
    const feeStructures = await feeStructureService.getFeeStructuresByClass(
      studentClass,
      section
    );
    res.json(sendSuccess(feeStructures, "Fee structures fetched"));
  }
);

export const deleteFeeStructure = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as FeeStructureParamsInput;
    const { reason } = req.body as { reason?: string };
    const actor = req.user ? { actorId: req.user.id, actorName: req.user.name, ipAddress: req.ip } : undefined;
    await feeStructureService.deleteFeeStructure(id, actor, reason);
    res.json(sendSuccess(null, "Fee structure deleted"));
  }
);
