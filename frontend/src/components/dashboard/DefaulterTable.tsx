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
import { CreditCard, Bell, Users } from "lucide-react";
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
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Defaulters</h3>
          <p className="text-sm text-slate-500 mt-0.5">Students with pending dues</p>
        </div>
        <div className="flex items-center gap-3">
          {(data?.length ?? 0) > 0 && (
            <Badge variant="destructive" className="px-2.5 py-1 text-xs font-semibold">
              {data?.length} pending
            </Badge>
          )}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-lg">
            <Users className="w-5 h-5 text-white" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 bg-slate-100/50 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-600">All clear! No defaulters found.</p>
          <p className="text-xs text-slate-400 mt-1">Everyone is up to date with their fees.</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-100">
                <TableHead className="pl-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Student</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Class</TableHead>
                <TableHead className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Due</TableHead>
                <TableHead className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Paid</TableHead>
                <TableHead className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Remaining</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-right pr-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((record) => (
                <TableRow key={record.studentId} className="border-slate-100 hover:bg-white/50 transition-colors">
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                        {record.studentName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{record.studentName}</p>
                        <p className="text-xs text-slate-500">{record.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-slate-600">{record.class} - {record.section}</span>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-slate-900">
                    {formatCurrency(record.totalDue)}
                  </TableCell>
                  <TableCell className="text-right text-slate-600">
                    {formatCurrency(record.totalPaid)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-rose-600">
                    {formatCurrency(record.remaining)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={record.status === "OVERDUE" ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {record.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-6">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                        onClick={() => onRecordPayment?.(record)}
                      >
                        <CreditCard className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-amber-600 hover:bg-amber-50"
                        onClick={() => onSendReminder?.(record.studentId)}
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
