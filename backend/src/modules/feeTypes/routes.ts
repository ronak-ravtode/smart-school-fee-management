import { Router } from "express";
import { validate } from "@/middleware/validate";
import {
  CreateFeeTypeSchema,
  UpdateFeeTypeSchema,
  FeeTypeQuerySchema,
  FeeTypeParamsSchema,
} from "./schemas";
import {
  createFeeType,
  getFeeTypes,
  getFeeTypeById,
  updateFeeType,
  deleteFeeType,
} from "./controller";

const router = Router();

router.get(
  "/",
  validate(FeeTypeQuerySchema, "query"),
  getFeeTypes
);

router.get(
  "/:id",
  validate(FeeTypeParamsSchema, "params"),
  getFeeTypeById
);

router.post(
  "/",
  validate(CreateFeeTypeSchema, "body"),
  createFeeType
);

router.put(
  "/:id",
  validate(FeeTypeParamsSchema, "params"),
  validate(UpdateFeeTypeSchema, "body"),
  updateFeeType
);

router.delete(
  "/:id",
  validate(FeeTypeParamsSchema, "params"),
  deleteFeeType
);

export { router as feeTypeModuleRoutes };
