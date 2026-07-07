import { Router } from "express";
import {
  getLedgers,
  getLedgerById,
  getLedgersByStudent,
} from "@/controllers/ledger.controller";

const router = Router();

router.get("/", getLedgers);
router.get("/:id", getLedgerById);
router.get("/student/:studentId", getLedgersByStudent);

export { router as ledgerRoutes };
