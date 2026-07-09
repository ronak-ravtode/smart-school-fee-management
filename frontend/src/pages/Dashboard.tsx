import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { MetricCards } from "@/components/dashboard/MetricCards";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { DefaulterTable } from "@/components/dashboard/DefaulterTable";
import { DefaulterDrawer } from "@/components/dashboard/DefaulterDrawer";
import { useUIStore } from "@/store/uiStore";
import {
  connectSocket,
  onReconnect,
  type PaymentVerifiedEvent,
  type RefundVerifiedEvent,
} from "@/lib/socket";
import { cn } from "@/lib/utils";
import type { DashboardMetrics, DefaulterRecord, RevenueByFeeType } from "@/types/dashboard";
import { useQuery } from "@tanstack/react-query";

export function Dashboard() {
  const { sidebarCollapsed, addToast } = useUIStore();
  const queryClient = useQueryClient();

  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: () => apiClient.get<DashboardMetrics>("/dashboard/metrics"),
  });

  const { data: defaultersData, isLoading: defaultersLoading } = useQuery({
    queryKey: ["dashboard-defaulters"],
    queryFn: () => apiClient.get<DefaulterRecord[]>("/dashboard/defaults?limit=10"),
  });

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ["dashboard-revenue"],
    queryFn: () => apiClient.get<RevenueByFeeType[]>("/dashboard/revenue-breakdown"),
  });

  // Edge Case 2 + Step 4: Socket listeners + force-fetch on reconnect
  useEffect(() => {
    const socket = connectSocket();

    // Real-time payment events
    socket.on("payment_verified", (event: PaymentVerifiedEvent) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-defaulters"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-revenue"] });
      queryClient.invalidateQueries({ queryKey: ["defaulter-tracker"] });

      addToast({
        title: "Payment Verified",
        description: `Rs. ${event.amount.toLocaleString("en-IN")} received from ${event.studentName ?? "student"}. Ledger status: ${event.ledgerStatus}.`,
        variant: "success",
      });
    });

    // Edge Case 3: Refund events
    socket.on("refund_verified", (event: RefundVerifiedEvent) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-defaulters"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-revenue"] });
      queryClient.invalidateQueries({ queryKey: ["defaulter-tracker"] });

      addToast({
        title: "Refund Processed",
        description: `Rs. ${event.refundAmount.toLocaleString("en-IN")} refunded to ${event.studentName ?? "student"}. Ledger status: ${event.ledgerStatus}.`,
        variant: "default",
      });
    });

    // Edge Case 2: Force-fetch all dashboard data on reconnect
    const cleanup = onReconnect(() => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-defaulters"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-revenue"] });
      queryClient.invalidateQueries({ queryKey: ["defaulter-tracker"] });

      addToast({
        title: "Reconnected",
        description: "Dashboard data refreshed after reconnection.",
        variant: "success",
      });
    });

    return () => {
      cleanup();
      socket.off("payment_verified");
      socket.off("refund_verified");
    };
  }, [queryClient, addToast]);

  return (
    <div className={cn(
      "ml-64 min-h-screen transition-all duration-300",
      sidebarCollapsed && "ml-[72px]"
    )}>
      <div className="pt-24 px-8 pb-8">
        {/* Header */}
        <div className="mb-8 animate-fade-slide-up">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-3xl font-bold text-on-surface" style={{ fontFamily: "Crimson Text" }}>
              Dashboard
            </h2>
            <div className="w-2 h-2 rounded-full bg-primary mt-1 animate-pulse-dot" />
          </div>
          <p className="text-on-surface-variant text-sm font-medium">
            Welcome back! Here's what's happening with your school fees.
          </p>
        </div>

        {/* Metric Cards */}
        <MetricCards
          metrics={metricsData?.data}
          isLoading={metricsLoading}
        />

        {/* Charts & Tables Grid */}
        <div className="grid grid-cols-12 gap-4 mt-4">
          <div className="col-span-12 md:col-span-8">
            <RevenueChart
              data={revenueData?.data}
              isLoading={revenueLoading}
            />
          </div>

          <div className="col-span-12 md:col-span-4">
            <DefaulterTable
              data={defaultersData?.data}
              isLoading={defaultersLoading}
              compact
            />
          </div>
        </div>
      </div>

      {/* FAB Button */}
      <button className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-white rounded-lg shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-50 group border border-primary/20">
        <span className="material-symbols-outlined text-3xl">add</span>
        <span className="absolute right-full mr-4 bg-stone-800 text-white px-4 py-2 rounded-lg text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          New Transaction
        </span>
      </button>

      <DefaulterDrawer />
    </div>
  );
}
