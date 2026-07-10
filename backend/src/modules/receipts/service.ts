import PDFDocument from "pdfkit";
import Decimal from "decimal.js";
import { Transaction, StudentFeeLedger, Student, FeeStructure, FeeType } from "@/models";
import { NotFoundError } from "@/lib/errors";

const SCHOOL_NAME = "SmartSchool Academy";
const SCHOOL_ADDRESS = "123 Education Lane, Knowledge City, IN 400001";
const SCHOOL_PHONE = "+91 22 2345 6789";

function formatCurrency(amount: Decimal): string {
  return `Rs. ${amount.toDecimalPlaces(2).toString()}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export async function generateReceiptPdf(transactionId: string): Promise<Buffer> {
  const transaction = await Transaction.findById(transactionId)
    .populate({
      path: "ledgerId",
      populate: [
        { path: "studentId" },
        { path: "feeStructureId", populate: { path: "feeTypeId" } },
      ],
    });

  if (!transaction) throw new NotFoundError("Transaction", transactionId);

  const ledger = transaction.ledgerId as any;
  const student = ledger.studentId;
  const feeStructure = ledger.feeStructureId;
  const feeType = feeStructure.feeTypeId;

  const baseAmount = new Decimal(feeStructure.amount);
  const totalAmount = new Decimal(ledger.totalAmount);
  const waivedAmount = new Decimal(ledger.waivedAmount);
  const lateFee = totalAmount.minus(baseAmount).plus(waivedAmount);
  const paidAmount = new Decimal(transaction.amount);

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).font("Helvetica-Bold").text(SCHOOL_NAME, { align: "center" })
      .fontSize(9).font("Helvetica").text(SCHOOL_ADDRESS, { align: "center" })
      .text(SCHOOL_PHONE, { align: "center" }).moveDown(0.5);

    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#c2410c").lineWidth(2).stroke().moveDown(1);

    doc.fontSize(16).font("Helvetica-Bold").text("FEE PAYMENT RECEIPT", { align: "center" }).moveDown(0.5);

    const infoY = doc.y;
    doc.fontSize(10).font("Helvetica-Bold").text("Receipt No:", 50, infoY)
      .font("Helvetica").text(transaction._id.toString().substring(0, 8).toUpperCase(), 140, infoY)
      .font("Helvetica-Bold").text("Date:", 350, infoY)
      .font("Helvetica").text(formatDate(new Date(transaction.createdAt)), 400, infoY).moveDown(1.2);

    doc.fontSize(11).font("Helvetica-Bold").fillColor("#c2410c").text("STUDENT DETAILS", 50, doc.y)
      .fillColor("#000000").moveDown(0.3);

    const detailY = doc.y;
    doc.fontSize(10).font("Helvetica-Bold").text("Name:", 50, detailY)
      .font("Helvetica").text(student.name, 140, detailY)
      .font("Helvetica-Bold").text("Class:", 350, detailY)
      .font("Helvetica").text(`${student.class} - ${student.section}`, 400, detailY);

    doc.font("Helvetica-Bold").text("Roll No:", 50, detailY + 18)
      .font("Helvetica").text(student.rollNumber, 140, detailY + 18)
      .font("Helvetica-Bold").text("Email:", 350, detailY + 18)
      .font("Helvetica").text(student.email, 400, detailY + 18);

    doc.y = detailY + 45;
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#c2410c").text("FEE DETAILS", 50, doc.y)
      .fillColor("#000000").moveDown(0.3);

    const tableTop = doc.y;
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#f5f5f4").rect(50, tableTop - 4, 495, 20).fill()
      .fillColor("#000000").text("Description", 58, tableTop).text("Fee Type", 300, tableTop).text("Amount", 440, tableTop, { width: 105, align: "right" });
    doc.y = tableTop + 22;

    const rows: Array<[string, string, string]> = [["Base Amount", feeType.name, formatCurrency(baseAmount)]];
    if (waivedAmount.gt(0)) rows.push(["Waiver", "", `(-) ${formatCurrency(waivedAmount)}`]);
    if (lateFee.gt(0)) rows.push(["Late Fee", "", `(+) ${formatCurrency(lateFee)}`]);
    rows.push(["Total Paid", "", formatCurrency(paidAmount)]);

    for (const [desc, type, amt] of rows) {
      const rowY = doc.y;
      doc.fontSize(10).font("Helvetica").text(desc, 58, rowY).text(type, 300, rowY).text(amt, 440, rowY, { width: 105, align: "right" });
      doc.y = rowY + 20;
    }

    doc.moveTo(50, doc.y - 4).lineTo(545, doc.y - 4).strokeColor("#000000").lineWidth(1).stroke();
    doc.fontSize(11).font("Helvetica-Bold").text("Total Paid:", 58, doc.y + 4)
      .text(formatCurrency(paidAmount), 440, doc.y - 16, { width: 105, align: "right" });
    doc.y += 20;

    doc.fontSize(10).font("Helvetica-Bold").text("Payment Method: ", 50, doc.y)
      .font("Helvetica").text(transaction.paymentMethod, 165, doc.y);

    doc.y = 580;
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#e7e5e4").lineWidth(1).stroke().moveDown(1);
    doc.fontSize(10).font("Helvetica").text("Authorized Signature", 50, doc.y + 30, { width: 200, align: "center" })
      .text("School Stamp", 350, doc.y + 30, { width: 200, align: "center" });

    doc.fontSize(8).font("Helvetica").fillColor("#a8a29e")
      .text("This is a computer-generated receipt. No signature is required.", 50, 720, { align: "center", width: 495 })
      .text(`Generated on ${formatDate(new Date())} | ${SCHOOL_NAME}`, 50, 732, { align: "center", width: 495 });

    doc.end();
  });
}
