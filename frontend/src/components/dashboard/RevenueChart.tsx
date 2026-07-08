import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { RevenueByFeeType } from "@/types/dashboard";

interface RevenueChartProps {
  data: RevenueByFeeType[] | undefined;
  isLoading: boolean;
}

const COLORS = [
  "url(#gradientIndigo)",
  "url(#gradientEmerald)",
  "url(#gradientAmber)",
  "url(#gradientRose)",
  "url(#gradientPurple)",
  "url(#gradientCyan)",
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

interface TooltipPayload {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: RevenueByFeeType;
  }>;
}

function CustomTooltip({ active, payload }: TooltipPayload) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="glass-card rounded-xl p-4 shadow-xl border border-white/60">
        <p className="font-bold text-slate-900">{data.feeTypeName}</p>
        <p className="text-sm text-slate-600 mt-1">
          <span className="font-semibold text-indigo-600">{formatCurrency(data.totalAmount)}</span>
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {data.ledgerCount} ledger{data.ledgerCount !== 1 ? 's' : ''}
        </p>
      </div>
    );
  }
  return null;
}

export function RevenueChart({ data, isLoading }: RevenueChartProps) {
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Revenue by Fee Type</h3>
          <p className="text-sm text-slate-500 mt-0.5">Total collection breakdown</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
      </div>

      {isLoading ? (
        <div className="h-[300px] bg-slate-100/50 animate-pulse rounded-xl" />
      ) : !data || data.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-slate-400">
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-sm font-medium">No revenue data available</p>
          </div>
        </div>
      ) : (
        <div className="bg-white/50 rounded-xl p-4 border border-slate-100">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradientIndigo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
                <linearGradient id="gradientEmerald" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
                <linearGradient id="gradientAmber" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
                <linearGradient id="gradientRose" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fb7185" />
                  <stop offset="100%" stopColor="#f43f5e" />
                </linearGradient>
                <linearGradient id="gradientPurple" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c084fc" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
                <linearGradient id="gradientCyan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="feeTypeName"
                tick={{ fill: "#64748b", fontSize: 12, fontFamily: "DM Sans" }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 12, fontFamily: "DM Sans" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: number) => `₹${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(99, 102, 241, 0.05)" }} />
              <Bar dataKey="totalAmount" radius={[8, 8, 0, 0]} barSize={40}>
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
