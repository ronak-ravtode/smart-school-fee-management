import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, Bell } from "lucide-react";
import type { DefaulterRecord } from "@/types/dashboard";

interface DefaulterTableProps {
  data: DefaulterRecord[] | undefined;
  isLoading: boolean;
  onRecordPayment?: (record: DefaulterRecord) => void;
  onSendReminder?: (studentId: string) => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DefaulterTable({
  data,
  isLoading,
  onRecordPayment,
  onSendReminder,
}: DefaulterTableProps) {
  const hasData = data && data.length > 0;

  return (
    <div className="paper-stack p-8 rounded-lg h-full flex flex-col animate-fade-slide-up" style={{ animationDelay: "400ms" }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h4 className="text-xl font-bold text-on-surface" style={{ fontFamily: "Crimson Text" }}>
            Defaulters
          </h4>
          <p className="text-on-surface-variant text-[11px] font-medium">
            Students with pending dues
          </p>
        </div>
        <div className="p-2 bg-error-container text-error rounded-full">
          <span className="material-symbols-outlined text-xl">person_off</span>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 bg-stone-100 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : !hasData ? (
        /* Empty State */
        <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
          <div className="relative w-32 h-32 mb-6">
            <div className="absolute inset-0 bg-tertiary/5 rounded-full animate-pulse" />
            <div className="absolute inset-4 bg-tertiary/10 rounded-full" />
            <div className="relative w-full h-full flex items-center justify-center">
              <span className="material-symbols-outlined text-tertiary text-6xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                verified
              </span>
            </div>
          </div>
          <h5 className="text-xl font-bold text-on-surface mb-2" style={{ fontFamily: "Crimson Text" }}>
            All clear!
          </h5>
          <p className="text-on-surface-variant text-sm max-w-[200px]">
            No defaulters found. Everyone is up to date with their fees.
          </p>
          <button className="mt-8 px-8 py-3 bg-stone-100 text-on-surface text-xs font-bold rounded-lg border border-outline-variant hover:bg-stone-200 transition-all active:scale-95 shadow-sm">
            View Full Report
          </button>
        </div>
      ) : (
        /* Table */
        <div className="overflow-x-auto -mx-8 flex-1">
          <Table>
            <TableHeader>
              <TableRow className="border-outline-variant/50 hover:bg-transparent">
                <TableHead className="pl-8 text-[10px] font-bold text-stone-400 uppercase tracking-wider">Student</TableHead>
                <TableHead className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Class</TableHead>
                <TableHead className="text-right text-[10px] font-bold text-stone-400 uppercase tracking-wider">Due</TableHead>
                <TableHead className="text-right text-[10px] font-bold text-stone-400 uppercase tracking-wider">Paid</TableHead>
                <TableHead className="text-right text-[10px] font-bold text-stone-400 uppercase tracking-wider">Remaining</TableHead>
                <TableHead className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-right pr-8 text-[10px] font-bold text-stone-400 uppercase tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((record) => (
                <TableRow key={record.studentId} className="border-outline-variant/50 hover:bg-stone-50 transition-colors">
                  <TableCell className="pl-8">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-primary text-sm font-bold">
                        {record.studentName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-on-surface">{record.studentName}</p>
                        <p className="text-[10px] text-on-surface-variant">{record.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-on-surface-variant font-medium">
                      {record.class} — {record.section}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm font-semibold text-on-surface">{formatCurrency(record.totalDue)}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm text-on-surface-variant">{formatCurrency(record.totalPaid)}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm font-bold text-error">{formatCurrency(record.remaining)}</span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={record.status === "OVERDUE" ? "destructive" : "secondary"}
                      className="text-[10px] font-bold px-2 py-0.5"
                    >
                      {record.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-8">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-stone-400 hover:text-primary hover:bg-primary-container rounded-lg transition-colors"
                        onClick={() => onRecordPayment?.(record)}
                        title="Record Payment"
                      >
                        <CreditCard className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-stone-400 hover:text-secondary hover:bg-secondary-container rounded-lg transition-colors"
                        onClick={() => onSendReminder?.(record.studentId)}
                        title="Send Reminder"
                      >
                        <Bell className="w-4 h-4" />
                      </Button>
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
