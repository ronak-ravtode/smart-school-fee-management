import { useState } from "react";
import type { RevenueTimelinePoint } from "@/types/dashboard";

interface RevenueChartProps {
  data: RevenueTimelinePoint[] | undefined;
  isLoading: boolean;
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
  const [showSeasonalityInfo, setShowSeasonalityInfo] = useState(false);

  const chartHeight = 240;
  const maxValue = data && data.length > 0 ? Math.max(...data.map((d) => d.collected)) : 1;

  // Edge Case 4: Zero data empty state
  if (!isLoading && (!data || data.length === 0)) {
    return (
      <div className="paper-stack p-8 rounded-lg h-full animate-fade-slide-up" style={{ animationDelay: "320ms" }}>
        <div className="flex justify-between items-center mb-10">
          <div>
            <h4 className="text-2xl font-bold text-on-surface" style={{ fontFamily: "Crimson Text" }}>
              Revenue Forecast
            </h4>
            <p className="text-on-surface-variant text-sm font-medium">
              Monthly collections with 2-month projection
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center h-60 text-center">
          <span className="material-symbols-outlined text-6xl text-stone-300 mb-4">analytics</span>
          <p className="text-lg font-bold text-on-surface" style={{ fontFamily: "Crimson Text" }}>
            No revenue data yet
          </p>
          <p className="text-sm text-on-surface-variant mt-1 max-w-xs">
            Record your first fee collection to see projections and revenue forecasts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="paper-stack p-8 rounded-lg h-full animate-fade-slide-up" style={{ animationDelay: "320ms" }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-2xl font-bold text-on-surface" style={{ fontFamily: "Crimson Text" }}>
              Revenue Forecast
            </h4>
            {/* Edge Case 1: Seasonality info icon */}
            <div className="relative">
              <button
                className="text-stone-400 hover:text-stone-600 transition-colors"
                onMouseEnter={() => setShowSeasonalityInfo(true)}
                onMouseLeave={() => setShowSeasonalityInfo(false)}
                onClick={() => setShowSeasonalityInfo(!showSeasonalityInfo)}
              >
                <span className="material-symbols-outlined text-lg">info</span>
              </button>
              {showSeasonalityInfo && (
                <div className="absolute left-0 top-full mt-2 w-64 bg-stone-800 text-white text-[11px] font-medium py-2 px-3 rounded-lg shadow-xl z-20 leading-relaxed">
                  Forecast adjusted for historical seasonality. April (new academic year) sees 2.5x revenue; December (holidays) sees 0.2x.
                </div>
              )}
            </div>
          </div>
          <p className="text-on-surface-variant text-sm font-medium">
            Monthly collections with 2-month projection
          </p>
        </div>
        <button className="bg-stone-100 p-2 rounded-lg hover:bg-primary hover:text-white transition-all">
          <span className="material-symbols-outlined">bar_chart</span>
        </button>
      </div>

      {/* Chart */}
      {isLoading ? (
        <div className="bg-stone-100 animate-pulse rounded-lg" style={{ height: chartHeight }} />
      ) : data && data.length > 0 ? (
        <div className="overflow-x-auto">
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
                  const barHeightPx = maxValue > 0 ? (item.collected / maxValue) * chartHeight : 0;
                  const isHovered = hoveredIndex === index;

                  return (
                    <div
                      key={item.month}
                      className="flex flex-col items-center"
                      style={{ width: 48 }}
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      {/* Tooltip */}
                      {isHovered && (
                        <div
                          className="absolute left-1/2 -translate-x-1/2 bg-stone-800 text-white text-[11px] font-medium py-1.5 px-3 rounded shadow-lg whitespace-nowrap z-10"
                          style={{ bottom: barHeightPx + 8 }}
                        >
                          {item.label}: {formatCurrency(item.collected)}
                          {item.projected && (
                            <span className="text-purple-300 ml-1">
                              (Projected {item.seasonalityMultiplier}x)
                            </span>
                          )}
                        </div>
                      )}

                      {/* Bar */}
                      <div
                        className="w-8 rounded-t-md cursor-pointer transition-opacity animate-bar-grow"
                        style={{
                          height: Math.max(barHeightPx, 4),
                          backgroundColor: item.projected ? "#a855f7" : "#D97706",
                          opacity: item.projected ? 0.5 : (isHovered ? 1 : 0.9),
                          animationDelay: `${index * 100}ms`,
                          border: item.projected ? "1px dashed #a855f7" : "none",
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
            {data.map((item) => (
              <div key={item.month} className="text-center" style={{ width: 48 }}>
                <p className="text-[9px] font-bold text-stone-400 uppercase leading-tight truncate">
                  {item.label}
                </p>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-stone-100">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#D97706" }} />
              <span className="text-[10px] font-bold text-stone-500">Actual</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm border border-dashed" style={{ backgroundColor: "#a855f7", opacity: 0.5 }} />
              <span className="text-[10px] font-bold text-stone-500">Projected (seasonality-adjusted)</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
