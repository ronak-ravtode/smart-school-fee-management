import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface DashboardMetrics {
  totalExpected: number;
  totalCollected: number;
  totalPending: number;
  totalOverdue: number;
  collectionPercentage: number;
}

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
}

export interface RevenueByFeeType {
  feeTypeName: string;
  totalAmount: number;
  ledgerCount: number;
}

export async function getMetrics(): Promise<DashboardMetrics> {
  const result = await prisma.studentFeeLedger.aggregate({
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
    where: { status: "OVERDUE" },
  });

  const totalExpected = Number(result._sum.totalAmount ?? 0);
  const totalCollected = Number(result._sum.paidAmount ?? 0);
  const totalWaived = Number(result._sum.waivedAmount ?? 0);
  const netExpected = totalExpected - totalWaived;
  const totalPending = netExpected - totalCollected;
  const totalOverdue = await prisma.studentFeeLedger.aggregate({
    where: { status: "OVERDUE" },
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
    },
    _sum: {
      totalAmount: true,
      paidAmount: true,
      waivedAmount: true,
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
    },
  });

  const studentIds = grouped.map((g) => g.studentId);
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
  });

  const studentMap = new Map(students.map((s) => [s.id, s]));

  const outstandingLedgers = await prisma.studentFeeLedger.findMany({
    where: {
      studentId: { in: studentIds },
      status: { in: ["OVERDUE", "PARTIAL"] },
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

  const data: DefaulterRecord[] = grouped.map((g) => {
    const student = studentMap.get(g.studentId);
    const totalDue = Number(g._sum.totalAmount ?? 0);
    const totalPaid = Number(g._sum.paidAmount ?? 0);
    const totalWaived = Number(g._sum.waivedAmount ?? 0);
    const remaining = totalDue - totalPaid - totalWaived;

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
    };
  });

  return {
    data,
    total: totalCount.length,
    page,
    limit,
  };
}

export async function getRevenueBreakdown(): Promise<RevenueByFeeType[]> {
  const result = await prisma.studentFeeLedger.groupBy({
    by: ["feeStructureId"],
    _sum: {
      totalAmount: true,
    },
    _count: {
      id: true,
    },
  });

  const feeStructureIds = result.map((r) => r.feeStructureId);
  const feeStructures = await prisma.feeStructure.findMany({
    where: { id: { in: feeStructureIds } },
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
