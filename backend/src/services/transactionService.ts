import { Prisma, Transaction, StudentFeeLedger } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";

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

function determineLedgerStatus(
  paidAmount: Decimal,
  totalDue: Decimal
): "PENDING" | "PARTIAL" | "PAID" {
  if (paidAmount.gte(totalDue)) return "PAID";
  if (paidAmount.gt(0)) return "PARTIAL";
  return "PENDING";
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

export async function clearCheque(
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

    const updatedTransaction = await tx.transaction.update({
      where: { id: transactionId },
      data: { status: "CLEARED" },
    });

    const ledger = await tx.studentFeeLedger.findUnique({
      where: { id: transaction.ledgerId },
    });
    if (!ledger) {
      throw new NotFoundError("Ledger", transaction.ledgerId);
    }

    const paidAmount = new Decimal(ledger.paidAmount.toString());
    const totalAmount = new Decimal(ledger.totalAmount.toString());
    const waivedAmount = new Decimal(ledger.waivedAmount.toString());
    const newPaidAmount = paidAmount.plus(new Decimal(transaction.amount.toString()));
    const totalDue = totalAmount.minus(waivedAmount);
    const newStatus = determineLedgerStatus(newPaidAmount, totalDue);

    const updatedLedger = await tx.studentFeeLedger.update({
      where: { id: transaction.ledgerId },
      data: {
        paidAmount: newPaidAmount.toDecimalPlaces(2).toString(),
        status: newStatus,
      },
    });

    return { transaction: updatedTransaction, ledger: updatedLedger };
  });
}

export async function bounceCheque(
  transactionId: string
): Promise<Transaction> {
  const transaction = await prisma.transaction.findUnique({
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

  return prisma.transaction.update({
    where: { id: transactionId },
    data: { status: "BOUNCED" },
  });
}
