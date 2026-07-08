import { Router } from "express";
import { validate } from "@/middleware/validate";
import { ReceiptParamsSchema } from "./schemas";
import { downloadReceipt } from "./controller";

const router = Router();

router.get(
  "/:transactionId/pdf",
  validate(ReceiptParamsSchema, "params"),
  downloadReceipt
);

export { router as receiptModuleRoutes };
