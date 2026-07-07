import { Router } from "express";
import { validate } from "@/middleware/validate";
import {
  CreateStudentSchema,
  UpdateStudentSchema,
  StudentQuerySchema,
  StudentParamsSchema,
} from "./schemas";
import {
  createStudent,
  getStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
} from "./controller";

const router = Router();

router.get(
  "/",
  validate(StudentQuerySchema, "query"),
  getStudents
);

router.get(
  "/:id",
  validate(StudentParamsSchema, "params"),
  getStudentById
);

router.post(
  "/",
  validate(CreateStudentSchema, "body"),
  createStudent
);

router.put(
  "/:id",
  validate(StudentParamsSchema, "params"),
  validate(UpdateStudentSchema, "body"),
  updateStudent
);

router.delete(
  "/:id",
  validate(StudentParamsSchema, "params"),
  deleteStudent
);

export { router as studentModuleRoutes };
