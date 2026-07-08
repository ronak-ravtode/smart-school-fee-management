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
}

export interface RevenueByFeeType {
  feeTypeName: string;
  totalAmount: number;
  ledgerCount: number;
}
