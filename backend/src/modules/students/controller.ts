import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess, sendPaginatedSuccess } from "@/utils/apiResponse";
import * as studentService from "./service";
import {
  CreateStudentInput,
  UpdateStudentInput,
  StudentQueryInput,
  StudentParamsInput,
} from "./schemas";

export const createStudent = asyncHandler(
  async (req: Request, res: Response) => {
    const data = req.body as CreateStudentInput;
    const actor = req.user ? { actorId: req.user.id, actorName: req.user.name, ipAddress: req.ip } : undefined;
    const student = await studentService.createStudent(data, actor);
    res.status(201).json(sendSuccess(student, "Student created"));
  }
);

export const getStudents = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as StudentQueryInput;
    const result = await studentService.getStudents(query);
    res.json(
      sendPaginatedSuccess(
        result.students,
        {
          page: result.page,
          limit: result.limit,
          total: result.total,
        },
        "Students fetched"
      )
    );
  }
);

export const getStudentById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as StudentParamsInput;
    const student = await studentService.getStudentById(id);
    res.json(sendSuccess(student, "Student fetched"));
  }
);

export const updateStudent = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as StudentParamsInput;
    const data = req.body as UpdateStudentInput;
    const actor = req.user ? { actorId: req.user.id, actorName: req.user.name, ipAddress: req.ip } : undefined;
    const student = await studentService.updateStudent(id, data, actor);
    res.json(sendSuccess(student, "Student updated"));
  }
);

export const deleteStudent = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as StudentParamsInput;
    const { reason } = req.body as { reason?: string };
    const actor = req.user ? { actorId: req.user.id, actorName: req.user.name, ipAddress: req.ip } : undefined;
    await studentService.deleteStudent(id, actor, reason);
    res.json(sendSuccess(null, "Student deleted"));
  }
);
