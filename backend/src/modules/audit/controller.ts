import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendPaginatedSuccess } from "@/utils/apiResponse";
import * as auditService from "@/services/auditService";
import { AuditLogQueryInput } from "./schemas";

export const getAuditLogs = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as AuditLogQueryInput;
    const result = await auditService.getAuditLogs(query);
    res.json(
      sendPaginatedSuccess(
        result.logs,
        {
          page: result.page,
          limit: result.limit,
          total: result.total,
        },
        "Audit logs fetched"
      )
    );
  }
);
