import { Router } from "express";
import { validate } from "@/middleware/validate";
import { SendReminderSchema } from "./schemas";
import { sendReminder } from "./controller";

const router = Router();

router.post("/reminder", validate(SendReminderSchema, "body"), sendReminder);

export { router as notificationModuleRoutes };
