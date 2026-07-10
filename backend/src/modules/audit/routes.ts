import { Router } from "express";
import { validate } from "@/middleware/validate";
import { AuditLogQuerySchema } from "./schemas";
import { getAuditLogs } from "./controller";

const router = Router();

router.get(
  "/",
  validate(AuditLogQuerySchema, "query"),
  getAuditLogs
);

export { router as auditModuleRoutes };
