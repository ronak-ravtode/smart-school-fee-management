# SmartSchoolFee — Demo Script & Pitch Outline

---

## Part 1: The Pitch (60 seconds)

### The Hook (15 seconds)

> "Every month, 20,000 schools across India collect fees the same way they did 30 years ago — paper receipts, Excel spreadsheets, and a prayer that the numbers add up. A single school with 1,500 students generates 18,000 transactions a year. That's 18,000 chances for a manual error, a lost receipt, or a parent dispute."

### The Problem (15 seconds)

> "The result? Schools spend 40% of their administrative time reconciling fees. Parents argue over hidden charges. And principals have zero real-time visibility into cash flow. Existing solutions are either expensive ERMs that cost lakhs per year, or glorified spreadsheets that break the moment a student gets a discount."

### The Solution (30 seconds)

> "SmartSchoolFee is a production-grade FinTech engine built specifically for school fee management. It's not a spreadsheet — it's a full-stack application with role-based access control, PDF receipts with cryptographic precision, and a dynamic fee engine that handles any fee structure a school can imagine. We built it with the same stack used by payment companies: decimal.js for math, JWT auth with HttpOnly cookies, and a React frontend with TanStack Query for real-time data. It's deployable in 10 minutes on Vercel and Render, and it handles the messy reality of school finance — offline mode, bulk reconciliation, and defaulter tracking — out of the box."

---

## Part 2: The Live Demo (2 min 30 sec)

### Pre-Demo Setup

- Open the app in a browser with two tabs: Admin view and Cashier view (if possible, use two laptops)
- Have Postman ready for a quick API verification mid-demo
- Pre-load the demo database with the seeder (run `npx ts-node -r tsconfig-paths/register prisma/seed.ts`)

---

### Scene 1: The Dashboard (25 seconds)

**[Say this while navigating]**

> "This is the command center. A principal opens this at 8 AM and instantly sees: total collected this month, outstanding balances, and a defaulter heatmap. Every card uses Material Design 3 tokens with proper elevation."

**[Action]**
1. Click on **Dashboard** in the sidebar
2. Point to the summary cards: Total Collected, Outstanding, Students, Defaulters
3. Click on the **Defaulter Tracking** tab
4. Point to the heatmap visualization

> "This heatmap was built with Recharts and a custom gradient scale. Red means more than 30% of a class has outstanding fees. A principal can drill into any class in one click."

---

### Scene 2: Dynamic Fee Engine (30 seconds)

**[Say this while navigating]**

> "Every school has unique fees — transport, lab, sports, cultural. Most systems force you to hardcode these. SmartSchoolFee lets you create any fee type on the fly."

**[Action]**
1. Click **Fee Types** in the sidebar
2. Click **Create Fee Type**
3. Enter: Name = "Annual Sports Day", Category = "EVENT"
4. Toggle **Late Fee** ON → Select "Fixed Amount" → Enter ₹50
5. Toggle **Waiver** ON → Select "Sibling Discount" → Enter 10%
6. Click **Save**

> "Notice the Visual Rule Builder — no JSON, no code. Toggle Late Fee, Waiver, or Discount, pick the type, set the value. The rules are enforced server-side with Zod validation. This fee type is immediately available for any class to opt into."

---

### Scene 3: Bulk Reconciliation (30 seconds)

**[Say this while navigating]**

> "End of month. 200 cash payments need recording. One by one? That's a full day's work. Watch this."

**[Action]**
1. Click **Transactions** → **Bulk Cash Entry**
2. The table loads with 15 pre-filled student rows
3. Tab through 3-4 rows, entering amounts: ₹5,000, ₹3,200, ₹4,500
4. Press **Tab** to move between cells (keyboard navigation)
5. Click **Submit All**

> "Full keyboard navigation — Tab, Shift+Tab, Enter. Every amount validated client-side and server-side with decimal.js. No floating point errors."

---

### Scene 4: PDF Receipt with Math Precision (20 seconds)

