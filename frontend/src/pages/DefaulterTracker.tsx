import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useUIStore } from "@/store/uiStore";
import { DefaulterTable } from "@/components/dashboard/DefaulterTable";
import { DefaulterDrawer } from "@/components/dashboard/DefaulterDrawer";
import { cn } from "@/lib/utils";
import type { DefaulterRecord } from "@/types/dashboard";

type Tab = "active" | "recovery";

export function DefaulterTracker() {
  const { sidebarCollapsed } = useUIStore();
  const [activeTab, setActiveTab] = useState<Tab>("active");

  const { data: defaultersData, isLoading } = useQuery({
    queryKey: ["defaulter-tracker"],
    queryFn: () => apiClient.get<DefaulterRecord[]>("/dashboard/defaults?limit=100"),
  });

  const { data: recoveryData, isLoading: recoveryLoading } = useQuery({
    queryKey: ["recovery-defaulters"],
    queryFn: () => apiClient.get<DefaulterRecord[]>("/dashboard/recovery"),
    enabled: activeTab === "recovery",
  });

  const defaulters = defaultersData?.data ?? [];
  const recoveryDefaulters = recoveryData?.data ?? [];

  const displayData = activeTab === "active" ? defaulters : recoveryDefaulters;
  const isCurrentlyLoading = activeTab === "active" ? isLoading : recoveryLoading;

  const criticalCount = defaulters.filter((d) => d.riskTier === "CRITICAL").length;
  const highCount = defaulters.filter((d) => d.riskTier === "HIGH").length;
  const mediumCount = defaulters.filter((d) => d.riskTier === "MEDIUM").length;
  const lowCount = defaulters.filter((d) => d.riskTier === "LOW").length;

  const totalRemaining = defaulters.reduce((sum, d) => sum + d.remaining, 0);
  const recoveryTotal = recoveryDefaulters.reduce((sum, d) => sum + d.remaining, 0);

  return (
    <div className={cn("xl:ml-60 ml-0 min-h-screen transition-all duration-300", sidebarCollapsed && "xl:ml-[72px] ml-0")}>
      <div className="pt-20 md:pt-24 lg:pt-28 px-3 md:px-5 lg:px-8 pb-8">
        {/* Header */}
        <div className="mb-8 animate-fade-slide-up">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-3xl font-bold text-on-surface" style={{ fontFamily: "Crimson Text" }}>
              Defaulter Tracker
            </h2>
            <div className="w-2 h-2 rounded-full bg-primary mt-1 animate-pulse-dot" />
          </div>
          <p className="text-on-surface-variant text-sm font-medium">
            Risk-prioritized view of all students with pending dues. Sorted by risk score (days overdue &times; oldest outstanding invoice).
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-stone-100 rounded-xl p-1 w-fit">
          <button
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
              activeTab === "active"
                ? "bg-white text-on-surface shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            )}
            onClick={() => setActiveTab("active")}
          >
            Active Defaulters
            {defaulters.length > 0 && (
              <span className="ml-2 text-xs text-on-surface-variant">({defaulters.length})</span>
            )}
          </button>
          <button
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
              activeTab === "recovery"
                ? "bg-white text-on-surface shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            )}
            onClick={() => setActiveTab("recovery")}
          >
            Recovery / Alumni Dues
            {recoveryDefaulters.length > 0 && (
              <span className="ml-2 text-xs text-on-surface-variant">({recoveryDefaulters.length})</span>
            )}
          </button>
        </div>

        {/* Summary Cards (only for active tab) */}
        {activeTab === "active" && !isLoading && defaulters.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6 animate-fade-slide-up" style={{ animationDelay: "100ms" }}>
            <div className="bg-white rounded-xl border border-outline-variant p-4">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Total Outstanding</p>
              <p className="text-xl font-bold text-error mt-1" style={{ fontFamily: "Crimson Text" }}>
                Rs. {totalRemaining.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="bg-red-50 rounded-xl border border-red-200 p-4">
              <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Critical</p>
              <p className="text-xl font-bold text-red-600 mt-1" style={{ fontFamily: "Crimson Text" }}>
                {criticalCount}
              </p>
            </div>
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">High</p>
              <p className="text-xl font-bold text-amber-600 mt-1" style={{ fontFamily: "Crimson Text" }}>
                {highCount}
              </p>
            </div>
            <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4">
              <p className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider">Medium</p>
              <p className="text-xl font-bold text-yellow-700 mt-1" style={{ fontFamily: "Crimson Text" }}>
                {mediumCount}
              </p>
            </div>
            <div className="bg-green-50 rounded-xl border border-green-200 p-4">
              <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Low</p>
              <p className="text-xl font-bold text-green-700 mt-1" style={{ fontFamily: "Crimson Text" }}>
                {lowCount}
              </p>
            </div>
          </div>
        )}

        {/* Recovery summary */}
        {activeTab === "recovery" && !recoveryLoading && recoveryDefaulters.length > 0 && (
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 mb-6 animate-fade-slide-up">
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Total Alumni/Transfer Dues</p>
            <p className="text-xl font-bold text-amber-700 mt-1" style={{ fontFamily: "Crimson Text" }}>
              Rs. {recoveryTotal.toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-amber-600 mt-1">
              These students are no longer active. Outstanding dues are tracked for recovery.
            </p>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-outline-variant overflow-hidden">
          <DefaulterTable
            data={displayData}
            isLoading={isCurrentlyLoading}
          />
        </div>
      </div>

      {/* Slide-over Drawer */}
      <DefaulterDrawer />
    </div>
  );
}
