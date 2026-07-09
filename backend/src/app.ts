import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { healthRoutes } from "@/routes/health.routes";
import { authModuleRoutes } from "@/modules/auth/routes";
import { studentModuleRoutes } from "@/modules/students/routes";
import { feeTypeModuleRoutes } from "@/modules/feeTypes/routes";
import { feeStructureModuleRoutes } from "@/modules/feeStructures/routes";
import { ledgerModuleRoutes } from "@/modules/ledgers/routes";
import { transactionModuleRoutes } from "@/modules/transactions/routes";
import { dashboardRoutes } from "@/modules/dashboard/routes";
import { receiptModuleRoutes } from "@/modules/receipts/routes";
import { auditModuleRoutes } from "@/modules/audit/routes";
import { notificationModuleRoutes } from "@/modules/notifications/routes";
import { handleUPIWebhook } from "@/controllers/webhookController";
import { protectRoute } from "@/middleware/protectRoute";
import { authorizeRoles } from "@/middleware/authorizeRoles";
import { errorHandler } from "@/middleware/errorHandler";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173", credentials: true }));
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// ── Public Routes ─────────────────────────────────────────────────────────────
app.use("/api/v1", healthRoutes);
app.use("/api/v1/auth", authModuleRoutes);

// ── Protected Routes ──────────────────────────────────────────────────────────
app.use("/api/v1/students", protectRoute, studentModuleRoutes);
app.use("/api/v1/dashboard", protectRoute, dashboardRoutes);
app.use("/api/v1/transactions", protectRoute, transactionModuleRoutes);
app.use("/api/v1/receipts", protectRoute, receiptModuleRoutes);

// ── Admin-Only Routes ─────────────────────────────────────────────────────────
app.use("/api/v1/fee-types", protectRoute, authorizeRoles("ADMIN"), feeTypeModuleRoutes);
app.use("/api/v1/fee-structures", protectRoute, authorizeRoles("ADMIN"), feeStructureModuleRoutes);
app.use("/api/v1/ledgers", protectRoute, authorizeRoles("ADMIN"), ledgerModuleRoutes);
app.use("/api/v1/audit-logs", protectRoute, authorizeRoles("ADMIN"), auditModuleRoutes);
app.use("/api/v1/notifications", protectRoute, notificationModuleRoutes);

// ── Webhooks (no auth) ────────────────────────────────────────────────────────
app.post("/api/v1/webhooks/upi", handleUPIWebhook);

app.use(errorHandler);

export { app };
