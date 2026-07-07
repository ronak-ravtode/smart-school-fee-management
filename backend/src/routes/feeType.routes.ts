import { Router } from "express";
import {
  getFeeTypes,
  getFeeTypeById,
  createFeeType,
  updateFeeType,
  deleteFeeType,
} from "@/controllers/feeType.controller";

const router = Router();

router.get("/", getFeeTypes);
router.get("/:id", getFeeTypeById);
router.post("/", createFeeType);
router.put("/:id", updateFeeType);
router.delete("/:id", deleteFeeType);

export { router as feeTypeRoutes };
