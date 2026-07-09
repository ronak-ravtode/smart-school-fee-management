import { Prisma, Transaction, StudentFeeLedger } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { createAuditLog } from "./auditService";
import { getIO } from "@/lib/socket";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const SOFT_DELETE_WHERE = { isDeleted: false } as const;

function determineLedgerStatus(
  paidAmount: Decimal,
  totalDue: Decimal
): "PENDING" | "PARTIAL" | "PAID" {
  if (paidAmount.gte(totalDue)) return "PAID";
  if (paidAmount.gt(0)) return "PARTIAL";
  return "PENDING";
}

// ─── Step 1: Zero-MDR UPI Order Creation ────────────────────────────────────

export interface CreateUPIOrderInput {
  ledgerId: string;
  amount: number;
  studentName: string;
  studentEmail?: string;
  studentContact?: string;
}

export interface UPIOrderResult {
  orderId: string;
  amount: number;
  currency: string;
  ledgerId: string;
  method: "upi";
}

export async function createUPIOrder(
  input: CreateUPIOrderInput
): Promise<UPIOrderResult> {
  const ledger = await prisma.studentFeeLedger.findUnique({
    where: { id: input.ledgerId },
    include: { student: true },
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

  const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  return {
    orderId,
    amount: amount.toNumber(),
    currency: "INR",
    ledgerId: input.ledgerId,
    method: "upi",
  };
}

// ─── Step 3: Idempotent Webhook Processing ──────────────────────────────────

export interface WebhookPaymentData {
  gatewayPaymentId: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  ledgerId: string;
  studentId?: string;
  studentName?: string;
}

export interface WebhookProcessResult {
  processed: boolean;
  transactionId?: string;
  ledgerId?: string;
  amount?: number;
  ledgerStatus?: string;
  reason?: string;
}

export async function processWebhookPayment(
  data: WebhookPaymentData
): Promise<WebhookProcessResult> {
  // Step 3: Idempotency check — if this gatewayPaymentId already exists, skip
  const existingTransaction = await prisma.transaction.findUnique({
    where: { gatewayPaymentId: data.gatewayPaymentId },
  });

  if (existingTransaction) {
    if (existingTransaction.status === "SUCCESS") {
      return {
        processed: false,
        transactionId: existingTransaction.id,
        reason: "Duplicate webhook — payment already processed",
      };
    }
    // If status is not SUCCESS (e.g. PENDING), we can retry
  }

  // Edge Case 4: Check if admin manually marked this ledger as paid
  // (transaction exists for this ledger with SUCCESS but no gatewayPaymentId)
  const manualTransaction = await prisma.transaction.findFirst({
    where: {
      ledgerId: data.ledgerId,
      status: "SUCCESS",
      gatewayPaymentId: null,
      isDeleted: false,
    },
  });

  if (manualTransaction) {
    // Admin already recorded this payment manually. Link the gateway payment ID
    // to the manual transaction for audit trail, but don't double-credit the ledger.
    await prisma.transaction.update({
      where: { id: manualTransaction.id },
      data: { gatewayPaymentId: data.gatewayPaymentId },
    });

    return {
      processed: false,
      transactionId: manualTransaction.id,
      reason: "Payment already recorded manually by admin — gatewayPaymentId linked for reconciliation",
    };
  }

  if (data.status !== "captured") {
    return {
      processed: false,
      reason: `Payment status '${data.status}' is not 'captured'`,
    };
  }

  const amountInRupees = data.amount / 100;

  return prisma.$transaction(async (tx) => {
    const ledger = await tx.studentFeeLedger.findUnique({
      where: { id: data.ledgerId },
    });
    if (!ledger) {
      throw new NotFoundError("Ledger", data.ledgerId);
    }

    const amount = new Decimal(amountInRupees);
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

    const newPaidAmount = paidAmount.plus(amount);
    const totalDue = totalAmount.minus(waivedAmount);
    const newStatus = determineLedgerStatus(newPaidAmount, totalDue);

    const transaction = await tx.transaction.create({
      data: {
        ledgerId: data.ledgerId,
        amount: amount.toDecimalPlaces(2).toString(),
        paymentMethod: "UPI",
        transactionRef: data.orderId,
        gatewayPaymentId: data.gatewayPaymentId,
        status: "SUCCESS",
      },
    });

    const updatedLedger = await tx.studentFeeLedger.update({
      where: { id: data.ledgerId },
      data: {
        paidAmount: newPaidAmount.toDecimalPlaces(2).toString(),
        status: newStatus,
      },
    });

    await createAuditLog({
      actorId: data.studentId ?? "webhook",
      actorName: data.studentName ?? "UPI Webhook",
      action: "PAYMENT_RECORDED",
      entityType: "Transaction",
      entityId: transaction.id,
      newValue: {
        amount: amount.toNumber(),
        paymentMethod: "UPI",
        gatewayPaymentId: data.gatewayPaymentId,
        paidAmount: newPaidAmount.toNumber(),
        ledgerStatus: newStatus,
        status: "SUCCESS",
        ledgerId: data.ledgerId,
        source: "webhook",
      },
    }, tx);

    // Step 4: Emit real-time event
    try {
      const io = getIO();
      const metrics = await tx.studentFeeLedger.aggregate({
        where: SOFT_DELETE_WHERE,
        _sum: { totalAmount: true, paidAmount: true, waivedAmount: true },
      });

      const totalExpected = Number(metrics._sum.totalAmount ?? 0);
      const totalCollected = Number(metrics._sum.paidAmount ?? 0);
      const totalWaived = Number(metrics._sum.waivedAmount ?? 0);
      const netExpected = totalExpected - totalWaived;
      const totalPending = Math.max(0, netExpected - totalCollected);

      io.emit("payment_verified", {
        studentId: data.studentId,
        studentName: data.studentName,
        amount: amount.toNumber(),
        transactionId: transaction.id,
        ledgerId: data.ledgerId,
        ledgerStatus: newStatus,
        newTotalRevenue: totalCollected,
        newTotalPending: totalPending,
        timestamp: new Date().toISOString(),
      });
    } catch {
      console.warn("Failed to emit payment_verified event");
    }

    return {
      processed: true,
      transactionId: transaction.id,
      ledgerId: data.ledgerId,
      amount: amount.toNumber(),
      ledgerStatus: newStatus,
    };
  });
}

// ─── Edge Case 3: Refund Processing ─────────────────────────────────────────
// Handles refund.processed webhook — reverses ledger, creates REFUND transaction

export interface WebhookRefundData {
  gatewayRefundId: string;
  gatewayPaymentId: string;
  amount: number;
  currency: string;
  status: string;
  ledgerId: string;
  studentId?: string;
  studentName?: string;
}

export interface WebhookRefundResult {
  processed: boolean;
  transactionId?: string;
  ledgerId?: string;
  amount?: number;
  ledgerStatus?: string;
  reason?: string;
}

export async function processWebhookRefund(
  data: WebhookRefundData
): Promise<WebhookRefundResult> {
  // Idempotency: check if this refund was already processed
  const existingRefund = await prisma.transaction.findFirst({
    where: {
      gatewayPaymentId: data.gatewayRefundId,
      status: "SUCCESS",
      isDeleted: false,
    },
  });

  if (existingRefund) {
    return {
      processed: false,
      transactionId: existingRefund.id,
      reason: "Duplicate refund webhook — already processed",
    };
  }

  if (data.status !== "processed") {
    return {
      processed: false,
      reason: `Refund status '${data.status}' is not 'processed'`,
    };
  }

  const amountInRupees = data.amount / 100;

  return prisma.$transaction(async (tx) => {
    const ledger = await tx.studentFeeLedger.findUnique({
      where: { id: data.ledgerId },
    });
    if (!ledger) {
      throw new NotFoundError("Ledger", data.ledgerId);
    }

    const refundAmount = new Decimal(amountInRupees);
    if (refundAmount.lte(0)) {
      throw new ValidationError("Refund amount must be greater than zero");
    }

    const paidAmount = new Decimal(ledger.paidAmount.toString());
    const totalAmount = new Decimal(ledger.totalAmount.toString());
    const waivedAmount = new Decimal(ledger.waivedAmount.toString());

    // Reverse the payment: subtract refund from paidAmount
    const newPaidAmount = Decimal.max(0, paidAmount.minus(refundAmount));
    const totalDue = totalAmount.minus(waivedAmount);
    const newStatus = determineLedgerStatus(newPaidAmount, totalDue);

    // Create REFUND transaction (negative indicator via status)
    const transaction = await tx.transaction.create({
      data: {
        ledgerId: data.ledgerId,
        amount: refundAmount.toDecimalPlaces(2).toString(),
        paymentMethod: "UPI",
        transactionRef: data.gatewayRefundId,
        gatewayPaymentId: data.gatewayRefundId,
        status: "SUCCESS",
      },
    });

    const updatedLedger = await tx.studentFeeLedger.update({
      where: { id: data.ledgerId },
      data: {
        paidAmount: newPaidAmount.toDecimalPlaces(2).toString(),
        status: newStatus,
      },
    });

    await createAuditLog({
      actorId: data.studentId ?? "webhook",
      actorName: data.studentName ?? "UPI Refund Webhook",
      action: "PAYMENT_REVERSED",
      entityType: "Transaction",
      entityId: transaction.id,
      previousValue: {
        paidAmount: Number(paidAmount),
        ledgerStatus: ledger.status,
      },
      newValue: {
        amount: refundAmount.toNumber(),
        paymentMethod: "UPI",
        gatewayRefundId: data.gatewayRefundId,
        paidAmount: newPaidAmount.toNumber(),
        ledgerStatus: newStatus,
        status: "SUCCESS",
        ledgerId: data.ledgerId,
        source: "refund_webhook",
      },
    }, tx);

    // Emit real-time refund event
    try {
      const io = getIO();
      const metrics = await tx.studentFeeLedger.aggregate({
        where: SOFT_DELETE_WHERE,
        _sum: { totalAmount: true, paidAmount: true, waivedAmount: true },
      });

      const totalExpected = Number(metrics._sum.totalAmount ?? 0);
      const totalCollected = Number(metrics._sum.paidAmount ?? 0);
      const totalWaived = Number(metrics._sum.waivedAmount ?? 0);
      const netExpected = totalExpected - totalWaived;
      const totalPending = Math.max(0, netExpected - totalCollected);

      io.emit("refund_verified", {
        studentId: data.studentId,
        studentName: data.studentName,
        refundAmount: refundAmount.toNumber(),
        transactionId: transaction.id,
        ledgerId: data.ledgerId,
        ledgerStatus: newStatus,
        newTotalRevenue: totalCollected,
        newTotalPending: totalPending,
        timestamp: new Date().toISOString(),
      });
    } catch {
      console.warn("Failed to emit refund_verified event");
    }

    return {
      processed: true,
      transactionId: transaction.id,
      ledgerId: data.ledgerId,
      amount: refundAmount.toNumber(),
      ledgerStatus: newStatus,
    };
  });
}
