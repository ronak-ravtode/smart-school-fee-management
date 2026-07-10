import { useState, useRef, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CreditCard, Bell, ExternalLink, MoreVertical, History, Ban, CloudOff } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { useSyncStore } from "@/store/syncStore";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DefaulterRecord, RiskTier } from "@/types/dashboard";

interface DefaulterTableProps {
  data: DefaulterRecord[] | undefined;
  isLoading: boolean;
  compact?: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

const RISK_TIER_CONFIG: Record<RiskTier, { bg: string; text: string; label: string; pulse?: boolean }> = {
  CRITICAL: { bg: "bg-red-600", text: "text-white", label: "CRITICAL", pulse: true },
  HIGH: { bg: "bg-amber-500", text: "text-white", label: "HIGH" },
  MEDIUM: { bg: "bg-yellow-400", text: "text-yellow-900", label: "MEDIUM" },
  LOW: { bg: "bg-green-100", text: "text-green-700", label: "LOW" },
};

function RiskBadge({ tier }: { tier?: RiskTier }) {
  if (!tier) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-500">
        N/A
      </span>
    );
  }
  const config = RISK_TIER_CONFIG[tier];
  if (!config) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-500">
        {tier}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold",
        config.bg,
        config.text,
        config.pulse && "animate-pulse"
      )}
    >
      {config.label}
    </span>
  );
}

function ProgressBar({ paid, total }: { paid: number; total: number }) {
  const pct = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
  const unpaidPct = 100 - pct;

  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-on-surface-variant">
          {formatCurrency(paid)} paid
        </span>
        <span className="text-error font-semibold">
          {formatCurrency(total - paid)} left
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full overflow-hidden bg-stone-100 flex">
        <div
          className="bg-tertiary h-full rounded-l-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
        <div
          className="bg-error h-full rounded-r-full transition-all duration-500"
          style={{ width: `${unpaidPct}%` }}
        />
      </div>
    </div>
  );
}

// Edge Case 4: Smart Actions — kebab menu with dropdown
function KebabMenu({ record, onRecordPayment, onSendReminder }: {
  record: DefaulterRecord;
  onRecordPayment: () => void;
  onSendReminder: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-stone-400 hover:text-on-surface hover:bg-surface rounded-lg transition-colors"
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
      >
        <MoreVertical className="w-4 h-4" />
      </Button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-outline-variant rounded-xl shadow-lg z-50 py-1 animate-fade-in">
          <button
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface transition-colors"
            onClick={() => { onRecordPayment(); setIsOpen(false); }}
          >
            <CreditCard className="w-4 h-4 text-primary" />
            Record Payment
          </button>
          <button
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface transition-colors"
            onClick={() => { onSendReminder(); setIsOpen(false); }}
          >
            <Bell className="w-4 h-4 text-amber-600" />
            {record.riskTier === "CRITICAL" ? "Send Urgent Reminder" : "Send Reminder"}
          </button>
          <div className="border-t border-outline-variant my-1" />
          <button
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <History className="w-4 h-4 text-stone-400" />
            View Payment History
          </button>
          <button
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <Ban className="w-4 h-4 text-stone-400" />
            Waive Fee
          </button>
        </div>
      )}
    </div>
  );
}

