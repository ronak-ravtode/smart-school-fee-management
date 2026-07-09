import { z } from "zod";

export const SendReminderSchema = z.object({
  studentId: z.string().uuid("Invalid student ID"),
  type: z.enum(["STANDARD", "URGENT"]).default("STANDARD"),
  message: z.string().max(500).optional(),
});

export type SendReminderInput = z.infer<typeof SendReminderSchema>;
