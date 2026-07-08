import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess, sendError } from "@/utils/apiResponse";
import { ValidationError } from "@/lib/errors";
import * as transactionService from "@/services/transactionService";

const UPIWebhookSchema = z.object({
  event: z.string(),
  payload: z.object({
    payment: z.object({
      entity: z.object({
        id: z.string(),
        amount: z.number(),
        currency: z.string(),
        status: z.string(),
        method: z.string(),
        notes: z.object({
          ledgerId: z.string().optional(),
        }).optional(),
      }),
    }),
  }),
});

export const handleUPIWebhook = asyncHandler(
  async (req: Request, res: Response) => {
    const webhookData = UPIWebhookSchema.parse(req.body);

    const { payload } = webhookData;
    const payment = payload.payment.entity;

    if (payment.status !== "captured") {
      res.json(
        sendSuccess(
          { received: true, processed: false },
          "Webhook received but payment not captured"
        )
      );
      return;
    }

    const ledgerId = payment.notes?.ledgerId;
    if (!ledgerId) {
      throw new ValidationError("Missing ledgerId in webhook payload notes");
    }

    const amountInRupees = payment.amount / 100;

    const result = await transactionService.recordSinglePayment({
      ledgerId,
      amount: amountInRupees,
      paymentMethod: "UPI",
      transactionRef: payment.id,
    });

    res.json(
      sendSuccess(
        {
          transactionId: result.transaction.id,
          ledgerId: result.ledger.id,
          amount: amountInRupees,
          status: result.ledger.status,
        },
        "UPI payment processed"
      )
    );
  }
);
