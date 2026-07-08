import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { verifyToken, AuthUser } from "@/modules/auth/service";
import { ValidationError } from "@/lib/errors";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const protectRoute = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.jwt;

    if (!token) {
      throw new ValidationError("Not authenticated. Please log in.");
    }

    try {
      const decoded = verifyToken(token);
      req.user = decoded;
      next();
    } catch {
      throw new ValidationError("Invalid or expired token. Please log in again.");
    }
  }
);
