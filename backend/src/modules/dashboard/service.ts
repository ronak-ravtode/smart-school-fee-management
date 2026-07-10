import { StudentFeeLedger, Transaction, Student, FeeStructure } from "@/models";

const SOFT_DELETE = { isDeleted: false };

export interface DashboardMetrics {
  totalExpected: number;
  totalCollected: number;
  totalPending: number;
  totalOverdue: number;
  collectionPercentage: number;
}

export type RiskTier = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

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
  const result = await StudentFeeLedger.aggregate([
    { $match: SOFT_DELETE },
    { $group: { _id: null, totalAmount: { $sum: "$totalAmount" }, paidAmount: { $sum: "$paidAmount" }, waivedAmount: { $sum: "$waivedAmount" } } },
  ]);

  const overdueResult = await StudentFeeLedger.aggregate([
    { $match: { ...SOFT_DELETE, status: "OVERDUE" } },
    { $group: { _id: null, totalAmount: { $sum: "$totalAmount" }, paidAmount: { $sum: "$paidAmount" }, waivedAmount: { $sum: "$waivedAmount" } } },
  ]);

  const r = result[0] ?? { totalAmount: 0, paidAmount: 0, waivedAmount: 0 };
  const o = overdueResult[0] ?? { totalAmount: 0, paidAmount: 0, waivedAmount: 0 };

  const totalExpected = r.totalAmount - r.waivedAmount;
  const totalCollected = r.paidAmount;
  const totalPending = Math.max(0, totalExpected - totalCollected);
  const totalOverdue = Math.max(0, o.totalAmount - o.paidAmount - o.waivedAmount);
  const collectionPercentage = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

  return { totalExpected, totalCollected, totalPending, totalOverdue, collectionPercentage };
}

export async function getDefaults(limit: number = 20) {
  const grouped = await StudentFeeLedger.aggregate([
    { $match: { ...SOFT_DELETE, status: { $in: ["OVERDUE", "PARTIAL"] } } },
    { $lookup: { from: "students", localField: "studentId", foreignField: "_id", as: "student" } },
    { $unwind: "$student" },
    { $match: { "student.status": "ACTIVE", "student.isDeleted": false } },
    { $group: {
      _id: "$studentId",
      totalAmount: { $sum: "$totalAmount" },
      paidAmount: { $sum: "$paidAmount" },
      waivedAmount: { $sum: "$waivedAmount" },
      minDueDate: { $min: "$dueDate" },
      ledgerCount: { $sum: 1 },
      student: { $first: "$student" },
    }},
    { $addFields: {
      remaining: { $subtract: [{ $subtract: ["$totalAmount", "$waivedAmount"] }, "$paidAmount"] },
    }},
    { $sort: { totalAmount: -1 } },
    { $limit: limit },
  ]);

  const now = new Date();
  return grouped.map((g: any) => ({
    studentId: g._id.toString(),
    studentName: g.student?.name ?? "Unknown",
    email: g.student?.email ?? "",
    class: g.student?.class ?? "",
    section: g.student?.section ?? "",
    totalDue: g.totalAmount,
    totalPaid: g.paidAmount,
    remaining: Math.max(0, g.remaining),
    status: g.remaining >= g.totalAmount ? "OVERDUE" : "PARTIAL",
    ledgerCount: g.ledgerCount,
    daysOverdue: g.minDueDate ? Math.max(0, daysBetween(g.minDueDate, now)) : 0,
    riskScore: g.minDueDate ? Math.max(0, daysBetween(g.minDueDate, now)) * Math.max(0, g.remaining) : 0,
    riskTier: "LOW" as RiskTier,
    hasBouncedCheques: false,
    historicalDefaulterCount: 0,
    studentStatus: g.student?.status ?? "ACTIVE",
    oldestOverdueRemaining: Math.max(0, g.remaining),
  }));
}

