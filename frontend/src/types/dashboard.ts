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
  daysOverdue?: number;
  riskScore?: number;
  riskTier?: RiskTier;
  hasBouncedCheques?: boolean;
  historicalDefaulterCount?: number;
  studentStatus?: "ACTIVE" | "TRANSFERRED" | "ALUMNI";
  oldestOverdueRemaining?: number;
}

export interface RevenueByFeeType {
  feeTypeName: string;
  totalAmount: number;
  ledgerCount: number;
}

export interface RevenueTimelinePoint {
  month: string;
  label: string;
  collected: number;
  projected: boolean;
  seasonalityMultiplier: number;
}
