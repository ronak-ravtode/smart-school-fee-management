import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { AppError } from "@/lib/errors";
import { sendError } from "@/utils/apiResponse";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({ field: e.path.join("."), message: e.message }));
    res.status(400).json(sendError("VALIDATION_ERROR", "Request validation failed", details));
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json(sendError(err.code, err.message, err.details));
    return;
  }

  if (err instanceof JsonWebTokenError) {
    res.status(401).json(sendError("UNAUTHORIZED", "Invalid token. Please log in again."));
    return;
  }

  if (err instanceof TokenExpiredError) {
    res.status(401).json(sendError("UNAUTHORIZED", "Token expired. Please log in again."));
    return;
  }

  const isDev = process.env.NODE_ENV === "development";
  res.status(500).json(
    sendError("INTERNAL_ERROR", isDev ? err.message : "An unexpected error occurred", isDev ? { stack: err.stack } : undefined)
  );
}
