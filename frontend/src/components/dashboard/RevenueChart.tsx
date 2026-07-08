import { useState } from "react";
import type { RevenueByFeeType } from "@/types/dashboard";

interface RevenueChartProps {
  data: RevenueByFeeType[] | undefined;
  isLoading: boolean;
}

const BAR_COLORS: Record<string, string> = {
  Transport: "#D97706",
  FinTransport: "#D97706",
  Library: "#F59E0B",
  default: "rgba(217, 119, 6, 0.6)",
  low: "rgba(217, 119, 6, 0.35)",
};

function getBarColor(name: string, index: number): string {
  if (BAR_COLORS[name]) return BAR_COLORS[name];
  if (index < 2) return BAR_COLORS.Transport;
  if (index === 2) return BAR_COLORS.Library;
  if (index < 5) return BAR_COLORS.default;
  return BAR_COLORS.low;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function RevenueChart({ data, isLoading }: RevenueChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartHeight = 240;
  const maxValue = data && data.length > 0 ? Math.max(...data.map((d) => d.totalAmount)) : 1;

  return (
    <div className="paper-stack p-8 rounded-lg h-full animate-fade-slide-up" style={{ animationDelay: "320ms" }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <div>
          <h4 className="text-2xl font-bold text-on-surface" style={{ fontFamily: "Crimson Text" }}>
            Revenue by Fee Type
          </h4>
          <p className="text-on-surface-variant text-sm font-medium">
            Total collection breakdown by category
          </p>
        </div>
        <button className="bg-stone-100 p-2 rounded-lg hover:bg-primary hover:text-white transition-all">
          <span className="material-symbols-outlined">bar_chart</span>
        </button>
      </div>

      {/* Chart */}
      {isLoading ? (
        <div className="bg-stone-100 animate-pulse rounded-lg" style={{ height: chartHeight }} />
      ) : !data || data.length === 0 ? (
        <div className="flex items-center justify-center" style={{ height: chartHeight }}>
          <div className="text-center">
            <span className="material-symbols-outlined text-5xl text-stone-300 mb-3">bar_chart</span>
            <p className="text-sm font-medium text-stone-500">No revenue data available</p>
          </div>
        </div>
      ) : (
        <div>
          {/* Y-axis labels + Chart area */}
          <div className="flex">
            {/* Y-axis */}
            <div className="flex flex-col justify-between pr-3" style={{ height: chartHeight }}>
              <span className="text-[10px] text-stone-400 font-medium">{formatCurrency(maxValue)}</span>
              <span className="text-[10px] text-stone-400 font-medium">{formatCurrency(maxValue * 0.75)}</span>
              <span className="text-[10px] text-stone-400 font-medium">{formatCurrency(maxValue * 0.5)}</span>
              <span className="text-[10px] text-stone-400 font-medium">{formatCurrency(maxValue * 0.25)}</span>
              <span className="text-[10px] text-stone-400 font-medium">₹0</span>
            </div>

            {/* Chart bars */}
            <div className="flex-1 relative" style={{ height: chartHeight }}>
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
                <div
                  key={pct}
                  className="absolute left-0 right-0 border-t border-stone-200/60"
                  style={{ bottom: `${pct * 100}%` }}
                />
              ))}

              {/* Bars */}
              <div className="absolute inset-0 flex items-end justify-around" style={{ paddingBottom: 0 }}>
                {data.map((item, index) => {
                  const barHeightPx = maxValue > 0 ? (item.totalAmount / maxValue) * chartHeight : 0;
                  const isHovered = hoveredIndex === index;

                  return (
                    <div
                      key={item.feeTypeName}
                      className="flex flex-col items-center"
                      style={{ width: 64 }}
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      {/* Tooltip */}
                      {isHovered && (
                        <div
                          className="absolute left-1/2 -translate-x-1/2 bg-stone-800 text-white text-[11px] font-medium py-1.5 px-3 rounded shadow-lg whitespace-nowrap z-10"
                          style={{ bottom: barHeightPx + 8 }}
                        >
                          {formatCurrency(item.totalAmount)}
                        </div>
                      )}

                      {/* Bar */}
                      <div
                        className="w-10 rounded-t-md cursor-pointer transition-opacity"
                        style={{
                          height: Math.max(barHeightPx, 4),
                          backgroundColor: getBarColor(item.feeTypeName, index),
                          opacity: isHovered ? 1 : 0.9,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* X-axis labels */}
          <div className="flex justify-around mt-3">
            {data.map((item, index) => (
              <div key={item.feeTypeName} className="text-center" style={{ width: 64 }}>
                <p className="text-[9px] font-bold text-stone-400 uppercase leading-tight truncate">
                  {item.feeTypeName}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
