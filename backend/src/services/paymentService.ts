import mongoose from "mongoose";
import Decimal from "decimal.js";
import { StudentFeeLedger, Transaction } from "@/models";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { createAuditLog } from "./auditService";
import { getIO } from "@/lib/socket";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

function determineLedgerStatus(paidAmount: number, totalDue: number): string {
  if (paidAmount >= totalDue) return "PAID";
  if (paidAmount > 0) return "PARTIAL";
  return "PENDING";
}

export interface CreateUPIOrderInput {
  ledgerId: string;
  amount: number;
  studentName: string;
  studentEmail?: string;
  studentContact?: string;
}

export async function createUPIOrder(input: CreateUPIOrderInput) {
  const ledger = await StudentFeeLedger.findById(input.ledgerId).populate("studentId");
  if (!ledger) throw new NotFoundError("Ledger", input.ledgerId);

  const amount = new Decimal(input.amount);
  if (amount.lte(0)) throw new ValidationError("Payment amount must be greater than zero");

  const totalDue = ledger.totalAmount - ledger.waivedAmount;
  const remainingBalance = totalDue - ledger.paidAmount;
  if (amount.greaterThan(remainingBalance)) {
    throw new ValidationError(`Payment amount ${amount.toString()} exceeds remaining balance ${remainingBalance}`);
  }

  return {
    orderId: `order_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    amount: amount.toNumber(),
    currency: "INR",
    ledgerId: input.ledgerId,
    method: "upi" as const,
  };
}

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

export async function processWebhookPayment(data: WebhookPaymentData) {
  const existingTransaction = await Transaction.findOne({ gatewayPaymentId: data.gatewayPaymentId });
  if (existingTransaction) {
    if (existingTransaction.status === "SUCCESS") {
      return { processed: false, transactionId: existingTransaction._id.toString(), reason: "Duplicate webhook" };
    }
  }

  const manualTransaction = await Transaction.findOne({
    ledgerId: data.ledgerId,
    status: "SUCCESS",
    gatewayPaymentId: null,
    isDeleted: false,
  });

  if (manualTransaction) {
    await Transaction.findByIdAndUpdate(manualTransaction._id, { gatewayPaymentId: data.gatewayPaymentId });
    return { processed: false, transactionId: manualTransaction._id.toString(), reason: "Payment already recorded manually" };
  }

  if (data.status !== "captured") {
    return { processed: false, reason: `Payment status '${data.status}' is not 'captured'` };
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const ledger = await StudentFeeLedger.findById(data.ledgerId).session(session);
    if (!ledger) throw new NotFoundError("Ledger", data.ledgerId);

    const amountInRupees = data.amount / 100;
    const amount = new Decimal(amountInRupees);
    if (amount.lte(0)) throw new ValidationError("Payment amount must be greater than zero");

    const totalDue = ledger.totalAmount - ledger.waivedAmount;
    const remainingBalance = totalDue - ledger.paidAmount;
    if (amount.greaterThan(remainingBalance)) {
      throw new ValidationError(`Payment amount exceeds remaining balance`);
    }

    const newPaidAmount = ledger.paidAmount + amount.toNumber();
    const newStatus = determineLedgerStatus(newPaidAmount, totalDue);

    const [transaction] = await Transaction.create([{
      ledgerId: data.ledgerId,
      amount: amount.toDecimalPlaces(2).toNumber(),
      paymentMethod: "UPI",
      transactionRef: data.orderId,
      gatewayPaymentId: data.gatewayPaymentId,
      status: "SUCCESS",
    } as any], { session });

    await StudentFeeLedger.findByIdAndUpdate(data.ledgerId, {
      paidAmount: newPaidAmount,
      status: newStatus,
    }, { session });

    await createAuditLog({
      actorId: data.studentId ?? "webhook",
      actorName: data.studentName ?? "UPI Webhook",
      action: "PAYMENT_RECORDED",
      entityType: "Transaction",
      entityId: transaction._id.toString(),
      newValue: {
        amount: amount.toNumber(),
        paymentMethod: "UPI",
        gatewayPaymentId: data.gatewayPaymentId,
        paidAmount: newPaidAmount,
        ledgerStatus: newStatus,
        status: "SUCCESS",
        ledgerId: data.ledgerId,
        source: "webhook",
      },
    }, session);

    await session.commitTransaction();

    try {
      const io = getIO();
      const metrics = await StudentFeeLedger.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: null, totalAmount: { $sum: "$totalAmount" }, paidAmount: { $sum: "$paidAmount" }, waivedAmount: { $sum: "$waivedAmount" } } },
      ]);
      const m = metrics[0] ?? { totalAmount: 0, paidAmount: 0, waivedAmount: 0 };
      const netExpected = m.totalAmount - m.waivedAmount;
      const totalPending = Math.max(0, netExpected - m.paidAmount);

      io.emit("payment_verified", {
        studentId: data.studentId,
        studentName: data.studentName,
        amount: amount.toNumber(),
        transactionId: transaction._id.toString(),
        ledgerId: data.ledgerId,
        ledgerStatus: newStatus,
        newTotalRevenue: m.paidAmount,
        newTotalPending: totalPending,
        timestamp: new Date().toISOString(),
      });
    } catch {
      console.warn("Failed to emit payment_verified event");
    }

    return { processed: true, transactionId: transaction._id.toString(), ledgerId: data.ledgerId, amount: amount.toNumber(), ledgerStatus: newStatus };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

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

export async function processWebhookRefund(data: WebhookRefundData) {
  const existingRefund = await Transaction.findOne({ gatewayPaymentId: data.gatewayRefundId, status: "SUCCESS", isDeleted: false });
  if (existingRefund) {
    return { processed: false, transactionId: existingRefund._id.toString(), reason: "Duplicate refund webhook" };
  }

  if (data.status !== "processed") {
    return { processed: false, reason: `Refund status '${data.status}' is not 'processed'` };
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const ledger = await StudentFeeLedger.findById(data.ledgerId).session(session);
    if (!ledger) throw new NotFoundError("Ledger", data.ledgerId);

    const refundAmount = new Decimal(data.amount / 100);
    if (refundAmount.lte(0)) throw new ValidationError("Refund amount must be greater than zero");

    const newPaidAmount = Math.max(0, ledger.paidAmount - refundAmount.toNumber());
    const totalDue = ledger.totalAmount - ledger.waivedAmount;
    const newStatus = determineLedgerStatus(newPaidAmount, totalDue);

    const [transaction] = await Transaction.create([{
      ledgerId: data.ledgerId,
      amount: refundAmount.toDecimalPlaces(2).toNumber(),
      paymentMethod: "UPI",
      transactionRef: data.gatewayRefundId,
      gatewayPaymentId: data.gatewayRefundId,
      status: "SUCCESS",
    } as any], { session });

    await StudentFeeLedger.findByIdAndUpdate(data.ledgerId, {
      paidAmount: newPaidAmount,
      status: newStatus,
    }, { session });

    await createAuditLog({
      actorId: data.studentId ?? "webhook",
      actorName: data.studentName ?? "UPI Refund Webhook",
      action: "PAYMENT_REVERSED",
      entityType: "Transaction",
      entityId: transaction._id.toString(),
      previousValue: { paidAmount: ledger.paidAmount, ledgerStatus: ledger.status },
      newValue: { amount: refundAmount.toNumber(), paymentMethod: "UPI", paidAmount: newPaidAmount, ledgerStatus: newStatus, source: "refund_webhook" },
    }, session);

    await session.commitTransaction();

    try {
      const io = getIO();
      const metrics = await StudentFeeLedger.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: null, totalAmount: { $sum: "$totalAmount" }, paidAmount: { $sum: "$paidAmount" }, waivedAmount: { $sum: "$waivedAmount" } } },
      ]);
      const m = metrics[0] ?? { totalAmount: 0, paidAmount: 0, waivedAmount: 0 };
      const netExpected = m.totalAmount - m.waivedAmount;
      const totalPending = Math.max(0, netExpected - m.paidAmount);

      io.emit("refund_verified", {
        studentId: data.studentId,
        studentName: data.studentName,
        refundAmount: refundAmount.toNumber(),
        transactionId: transaction._id.toString(),
        ledgerId: data.ledgerId,
        ledgerStatus: newStatus,
        newTotalRevenue: m.paidAmount,
        newTotalPending: totalPending,
        timestamp: new Date().toISOString(),
      });
    } catch {
      console.warn("Failed to emit refund_verified event");
    }

    return { processed: true, transactionId: transaction._id.toString(), ledgerId: data.ledgerId, amount: refundAmount.toNumber(), ledgerStatus: newStatus };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