export function DefaulterTable({ data, isLoading, compact = false }: DefaulterTableProps) {
  const { openDrawer, addToast } = useUIStore();
  const queryClient = useQueryClient();
  const { pendingQueue } = useSyncStore();

  // Build a set of studentIds with pending offline payments
  const unsyncedStudentIds = new Set(pendingQueue.map((p) => p.studentId));

  const handleRecordPayment = (record: DefaulterRecord) => {
    openDrawer({
      type: "record-payment",
      studentId: record.studentId,
      studentName: record.studentName,
      remaining: record.remaining,
      ledgerId: record.ledgerId,
      riskTier: record.riskTier ?? "LOW",
      totalDue: record.totalDue,
      paidAmount: record.totalPaid,
    });
  };

  const handleSendReminder = async (record: DefaulterRecord) => {
    const type = record.riskTier === "CRITICAL" || record.riskTier === "HIGH" ? "URGENT" : "STANDARD";
    try {
      await apiClient.post("/notifications/reminder", {
        studentId: record.studentId,
        type,
      });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      addToast({
        title: `${type === "URGENT" ? "Urgent " : ""}Reminder logged`,
        description: `Reminder sent to ${record.studentName} (${record.email}).`,
        variant: "success",
      });
    } catch {
      addToast({
        title: "Failed to send reminder",
        description: "Could not log reminder. Please try again.",
        variant: "error",
      });
    }
  };

  const hasData = data && data.length > 0;

  return (
    <div className={cn(
      "rounded-lg flex flex-col",
      !compact && "paper-stack animate-fade-slide-up"
    )}>
      {/* Header (only in compact mode) */}
      {compact && (
        <div className="flex justify-between items-center mb-6 px-2">
          <div>
            <h4 className="text-xl font-bold text-on-surface" style={{ fontFamily: "Crimson Text" }}>
              Defaulters
            </h4>
            <p className="text-on-surface-variant text-[11px] font-medium">
              Sorted by risk priority
            </p>
          </div>
          <a
            href="/defaulter-tracker"
            className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
          >
            View All <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className={cn("space-y-3", compact ? "" : "p-8")}>
          {[...Array(compact ? 3 : 5)].map((_, i) => (
            <div key={i} className={cn("bg-stone-100 animate-pulse rounded-lg", compact ? "h-14" : "h-16")} />
          ))}
        </div>
      ) : !hasData ? (
        <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-10" : "py-20")}>
          <span className="material-symbols-outlined text-tertiary text-5xl mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>
            verified
          </span>
          <p className="text-on-surface-variant font-medium text-sm">All clear!</p>
          <p className="text-on-surface-variant/60 text-xs mt-1">No defaulters found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className={cn(!compact && "bg-stone-50")}>
                <TableHead className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider w-20">Risk</TableHead>
                <TableHead className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Student</TableHead>
                {!compact && (
                  <TableHead className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Class</TableHead>
                )}
                <TableHead className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Days</TableHead>
                {!compact && (
                  <TableHead className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-right min-w-[180px]">Payment Progress</TableHead>
                )}
                {compact && (
                  <TableHead className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Remaining</TableHead>
                )}
                <TableHead className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-right w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((record) => (
                <TableRow
                  key={record.studentId}
                  className={cn(
                    "border-outline-variant/50 transition-colors h-[60px]",
                    record.riskTier === "CRITICAL" && "bg-red-50/50",
                    record.riskTier === "HIGH" && "bg-amber-50/30"
                  )}
                >
                  <TableCell>
                    <RiskBadge tier={record.riskTier} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold",
                        record.riskTier === "CRITICAL" ? "bg-red-100 text-red-600" :
                        record.riskTier === "HIGH" ? "bg-amber-100 text-amber-600" :
                        "bg-primary-container text-primary"
                      )}>
                        {record.studentName.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-on-surface">{record.studentName}</p>
                          {/* Step 4: Row-level unsynced indicator */}
                          {unsyncedStudentIds.has(record.studentId) && (
                            <span title="Unsynced payment pending">
                              <CloudOff className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                            </span>
                          )}
                        </div>
                        {!compact && (
                          <p className="text-[10px] text-on-surface-variant">{record.email}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  {!compact && (
                    <TableCell>
                      <span className="text-sm text-on-surface-variant font-medium">
                        {record.class} — {record.section}
                      </span>
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <span className={cn(
                      "text-sm font-semibold",
                      (record.daysOverdue ?? 0) > 60 ? "text-red-600" :
                      (record.daysOverdue ?? 0) > 30 ? "text-amber-600" :
                      "text-on-surface-variant"
                    )}>
                      {record.daysOverdue ?? 0}d
                    </span>
                  </TableCell>
                  {!compact ? (
                    <TableCell className="text-right pr-4">
                      <ProgressBar paid={record.totalPaid} total={record.totalDue} />
                    </TableCell>
                  ) : (
                    <TableCell className="text-right">
                      <span className="text-sm font-bold text-error">
                        {formatCurrency(record.remaining)}
                      </span>
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {/* Edge Case 4: Primary action directly on row, rest in kebab menu */}
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-8 w-8 rounded-lg transition-colors",
                          record.riskTier === "CRITICAL"
                            ? "text-red-600 hover:text-red-700 hover:bg-red-50"
                            : "text-primary hover:text-primary/80 hover:bg-primary-container"
                        )}
                        onClick={() => handleRecordPayment(record)}
                        title="Record Payment"
                      >
                        <CreditCard className="w-4 h-4" />
                      </Button>
                      <KebabMenu
                        record={record}
                        onRecordPayment={() => handleRecordPayment(record)}
                        onSendReminder={() => handleSendReminder(record)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
