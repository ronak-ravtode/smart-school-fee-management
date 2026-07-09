import { Request, Response } from "express";
import crypto from "crypto";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess, sendError } from "@/utils/apiResponse";
import * as paymentService from "@/services/paymentService";
import { createAuditLog } from "@/services/auditService";

// ─── Step 1: Zero-MDR UPI Order Creation Endpoint ───────────────────────────

export const createPaymentOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const { ledgerId, amount, studentName, studentEmail, studentContact } = req.body;

    if (!ledgerId || !amount || !studentName) {
      res.status(400).json(
        sendError("MISSING_FIELDS", "ledgerId, amount, and studentName are required")
      );
      return;
    }

    const result = await paymentService.createUPIOrder({
      ledgerId,
      amount,
      studentName,
      studentEmail,
      studentContact,
    });

    res.json(
      sendSuccess(result, "UPI payment order created. Zero MDR — no transaction fees.")
    );
  }
);

// ─── Step 2: Cryptographic Webhook Signature Verification ───────────────────

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "whsec_demo_secret_key_do_not_use_in_production";

function verifyWebhookSignature(
  rawBody: string,
  signature: string | undefined
): boolean {
  if (!signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(rawBody, "utf8")
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}

// ─── Razorpay-style webhook payload structures ───────────────────────────────

interface RazorpayPaymentEntity {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  order_id: string;
  notes: {
    ledgerId?: string;
    studentId?: string;
    studentName?: string;
  };
}

interface RazorpayRefundEntity {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_id: string;
  notes: {
    ledgerId?: string;
    studentId?: string;
    studentName?: string;
  };
}

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: { entity: RazorpayPaymentEntity };
    refund?: { entity: RazorpayRefundEntity };
  };
}

// ─── Edge Case 1: Log suspicious webhook attempts ────────────────────────────

async function logSuspiciousAttempt(
  req: Request,
  reason: string,
  signature?: string
) {
  const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "unknown";
  try {
    await createAuditLog({
      actorId: "attacker",
      actorName: "Suspicious Webhook",
      action: "SUSPICIOUS_WEBHOOK_ATTEMPT",
      entityType: "Webhook",
      entityId: `webhook_${Date.now()}`,
      newValue: {
        reason,
        ipAddress: ip,
        hasSignature: !!signature,
        path: req.path,
      },
      ipAddress: ip,
    });
  } catch {
    console.warn("Failed to log suspicious webhook attempt");
  }
}

// ─── Public Webhook Endpoint (no JWT auth) ──────────────────────────────────

export const handleUPIWebhook = asyncHandler(
  async (req: Request, res: Response) => {
    const rawBody = (req as any).rawBody as string | undefined;
    const signature = req.headers["x-razorpay-signature"] as string | undefined;

    // Edge Case 1: Verify signature — log failure as suspicious
    if (!rawBody) {
      await logSuspiciousAttempt(req, "Missing raw body");
      res.status(401).json(
        sendError("MISSING_RAW_BODY", "Raw body required for signature verification")
      );
      return;
    }

    if (!verifyWebhookSignature(rawBody, signature)) {
      await logSuspiciousAttempt(req, "Invalid HMAC SHA256 signature", signature);
      res.status(401).json(
        sendError("INVALID_SIGNATURE", "Webhook signature verification failed")
      );
      return;
    }

    const payload = req.body as RazorpayWebhookPayload;

    // Route to appropriate handler based on event type
    if (payload.event === "payment.captured") {
      await handlePaymentCaptured(payload, res);
    } else if (payload.event === "refund.processed") {
      await handleRefundProcessed(payload, req, res);
    } else {
      res.json(
        sendSuccess(
          { received: true, processed: false },
          `Event '${payload.event}' ignored`
        )
      );
    }
  }
);

// ─── payment.captured handler ────────────────────────────────────────────────

async function handlePaymentCaptured(
  payload: RazorpayWebhookPayload,
  res: Response
) {
  const payment = payload.payload?.payment?.entity;
  if (!payment) {
    res.status(400).json(
      sendError("INVALID_PAYLOAD", "Missing payment entity in webhook payload")
    );
    return;
  }

  const ledgerId = payment.notes?.ledgerId;
  if (!ledgerId) {
    res.status(400).json(
      sendError("MISSING_LEDGER_ID", "Missing ledgerId in webhook payload notes")
    );
    return;
  }

  const result = await paymentService.processWebhookPayment({
    gatewayPaymentId: payment.id,
    orderId: payment.order_id,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    method: payment.method,
    ledgerId,
    studentId: payment.notes?.studentId,
    studentName: payment.notes?.studentName,
  });

  if (result.processed) {
    res.json(
      sendSuccess(
        {
          transactionId: result.transactionId,
          ledgerId: result.ledgerId,
          amount: result.amount,
          ledgerStatus: result.ledgerStatus,
        },
        "UPI payment processed successfully"
      )
    );
  } else {
    res.json(
      sendSuccess(
        { received: true, processed: false, reason: result.reason },
        "Webhook received but not processed"
      )
    );
  }
}

// ─── Edge Case 3: refund.processed handler ───────────────────────────────────

async function handleRefundProcessed(
  payload: RazorpayWebhookPayload,
  req: Request,
  res: Response
) {
  const refund = payload.payload?.refund?.entity;
  if (!refund) {
    res.status(400).json(
      sendError("INVALID_PAYLOAD", "Missing refund entity in webhook payload")
    );
    return;
  }

  const ledgerId = refund.notes?.ledgerId;
  if (!ledgerId) {
    res.status(400).json(
      sendError("MISSING_LEDGER_ID", "Missing ledgerId in refund webhook notes")
    );
    return;
  }

  const result = await paymentService.processWebhookRefund({
    gatewayRefundId: refund.id,
    gatewayPaymentId: refund.payment_id,
    amount: refund.amount,
    currency: refund.currency,
    status: refund.status,
    ledgerId,
    studentId: refund.notes?.studentId,
    studentName: refund.notes?.studentName,
  });

  if (result.processed) {
    res.json(
      sendSuccess(
        {
          transactionId: result.transactionId,
          ledgerId: result.ledgerId,
          amount: result.amount,
          ledgerStatus: result.ledgerStatus,
        },
        "Refund processed successfully"
      )
    );
  } else {
    res.json(
      sendSuccess(
        { received: true, processed: false, reason: result.reason },
        "Refund webhook received but not processed"
      )
    );
  }
}
