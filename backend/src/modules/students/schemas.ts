import { z } from "zod";

export const CreateStudentSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email format"),
  class: z.string().min(1, "Class is required").max(20),
  section: z.string().min(1, "Section is required").max(10),
  rollNumber: z.string().min(1, "Roll number is required").max(30),
});

export const UpdateStudentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  class: z.string().min(1).max(20).optional(),
  section: z.string().min(1).max(10).optional(),
  rollNumber: z.string().min(1).max(30).optional(),
});

export const StudentQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  class: z.string().optional(),
  section: z.string().optional(),
  search: z.string().optional(),
});

export const StudentParamsSchema = z.object({
  id: z.string().uuid("Invalid student ID"),
});

export const DeleteStudentSchema = z.object({
  reason: z.string().min(10, "Reason is required and must be at least 10 characters"),
});

export type CreateStudentInput = z.infer<typeof CreateStudentSchema>;
export type UpdateStudentInput = z.infer<typeof UpdateStudentSchema>;
export type StudentQueryInput = z.infer<typeof StudentQuerySchema>;
export type StudentParamsInput = z.infer<typeof StudentParamsSchema>;
export type DeleteStudentInput = z.infer<typeof DeleteStudentSchema>;
