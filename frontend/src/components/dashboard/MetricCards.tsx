import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, DollarSign, AlertTriangle, CheckCircle } from "lucide-react";
import type { DashboardMetrics } from "@/types/dashboard";

interface MetricCardsProps {
  metrics: DashboardMetrics | undefined;
  isLoading: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

const cards = [
  {
    key: "expected" as const,
    title: "Total Expected",
    getValue: (m: DashboardMetrics) => m.totalExpected,
    icon: DollarSign,
    gradient: "from-indigo-500 via-blue-500 to-cyan-400",
    bgGlow: "bg-indigo-50",
    iconBg: "bg-gradient-to-br from-indigo-500 to-blue-600",
    accentBar: "from-indigo-500 to-blue-500",
    valueColor: "text-slate-900",
  },
  {
    key: "collected" as const,
    title: "Collected",
    getValue: (m: DashboardMetrics) => m.totalCollected,
    getSubtitle: (m: DashboardMetrics) => `${m.collectionPercentage}% collected`,
    icon: CheckCircle,
    gradient: "from-emerald-400 via-teal-500 to-cyan-400",
    bgGlow: "bg-emerald-50",
    iconBg: "bg-gradient-to-br from-emerald-500 to-teal-600",
    accentBar: "from-emerald-400 to-teal-500",
    valueColor: "text-slate-900",
    subtitleColor: "text-emerald-600",
  },
  {
    key: "pending" as const,
    title: "Pending",
    getValue: (m: DashboardMetrics) => m.totalPending,
    icon: TrendingUp,
    gradient: "from-amber-400 via-orange-400 to-yellow-400",
    bgGlow: "bg-amber-50",
    iconBg: "bg-gradient-to-br from-amber-400 to-orange-500",
    accentBar: "from-amber-400 to-orange-400",
    valueColor: "text-slate-900",
  },
  {
    key: "overdue" as const,
    title: "Overdue",
    getValue: (m: DashboardMetrics) => m.totalOverdue,
    icon: AlertTriangle,
    gradient: "from-rose-400 via-pink-500 to-red-500",
    bgGlow: "bg-rose-50",
    iconBg: "bg-gradient-to-br from-rose-500 to-pink-600",
    accentBar: "from-rose-400 to-pink-500",
    valueColor: "text-slate-900",
  },
];

export function MetricCards({ metrics, isLoading }: MetricCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const value = metrics ? card.getValue(metrics) : 0;
        const subtitle = metrics && card.getSubtitle ? card.getSubtitle(metrics) : null;

        return (
          <div
            key={card.key}
            className="metric-card glass-card rounded-2xl p-5 relative overflow-hidden"
            style={{ ["--accent-gradient" as string]: `linear-gradient(135deg, var(--tw-gradient-stops))` }}
          >
            <div className={`absolute inset-0 ${card.bgGlow} opacity-40`} />
            <div className="relative flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {card.title}
                </p>
                {isLoading ? (
                  <div className="h-8 w-24 bg-slate-200/60 animate-pulse rounded-lg mt-2" />
                ) : (
                  <p className={`text-2xl font-bold mt-2 ${card.valueColor}`}>
                    {formatCurrency(value)}
                  </p>
                )}
                {subtitle && !isLoading && (
                  <p className={`text-xs font-semibold mt-2 ${card.subtitleColor ?? 'text-slate-500'}`}>
                    {subtitle}
                  </p>
                )}
              </div>
              <div className={`w-11 h-11 rounded-xl ${card.iconBg} flex items-center justify-center shadow-lg`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
