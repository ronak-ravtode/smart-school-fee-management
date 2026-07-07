import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { healthRoutes } from "@/routes/health.routes";
import { studentRoutes } from "@/routes/student.routes";
import { feeTypeRoutes } from "@/routes/feeType.routes";
import { feeStructureRoutes } from "@/routes/feeStructure.routes";
import { ledgerRoutes } from "@/routes/ledger.routes";
import { transactionRoutes } from "@/routes/transaction.routes";
import { errorHandler } from "@/middleware/errorHandler";

const app = express();

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

app.use("/api/v1", healthRoutes);
app.use("/api/v1/students", studentRoutes);
app.use("/api/v1/fee-types", feeTypeRoutes);
app.use("/api/v1/fee-structures", feeStructureRoutes);
app.use("/api/v1/ledgers", ledgerRoutes);
app.use("/api/v1/transactions", transactionRoutes);

app.use(errorHandler);

export { app };
