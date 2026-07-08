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
    materialIcon: "payments",
    containerColor: "bg-primary-container text-primary",
    delay: 0,
    footer: (m: DashboardMetrics | undefined) => ({
      icon: "trending_up",
      text: "8% from last term",
      color: "text-primary",
    }),
  },
  {
    key: "collected" as const,
    title: "Collected",
    getValue: (m: DashboardMetrics) => m.totalCollected,
    getSubtitle: (m: DashboardMetrics) => `${m.collectionPercentage}% collected`,
    materialIcon: "check_circle",
    containerColor: "bg-tertiary-container text-tertiary",
    delay: 80,
    footer: (m: DashboardMetrics | undefined) => ({
      showProgress: true,
      progress: m?.collectionPercentage ?? 0,
      text: `${m?.collectionPercentage ?? 0}% collected`,
      color: "text-tertiary",
    }),
  },
  {
    key: "pending" as const,
    title: "Pending",
    getValue: (m: DashboardMetrics) => m.totalPending,
    materialIcon: "history",
    containerColor: "bg-secondary-container text-secondary",
    delay: 160,
    footer: (m: DashboardMetrics | undefined) => ({
      text: "12 invoices pending",
      color: "text-secondary",
    }),
  },
  {
    key: "overdue" as const,
    title: "Overdue",
    getValue: (m: DashboardMetrics) => m.totalOverdue,
    materialIcon: "warning",
    containerColor: "bg-error-container text-error",
    delay: 240,
    footer: (m: DashboardMetrics | undefined) => ({
      icon: "verified_user",
      text: "System all clear",
      color: "text-tertiary",
    }),
  },
];

export function MetricCards({ metrics, isLoading }: MetricCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {cards.map((card) => {
        const value = metrics ? card.getValue(metrics) : 0;
        const footer = card.footer(metrics);

        return (
          <div
            key={card.key}
            className="paper-stack p-6 rounded-lg flex flex-col justify-between group transition-all hover:-translate-y-1 animate-fade-slide-up"
            style={{ animationDelay: `${card.delay}ms` }}
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <p className="text-stone-400 text-[10px] font-bold uppercase tracking-wider">
                  {card.title}
                </p>
                <div className={`p-2.5 ${card.containerColor} rounded-lg`}>
                  <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {card.materialIcon}
                  </span>
                </div>
              </div>
              {isLoading ? (
                <div className="h-8 w-24 bg-stone-100 animate-pulse rounded" />
              ) : (
                <h3 className="text-2xl font-bold text-on-surface" style={{ fontFamily: "Crimson Text" }}>
                  {formatCurrency(value)}
                </h3>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-stone-100">
              {footer.showProgress ? (
                <>
                  <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-tertiary h-full rounded-full transition-all duration-1000"
                      style={{ width: `${Math.min(footer.progress, 100)}%` }}
                    />
                  </div>
                  <p className={`text-[10px] font-bold ${footer.color} mt-2`}>{footer.text}</p>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  {footer.icon && (
                    <span className={`material-symbols-outlined text-sm ${footer.color}`}>
                      {footer.icon}
                    </span>
                  )}
                  <span className={`text-[10px] font-bold ${footer.color}`}>
                    {footer.text}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