**[Say this while navigating]**

> "After every payment, a professional PDF receipt is generated — the kind parents actually keep."

**[Action]**
1. Click on any completed transaction
2. Click **Download Receipt (PDF)**
3. Open the PDF and zoom in on the totals

> "Built with pdfkit — pure JavaScript, no headless browser. Every number uses decimal.js with 2-decimal precision. Subtotal ₹15,000.00, Late Fee ₹50.00, Total ₹15,050.00. No rounding errors. The same precision banks use."

---

### Scene 5: Security & RBAC (25 seconds)

**[Say this while navigating]**

> "A cashier should never create fee types or modify ledgers. This is a compliance requirement."

**[Action]**
1. Log out and log in as `cashier@school.com` / `cashier123`
2. Navigate to **Transactions** — the cashier sees the payment entry screen
3. Show that **Fee Types** and **Fee Structures** are absent from the sidebar
4. Open browser console → paste: `fetch('/api/v1/fee-types', {credentials:'include'}).then(r=>r.json()).then(console.log)`
5. Point to the 403 Forbidden response

> "JWT with HttpOnly cookies — no localStorage, no XSS token theft. The middleware stack is protectRoute → authorizeRoles('ADMIN'). The cashier literally cannot access admin endpoints. Cookies are HttpOnly, Secure, SameSite=Lax."

---

### Scene 6: API Verification (20 seconds)

**[Say this while navigating]**

> "This isn't a mockup. Every feature runs against a real PostgreSQL database with real API calls."

**[Action]**
1. Switch to Postman (or open a new tab)
2. Hit `GET /api/v1/health`
3. Point to the JSON response: `{ status: "OK", uptime: 1234.5, environment: "production" }`
4. Hit `GET /api/v1/dashboard/summary` with the auth cookie
5. Point to the real aggregated data

> "This health endpoint returns uptime and environment — exactly what Render and Railway probe. The dashboard query aggregates 153 transactions and 51 students in a single SQL query. No N+1 loops."

---

## Part 3: Judge Q&A Prep — 5 Hard Questions

---

### Q1: "How do you handle race conditions in offline sync?"

**Answer:**

> "Great question. We use a two-layer approach. First, the client generates a UUID for every offline transaction and stores it with a `createdAt` timestamp in IndexedDB. When the device comes back online, the sync engine sends all pending transactions in chronological order to the `/api/v1/transactions/bulk` endpoint. The backend uses a PostgreSQL transaction with a `SELECT ... FOR UPDATE` on the student's ledger row — this acquires a row-level lock. If two devices submit simultaneously, the second one waits for the first transaction to commit before updating the balance. We also store an `idempotencyKey` on each transaction, so if the same UUID is submitted twice (e.g., network retry), the backend returns the existing record instead of double-crediting. This is the same pattern used by Stripe and Square for offline POS systems."

---

### Q2: "Why did you choose TanStack Query over Redux for state management?"

**Answer:**

> "Redux is excellent for client-side state, but 90% of our state is server state — fee types, students, ledgers, transactions. TanStack Query is purpose-built for server state: it handles caching, background refetching, stale-while-revalidate, and optimistic updates out of the box. For example, when a cashier records a payment, we use `useMutation` with `onMutate` to optimistically update the UI before the server responds, then `onError` to roll back if the request fails. With Redux, we'd have to write all of that manually. For the small amount of truly client-side state — sidebar collapsed, modal open, selected row — we use Zustand, which is 1.5KB and has no boilerplate. It's the right tool for each job."

---

### Q3: "How do you ensure math precision across the entire stack?"

**Answer:**

> "We never use JavaScript floats for money. Period. The entire backend uses `decimal.js` with a precision of 20 digits and ROUND_HALF_UP rounding. Every database column that stores money is `Decimal(12,2)` in Prisma. On the frontend, we display values that the backend has already calculated — we don't recalculate. The PDF receipt generator uses the same `decimal.js` library. The seeder script that populates demo data also uses `decimal.js` — that's why you see exact ₹275,026.27 instead of a floating-point approximation. This is the same approach used by Stripe's internal ledger: store as decimal, calculate as decimal, display as decimal."

