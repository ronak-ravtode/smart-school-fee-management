export interface FeeRule {
  type: "percentage" | "flat";
  value: number;
}

export interface FeeRules {
  lateFee?: FeeRule;
  waiver?: FeeRule;
  discount?: FeeRule;
}

export interface FeeType {
  id: string;
  name: string;
  baseAmount: number;
  rules: FeeRules | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeeStructure {
  id: string;
  feeTypeId: string;
  class: string;
  section: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
  feeType?: FeeType;
}

export interface CreateFeeTypeInput {
  name: string;
  baseAmount: number;
  rules: FeeRules | null;
}

export interface CreateFeeStructureInput {
  feeTypeId: string;
  class: string;
  section: string;
  amount: number;
}

export interface GenerateLedgerInput {
  class: string;
  section?: string;
  academicSession: string;
  month: string;
  dueDate: string;
}

export interface GenerateLedgerResult {
  created: number;
  skipped: number;
  total: number;
}
