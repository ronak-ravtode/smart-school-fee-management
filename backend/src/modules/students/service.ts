import mongoose from "mongoose";
import { Student } from "@/models";
import { NotFoundError, ConflictError } from "@/lib/errors";
import { createAuditLog, ActorInfo } from "@/services/auditService";
import { CreateStudentInput, UpdateStudentInput, StudentQueryInput } from "./schemas";

export async function createStudent(data: CreateStudentInput, actor?: ActorInfo) {
  const existingEmail = await Student.findOne({ email: data.email, isDeleted: false });
  if (existingEmail) throw new ConflictError("A student with this email already exists");

  const existingRoll = await Student.findOne({
    rollNumber: data.rollNumber, class: data.class, section: data.section, isDeleted: false,
  });
  if (existingRoll) throw new ConflictError(`A student with roll number '${data.rollNumber}' already exists in class ${data.class} section ${data.section}`);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const [student] = await Student.create([data], { session });

    await createAuditLog({
      actorId: actor?.actorId ?? "system",
      actorName: actor?.actorName ?? "System",
      action: "CREATED",
      entityType: "Student",
      entityId: student._id.toString(),
      newValue: { name: student.name, email: student.email, class: student.class, section: student.section, rollNumber: student.rollNumber },
      ipAddress: actor?.ipAddress,
    }, session);

    await session.commitTransaction();
    return student;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function getStudents(query: StudentQueryInput) {
  const { page, limit, class: studentClass, section, search } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, any> = { isDeleted: false };
  if (studentClass) filter.class = studentClass;
  if (section) filter.section = section;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { rollNumber: { $regex: search, $options: "i" } },
    ];
  }

  const [students, total] = await Promise.all([
    Student.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Student.countDocuments(filter),
  ]);

  return { students, total, page, limit };
}

export async function getStudentById(id: string) {
  const student = await Student.findOne({ _id: id, isDeleted: false });
  if (!student) throw new NotFoundError("Student", id);
  return student;
}

export async function updateStudent(id: string, data: UpdateStudentInput, actor?: ActorInfo) {
  const existing = await getStudentById(id);

  if (data.email) {
    const dup = await Student.findOne({ email: data.email, _id: { $ne: id }, isDeleted: false });
    if (dup) throw new ConflictError("A student with this email already exists");
  }

  if (data.rollNumber || data.class || data.section) {
    const targetClass = data.class ?? existing.class;
    const targetSection = data.section ?? existing.section;
    const targetRoll = data.rollNumber ?? existing.rollNumber;
    const dup = await Student.findOne({ rollNumber: targetRoll, class: targetClass, section: targetSection, _id: { $ne: id }, isDeleted: false });
    if (dup) throw new ConflictError(`A student with roll number '${targetRoll}' already exists in class ${targetClass} section ${targetSection}`);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const updated = await Student.findByIdAndUpdate(id, data, { new: true, session });

    await createAuditLog({
      actorId: actor?.actorId ?? "system",
      actorName: actor?.actorName ?? "System",
      action: "UPDATED",
      entityType: "Student",
      entityId: id,
      previousValue: { name: existing.name, email: existing.email, class: existing.class, section: existing.section, rollNumber: existing.rollNumber },
      newValue: { name: updated!.name, email: updated!.email, class: updated!.class, section: updated!.section, rollNumber: updated!.rollNumber },
      ipAddress: actor?.ipAddress,
    }, session);

    await session.commitTransaction();
    return updated;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function deleteStudent(id: string, actor?: ActorInfo, reason?: string) {
  const existing = await getStudentById(id);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await Student.findByIdAndUpdate(id, { isDeleted: true, deletedAt: new Date() }, { session });

    await createAuditLog({
      actorId: actor?.actorId ?? "system",
      actorName: actor?.actorName ?? "System",
      action: "DELETED",
      entityType: "Student",
      entityId: id,
      previousValue: { name: existing.name, email: existing.email, class: existing.class, section: existing.section, rollNumber: existing.rollNumber },
      reason,
      ipAddress: actor?.ipAddress,
    }, session);

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
