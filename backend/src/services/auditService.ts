import { ClientSession } from "mongoose";
import { AuditLog } from "@/models";
import { AuditAction } from "@/types/enums";

export interface ActorInfo {
  actorId: string;
  actorName: string;
  ipAddress?: string;
}

export interface AuditLogParams {
  actorId: string;
  actorName: string;
  action: AuditAction | string;
  entityType: string;
  entityId: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
  ipAddress?: string;
}

const SENSITIVE_FIELDS = new Set([
  "phone", "parentPhone", "phoneNumber", "mobile",
  "email",
  "aadhaar", "aadhaarNumber",
  "bankAccount", "accountNumber", "ifsc", "ifscCode",
  "password", "passwordHash",
  "address", "street", "city", "pincode", "zipCode",
  "guardianPhone", "guardianEmail",
  "pan", "panNumber",
]);

function maskValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  const lower = key.toLowerCase();
  if (lower.includes("phone") || lower.includes("mobile")) {
    const str = String(value);
    if (str.length <= 5) return "XXXXX";
    return str.slice(0, 5) + "XXXXX";
  }
  if (lower === "email") {
    const str = String(value);
    const atIdx = str.indexOf("@");
    if (atIdx <= 0) return "***@***";
    return str[0] + "***" + str.slice(atIdx);
  }
  if (lower.includes("aadhaar")) {
    const str = String(value).replace(/\s/g, "");
    if (str.length <= 4) return "XXXX XXXX XXXX";
    return "XXXX XXXX " + str.slice(-4);
  }
  if (lower.includes("account") || lower.includes("bank") || lower === "ifsc" || lower.includes("ifsc")) {
    const str = String(value);
    if (str.length <= 4) return "XXXX";
    return "XXXX" + str.slice(-4);
  }
  if (lower.includes("password")) return "[REDACTED]";
  if (["address", "street", "city", "pincode", "zipcode"].includes(lower)) return "[REDACTED]";
  return value;
}

function sanitizeAuditData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_FIELDS.has(key) || SENSITIVE_FIELDS.has(key.toLowerCase())) {
      sanitized[key] = maskValue(key, value);
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeAuditData(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export async function createAuditLog(
  params: AuditLogParams,
  session?: ClientSession
) {
  const sanitizedPrevious = params.previousValue
    ? sanitizeAuditData(params.previousValue)
    : undefined;
  const sanitizedNew = params.newValue
    ? sanitizeAuditData(params.newValue)
    : undefined;

  const doc = new AuditLog({
    actorId: params.actorId,
    actorName: params.actorName,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    previousValue: sanitizedPrevious,
    newValue: sanitizedNew,
    reason: params.reason,
    ipAddress: params.ipAddress,
  });

  if (session) {
    await doc.save({ session });
  } else {
    await doc.save();
  }
  return doc;
}

export interface AuditLogQueryParams {
  page: number;
  limit: number;
  action?: string;
  entityType?: string;
  actorName?: string;
  entityId?: string;
  fromDate?: string;
  toDate?: string;
}

export async function getAuditLogs(query: AuditLogQueryParams) {
  const { page, limit, action, entityType, actorName, entityId, fromDate, toDate } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, any> = {};
  if (action) filter.action = action;
  if (entityType) filter.entityType = entityType;
  if (entityId) filter.entityId = entityId;
  if (actorName) filter.actorName = { $regex: actorName, $options: "i" };
  if (fromDate || toDate) {
    filter.timestamp = {};
    if (fromDate) filter.timestamp.$gte = new Date(fromDate);
    if (toDate) filter.timestamp.$lte = new Date(toDate + "T23:59:59.999Z");
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);

  return { logs, total, page, limit };
}