---

### Q4: "What's your security model? How does this compare to a real banking app?"

**Answer:**

> "Our security stack mirrors production FinTech applications. First, authentication: JWT tokens stored in HttpOnly cookies with Secure and SameSite=Lax flags — this means JavaScript cannot read the token, so XSS attacks cannot steal it. The cookie is automatically sent with every request, so no `Authorization` header management is needed. Second, authorization: a two-layer middleware stack — `protectRoute` verifies the JWT and attaches the user to the request, `authorizeRoles('ADMIN')` checks the role. Admin-only routes (fee types, structures, ledgers) are double-gated. Third, validation: every endpoint uses Zod schemas — invalid input is rejected before it reaches the database. Fourth, the database: PostgreSQL with Prisma ORM, which parameterizes all queries — no SQL injection. Fifth, HTTPS in production with CORS restricted to the frontend origin. We also use `helmet` for HTTP security headers. This isn't a prototype — it's the same security model used by mid-size payment processors."

---

### Q5: "How would this scale to 50,000 students across multiple branches?"

**Answer:**

> "Three key architectural decisions make this horizontally scalable. First, the database: PostgreSQL with proper indexing on `studentId`, `classId`, and `createdAt`. The defaulter query uses a single aggregated SQL query with GROUP BY — not N+1 JavaScript loops. With proper indexes, this handles 50,000 rows in under 50ms. Second, the backend: it's a stateless Express server. Every request is authenticated via JWT — no session state in memory. This means you can run 10 instances behind a load balancer with zero coordination. Third, the frontend: TanStack Query caches server responses with configurable stale times. The dashboard data is cached for 60 seconds — a principal refreshing the page doesn't hit the database. For multi-branch schools, we'd add a `branchId` foreign key to every table and filter all queries by branch. The fee structure already maps fee types to classes — extending to branches is a one-line schema change. We'd also add Redis for session caching and a background job queue (Bull/BullMQ) for PDF generation at scale."

---

## Appendix: Technical Architecture

### Backend Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | Node.js + Express | Fast, TypeScript-native, huge ecosystem |
| Auth | JWT + HttpOnly cookies | XSS-proof, stateless, production-grade |
| Validation | Zod | Type-safe input validation |
| ORM | Prisma | Type-safe queries, migrations, introspection |
| Database | PostgreSQL | ACID compliance, Decimal support |
| Math | decimal.js | 20-digit precision, no float errors |
| PDF | pdfkit | Pure JS, no headless browser needed |

### Frontend Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | React 19 | Component model, ecosystem |
| Build | Vite | Fast dev, optimized builds |
| Styling | Tailwind CSS 4 | Utility-first, consistent design |
| Components | shadcn/ui + Radix | Accessible, composable |
| Server State | TanStack Query | Caching, optimistic updates |
| Client State | Zustand | Minimal, no boilerplate |
| Charts | Recharts | Declarative, responsive |
| Routing | React Router v7 | Nested routes, lazy loading |

### Security Model

```
Request → CORS → Helmet → Cookie Parser → protectRoute (JWT verify)
       → authorizeRoles (role check) → Zod validation → Controller → Prisma
```

### Database Schema (Key Tables)

```
User ─────┬──── FeeType ──── FeeStructure
          │
Student ──┼──── Ledger ──── Transaction
          │
          └──── AuditLog
```

### Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `JWT_SECRET` | Token signing key | 64-char random string |
| `CORS_ORIGIN` | Allowed frontend origin | `https://app.vercel.app` |
| `VITE_API_BASE_URL` | Backend API URL (frontend) | `https://api.render.com/api/v1` |
| `NODE_ENV` | Environment mode | `production` |
