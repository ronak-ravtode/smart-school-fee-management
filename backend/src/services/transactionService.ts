import mongoose from "mongoose";
import Decimal from "decimal.js";
import { StudentFeeLedger, Transaction, Student, FeeStructure, FeeType } from "@/models";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { calculateFee, FeeRules } from "./feeEngine";
import { createAuditLog } from "./auditService";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface ActorInfo {
  id: string;
  name: string;
  ipAddress?: string;
}

export interface SinglePaymentInput {
  ledgerId: string;
  amount: number;
  paymentMethod: "UPI" | "CASH" | "CHEQUE";
  transactionRef?: string;
  receiptNumber?: string;
  chequeNumber?: string;
  chequeBank?: string;
  chequeIssueDate?: string;
  expectedServerState?: any;
}

export interface BulkPaymentItem extends SinglePaymentInput {}

export interface PaymentResult {
  transaction: any;
  ledger: any;
}

export interface ClearChequeInput {
  transactionId: string;
  actualClearedAmount?: number;
  actor?: ActorInfo;
  reason?: string;
}

export interface BounceChequeInput {
  transactionId: string;
  actor?: ActorInfo;
  reason: string;
}

function determineLedgerStatus(paidAmount: number, totalDue: number): string {
  if (paidAmount >= totalDue) return "PAID";
  if (paidAmount > 0) return "PARTIAL";
  return "PENDING";
}

async function checkForDuplicateCheque(
  session: mongoose.ClientSession,
  studentId: string,
  chequeNumber: string,
  chequeBank: string
): Promise<void> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const existingCheque = await Transaction.findOne({
    paymentMethod: "CHEQUE",
    chequeNumber,
    chequeBank,
    createdAt: { $gte: thirtyDaysAgo },
    status: { $ne: "BOUNCED" },
    isDeleted: false,
  }).populate({
    path: "ledgerId",
    match: { studentId },
  }).session(session);

  if (existingCheque && existingCheque.ledgerId) {
    throw new ConflictError(
      `Duplicate cheque detected: Cheque #${chequeNumber} from ${chequeBank} was already recorded for this student.`
    );
  }
}

async function validateAndRecordPayment(
  session: mongoose.ClientSession,
  input: SinglePaymentInput,
  actor?: ActorInfo
): Promise<PaymentResult> {
  const ledger = await StudentFeeLedger.findById(input.ledgerId).session(session);
  if (!ledger) {
    throw new NotFoundError("Ledger", input.ledgerId);
  }

  const amount = new Decimal(input.amount);
  if (amount.lte(0)) {
    throw new ValidationError("Payment amount must be greater than zero");
  }

  const totalDue = ledger.totalAmount - ledger.waivedAmount;
  const remainingBalance = totalDue - ledger.paidAmount;

  if (amount.greaterThan(remainingBalance)) {
    throw new ValidationError(
      `Payment amount ${amount.toString()} exceeds remaining balance ${remainingBalance}`
    );
  }

  if (input.paymentMethod === "CHEQUE") {
    if (!input.chequeNumber || !input.chequeBank || !input.chequeIssueDate) {
      throw new ValidationError("Cheque number, bank name, and issue date are required for cheque payments");
    }

    await checkForDuplicateCheque(session, ledger.studentId.toString(), input.chequeNumber, input.chequeBank);

    const transaction = await Transaction.create([{
      ledgerId: input.ledgerId,
      amount: amount.toDecimalPlaces(2).toNumber(),
      paymentMethod: "CHEQUE",
      transactionRef: input.transactionRef ?? undefined,
      receiptNumber: input.receiptNumber ?? undefined,
      status: "PENDING_CLEARANCE",
      chequeNumber: input.chequeNumber,
      chequeBank: input.chequeBank,
      chequeIssueDate: new Date(input.chequeIssueDate),
    } as any], { session });

    if (actor) {
      await createAuditLog({
        actorId: actor.id,
        actorName: actor.name,
        action: "PAYMENT_RECORDED",
        entityType: "Transaction",
        entityId: transaction[0]._id.toString(),
        newValue: {
          amount: amount.toNumber(),
          paymentMethod: "CHEQUE",
          chequeNumber: input.chequeNumber,
          chequeBank: input.chequeBank,
          status: "PENDING_CLEARANCE",
          ledgerId: input.ledgerId,
        },
        ipAddress: actor.ipAddress,
      }, session);
    }

    return { transaction: transaction[0], ledger };
  }

  const newPaidAmount = ledger.paidAmount + amount.toNumber();
  const newStatus = determineLedgerStatus(newPaidAmount, totalDue);

  const transaction = await Transaction.create([{
    ledgerId: input.ledgerId,
    amount: amount.toDecimalPlaces(2).toNumber(),
    paymentMethod: input.paymentMethod,
    transactionRef: input.transactionRef ?? undefined,
    receiptNumber: input.receiptNumber ?? undefined,
    status: "SUCCESS",
  } as any], { session });

  const updatedLedger = await StudentFeeLedger.findByIdAndUpdate(
    input.ledgerId,
    { paidAmount: newPaidAmount, status: newStatus },
    { new: true, session }
  );

  if (actor) {
    await createAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      action: "PAYMENT_RECORDED",
      entityType: "Transaction",
      entityId: transaction[0]._id.toString(),
      previousValue: { paidAmount: ledger.paidAmount, ledgerStatus: ledger.status },
      newValue: {
        amount: amount.toNumber(),
        paymentMethod: input.paymentMethod,
        paidAmount: newPaidAmount,
        ledgerStatus: newStatus,
        status: "SUCCESS",
        ledgerId: input.ledgerId,
      },
      ipAddress: actor.ipAddress,
    }, session);
  }

  return { transaction: transaction[0], ledger: updatedLedger };
}

