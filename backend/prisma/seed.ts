import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import Decimal from "decimal.js";

const prisma = new PrismaClient();

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

function toDecimal(d: Decimal): string {
  return d.toDecimalPlaces(2).toString();
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna",
  "Ishaan", "Shaurya", "Atharv", "Advik", "Pranav", "Advaith", "Aarush",
  "Ananya", "Diya", "Priya", "Aanya", "Aadhya", "Aarohi", "Anvi", "Nisha",
  "Kavya", "Myra", "Saanvi", "Pari", "Riya", "Shruti", "Tanvi",
  "Rohit", "Amit", "Suresh", "Rahul", "Sanjay", "Vikram", "Rajesh", "Anil",
  "Deepak", "Manoj", "Sunita", "Geeta", "Meena", "Rekha", "Sushila",
  "Arun", "Nitin", "Mohan", "Prakash", "Sachin",
];

const LAST_NAMES = [
  "Sharma", "Verma", "Gupta", "Singh", "Kumar", "Das", "Mukherjee", "Joshi",
  "Reddy", "Nair", "Iyer", "Patel", "Mehta", "Jain", "Agarwal",
  "Chatterjee", "Banerjee", "Roy", "Sen", "Ghosh",
];

const SECTIONS = ["A", "B", "C"];
const CLASSES = ["9", "10", "11"];
const PAYMENT_METHODS: Array<"UPI" | "CASH" | "CHEQUE"> = ["UPI", "CASH", "CHEQUE"];