export async function getRevenueBreakdown() {
  const result = await StudentFeeLedger.aggregate([
    { $match: SOFT_DELETE },
    { $lookup: { from: "feestructures", localField: "feeStructureId", foreignField: "_id", as: "fs" } },
    { $unwind: "$fs" },
    { $lookup: { from: "feetypes", localField: "fs.feeTypeId", foreignField: "_id", as: "ft" } },
    { $unwind: "$ft" },
    { $group: { _id: "$ft.name", totalAmount: { $sum: "$totalAmount" }, ledgerCount: { $sum: 1 } } },
    { $sort: { totalAmount: -1 } },
  ]);

  return result.map((r: any) => ({ feeTypeName: r._id, totalAmount: r.totalAmount, ledgerCount: r.ledgerCount }));
}

export interface RevenueTimelinePoint {
  month: string;
  label: string;
  collected: number;
  projected: boolean;
  seasonalityMultiplier: number;
}

const MONTH_MULTIPLIERS: Record<number, number> = {
  1: 0.5, 2: 0.7, 3: 0.9, 4: 2.5, 5: 2.0, 6: 1.5,
  7: 1.2, 8: 1.0, 9: 1.0, 10: 0.8, 11: 0.6, 12: 0.2,
};

export async function getRevenueTimeline(): Promise<RevenueTimelinePoint[]> {
  const now = new Date();
  const months: RevenueTimelinePoint[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    const result = await StudentFeeLedger.aggregate([
      { $match: { ...SOFT_DELETE, createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: null, paidAmount: { $sum: "$paidAmount" } } },
    ]);

    const label = d.toLocaleString("en-IN", { month: "short", year: "2-digit" });
    months.push({
      month: `${year}-${String(month + 1).padStart(2, "0")}`,
      label,
      collected: result[0]?.paidAmount ?? 0,
      projected: false,
      seasonalityMultiplier: 1,
    });
  }

  const lastThree = months.slice(-3);
  const avg = lastThree.reduce((sum, m) => sum + m.collected, 0) / 3;

  for (let i = 1; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const projectedMonth = d.getMonth() + 1;
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

export async function getRecoveryDefaulters() {
  const grouped = await StudentFeeLedger.aggregate([
    { $match: { ...SOFT_DELETE, status: { $in: ["OVERDUE", "PARTIAL"] } } },
    { $lookup: { from: "students", localField: "studentId", foreignField: "_id", as: "student" } },
    { $unwind: "$student" },
    { $match: { "student.status": { $in: ["TRANSFERRED", "ALUMNI"] }, "student.isDeleted": false } },
    { $group: {
      _id: "$studentId",
      totalAmount: { $sum: "$totalAmount" },
      paidAmount: { $sum: "$paidAmount" },
      waivedAmount: { $sum: "$waivedAmount" },
      minDueDate: { $min: "$dueDate" },
      ledgerCount: { $sum: 1 },
      student: { $first: "$student" },
    }},
    { $addFields: { remaining: { $subtract: [{ $subtract: ["$totalAmount", "$waivedAmount"] }, "$paidAmount"] } } },
    { $sort: { remaining: -1 } },
  ]);

  return {
    data: grouped.map((g: any) => ({
      studentId: g._id.toString(),
      studentName: g.student?.name ?? "Unknown",
      email: g.student?.email ?? "",
      class: g.student?.class ?? "",
      section: g.student?.section ?? "",
      totalDue: g.totalAmount,
      totalPaid: g.paidAmount,
      remaining: Math.max(0, g.remaining),
      status: g.remaining >= g.totalAmount ? "OVERDUE" : "PARTIAL",
      ledgerCount: g.ledgerCount,
      daysOverdue: g.minDueDate ? Math.max(0, daysBetween(g.minDueDate, new Date())) : 0,
      riskScore: 0,
      riskTier: "LOW" as RiskTier,
      hasBouncedCheques: false,
      historicalDefaulterCount: 0,
      studentStatus: g.student?.status ?? "ACTIVE",
      oldestOverdueRemaining: Math.max(0, g.remaining),
    })),
    total: grouped.length,
  };
}
