import { Prisma, AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ─── Edge Case 3: Infinite Audit Loop Prevention ─────────────────────────────
// createAuditLog() calls prisma.auditLog.create() DIRECTLY — never routed through
// any generic onUpdate/onDelete interceptor or Prisma middleware. The AuditLog model
// is excluded from any hooks by design. This prevents infinite recursion.

export interface ActorInfo {
  actorId: string;
  actorName: string;
  ipAddress?: string;
}

export interface AuditLogParams {
  actorId: string;
  actorName: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
  ipAddress?: string;
}

// ─── Edge Case 2: PII Sanitization ───────────────────────────────────────────
// Strip or mask sensitive fields before writing to audit log.
// Only financial fields (amounts, statuses, dates) are preserved.

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

  // Phone numbers: show first 5, mask rest
  if (lower.includes("phone") || lower.includes("mobile")) {
    const str = String(value);
    if (str.length <= 5) return "XXXXX";
    return str.slice(0, 5) + "XXXXX";
  }

  // Email: show first char + domain
  if (lower === "email") {
    const str = String(value);
    const atIdx = str.indexOf("@");
    if (atIdx <= 0) return "***@***";
    return str[0] + "***" + str.slice(atIdx);
  }

  // Aadhaar: show last 4
  if (lower.includes("aadhaar")) {
    const str = String(value).replace(/\s/g, "");
    if (str.length <= 4) return "XXXX XXXX XXXX";
    return "XXXX XXXX " + str.slice(-4);
  }

  // Bank account: show last 4
  if (lower.includes("account") || lower.includes("bank") || lower === "ifsc" || lower.includes("ifsc")) {
    const str = String(value);
    if (str.length <= 4) return "XXXX";
    return "XXXX" + str.slice(-4);
  }

  // Passwords: fully redact
  if (lower.includes("password")) return "[REDACTED]";

  // Addresses: redact
  if (["address", "street", "city", "pincode", "zipcode"].includes(lower)) return "[REDACTED]";

  return value;
}

function sanitizeAuditData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_FIELDS.has(key) || SENSITIVE_FIELDS.has(key.toLowerCase())) {
      sanitized[key] = maskValue(key, value);
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      // Recurse into nested objects (e.g. rules)
      sanitized[key] = sanitizeAuditData(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Append-only audit log. NEVER fails silently.
 * If this write fails, the parent $transaction MUST rollback.
 *
 * All previousValue/newValue are sanitized to strip PII before storage.
 */
export async function createAuditLog(
  params: AuditLogParams,
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? prisma;

  const sanitizedPrevious = params.previousValue
    ? sanitizeAuditData(params.previousValue)
    : undefined;
  const sanitizedNew = params.newValue
    ? sanitizeAuditData(params.newValue)
    : undefined;

  // Direct prisma.auditLog.create() — no middleware, no hooks, no infinite loop
  return client.auditLog.create({
    data: {
      actorId: params.actorId,
      actorName: params.actorName,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      previousValue: sanitizedPrevious as unknown as Prisma.InputJsonValue | undefined,
      newValue: sanitizedNew as unknown as Prisma.InputJsonValue | undefined,
      reason: params.reason,
      ipAddress: params.ipAddress,
    },
  });
}

export interface AuditLogQueryParams {
  page: number;
  limit: number;
  action?: AuditAction;
  entityType?: string;
  actorName?: string;
  entityId?: string;
  fromDate?: string;
  toDate?: string;
}

export async function getAuditLogs(query: AuditLogQueryParams) {
  const { page, limit, action, entityType, actorName, entityId, fromDate, toDate } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.AuditLogWhereInput = {};

  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (actorName) where.actorName = { contains: actorName, mode: "insensitive" };
  if (fromDate || toDate) {
    where.timestamp = {};
    if (fromDate) where.timestamp.gte = new Date(fromDate);
    if (toDate) where.timestamp.lte = new Date(toDate + "T23:59:59.999Z");
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { timestamp: "desc" },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total, page, limit };
}