export async function recordSinglePayment(
  input: SinglePaymentInput,
  actor?: ActorInfo
): Promise<PaymentResult> {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await validateAndRecordPayment(session, input, actor);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function bulkReconcile(
  payments: BulkPaymentItem[],
  actor?: ActorInfo
): Promise<{ processed: number; results: PaymentResult[] }> {
  if (payments.length === 0) throw new ValidationError("Payment array cannot be empty");
  if (payments.length > 100) throw new ValidationError("Bulk batch cannot exceed 100 payments");

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const results: PaymentResult[] = [];
    for (let i = 0; i < payments.length; i++) {
      try {
        const result = await validateAndRecordPayment(session, payments[i], actor);
        results.push(result);
      } catch (error) {
        if (error instanceof NotFoundError) {
          throw new ValidationError(`Payment at index ${i}: Ledger '${payments[i].ledgerId}' not found`);
        }
        if (error instanceof ValidationError) {
          throw new ValidationError(`Payment at index ${i}: ${error.message}`);
        }
        throw error;
      }
    }

    if (actor && results.length > 0) {
      const totalAmount = results.reduce((sum, r) => sum + r.transaction.amount, 0);
      await createAuditLog({
        actorId: actor.id,
        actorName: actor.name,
        action: "BULK_PAYMENT",
        entityType: "Transaction",
        entityId: `bulk-${Date.now()}`,
        newValue: {
          count: results.length,
          totalAmount,
          paymentMethods: [...new Set(payments.map((p) => p.paymentMethod))],
        },
        ipAddress: actor.ipAddress,
      }, session);
    }

    await session.commitTransaction();
    return { processed: results.length, results };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function getTransactionsByLedger(ledgerId: string) {
  const ledger = await StudentFeeLedger.findById(ledgerId);
  if (!ledger) throw new NotFoundError("Ledger", ledgerId);

  return Transaction.find({ ledgerId, isDeleted: false }).sort({ createdAt: -1 });
}

export async function getPendingCheques() {
  const transactions = await Transaction.find({
    status: "PENDING_CLEARANCE",
    isDeleted: false,
  })
    .populate({
      path: "ledgerId",
      populate: { path: "studentId" },
    })
    .sort({ createdAt: 1 });

  const now = new Date();
  return transactions.map((txn: any) => {
    const ledger = txn.ledgerId;
    const student = ledger?.studentId;
    const daysWaiting = Math.floor(
      (now.getTime() - txn.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      transactionId: txn._id.toString(),
      ledgerId: ledger?._id?.toString(),
      studentId: student?._id?.toString(),
      studentName: student?.name ?? "",
      studentClass: student?.class ?? "",
      studentSection: student?.section ?? "",
      chequeNumber: txn.chequeNumber,
      chequeBank: txn.chequeBank,
      chequeIssueDate: txn.chequeIssueDate,
      amount: txn.amount,
      dateReceived: txn.createdAt,
      daysWaiting,
    };
  });
}

export async function clearCheque(input: ClearChequeInput) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const transaction = await Transaction.findById(input.transactionId).session(session);
    if (!transaction) throw new NotFoundError("Transaction", input.transactionId);
    if (transaction.status !== "PENDING_CLEARANCE") {
      throw new ConflictError(`Transaction ${input.transactionId} is not in PENDING_CLEARANCE status`);
    }

    const ledger = await StudentFeeLedger.findById(transaction.ledgerId).session(session);
    if (!ledger) throw new NotFoundError("Ledger", transaction.ledgerId.toString());

    const totalDue = ledger.totalAmount - ledger.waivedAmount;
    const outstandingBefore = totalDue - ledger.paidAmount;

    if (outstandingBefore <= 0) {
      throw new ConflictError("Fee already paid via another method.");
    }

    let actualCleared = transaction.amount;
    if (input.actualClearedAmount !== undefined) {
      actualCleared = input.actualClearedAmount;
      if (actualCleared <= 0) throw new ValidationError("Actual cleared amount must be greater than zero");
      if (actualCleared > transaction.amount) throw new ValidationError("Actual cleared amount cannot exceed cheque amount");
      if (actualCleared > outstandingBefore) actualCleared = outstandingBefore;
    }

    const isPartial = actualCleared < transaction.amount;
    const transactionStatus = isPartial ? "PARTIALLY_CLEARED" : "CLEARED";

    await Transaction.findByIdAndUpdate(input.transactionId, {
      status: transactionStatus,
      actualClearedAmount: actualCleared,
    }, { session });

    const newPaidAmount = ledger.paidAmount + actualCleared;
    const newStatus = determineLedgerStatus(newPaidAmount, totalDue);

    const updatedLedger = await StudentFeeLedger.findByIdAndUpdate(
      transaction.ledgerId,
      { paidAmount: newPaidAmount, status: newStatus },
      { new: true, session }
    );

    if (input.actor) {
      await createAuditLog({
        actorId: input.actor.id,
        actorName: input.actor.name,
        action: "CHEQUE_CLEARED",
        entityType: "Transaction",
        entityId: transaction._id.toString(),
        previousValue: { status: "PENDING_CLEARANCE", amount: transaction.amount, paidAmount: ledger.paidAmount },
        newValue: { status: transactionStatus, actualClearedAmount: actualCleared, paidAmount: newPaidAmount, ledgerStatus: newStatus, isPartial },
        reason: input.reason,
        ipAddress: input.actor.ipAddress,
      }, session);
    }

    let remainingTransaction: any;
    if (isPartial) {
      const remaining = transaction.amount - actualCleared;
      const [rt] = await Transaction.create([{
        ledgerId: transaction.ledgerId,
        amount: remaining,
        paymentMethod: "CHEQUE",
        transactionRef: transaction.transactionRef,
        chequeNumber: transaction.chequeNumber,
        chequeBank: transaction.chequeBank,
        chequeIssueDate: transaction.chequeIssueDate,
        status: "BOUNCED",
      } as any], { session });
      remainingTransaction = rt;
    }

    await session.commitTransaction();
    return { transaction: await Transaction.findById(input.transactionId), ledger: updatedLedger, remainingTransaction };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function bounceCheque(input: BounceChequeInput) {
  if (!input.reason || input.reason.trim().length < 10) {
    throw new ValidationError("Reason must be at least 10 characters");
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const transaction = await Transaction.findById(input.transactionId).session(session);
    if (!transaction) throw new NotFoundError("Transaction", input.transactionId);
    if (transaction.status !== "PENDING_CLEARANCE") {
      throw new ConflictError(`Transaction ${input.transactionId} is not in PENDING_CLEARANCE status`);
    }

    await Transaction.findByIdAndUpdate(input.transactionId, { status: "BOUNCED" }, { session });

    const ledger = await StudentFeeLedger.findById(transaction.ledgerId)
      .populate({ path: "feeStructureId", populate: { path: "feeTypeId" } })
      .session(session);

    if (!ledger) throw new NotFoundError("Ledger", transaction.ledgerId.toString());

    const fs = ledger.feeStructureId as any;
    const ft = fs?.feeTypeId;
    const rules = (ft?.rules as FeeRules) ?? null;
    const baseAmount = new Decimal(fs?.amount ?? 0);
    const recalculated = calculateFee(baseAmount, ledger.dueDate, new Date(), rules);

    const updatedLedger = await StudentFeeLedger.findByIdAndUpdate(
      transaction.ledgerId,
      { totalAmount: recalculated.totalAmount.toNumber(), waivedAmount: recalculated.waiverAmount.toNumber() },
      { new: true, session }
    );

    if (input.actor) {
      await createAuditLog({
        actorId: input.actor.id,
        actorName: input.actor.name,
        action: "CHEQUE_BOUNCED",
        entityType: "Transaction",
        entityId: transaction._id.toString(),
        previousValue: { status: "PENDING_CLEARANCE", amount: transaction.amount },
        newValue: { status: "BOUNCED", totalAmount: recalculated.totalAmount.toNumber() },
        reason: input.reason,
        ipAddress: input.actor.ipAddress,
      }, session);
    }

    await session.commitTransaction();
    return { transaction: await Transaction.findById(input.transactionId), ledger: updatedLedger };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
