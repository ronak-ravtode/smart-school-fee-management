import Decimal from "decimal.js";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface FeeRule {
  type: "percentage" | "flat";
  value: number;
}

export interface FeeRules {
  lateFee?: FeeRule;
  waiver?: FeeRule;
  discount?: FeeRule;
}

export interface FeeCalculationResult {
  baseAmount: Decimal;
  waiverAmount: Decimal;
  discountAmount: Decimal;
  lateFeeAmount: Decimal;
  totalAmount: Decimal;
}

function stripTimeToUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function applyRule(amount: Decimal, rule: FeeRule | undefined): Decimal {
  if (!rule) return new Decimal(0);

  const ruleValue = new Decimal(rule.value);

  if (rule.type === "flat") {
    return ruleValue;
  }

  if (rule.type === "percentage") {
    return amount.mul(ruleValue).div(100).toDecimalPlaces(2);
  }

  return new Decimal(0);
}

export function calculateFee(
  baseAmount: Decimal | number | string,
  dueDate: Date,
  currentDate: Date,
  rules: FeeRules | null | undefined
): FeeCalculationResult {
  const base = new Decimal(baseAmount);
  const dueDateUTC = stripTimeToUTC(dueDate);
  const currentDateUTC = stripTimeToUTC(currentDate);

  let waiverAmount = new Decimal(0);
  let discountAmount = new Decimal(0);
  let lateFeeAmount = new Decimal(0);

  if (rules?.waiver) {
    waiverAmount = applyRule(base, rules.waiver);
  }

  if (rules?.discount) {
    discountAmount = applyRule(base, rules.discount);
  }

  const afterWaiverDiscount = base.minus(waiverAmount).minus(discountAmount);

  if (currentDateUTC.getTime() > dueDateUTC.getTime() && rules?.lateFee) {
    lateFeeAmount = applyRule(afterWaiverDiscount, rules.lateFee);
  }

  const totalAmount = afterWaiverDiscount.plus(lateFeeAmount);

  return {
    baseAmount: base,
    waiverAmount,
    discountAmount,
    lateFeeAmount,
    totalAmount,
  };
}

export function toPrismaDecimal(d: Decimal): string {
  return d.toDecimalPlaces(2).toString();
}
