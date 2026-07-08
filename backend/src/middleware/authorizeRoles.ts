import { Request, Response, NextFunction } from "express";
import { AppError } from "@/lib/errors";

export function authorizeRoles(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, "Not authenticated", "UNAUTHORIZED"));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(
        new AppError(
          403,
          `Role '${req.user.role}' is not authorized to access this resource`,
          "FORBIDDEN"
        )
      );
      return;
    }

    next();
  };
}
