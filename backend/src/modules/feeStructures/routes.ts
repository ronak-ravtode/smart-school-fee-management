import { Router } from "express";
import { validate } from "@/middleware/validate";
import {
  CreateFeeStructureSchema,
  FeeStructureQuerySchema,
  FeeStructureParamsSchema,
  FeeStructureByClassParamsSchema,
  DeleteFeeStructureSchema,
} from "./schemas";
import {
  createFeeStructure,
  getFeeStructures,
  getFeeStructureById,
  getFeeStructuresByClass,
  deleteFeeStructure,
} from "./controller";

const router = Router();

router.get(
  "/",
  validate(FeeStructureQuerySchema, "query"),
  getFeeStructures
);

router.get(
  "/class/:class",
  validate(FeeStructureByClassParamsSchema, "params"),
  getFeeStructuresByClass
);

router.get(
  "/class/:class/:section",
  validate(FeeStructureByClassParamsSchema, "params"),
  getFeeStructuresByClass
);

router.get(
  "/:id",
  validate(FeeStructureParamsSchema, "params"),
  getFeeStructureById
);

router.post(
  "/",
  validate(CreateFeeStructureSchema, "body"),
  createFeeStructure
);

router.delete(
  "/:id",
  validate(FeeStructureParamsSchema, "params"),
  validate(DeleteFeeStructureSchema, "body"),
  deleteFeeStructure
);

export { router as feeStructureModuleRoutes };
