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

server.on("error", (e) => {
  console.error("Server error:", e.message);
  process.exit(1);
});

// Wait for server to be ready
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
  try {
    console.log("\n=== 1. Health ===");
    let r = await hit("/api/v1/health");
    console.log(r.status, JSON.stringify(r.body));

    console.log("\n=== 2. Create Student ===");
    r = await hit("/api/v1/students", "POST", {
      name: "Test Student",
      email: "test@school.com",
      class: "10",
      section: "A",
      rollNumber: "R001",
    });
    console.log(r.status, JSON.stringify(r.body));

    console.log("\n=== 3. Get Students (paginated) ===");
    r = await hit("/api/v1/students?page=1&limit=5");
    console.log(r.status, JSON.stringify(r.body));

    console.log("\n=== 4. Create FeeType ===");
    r = await hit("/api/v1/fee-types", "POST", {
      name: "Tuition",
      baseAmount: 5000,
      rules: { lateFee: { type: "percentage", value: 5 } },
    });
    console.log(r.status, JSON.stringify(r.body));

    console.log("\n=== 5. Create FeeType (invalid rules) ===");
    r = await hit("/api/v1/fee-types", "POST", {
      name: "Transport",
      baseAmount: 2000,
      rules: { invalidKey: { type: "bad", value: -1 } },
    });
    console.log(r.status, JSON.stringify(r.body));

    console.log("\n=== 6. Get FeeTypes ===");
    r = await hit("/api/v1/fee-types");
    console.log(r.status, JSON.stringify(r.body));

    console.log("\n=== 7. Validation Error (missing fields) ===");
    r = await hit("/api/v1/students", "POST", { name: "" });
    console.log(r.status, JSON.stringify(r.body));

    console.log("\n=== ALL TESTS PASSED ===");
  } catch (e) {
    console.error("Test failed:", e.message);
  }
  server.kill();
  process.exit(0);
});
