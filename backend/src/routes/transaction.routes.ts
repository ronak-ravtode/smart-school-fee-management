import { Router } from "express";
import {
  getTransactions,
  getTransactionById,
  createTransaction,
} from "@/controllers/transaction.controller";

const router = Router();

router.get("/", getTransactions);
router.get("/:id", getTransactionById);
router.post("/", createTransaction);

export { router as transactionRoutes };
