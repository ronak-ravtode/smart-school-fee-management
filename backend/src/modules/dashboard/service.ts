import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SOFT_DELETE_WHERE = { isDeleted: false } as const;

export interface DashboardMetrics {
  totalExpected: number;
  totalCollected: number;
  totalPending: number;
  totalOverdue: number;
  collectionPercentage: number;
}

export type RiskTier = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface DefaulterRecord {
  studentId: string;
  studentName: string;
  email: string;
  class: string;
  section: string;
  totalDue: number;
  totalPaid: number;
  remaining: number;
  status: "OVERDUE" | "PARTIAL";
  ledgerCount: number;
  ledgerId: string;
  daysOverdue: number;
  riskScore: number;
  riskTier: RiskTier;
  hasBouncedCheques: boolean;
  historicalDefaulterCount: number;
  studentStatus: "ACTIVE" | "TRANSFERRED" | "ALUMNI";
  oldestOverdueRemaining: number;
}

export interface RevenueByFeeType {
  feeTypeName: string;
  totalAmount: number;
  ledgerCount: number;
}

// ─── Risk Scoring Algorithm ──────────────────────────────────────────────────
// riskScore = daysOverdue * remaining
// Multiplier: 1.5x if student has bounced cheques or historical overdue records

function classifyRiskTier(score: number): RiskTier {
  if (score >= 50000) return "CRITICAL";
  if (score >= 10000) return "HIGH";
  if (score >= 1000) return "MEDIUM";
  return "LOW";
}

function daysBetween(date1: Date, date2: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((date2.getTime() - date1.getTime()) / msPerDay);
}

export async function getMetrics(): Promise<DashboardMetrics> {
  const result = await prisma.studentFeeLedger.aggregate({
    where: SOFT_DELETE_WHERE,
    _sum: {
      totalAmount: true,
      paidAmount: true,
      waivedAmount: true,
    },
    _count: {
      id: true,
    },
  });

  const overdueCount = await prisma.studentFeeLedger.count({
    where: { status: "OVERDUE", ...SOFT_DELETE_WHERE },
  });

  const totalExpected = Number(result._sum.totalAmount ?? 0);
  const totalCollected = Number(result._sum.paidAmount ?? 0);
  const totalWaived = Number(result._sum.waivedAmount ?? 0);
  const netExpected = totalExpected - totalWaived;
  const totalPending = netExpected - totalCollected;
  const totalOverdue = await prisma.studentFeeLedger.aggregate({
    where: { status: "OVERDUE", ...SOFT_DELETE_WHERE },
    _sum: {
      totalAmount: true,
      paidAmount: true,
      waivedAmount: true,
    },
  });

  const overdueAmount =
    Number(totalOverdue._sum.totalAmount ?? 0) -
    Number(totalOverdue._sum.paidAmount ?? 0) -
    Number(totalOverdue._sum.waivedAmount ?? 0);

  const collectionPercentage =
    netExpected > 0 ? Math.round((totalCollected / netExpected) * 100) : 0;

  return {
    totalExpected: netExpected,
    totalCollected,
    totalPending: Math.max(0, totalPending),
    totalOverdue: Math.max(0, overdueAmount),
    collectionPercentage,
  };
}

