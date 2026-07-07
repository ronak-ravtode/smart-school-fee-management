import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { sendError } from "@/utils/apiResponse";

const PRISMA_ERROR_MAP: Record<string, { statusCode: number; code: string }> = {
  P2002: { statusCode: 409, code: "CONFLICT" },
  P2025: { statusCode: 404, code: "NOT_FOUND" },
  P2003: { statusCode: 400, code: "FOREIGN_KEY_VIOLATION" },
  P2014: { statusCode: 400, code: "REQUIRED_RELATION_VIOLATION" },
};

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    res
      .status(400)
      .json(sendError("VALIDATION_ERROR", "Request validation failed", details));
    return;
  }

  // AppError (custom domain errors)
  if (err instanceof AppError) {
    res
      .status(err.statusCode)
      .json(sendError(err.code, err.message, err.details));
    return;
  }

  // Prisma known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = PRISMA_ERROR_MAP[err.code];
    if (mapped) {
      const message =
        err.code === "P2002"
          ? `Unique constraint violation on: ${String((err.meta?.target as string[]) ?? "unknown field")}`
          : `Database error: ${err.code}`;
      res
        .status(mapped.statusCode)
        .json(sendError(mapped.code, message));
      return;
    }
  }

  // Unknown error — do not leak stack traces in production
  const isDev = process.env.NODE_ENV === "development";
  res.status(500).json(
    sendError(
      "INTERNAL_ERROR",
      isDev ? err.message : "An unexpected error occurred",
      isDev ? { stack: err.stack } : undefined
    )
  );
}
