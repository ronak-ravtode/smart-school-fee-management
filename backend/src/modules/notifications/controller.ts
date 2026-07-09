import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/apiResponse";
import * as notificationService from "./service";
import { SendReminderInput } from "./service";

export const sendReminder = asyncHandler(
  async (req: Request, res: Response) => {
    const { studentId, type, message } = req.body as {
      studentId: string;
      type: "STANDARD" | "URGENT";
      message?: string;
    };
    const actor = req.user
      ? {
          actorId: req.user.id,
          actorName: req.user.name,
          ipAddress: req.ip,
        }
      : undefined;

    const result = await notificationService.sendReminder({
      studentId,
      type: type ?? "STANDARD",
      message,
      actor,
    });

    res.json(sendSuccess(result, "Reminder logged successfully"));
  }
);
