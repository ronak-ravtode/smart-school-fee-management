import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ConflictError } from "@/lib/errors";
import {
  CreateStudentInput,
  UpdateStudentInput,
  StudentQueryInput,
} from "./schemas";

export async function createStudent(data: CreateStudentInput) {
  const existingEmail = await prisma.student.findUnique({
    where: { email: data.email },
  });
  if (existingEmail) {
    throw new ConflictError("A student with this email already exists");
  }

  const existingRoll = await prisma.student.findUnique({
    where: { rollNumber: data.rollNumber },
  });
  if (existingRoll) {
    throw new ConflictError("A student with this roll number already exists");
  }

  return prisma.student.create({ data });
}

export async function getStudents(query: StudentQueryInput) {
  const { page, limit, class: studentClass, section, search } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.StudentWhereInput = {};

  if (studentClass) {
    where.class = studentClass;
  }
  if (section) {
    where.section = section;
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { rollNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.student.count({ where }),
  ]);

  return { students, total, page, limit };
}

export async function getStudentById(id: string) {
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) {
    throw new NotFoundError("Student", id);
  }
  return student;
}

export async function updateStudent(id: string, data: UpdateStudentInput) {
  await getStudentById(id);

  if (data.email) {
    const existing = await prisma.student.findFirst({
      where: { email: data.email, NOT: { id } },
    });
    if (existing) {
      throw new ConflictError("A student with this email already exists");
    }
  }

  if (data.rollNumber) {
    const existing = await prisma.student.findFirst({
      where: { rollNumber: data.rollNumber, NOT: { id } },
    });
    if (existing) {
      throw new ConflictError(
        "A student with this roll number already exists"
      );
    }
  }

  return prisma.student.update({ where: { id }, data });
}

export async function deleteStudent(id: string) {
  await getStudentById(id);
  return prisma.student.delete({ where: { id } });
}
