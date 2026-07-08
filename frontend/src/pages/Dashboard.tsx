import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { MetricCards } from "@/components/dashboard/MetricCards";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { DefaulterTable } from "@/components/dashboard/DefaulterTable";
import { RecordPaymentDialog } from "@/components/dashboard/RecordPaymentDialog";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";
import type { DashboardMetrics, DefaulterRecord, RevenueByFeeType } from "@/types/dashboard";

export function Dashboard() {
  const queryClient = useQueryClient();
  const { openModal, sidebarCollapsed } = useUIStore();
  const [selectedDefaulter, setSelectedDefaulter] = useState<DefaulterRecord | null>(null);

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

  const handleRecordPayment = (record: DefaulterRecord) => {
    setSelectedDefaulter(record);
    openModal(`payment-${record.studentId}`);
  };

  const handleSendReminder = (studentId: string) => {
    console.log("Send reminder to:", studentId);
    queryClient.invalidateQueries({ queryKey: ["dashboard-defaulters"] });
  };

  return (
    <div className={cn(
      "min-h-screen pt-20 pr-8 pb-8 transition-all duration-300",
      sidebarCollapsed ? "pl-[88px]" : "pl-[276px]"
    )}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        <p className="text-slate-500 mt-1">
          Welcome back! Here's what's happening with your school fees.
        </p>
      </div>

      <MetricCards
        metrics={metricsData?.data}
        isLoading={metricsLoading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-6">
        <div className="lg:col-span-3">
          <RevenueChart
            data={revenueData?.data}
            isLoading={revenueLoading}
          />
        </div>

        <div className="lg:col-span-2">
          <DefaulterTable
            data={defaultersData?.data}
            isLoading={defaultersLoading}
            onRecordPayment={handleRecordPayment}
            onSendReminder={handleSendReminder}
          />
        </div>
      </div>

      {selectedDefaulter && (
        <RecordPaymentDialog
          studentId={selectedDefaulter.studentId}
          studentName={selectedDefaulter.studentName}
          remaining={selectedDefaulter.remaining}
        />
      )}
    </div>
  );
}
