import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { healthRoutes } from "@/routes/health.routes";
import { studentModuleRoutes } from "@/modules/students/routes";
import { feeTypeModuleRoutes } from "@/modules/feeTypes/routes";
import { feeStructureModuleRoutes } from "@/modules/feeStructures/routes";
import { ledgerModuleRoutes } from "@/modules/ledgers/routes";
import { transactionModuleRoutes } from "@/modules/transactions/routes";
import { dashboardRoutes } from "@/modules/dashboard/routes";
import { handleUPIWebhook } from "@/controllers/webhookController";
import { errorHandler } from "@/middleware/errorHandler";

const app = express();

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));

app.use("/api/v1", healthRoutes);
app.use("/api/v1/students", studentModuleRoutes);
app.use("/api/v1/fee-types", feeTypeModuleRoutes);
app.use("/api/v1/fee-structures", feeStructureModuleRoutes);
app.use("/api/v1/ledgers", ledgerModuleRoutes);
app.use("/api/v1/transactions", transactionModuleRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);

app.post("/api/v1/webhooks/upi", handleUPIWebhook);

app.use(errorHandler);

export { app };
