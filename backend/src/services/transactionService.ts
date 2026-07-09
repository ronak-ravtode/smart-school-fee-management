import { Prisma, Transaction, StudentFeeLedger } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { calculateFee, toPrismaDecimal, FeeRules } from "./feeEngine";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface SinglePaymentInput {
  ledgerId: string;
  amount: number;
  paymentMethod: "UPI" | "CASH" | "CHEQUE";
  transactionRef?: string;
  receiptNumber?: string;
  chequeNumber?: string;
  chequeBank?: string;
  chequeIssueDate?: string;
}

export interface BulkPaymentItem {
  ledgerId: string;
  amount: number;
  paymentMethod: "UPI" | "CASH" | "CHEQUE";
  transactionRef?: string;
  receiptNumber?: string;
  chequeNumber?: string;
  chequeBank?: string;
  chequeIssueDate?: string;
}

export interface PaymentResult {
  transaction: Transaction;
  ledger: StudentFeeLedger;
}

export interface ClearChequeInput {
  transactionId: string;
  actualClearedAmount?: number;
}

export interface ClearChequeResult {
  transaction: Transaction;
  ledger: StudentFeeLedger;
  remainingTransaction?: Transaction;
}

function determineLedgerStatus(
  paidAmount: Decimal,
  totalDue: Decimal
): "PENDING" | "PARTIAL" | "PAID" {
  if (paidAmount.gte(totalDue)) return "PAID";
  if (paidAmount.gt(0)) return "PARTIAL";
  return "PENDING";
}

// ─── Edge Case 3: Ghost Cheque Detection ─────────────────────────────────────
// Checks if the same student already has a CHEQUE with the same number + bank
// recorded in the last 30 days. Blocks duplicate entries.

async function checkForDuplicateCheque(
  tx: Prisma.TransactionClient,
  studentId: string,
  chequeNumber: string,
  chequeBank: string
): Promise<void> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const existingCheque = await tx.transaction.findFirst({
    where: {
      paymentMethod: "CHEQUE",
      chequeNumber,
      chequeBank,
      createdAt: { gte: thirtyDaysAgo },
      ledger: {
        studentId,
      },
      status: { notIn: ["BOUNCED"] },
    },
    select: { id: true, chequeNumber: true, createdAt: true },
  });

  if (existingCheque) {
    throw new ConflictError(
      `Duplicate cheque detected: Cheque #${chequeNumber} from ${chequeBank} was already recorded for this student on ${existingCheque.createdAt.toLocaleDateString("en-IN")}.`
    );
  }
}

async function validateAndRecordPayment(
  tx: Prisma.TransactionClient,
  input: SinglePaymentInput
): Promise<PaymentResult> {
  const ledger = await tx.studentFeeLedger.findUnique({
    where: { id: input.ledgerId },
  });
  if (!ledger) {
    throw new NotFoundError("Ledger", input.ledgerId);
  }

  const amount = new Decimal(input.amount);
  if (amount.lte(0)) {
    throw new ValidationError("Payment amount must be greater than zero");
  }

  const totalAmount = new Decimal(ledger.totalAmount.toString());
  const waivedAmount = new Decimal(ledger.waivedAmount.toString());
  const paidAmount = new Decimal(ledger.paidAmount.toString());
  const remainingBalance = totalAmount.minus(waivedAmount).minus(paidAmount);

  if (amount.gt(remainingBalance)) {
    throw new ValidationError(
      `Payment amount ${amount.toString()} exceeds remaining balance ${remainingBalance.toString()}`
    );
  }

  if (input.paymentMethod === "CHEQUE") {
    if (!input.chequeNumber || !input.chequeBank || !input.chequeIssueDate) {
      throw new ValidationError("Cheque number, bank name, and issue date are required for cheque payments");
    }

    // Edge Case 3: Block duplicate cheques
    await checkForDuplicateCheque(
      tx,
      ledger.studentId,
      input.chequeNumber,
      input.chequeBank
    );

    const transaction = await tx.transaction.create({
      data: {
        ledgerId: input.ledgerId,
        amount: amount.toDecimalPlaces(2).toString(),
        paymentMethod: "CHEQUE",
        transactionRef: input.transactionRef ?? null,
        receiptNumber: input.receiptNumber ?? null,
        status: "PENDING_CLEARANCE",
        chequeNumber: input.chequeNumber,
        chequeBank: input.chequeBank,
        chequeIssueDate: new Date(input.chequeIssueDate),
      },
    });

    return { transaction, ledger };
  }

  const newPaidAmount = paidAmount.plus(amount);
  const totalDue = totalAmount.minus(waivedAmount);
  const newStatus = determineLedgerStatus(newPaidAmount, totalDue);

  const transaction = await tx.transaction.create({
    data: {
      ledgerId: input.ledgerId,
      amount: amount.toDecimalPlaces(2).toString(),
      paymentMethod: input.paymentMethod,
      transactionRef: input.transactionRef ?? null,
      receiptNumber: input.receiptNumber ?? null,
      status: "SUCCESS",
    },
  });

  const updatedLedger = await tx.studentFeeLedger.update({
    where: { id: input.ledgerId },
    data: {
      paidAmount: newPaidAmount.toDecimalPlaces(2).toString(),
      status: newStatus,
    },
  });

  return { transaction, ledger: updatedLedger };
}