export async function getDefaults(
  page: number = 1,
  limit: number = 20
): Promise<{ data: DefaulterRecord[]; total: number; page: number; limit: number }> {
  const skip = (page - 1) * limit;

  const grouped = await prisma.studentFeeLedger.groupBy({
    by: ["studentId"],
    where: {
      status: { in: ["OVERDUE", "PARTIAL"] },
      ...SOFT_DELETE_WHERE,
      student: { status: "ACTIVE", isDeleted: false },
    },
    _sum: {
      totalAmount: true,
      paidAmount: true,
      waivedAmount: true,
    },
    _min: {
      dueDate: true,
    },
    _count: {
      id: true,
    },
    orderBy: {
      _sum: {
        totalAmount: "desc",
      },
    },
    skip,
    take: limit,
  });

  const totalCount = await prisma.studentFeeLedger.groupBy({
    by: ["studentId"],
    where: {
      status: { in: ["OVERDUE", "PARTIAL"] },
      ...SOFT_DELETE_WHERE,
      student: { status: "ACTIVE", isDeleted: false },
    },
  });

  const studentIds = grouped.map((g) => g.studentId);
  if (studentIds.length === 0) {
    return { data: [], total: totalCount.length, page, limit };
  }

  // Batch fetch students
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds }, ...SOFT_DELETE_WHERE },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  // Batch fetch primary ledger IDs (earliest overdue per student)
  const outstandingLedgers = await prisma.studentFeeLedger.findMany({
    where: {
      studentId: { in: studentIds },
      status: { in: ["OVERDUE", "PARTIAL"] },
      ...SOFT_DELETE_WHERE,
    },
    orderBy: { dueDate: "asc" },
    select: { id: true, studentId: true, totalAmount: true, paidAmount: true, waivedAmount: true, dueDate: true, feeIssuedDate: true },
  });
  const primaryLedgerMap = new Map<string, string>();
  // Track the oldest overdue ledger per student for risk scoring
  const oldestOverdueByStudent = new Map<string, { id: string; remaining: number; dueDate: Date; feeIssuedDate: Date | null }>();
  for (const ledger of outstandingLedgers) {
    if (!primaryLedgerMap.has(ledger.studentId)) {
      primaryLedgerMap.set(ledger.studentId, ledger.id);
    }
    if (!oldestOverdueByStudent.has(ledger.studentId)) {
      const rem = Number(ledger.totalAmount) - Number(ledger.paidAmount) - Number(ledger.waivedAmount);
      oldestOverdueByStudent.set(ledger.studentId, {
        id: ledger.id,
        remaining: Math.max(0, rem),
        dueDate: ledger.dueDate,
        feeIssuedDate: ledger.feeIssuedDate,
      });
    }
  }

  // ─── Risk Scoring: Batch queries for historical behavior ─────────────────
  const now = new Date();

  // Check for bounced cheques per student
  const bouncedTransactions = await prisma.transaction.groupBy({
    by: ["ledgerId"],
    where: {
      status: "BOUNCED",
      isDeleted: false,
      ledger: {
        studentId: { in: studentIds },
        isDeleted: false,
      },
    },
    _count: { id: true },
  });

  // Map ledgerId -> studentId for bounced cheques
  const ledgerIds = bouncedTransactions.map((bt) => bt.ledgerId);
  const bouncedLedgers = await prisma.studentFeeLedger.findMany({
    where: { id: { in: ledgerIds }, isDeleted: false },
    select: { id: true, studentId: true },
  });
  const ledgerToStudent = new Map(bouncedLedgers.map((l) => [l.id, l.studentId]));

  const bouncedChequeCountByStudent = new Map<string, number>();
  for (const bt of bouncedTransactions) {
    const sid = ledgerToStudent.get(bt.ledgerId);
    if (sid) {
      bouncedChequeCountByStudent.set(
        sid,
        (bouncedChequeCountByStudent.get(sid) ?? 0) + bt._count.id
      );
    }
  }

  // Check historical OVERDUE records (ledgers created before 3 months ago that were/are OVERDUE)
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const historicalOverdue = await prisma.studentFeeLedger.groupBy({
    by: ["studentId"],
    where: {
      studentId: { in: studentIds },
      status: "OVERDUE",
      createdAt: { lt: threeMonthsAgo },
      isDeleted: false,
    },
    _count: { id: true },
  });
  const historicalOverdueMap = new Map(
    historicalOverdue.map((h) => [h.studentId, h._count.id])
  );

  // ─── Compute risk scores ─────────────────────────────────────────────────
  const data: DefaulterRecord[] = grouped.map((g) => {
    const student = studentMap.get(g.studentId);
    const totalDue = Number(g._sum.totalAmount ?? 0);
    const totalPaid = Number(g._sum.paidAmount ?? 0);
    const totalWaived = Number(g._sum.waivedAmount ?? 0);
    const remaining = totalDue - totalPaid - totalWaived;

    // Edge Case 1: Risk scoring uses the OLDEST overdue invoice specifically
    // A partial payment on a newer invoice must NOT lower the risk tier
    const oldestOverdue = oldestOverdueByStudent.get(g.studentId);
    const oldestDueDate = oldestOverdue?.dueDate ?? g._min.dueDate;
    const oldestOverdueRemaining = oldestOverdue?.remaining ?? 0;

    // Edge Case 2: Days overdue starts from max(dueDate, feeIssuedDate)
    // A fee can't be overdue before it was issued/communicated to parent
    const effectiveStartDate = oldestOverdue?.feeIssuedDate
      ? (oldestOverdue.feeIssuedDate > (oldestDueDate ?? oldestOverdue.feeIssuedDate)
        ? oldestOverdue.feeIssuedDate
        : (oldestDueDate ?? oldestOverdue.feeIssuedDate))
      : oldestDueDate;
    const daysOverdue = effectiveStartDate
      ? Math.max(0, daysBetween(effectiveStartDate, now))
      : 0;

    // Historical behavior
    const hasBouncedCheques = (bouncedChequeCountByStudent.get(g.studentId) ?? 0) > 0;
    const historicalDefaulterCount = historicalOverdueMap.get(g.studentId) ?? 0;

    // Risk score: daysOverdue of oldest invoice × its remaining amount
    // This ensures partial payments on newer fees don't drop the risk tier
    let riskScore = daysOverdue * oldestOverdueRemaining;

    // Apply 1.5x multiplier for poor historical behavior
    if (hasBouncedCheques || historicalDefaulterCount > 0) {
      riskScore = Math.round(riskScore * 1.5);
    }

    const riskTier = classifyRiskTier(riskScore);

    return {
      studentId: g.studentId,
      studentName: student?.name ?? "Unknown",
      email: student?.email ?? "",
      class: student?.class ?? "",
      section: student?.section ?? "",
      totalDue,
      totalPaid,
      remaining,
      status: remaining >= totalDue ? "OVERDUE" : "PARTIAL",
      ledgerCount: g._count.id,
      ledgerId: primaryLedgerMap.get(g.studentId) ?? "",
      daysOverdue,
      riskScore,
      riskTier,
      hasBouncedCheques,
      historicalDefaulterCount,
      studentStatus: (student as any)?.status ?? "ACTIVE",
      oldestOverdueRemaining,
    };
  });

  // Sort by riskScore DESC
  data.sort((a, b) => b.riskScore - a.riskScore);

  return {
    data,
    total: totalCount.length,
    page,
    limit,
  };
}

