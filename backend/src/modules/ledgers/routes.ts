import { Router } from "express";
import { validate } from "@/middleware/validate";
import {
  GenerateLedgerSchema,
  StudentLedgerParamsSchema,
} from "./schemas";
import {
  generateLedgers,
  getStudentLedgers,
  getDefaulters,
} from "./controller";

const router = Router();

router.post(
  "/generate",
  validate(GenerateLedgerSchema, "body"),
  generateLedgers
);

router.get("/defaults", getDefaulters);

router.get(
  "/student/:studentId",
  validate(StudentLedgerParamsSchema, "params"),
  getStudentLedgers
);

export { router as ledgerModuleRoutes };
