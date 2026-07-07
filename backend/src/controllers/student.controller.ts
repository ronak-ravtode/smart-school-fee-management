import { Request, Response } from "express";
import { sendSuccess } from "@/utils/apiResponse";
import { asyncHandler } from "@/utils/asyncHandler";

export const getStudents = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json(sendSuccess([], "Students fetched"));
  }
);

export const getStudentById = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json(sendSuccess(null, "Student fetched"));
  }
);

export const createStudent = asyncHandler(
  async (_req: Request, res: Response) => {
    res.status(201).json(sendSuccess(null, "Student created"));
  }
);

export const updateStudent = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json(sendSuccess(null, "Student updated"));
  }
);

export const deleteStudent = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json(sendSuccess(null, "Student deleted"));
  }
);