// Edge Case 3: Recovery/Alumni Dues — students who left with outstanding balances
export async function getRecoveryDefaulters(): Promise<{
  data: DefaulterRecord[];
  total: number;
}> {
  const grouped = await prisma.studentFeeLedger.groupBy({
    by: ["studentId"],
    where: {
      status: { in: ["OVERDUE", "PARTIAL"] },
      ...SOFT_DELETE_WHERE,
      student: { status: { in: ["TRANSFERRED", "ALUMNI"] }, isDeleted: false },
    },
    _sum: {
      totalAmount: true,
      paidAmount: true,
      waivedAmount: true,
    },
    _min: {
      dueDate: true,
    },
    _count: {
      id: true,
    },
  });

  const studentIds = grouped.map((g) => g.studentId);
  if (studentIds.length === 0) {
    return { data: [], total: 0 };
  }

  const students = await prisma.student.findMany({
    where: { id: { in: studentIds }, ...SOFT_DELETE_WHERE },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const outstandingLedgers = await prisma.studentFeeLedger.findMany({
    where: {
      studentId: { in: studentIds },
      status: { in: ["OVERDUE", "PARTIAL"] },
      ...SOFT_DELETE_WHERE,
    },
    orderBy: { dueDate: "asc" },
    select: { id: true, studentId: true },
  });
  const primaryLedgerMap = new Map<string, string>();
  for (const ledger of outstandingLedgers) {
    if (!primaryLedgerMap.has(ledger.studentId)) {
      primaryLedgerMap.set(ledger.studentId, ledger.id);
    }
  }

  const now = new Date();
  const data: DefaulterRecord[] = grouped.map((g) => {
    const student = studentMap.get(g.studentId);
    const totalDue = Number(g._sum.totalAmount ?? 0);
    const totalPaid = Number(g._sum.paidAmount ?? 0);
    const totalWaived = Number(g._sum.waivedAmount ?? 0);
    const remaining = totalDue - totalPaid - totalWaived;
    const oldestDueDate = g._min.dueDate;
    const daysOverdue = oldestDueDate ? Math.max(0, daysBetween(oldestDueDate, now)) : 0;

    return {
      studentId: g.studentId,
      studentName: student?.name ?? "Unknown",
      email: student?.email ?? "",
      class: student?.class ?? "",
      section: student?.section ?? "",
      totalDue,
      totalPaid,
      remaining,
      status: remaining >= totalDue ? "OVERDUE" : "PARTIAL",
      ledgerCount: g._count.id,
      ledgerId: primaryLedgerMap.get(g.studentId) ?? "",
      daysOverdue,
      riskScore: 0,
      riskTier: "LOW",
      hasBouncedCheques: false,
      historicalDefaulterCount: 0,
      studentStatus: (student as any)?.status ?? "ACTIVE",
      oldestOverdueRemaining: remaining,
    };
  });

  data.sort((a, b) => b.remaining - a.remaining);
  return { data, total: grouped.length };
}

export async function getRevenueBreakdown(): Promise<RevenueByFeeType[]> {
  const result = await prisma.studentFeeLedger.groupBy({
    by: ["feeStructureId"],
    where: SOFT_DELETE_WHERE,
    _sum: {
      totalAmount: true,
    },
    _count: {
      id: true,
    },
  });

  const feeStructureIds = result.map((r) => r.feeStructureId);
  const feeStructures = await prisma.feeStructure.findMany({
    where: { id: { in: feeStructureIds }, ...SOFT_DELETE_WHERE },
    include: { feeType: true },
  });

  const fsMap = new Map(feeStructures.map((fs) => [fs.id, fs.feeType.name]));

  const revenueMap = new Map<string, { totalAmount: number; ledgerCount: number }>();

  for (const r of result) {
    const typeName = fsMap.get(r.feeStructureId) ?? "Unknown";
    const existing = revenueMap.get(typeName) ?? { totalAmount: 0, ledgerCount: 0 };
    revenueMap.set(typeName, {
      totalAmount: existing.totalAmount + Number(r._sum.totalAmount ?? 0),
      ledgerCount: existing.ledgerCount + r._count.id,
    });
  }

  return Array.from(revenueMap.entries())
    .map(([feeTypeName, data]) => ({
      feeTypeName,
      ...data,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

// ─── Revenue Timeline with Seasonality ───────────────────────────────────────

export interface RevenueTimelinePoint {
  month: string;
  label: string;
  collected: number;
  projected: boolean;
  seasonalityMultiplier: number;
}

// School fee seasonality: April (new academic year) brings 80% of revenue
const MONTH_MULTIPLIERS: Record<number, number> = {
  1: 0.5,   // January
  2: 0.7,   // February
  3: 0.9,   // March (end of FY)
  4: 2.5,   // April (new academic year — peak)
  5: 2.0,   // May
  6: 1.5,   // June
  7: 1.2,   // July
  8: 1.0,   // August
  9: 1.0,   // September
  10: 0.8,  // October
  11: 0.6,  // November
  12: 0.2,  // December (holiday season — trough)
};

export async function getRevenueTimeline(): Promise<RevenueTimelinePoint[]> {
  const now = new Date();
  const months: RevenueTimelinePoint[] = [];

  // Collect last 6 months of actual data
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    const result = await prisma.studentFeeLedger.aggregate({
      where: {
        ...SOFT_DELETE_WHERE,
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { paidAmount: true },
    });

    const label = d.toLocaleString("en-IN", { month: "short", year: "2-digit" });
    months.push({
      month: `${year}-${String(month + 1).padStart(2, "0")}`,
      label,
      collected: Number(result._sum.paidAmount ?? 0),
      projected: false,
      seasonalityMultiplier: 1,
    });
  }

  // 3-month moving average for projection
  const lastThree = months.slice(-3);
  const avg = lastThree.reduce((sum, m) => sum + m.collected, 0) / 3;

  // Project next 2 months with seasonality adjustment
  for (let i = 1; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const projectedMonth = d.getMonth() + 1; // 1-indexed
    const multiplier = MONTH_MULTIPLIERS[projectedMonth] ?? 1;
    const label = d.toLocaleString("en-IN", { month: "short", year: "2-digit" });

    months.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label,
      collected: Math.round(avg * multiplier),
      projected: true,
      seasonalityMultiplier: multiplier,
    });
  }

  return months;
}
