import PDFDocument from "pdfkit";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";

const SCHOOL_NAME = "SmartSchool Academy";
const SCHOOL_ADDRESS = "123 Education Lane, Knowledge City, IN 400001";
const SCHOOL_PHONE = "+91 22 2345 6789";

function formatCurrency(amount: Decimal): string {
  return `Rs. ${amount.toDecimalPlaces(2).toString()}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export async function generateReceiptPdf(
  transactionId: string
): Promise<Buffer> {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      ledger: {
        include: {
          student: true,
          feeStructure: {
            include: { feeType: true },
          },
        },
      },
    },
  });

  if (!transaction) {
    throw new NotFoundError("Transaction", transactionId);
  }

  const { ledger } = transaction;
  const { student, feeStructure } = ledger;
  const feeType = feeStructure.feeType;

  const baseAmount = new Decimal(feeStructure.amount.toString());
  const totalAmount = new Decimal(ledger.totalAmount.toString());
  const waivedAmount = new Decimal(ledger.waivedAmount.toString());
  const lateFee = totalAmount.minus(baseAmount).plus(waivedAmount);
  const paidAmount = new Decimal(transaction.amount.toString());

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Header ──────────────────────────────────────────────
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text(SCHOOL_NAME, { align: "center" })
      .fontSize(9)
      .font("Helvetica")
      .text(SCHOOL_ADDRESS, { align: "center" })
      .text(SCHOOL_PHONE, { align: "center" })
      .moveDown(0.5);

    // Divider
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor("#c2410c")
      .lineWidth(2)
      .stroke()
      .moveDown(1);

    // ── Receipt Title ───────────────────────────────────────
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("FEE PAYMENT RECEIPT", { align: "center" })
      .moveDown(0.5);

    // ── Receipt Info ────────────────────────────────────────
    const infoY = doc.y;
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Receipt No:", 50, infoY)
      .font("Helvetica")
      .text(transaction.id.substring(0, 8).toUpperCase(), 140, infoY)
      .font("Helvetica-Bold")
      .text("Date:", 350, infoY)
      .font("Helvetica")
      .text(formatDate(transaction.createdAt), 400, infoY)
      .moveDown(1.2);

    // ── Student Details ─────────────────────────────────────
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor("#c2410c")
      .text("STUDENT DETAILS", 50, doc.y)
      .fillColor("#000000")
      .moveDown(0.3);

    const detailY = doc.y;
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Name:", 50, detailY)
      .font("Helvetica")
      .text(student.name, 140, detailY)
      .font("Helvetica-Bold")
      .text("Class:", 350, detailY)
      .font("Helvetica")
      .text(`${student.class} - ${student.section}`, 400, detailY);

    doc
      .font("Helvetica-Bold")
      .text("Roll No:", 50, detailY + 18)
      .font("Helvetica")
      .text(student.rollNumber, 140, detailY + 18)
      .font("Helvetica-Bold")
      .text("Email:", 350, detailY + 18)
      .font("Helvetica")
      .text(student.email, 400, detailY + 18);

    doc.y = detailY + 45;

    // ── Fee Details ─────────────────────────────────────────
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor("#c2410c")
      .text("FEE DETAILS", 50, doc.y)
      .fillColor("#000000")
      .moveDown(0.3);

    const tableTop = doc.y;
    const col1 = 50;
    const col2 = 300;
    const col3 = 440;

    // Table header
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#f5f5f4")
      .rect(col1, tableTop - 4, 495, 20)
      .fill()
      .fillColor("#000000")
      .text("Description", col1 + 8, tableTop)
      .text("Fee Type", col2, tableTop)
      .text("Amount", col3, tableTop, { width: 105, align: "right" });

    doc.y = tableTop + 22;

    // Table rows
    const rows: Array<[string, string, string]> = [
      ["Base Amount", feeType.name, formatCurrency(baseAmount)],
    ];

    if (waivedAmount.gt(0)) {
      rows.push(["Waiver", "", `(-) ${formatCurrency(waivedAmount)}`]);
    }

    if (lateFee.gt(0)) {
      rows.push(["Late Fee", "", `(+) ${formatCurrency(lateFee)}`]);
    }

    rows.push(["Total Paid", "", formatCurrency(paidAmount)]);

    for (const [desc, type, amt] of rows) {
      const rowY = doc.y;
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(desc, col1 + 8, rowY)
        .text(type, col2, rowY)
        .text(amt, col3, rowY, { width: 105, align: "right" });
      doc.y = rowY + 20;
    }

    // Total line
    doc
      .moveTo(col1, doc.y - 4)
      .lineTo(col1 + 495, doc.y - 4)
      .strokeColor("#000000")
      .lineWidth(1)
      .stroke();

    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .text("Total Paid:", col1 + 8, doc.y + 4)
      .text(formatCurrency(paidAmount), col3, doc.y - 16, {
        width: 105,
        align: "right",
      });

    doc.y += 20;

    // ── Payment Method ──────────────────────────────────────
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Payment Method: ", 50, doc.y)
      .font("Helvetica")
      .text(transaction.paymentMethod, 165, doc.y);

    if (transaction.receiptNumber) {
      doc
        .font("Helvetica-Bold")
        .text("Cheque/Ref No: ", 350, doc.y)
        .font("Helvetica")
        .text(transaction.receiptNumber, 455, doc.y);
    }

    doc.y += 30;

    // ── Signature Section ───────────────────────────────────
    doc.y = 580;
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor("#e7e5e4")
      .lineWidth(1)
      .stroke()
      .moveDown(1);

    doc
      .fontSize(10)
      .font("Helvetica")
      .text("Authorized Signature", 50, doc.y + 30, {
        width: 200,
        align: "center",
      })
      .text("School Stamp", 350, doc.y + 30, {
        width: 200,
        align: "center",
      });

    // Signature lines
    doc
      .moveTo(80, doc.y + 25)
      .lineTo(220, doc.y + 25)
      .strokeColor("#a8a29e")
      .lineWidth(0.5)
      .stroke()
      .moveTo(380, doc.y + 25)
      .lineTo(520, doc.y + 25)
      .stroke();

    // ── Footer ──────────────────────────────────────────────
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#a8a29e")
      .text(
        "This is a computer-generated receipt. No signature is required.",
        50,
        720,
        { align: "center", width: 495 }
      )
      .text(
        `Generated on ${formatDate(new Date())} | ${SCHOOL_NAME}`,
        50,
        732,
        { align: "center", width: 495 }
      );

    doc.end();
  });
}