export async function recordSinglePayment(
  input: SinglePaymentInput
): Promise<PaymentResult> {
  return prisma.$transaction(async (tx) => {
    return validateAndRecordPayment(tx, input);
  });
}

export async function bulkReconcile(
  payments: BulkPaymentItem[]
): Promise<{ processed: number; results: PaymentResult[] }> {
  if (payments.length === 0) {
    throw new ValidationError("Payment array cannot be empty");
  }

  if (payments.length > 100) {
    throw new ValidationError("Bulk batch cannot exceed 100 payments");
  }

  return prisma.$transaction(async (tx) => {
    const results: PaymentResult[] = [];

    for (let i = 0; i < payments.length; i++) {
      try {
        const result = await validateAndRecordPayment(tx, payments[i]);
        results.push(result);
      } catch (error) {
        if (error instanceof NotFoundError) {
          throw new ValidationError(
            `Payment at index ${i}: Ledger '${payments[i].ledgerId}' not found`
          );
        }
        if (error instanceof ValidationError) {
          throw new ValidationError(
            `Payment at index ${i}: ${error.message}`
          );
        }
        throw error;
      }
    }

    return { processed: results.length, results };
  });
}

export async function getTransactionsByLedger(ledgerId: string) {
  const ledger = await prisma.studentFeeLedger.findUnique({
    where: { id: ledgerId },
  });
  if (!ledger) {
    throw new NotFoundError("Ledger", ledgerId);
  }

  return prisma.transaction.findMany({
    where: { ledgerId },
    orderBy: { createdAt: "desc" },
  });
}

// ─── Cheque Reconciliation ───────────────────────────────────────────────────

export interface PendingChequeRecord {
  transactionId: string;
  ledgerId: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  studentSection: string;
  chequeNumber: string;
  chequeBank: string;
  chequeIssueDate: Date;
  amount: number;
  dateReceived: Date;
  daysWaiting: number;
}

