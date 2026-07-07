import { Router } from "express";
import {
  getFeeStructures,
  getFeeStructureById,
  createFeeStructure,
  updateFeeStructure,
  deleteFeeStructure,
} from "@/controllers/feeStructure.controller";

const router = Router();

router.get("/", getFeeStructures);
router.get("/:id", getFeeStructureById);
router.post("/", createFeeStructure);
router.put("/:id", updateFeeStructure);
router.delete("/:id", deleteFeeStructure);

export { router as feeStructureRoutes };
