import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { ReceiptParamsInput } from "./schemas";
import * as receiptService from "./service";

export const downloadReceipt = asyncHandler(
  async (req: Request, res: Response) => {
    const { transactionId } = req.params as ReceiptParamsInput;
    const pdfBuffer = await receiptService.generateReceiptPdf(transactionId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="receipt-${transactionId.substring(0, 8)}.pdf"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);

    res.end(pdfBuffer);
  }
);