export async function getPendingCheques(): Promise<PendingChequeRecord[]> {
  const transactions = await prisma.transaction.findMany({
    where: { status: "PENDING_CLEARANCE" },
    include: {
      ledger: {
        include: {
          student: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const now = new Date();

  return transactions.map((txn) => {
    const daysWaiting = Math.floor(
      (now.getTime() - txn.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      transactionId: txn.id,
      ledgerId: txn.ledgerId,
      studentId: txn.ledger.studentId,
      studentName: txn.ledger.student.name,
      studentClass: txn.ledger.student.class,
      studentSection: txn.ledger.student.section,
      chequeNumber: txn.chequeNumber!,
      chequeBank: txn.chequeBank!,
      chequeIssueDate: txn.chequeIssueDate!,
      amount: Number(txn.amount),
      dateReceived: txn.createdAt,
      daysWaiting,
    };
  });
}

// ─── Edge Case 4 + Edge Case 2: Clear Cheque with Race Condition + Partial ──

export async function clearCheque(
  input: ClearChequeInput
): Promise<ClearChequeResult> {
  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: input.transactionId },
    });

    if (!transaction) {
      throw new NotFoundError("Transaction", input.transactionId);
    }

    if (transaction.status !== "PENDING_CLEARANCE") {
      throw new ConflictError(
        `Transaction ${input.transactionId} is not in PENDING_CLEARANCE status (current: ${transaction.status})`
      );
    }

    // Edge Case 4: Race Condition - Re-fetch ledger to ensure no concurrent payment
    const ledger = await tx.studentFeeLedger.findUnique({
      where: { id: transaction.ledgerId },
    });
    if (!ledger) {
      throw new NotFoundError("Ledger", transaction.ledgerId);
    }

    const paidAmount = new Decimal(ledger.paidAmount.toString());
    const totalAmount = new Decimal(ledger.totalAmount.toString());
    const waivedAmount = new Decimal(ledger.waivedAmount.toString());
    const totalDue = totalAmount.minus(waivedAmount);
    const outstandingBefore = totalDue.minus(paidAmount);

    // If already fully paid (e.g. UPI webhook arrived), abort
    if (outstandingBefore.lte(0)) {
      throw new ConflictError(
        "Fee already paid via another method. The outstanding balance is already zero."
      );
    }

    // Edge Case 2: Partial Clearance - determine actual cleared amount
    const expectedAmount = new Decimal(transaction.amount.toString());
    let actualCleared = expectedAmount;

    if (input.actualClearedAmount !== undefined) {
      actualCleared = new Decimal(input.actualClearedAmount);

      if (actualCleared.lte(0)) {
        throw new ValidationError("Actual cleared amount must be greater than zero");
      }

      if (actualCleared.gt(expectedAmount)) {
        throw new ValidationError(
          `Actual cleared amount ${actualCleared.toString()} cannot exceed cheque amount ${expectedAmount.toString()}`
        );
      }

      // Cap at outstanding balance
      if (actualCleared.gt(outstandingBefore)) {
        actualCleared = outstandingBefore;
      }
    }

    const isPartial = actualCleared.lt(expectedAmount);
    const transactionStatus = isPartial ? "PARTIALLY_CLEARED" : "CLEARED";

    // Update the original transaction with actual cleared amount and status
    const updatedTransaction = await tx.transaction.update({
      where: { id: input.transactionId },
      data: {
        status: transactionStatus,
        actualClearedAmount: actualCleared.toDecimalPlaces(2).toString(),
      },
    });

    // Update ledger with actual cleared amount
    const newPaidAmount = paidAmount.plus(actualCleared);
    const newStatus = determineLedgerStatus(newPaidAmount, totalDue);

    const updatedLedger = await tx.studentFeeLedger.update({
      where: { id: transaction.ledgerId },
      data: {
        paidAmount: newPaidAmount.toDecimalPlaces(2).toString(),
        status: newStatus,
      },
    });

    // If partial, create a remaining balance transaction for the uncleared portion
    let remainingTransaction: Transaction | undefined;
    if (isPartial) {
      const remaining = expectedAmount.minus(actualCleared);
      remainingTransaction = await tx.transaction.create({
        data: {
          ledgerId: transaction.ledgerId,
          amount: remaining.toDecimalPlaces(2).toString(),
          paymentMethod: "CHEQUE",
          transactionRef: transaction.transactionRef,
          chequeNumber: transaction.chequeNumber,
          chequeBank: transaction.chequeBank,
          chequeIssueDate: transaction.chequeIssueDate,
          status: "BOUNCED",
        },
      });
    }

    return {
      transaction: updatedTransaction,
      ledger: updatedLedger,
      remainingTransaction,
    };
  });
}

// ─── Edge Case 1: Time Travel Late Fee Fix for Bounced Cheques ───────────────
// When a cheque bounces, recalculate the ledger's totalAmount using the
// original due date (not the bounce date). This prevents giving the parent
// free credit for the period the cheque was pending.

export async function bounceCheque(
  transactionId: string
): Promise<{ transaction: Transaction; ledger: StudentFeeLedger }> {
  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundError("Transaction", transactionId);
    }

    if (transaction.status !== "PENDING_CLEARANCE") {
      throw new ConflictError(
        `Transaction ${transactionId} is not in PENDING_CLEARANCE status (current: ${transaction.status})`
      );
    }

    // Mark the transaction as bounced
    const updatedTransaction = await tx.transaction.update({
      where: { id: transactionId },
      data: { status: "BOUNCED" },
    });

    // Fetch the ledger and its fee structure to recalculate penalty
    const ledger = await tx.studentFeeLedger.findUnique({
      where: { id: transaction.ledgerId },
      include: {
        feeStructure: {
          include: { feeType: true },
        },
      },
    });

    if (!ledger) {
      throw new NotFoundError("Ledger", transaction.ledgerId);
    }

    // Edge Case 1: Time Travel Fix
    // Recalculate the fee using the ORIGINAL due date and TODAY as the current date.
    // This ensures the late penalty is calculated as if the payment never happened.
    const rules = (ledger.feeStructure.feeType.rules as FeeRules) ?? null;
    const baseAmount = new Decimal(ledger.feeStructure.amount.toString());

    // Use original due date for penalty calculation, today as "current date"
    const recalculated = calculateFee(
      baseAmount,
      ledger.dueDate,
      new Date(),
      rules
    );

    // Also recalculate waiver to be safe (waiver rules don't depend on date,
    // but recalculating ensures consistency)
    const newTotalAmount = recalculated.totalAmount;
    const newWaivedAmount = recalculated.waiverAmount;

    // Update ledger with recalculated amounts
    // paidAmount stays the same (cheque was PENDING_CLEARANCE, never updated paidAmount)
    const updatedLedger = await tx.studentFeeLedger.update({
      where: { id: transaction.ledgerId },
      data: {
        totalAmount: toPrismaDecimal(newTotalAmount),
        waivedAmount: toPrismaDecimal(newWaivedAmount),
      },
    });

    return { transaction: updatedTransaction, ledger: updatedLedger };
  });
}
