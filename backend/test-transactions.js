const { spawn, execSync } = require("child_process");
const http = require("http");

function hit(path, method = "GET", body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "localhost",
      port: 5000,
      path,
      method,
      headers: { "Content-Type": "application/json" },
    };
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const server = spawn(
  "npx",
  ["ts-node", "-r", "tsconfig-paths/register", "src/index.ts"],
  { cwd: __dirname, stdio: "pipe", shell: true }
);

function waitForServer() {
  return new Promise((resolve) => {
    const check = async () => {
      try {
        await hit("/api/v1/health");
        resolve();
      } catch {
        setTimeout(check, 500);
      }
    };
    check();
  });
}

function killServer() {
  try {
    server.kill("SIGTERM");
    execSync("taskkill /F /IM node.exe /T 2>nul", { stdio: "pipe" });
  } catch {}
}

async function run() {
  let passed = 0;
  let failed = 0;
  function assert(name, condition, detail) {
    if (condition) {
      console.log(`  PASS: ${name}`);
      passed++;
    } else {
      console.log(`  FAIL: ${name}${detail ? ` — got: ${detail}` : ""}`);
      failed++;
    }
  }

  try {
    await waitForServer();
    console.log("Server ready\n");

    // Setup: create student, fee type, fee structure, generate ledger
    console.log("=== SETUP ===");
    let r = await hit("/api/v1/students", "POST", {
      name: "PayTest", email: "pay@test.com",
      class: "PAY", section: "A", rollNumber: "PT001",
    });
    const studentId = r.body.data.id;

    r = await hit("/api/v1/fee-types", "POST", {
      name: "PayFee", baseAmount: 1000,
    });
    const feeTypeId = r.body.data.id;

    r = await hit("/api/v1/fee-structures", "POST", {
      feeTypeId, class: "PAY", section: "A", amount: 1000,
    });

    r = await hit("/api/v1/ledgers/generate", "POST", {
      class: "PAY", section: "A",
      academicSession: "2024-25", month: "Dec",
      dueDate: "2024-12-31",
    });

    r = await hit(`/api/v1/ledgers/student/${studentId}`);
    const ledger = r.body.data.find(l => l.feeStructure.feeType.name === "PayFee");
    const ledgerId = ledger.id;
    console.log(`  Ledger: ${ledgerId}, total: ${ledger.totalAmount}, status: ${ledger.status}`);

    // ─── EDGE CASE 1: Partial Payment Lifecycle ───────────────────────
    console.log("\n=== EDGE CASE 1: Partial Payment Lifecycle ===");

    r = await hit("/api/v1/transactions/pay", "POST", {
      ledgerId, amount: 400, paymentMethod: "CASH",
    });
    assert("Payment 1 (400) succeeds", r.status === 201);
    assert("paidAmount is 400", r.body.data.ledger.paidAmount === "400", r.body.data.ledger.paidAmount);
    assert("status is PARTIAL", r.body.data.ledger.status === "PARTIAL", r.body.data.ledger.status);

    r = await hit("/api/v1/transactions/pay", "POST", {
      ledgerId, amount: 600, paymentMethod: "CASH",
    });
    assert("Payment 2 (600) succeeds", r.status === 201);
    assert("paidAmount is 1000", r.body.data.ledger.paidAmount === "1000", r.body.data.ledger.paidAmount);
    assert("status is PAID", r.body.data.ledger.status === "PAID", r.body.data.ledger.status);

    // ─── EDGE CASE 2: Overpayment Block ───────────────────────────────
    console.log("\n=== EDGE CASE 2: Overpayment Block ===");

    r = await hit("/api/v1/transactions/pay", "POST", {
      ledgerId, amount: 100, paymentMethod: "CASH",
    });
    assert("Overpayment rejected with 400", r.status === 400, r.status);
    assert("Error message mentions remaining balance", r.body.error?.message?.includes("exceeds remaining"), r.body.error?.message);

    // ─── EDGE CASE 3: Bulk Reconciliation Rollback ────────────────────
    console.log("\n=== EDGE CASE 3: Bulk Reconciliation Rollback ===");

    // Setup 3 ledgers for bulk test
    r = await hit("/api/v1/students", "POST", {
      name: "Bulk1", email: "bulk1@test.com",
      class: "BULK", section: "A", rollNumber: "B001",
    });
    const s1 = r.body.data.id;
    r = await hit("/api/v1/students", "POST", {
      name: "Bulk2", email: "bulk2@test.com",
      class: "BULK", section: "A", rollNumber: "B002",
    });
    const s2 = r.body.data.id;
    r = await hit("/api/v1/students", "POST", {
      name: "Bulk3", email: "bulk3@test.com",
      class: "BULK", section: "A", rollNumber: "B003",
    });
    const s3 = r.body.data.id;

    r = await hit("/api/v1/fee-types", "POST", {
      name: "BulkFee", baseAmount: 500,
    });
    const bulkFtId = r.body.data.id;

    r = await hit("/api/v1/fee-structures", "POST", {
      feeTypeId: bulkFtId, class: "BULK", section: "A", amount: 500,
    });

    r = await hit("/api/v1/ledgers/generate", "POST", {
      class: "BULK", section: "A",
      academicSession: "2024-25", month: "Dec",
      dueDate: "2024-12-31",
    });

    const l1 = (await hit(`/api/v1/ledgers/student/${s1}`)).body.data.find(l => l.feeStructure.feeType.name === "BulkFee");
    const l2 = (await hit(`/api/v1/ledgers/student/${s2}`)).body.data.find(l => l.feeStructure.feeType.name === "BulkFee");
    const l3 = (await hit(`/api/v1/ledgers/student/${s3}`)).body.data.find(l => l.feeStructure.feeType.name === "BulkFee");

    r = await hit("/api/v1/transactions/bulk-reconcile", "POST", {
      payments: [
        { ledgerId: l1.id, amount: 500, paymentMethod: "CASH", receiptNumber: "R001" },
        { ledgerId: l2.id, amount: 99999, paymentMethod: "CASH", receiptNumber: "R002" },
        { ledgerId: l3.id, amount: 500, paymentMethod: "CASH", receiptNumber: "R003" },
      ],
    });
    assert("Bulk rejected with 400", r.status === 400, r.status);
    assert("Error mentions index", r.body.error?.message?.includes("index"), r.body.error?.message);

    // Verify NO transactions were created
    const l1After = (await hit(`/api/v1/ledgers/student/${s1}`)).body.data.find(l => l.feeStructure.feeType.name === "BulkFee");
    const l2After = (await hit(`/api/v1/ledgers/student/${s2}`)).body.data.find(l => l.feeStructure.feeType.name === "BulkFee");
    const l3After = (await hit(`/api/v1/ledgers/student/${s3}`)).body.data.find(l => l.feeStructure.feeType.name === "BulkFee");
    assert("Ledger 1 still has 0 paid (rollback worked)", l1After.paidAmount === "0", l1After.paidAmount);
    assert("Ledger 2 still has 0 paid (rollback worked)", l2After.paidAmount === "0", l2After.paidAmount);
    assert("Ledger 3 still has 0 paid (rollback worked)", l3After.paidAmount === "0", l3After.paidAmount);

    // ─── EDGE CASE 4: Zero/Negative Payment Trap ──────────────────────
    console.log("\n=== EDGE CASE 4: Zero/Negative Payment Trap ===");

    r = await hit("/api/v1/transactions/pay", "POST", {
      ledgerId: l1.id, amount: 0, paymentMethod: "CASH",
    });
    assert("Zero payment rejected with 400", r.status === 400, r.status);

    r = await hit("/api/v1/transactions/pay", "POST", {
      ledgerId: l1.id, amount: -50, paymentMethod: "CASH",
    });
    assert("Negative payment rejected with 400", r.status === 400, r.status);

    console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    killServer();
    process.exit(failed > 0 ? 1 : 0);
  }
}

run();
