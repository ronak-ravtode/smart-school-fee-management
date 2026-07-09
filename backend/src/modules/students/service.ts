import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ConflictError } from "@/lib/errors";
import { createAuditLog, ActorInfo } from "@/services/auditService";
import {
  CreateStudentInput,
  UpdateStudentInput,
  StudentQueryInput,
} from "./schemas";

const SOFT_DELETE_WHERE = { isDeleted: false } as const;

export async function createStudent(data: CreateStudentInput, actor?: ActorInfo) {
  const existingEmail = await prisma.student.findFirst({
    where: { email: data.email, ...SOFT_DELETE_WHERE },
  });
  if (existingEmail) {
    throw new ConflictError("A student with this email already exists");
  }

  const existingRoll = await prisma.student.findFirst({
    where: {
      rollNumber: data.rollNumber,
      class: data.class,
      section: data.section,
      ...SOFT_DELETE_WHERE,
    },
  });
  if (existingRoll) {
    throw new ConflictError(
      `A student with roll number '${data.rollNumber}' already exists in class ${data.class} section ${data.section}`
    );
  }

  return prisma.$transaction(async (tx) => {
    const student = await tx.student.create({ data });

    await createAuditLog({
      actorId: actor?.actorId ?? "system",
      actorName: actor?.actorName ?? "System",
      action: "CREATED",
      entityType: "Student",
      entityId: student.id,
      newValue: {
        name: student.name,
        email: student.email,
        class: student.class,
        section: student.section,
        rollNumber: student.rollNumber,
      },
      ipAddress: actor?.ipAddress,
    }, tx);

    return student;
  });
}

export async function getStudents(query: StudentQueryInput) {
  const { page, limit, class: studentClass, section, search } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.StudentWhereInput = { ...SOFT_DELETE_WHERE };

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
  const student = await prisma.student.findFirst({ where: { id, ...SOFT_DELETE_WHERE } });
  if (!student) {
    throw new NotFoundError("Student", id);
  }
  return student;
}

export async function updateStudent(id: string, data: UpdateStudentInput, actor?: ActorInfo) {
  const existing = await getStudentById(id);

  if (data.email) {
    const duplicateEmail = await prisma.student.findFirst({
      where: { email: data.email, NOT: { id }, ...SOFT_DELETE_WHERE },
    });
    if (duplicateEmail) {
      throw new ConflictError("A student with this email already exists");
    }
  }

  if (data.rollNumber || data.class || data.section) {
    const targetClass = data.class ?? existing.class;
    const targetSection = data.section ?? existing.section;
    const targetRoll = data.rollNumber ?? existing.rollNumber;

    const duplicateRoll = await prisma.student.findFirst({
      where: {
        rollNumber: targetRoll,
        class: targetClass,
        section: targetSection,
        NOT: { id },
        ...SOFT_DELETE_WHERE,
      },
    });
    if (duplicateRoll) {
      throw new ConflictError(
        `A student with roll number '${targetRoll}' already exists in class ${targetClass} section ${targetSection}`
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.student.update({ where: { id }, data });

    await createAuditLog({
      actorId: actor?.actorId ?? "system",
      actorName: actor?.actorName ?? "System",
      action: "UPDATED",
      entityType: "Student",
      entityId: id,
      previousValue: {
        name: existing.name,
        email: existing.email,
        class: existing.class,
        section: existing.section,
        rollNumber: existing.rollNumber,
      },
      newValue: {
        name: updated.name,
        email: updated.email,
        class: updated.class,
        section: updated.section,
        rollNumber: updated.rollNumber,
      },
      ipAddress: actor?.ipAddress,
    }, tx);

    return updated;
  });
}

export async function deleteStudent(id: string, actor?: ActorInfo, reason?: string) {
  const existing = await getStudentById(id);

  return prisma.$transaction(async (tx) => {
    // Edge Case 1: Soft delete — UPDATE instead of DELETE
    await tx.student.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    await createAuditLog({
      actorId: actor?.actorId ?? "system",
      actorName: actor?.actorName ?? "System",
      action: "DELETED",
      entityType: "Student",
      entityId: id,
      previousValue: {
        name: existing.name,
        email: existing.email,
        class: existing.class,
        section: existing.section,
        rollNumber: existing.rollNumber,
      },
      reason,
      ipAddress: actor?.ipAddress,
    }, tx);
  });
}
