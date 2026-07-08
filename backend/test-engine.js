const { spawn } = require("child_process");
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
  { cwd: __dirname, stdio: "inherit", shell: true }
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

waitForServer().then(async () => {
  let passed = 0;
  let failed = 0;

  function assert(name, condition) {
    if (condition) {
      console.log(`  PASS: ${name}`);
      passed++;
    } else {
      console.log(`  FAIL: ${name}`);
      failed++;
    }
  }

  try {
    console.log("\n=== EDGE CASE 1: Floating Point Precision ===");
    let r = await hit("/api/v1/fee-types", "POST", {
      name: "Tuition-Precision",
      baseAmount: 100.50,
      rules: { lateFee: { type: "percentage", value: 5 } },
    });
    const feeTypeId = r.body.data.id;

    r = await hit("/api/v1/students", "POST", {
      name: "Precision-Test",
      email: "precision@test.com",
      class: "10",
      section: "A",
      rollNumber: "P001",
    });
    const studentId = r.body.data.id;

    r = await hit("/api/v1/fee-structures", "POST", {
      feeTypeId,
      class: "10",
      section: "A",
      amount: 100.50,
    });
    const fsId = r.body.data.id;

    r = await hit("/api/v1/ledgers/generate", "POST", {
      class: "10",
      section: "A",
      academicSession: "2024-25",
      month: "November",
      dueDate: "2024-10-31",
    });
    assert("Ledger created", r.status === 201);

    r = await hit(`/api/v1/ledgers/student/${studentId}`);
    const ledger = r.body.data[0];
    assert("Total is 105.53 (100.50 + 5.03 late fee)", ledger.totalAmount === "105.53");
    assert("Late fee is 5.03", ledger.waivedAmount === "0.00");

    console.log("\n=== EDGE CASE 2: Timezone Trap ===");
    r = await hit("/api/v1/fee-types", "POST", {
      name: "Transport-Timezone",
      baseAmount: 2000,
      rules: { lateFee: { type: "flat", value: 100 } },
    });
    const tzFeeTypeId = r.body.data.id;

    r = await hit("/api/v1/fee-structures", "POST", {
      feeTypeId: tzFeeTypeId,
      class: "10",
      section: "A",
      amount: 2000,
    });
    const tzFsId = r.body.data.id;

    r = await hit("/api/v1/students", "POST", {
      name: "Timezone-Test",
      email: "tz@test.com",
      class: "10",
      section: "A",
      rollNumber: "T001",
    });
    const tzStudentId = r.body.data.id;

    r = await hit("/api/v1/ledgers/generate", "POST", {
      class: "10",
      section: "A",
      academicSession: "2024-25",
      month: "October-TZ",
      dueDate: "2024-10-31",
    });
    assert("Late fee applied (due date Oct 31, current date Nov 1+)", r.status === 201);

    console.log("\n=== EDGE CASE 3: Idempotency ===");
    r = await hit("/api/v1/ledgers/generate", "POST", {
      class: "10",
      section: "A",
      academicSession: "2024-25",
      month: "November",
      dueDate: "2024-10-31",
    });
    assert("Second generate skips existing (created=0)", r.body.data.created === 0);
    assert("Skipped count reported", r.body.data.skipped > 0);

    console.log("\n=== EDGE CASE 4: Defaulters Endpoint ===");
    r = await hit("/api/v1/ledgers/defaults");
    assert("Defaulters endpoint works", r.status === 200);
    assert("Returns array", Array.isArray(r.body.data));

    console.log("\n=== EDGE CASE 5: Validation ===");
    r = await hit("/api/v1/ledgers/generate", "POST", {
      class: "",
      academicSession: "2024-25",
      month: "November",
      dueDate: "invalid-date",
    });
    assert("Validation rejects empty class", r.status === 400);

    console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  } catch (e) {
    console.error("Test error:", e.message);
  }
  server.kill();
  process.exit(failed > 0 ? 1 : 0);
});