async function main() {
  console.log("🌱 Seeding database...\n");

  // Clear existing data
  console.log("🗑️  Clearing existing data...");
  await prisma.transaction.deleteMany();
  await prisma.studentFeeLedger.deleteMany();
  await prisma.feeStructure.deleteMany();
  await prisma.feeType.deleteMany();
  await prisma.student.deleteMany();
  await prisma.user.deleteMany();

  // ── Users ─────────────────────────────────────────────────────────────────────
  console.log("👤 Creating users...");
  const adminPasswordHash = await bcrypt.hash("admin123", 12);
  const cashierPasswordHash = await bcrypt.hash("cashier123", 12);

  const admin = await prisma.user.create({
    data: {
      email: "admin@school.com",
      passwordHash: adminPasswordHash,
      name: "Admin User",
      role: "ADMIN",
    },
  });

  const cashier = await prisma.user.create({
    data: {
      email: "cashier@school.com",
      passwordHash: cashierPasswordHash,
      name: "Cashier User",
      role: "CASHIER",
    },
  });

  console.log(`   ✅ Admin: ${admin.email}`);
  console.log(`   ✅ Cashier: ${cashier.email}`);

  // ── Fee Types ─────────────────────────────────────────────────────────────────
  console.log("\n💰 Creating fee types...");

  const tuitionFee = await prisma.feeType.create({
    data: {
      name: "Tuition Fee",
      baseAmount: toDecimal(new Decimal(5000)),
      rules: {
        lateFee: { type: "percentage", value: 5 },
        waiver: { type: "flat", value: 500 },
      },
    },
  });

  const transportFee = await prisma.feeType.create({
    data: {
      name: "Transport Fee",
      baseAmount: toDecimal(new Decimal(1500)),
      rules: {
        lateFee: { type: "flat", value: 100 },
        discount: { type: "percentage", value: 10 },
      },
    },
  });

  const labFee = await prisma.feeType.create({
    data: {
      name: "Lab Fee",
      baseAmount: toDecimal(new Decimal(2000)),
      rules: {
        lateFee: { type: "percentage", value: 10 },
        waiver: { type: "flat", value: 200 },
        discount: { type: "percentage", value: 5 },
      },
    },
  });

  console.log(`   ✅ ${tuitionFee.name}: Rs. ${tuitionFee.baseAmount}`);
  console.log(`   ✅ ${transportFee.name}: Rs. ${transportFee.baseAmount}`);
  console.log(`   ✅ ${labFee.name}: Rs. ${labFee.baseAmount}`);

  // ── Fee Structures ────────────────────────────────────────────────────────────
  console.log("\n📋 Creating fee structures...");

  const feeTypes = [tuitionFee, transportFee, labFee];
  const feeStructures = [];

  for (const cls of CLASSES) {
    for (const section of SECTIONS) {
      for (const ft of feeTypes) {
        const baseAmt = new Decimal(ft.baseAmount.toString());
        const amount = baseAmt.plus(randomBetween(-200, 200));

        const fs = await prisma.feeStructure.create({
          data: {
            feeTypeId: ft.id,
            class: cls,
            section,
            amount: toDecimal(amount),
          },
        });
        feeStructures.push(fs);
      }
    }
  }

  console.log(`   ✅ ${feeStructures.length} fee structures created`);

  // ── Students ──────────────────────────────────────────────────────────────────
  console.log("\n📚 Creating students...");

  const students = [];
  const usedNames = new Set<string>();

  for (const cls of CLASSES) {
    for (const section of SECTIONS) {
      const studentsPerSection = cls === "11" ? 5 : 6;

      for (let i = 0; i < studentsPerSection; i++) {
        let firstName: string;
        let lastName: string;
        let fullName: string;

        do {
          firstName = pickRandom(FIRST_NAMES);
          lastName = pickRandom(LAST_NAMES);
          fullName = `${firstName} ${lastName}`;
        } while (usedNames.has(fullName));

        usedNames.add(fullName);

        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${cls}${section.toLowerCase()}@student.school.com`;

        const student = await prisma.student.create({
          data: {
            name: fullName,
            email,
            class: cls,
            section,
            rollNumber: `${cls}${section}${String(i + 1).padStart(2, "0")}`,
          },
        });
        students.push(student);
      }
    }
  }

  console.log(`   ✅ ${students.length} students created`);

  // ── Ledgers & Transactions ────────────────────────────────────────────────────
  console.log("\n📒 Creating ledgers and transactions...");

  let ledgerCount = 0;
  let transactionCount = 0;
  let totalCollected = new Decimal(0);

  // Determine statuses: 30% OVERDUE, 20% PARTIAL, 50% PAID
  const statusDistribution: Array<"OVERDUE" | "PARTIAL" | "PAID"> = [
    ...Array(30).fill("OVERDUE"),
    ...Array(20).fill("PARTIAL"),
    ...Array(50).fill("PAID"),
  ];

  const dueDate = new Date("2026-07-01T00:00:00Z");

  for (const student of students) {
    const studentFeeStructures = feeStructures.filter(
      (fs) => fs.class === student.class && fs.section === student.section
    );

    for (const fs of studentFeeStructures) {
      const baseAmount = new Decimal(fs.amount.toString());
      const waivedAmount = new Decimal(0);
      const totalAmount = baseAmount.minus(waivedAmount);

      const assignedStatus = pickRandom(statusDistribution);

      let paidAmount = new Decimal(0);
      let ledgerStatus: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";

      if (assignedStatus === "PAID") {
        paidAmount = totalAmount;
        ledgerStatus = "PAID";
      } else if (assignedStatus === "PARTIAL") {
        paidAmount = totalAmount.mul(randomBetween(20, 70)).div(100).toDecimalPlaces(2);
        ledgerStatus = "PARTIAL";
      } else {
        // OVERDUE - some partial or zero payment
        if (Math.random() > 0.5) {
          paidAmount = totalAmount.mul(randomBetween(10, 40)).div(100).toDecimalPlaces(2);
        }
        ledgerStatus = "OVERDUE";
      }

      const ledger = await prisma.studentFeeLedger.create({
        data: {
          studentId: student.id,
          feeStructureId: fs.id,
          totalAmount: toDecimal(totalAmount),
          waivedAmount: toDecimal(waivedAmount),
          paidAmount: toDecimal(paidAmount),
          dueDate,
          status: ledgerStatus,
        },
      });

      ledgerCount++;

      // Create transactions for PAID and PARTIAL ledgers
      if (paidAmount.gt(0)) {
        const txnCount = Math.random() > 0.6 ? 2 : 1;
        let remaining = new Decimal(paidAmount);

        for (let t = 0; t < txnCount && remaining.gt(0); t++) {
          const isLast = t === txnCount - 1;
          const txnAmount = isLast ? remaining : remaining.mul(randomBetween(30, 70)).div(100).toDecimalPlaces(2);

          if (txnAmount.lte(0)) continue;

          const createdAt = new Date(dueDate);
          createdAt.setDate(createdAt.getDate() - randomBetween(0, 15));

          await prisma.transaction.create({
            data: {
              ledgerId: ledger.id,
              amount: toDecimal(txnAmount),
              paymentMethod: pickRandom(PAYMENT_METHODS),
              status: "SUCCESS",
              createdAt,
            },
          });

          totalCollected = totalCollected.plus(txnAmount);
          transactionCount++;
          remaining = remaining.minus(txnAmount);
        }
      }
    }
  }

  console.log(`   ✅ ${ledgerCount} ledgers created`);
  console.log(`   ✅ ${transactionCount} transactions created`);
  console.log(`   ✅ Total collected: Rs. ${totalCollected.toDecimalPlaces(2)}`);

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(50));
  console.log("🎉 Seeding complete!");
  console.log("═".repeat(50));
  console.log(`\n📊 Summary:`);
  console.log(`   Users:      2 (1 Admin, 1 Cashier)`);
  console.log(`   Fee Types:  3`);
  console.log(`   Structures: ${feeStructures.length}`);
  console.log(`   Students:   ${students.length}`);
  console.log(`   Ledgers:    ${ledgerCount}`);
  console.log(`   Transactions: ${transactionCount}`);
  console.log(`\n🔑 Login Credentials:`);
  console.log(`   Admin:   admin@school.com / admin123`);
  console.log(`   Cashier: cashier@school.com / cashier123`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
