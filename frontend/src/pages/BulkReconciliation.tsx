import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSyncStore, type PaymentPayload, type PaymentMethod } from "@/store/syncStore";
import { useUIStore } from "@/store/uiStore";
import { WifiOff, Send, Loader2, CheckCircle2 } from "lucide-react";
import type { DefaulterRecord } from "@/types/dashboard";

interface BulkEntry {
  amount: string;
  paymentMethod: PaymentMethod;
  receiptNumber: string;
}

const FIELDS: (keyof BulkEntry)[] = ["amount", "paymentMethod", "receiptNumber"];

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function BulkReconciliation() {
  const queryClient = useQueryClient();
  const { isOnline, addToQueue } = useSyncStore();
  const { addToast, sidebarCollapsed } = useUIStore();
  const [entries, setEntries] = useState<Record<string, BulkEntry>>({});
  const focusRefs = useRef<Map<string, HTMLElement>>(new Map());

  const { data: defaultersData, isLoading } = useQuery({
    queryKey: ["bulk-reconciliation-defaulters", { limit: 50 }],
    queryFn: () => apiClient.get<DefaulterRecord[]>("/dashboard/defaults?limit=50"),
  });

  const students = defaultersData?.data ?? [];

  const mutation = useMutation({
    mutationFn: async (payloads: Array<{ ledgerId: string; amount: number; paymentMethod: string; receiptNumber?: string }>) => {
      const results = await Promise.allSettled(
        payloads.map((p) =>
          apiClient.post("/transactions/pay", {
            ledgerId: p.ledgerId,
            amount: p.amount,
            paymentMethod: p.paymentMethod,
            receiptNumber: p.receiptNumber || undefined,
          })
        )
      );
      return results;
    },
    onSuccess: (results) => {
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-defaulters"] });
      queryClient.invalidateQueries({ queryKey: ["bulk-reconciliation-defaulters"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-revenue"] });

      setEntries({});

      addToast({
        title: "Batch complete",
        description: `${succeeded} payment(s) recorded${failed > 0 ? `. ${failed} failed.` : "."}`,
        variant: succeeded > 0 ? "success" : "error",
      });
    },
    onError: () => {
      addToast({
        title: "Batch failed",
        description: "Failed to process batch. Please try again.",
        variant: "error",
      });
    },
  });

  const registerRef = useCallback((key: string, el: HTMLElement | null) => {
    if (el) {
      focusRefs.current.set(key, el);
    } else {
      focusRefs.current.delete(key);
    }
  }, []);

  const focusField = useCallback((studentId: string, field: keyof BulkEntry) => {
    const key = `${studentId}-${field}`;
    const el = focusRefs.current.get(key);
    if (el) {
      el.focus();
      if ("select" in el) {
        (el as HTMLInputElement).select();
      }
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, studentId: string, field: keyof BulkEntry) => {
      if (e.key !== "Tab" && e.key !== "Enter") return;

      e.preventDefault();

      const studentIds = students.map((s) => s.studentId);
      const currentStudentIdx = studentIds.indexOf(studentId);
      const currentFieldIdx = FIELDS.indexOf(field);

      let nextStudentIdx = currentStudentIdx;
      let nextFieldIdx = e.shiftKey ? currentFieldIdx - 1 : currentFieldIdx + 1;

      if (e.shiftKey) {
        if (nextFieldIdx < 0) {
          nextFieldIdx = FIELDS.length - 1;
          nextStudentIdx = currentStudentIdx - 1;
        }
      } else {
        if (nextFieldIdx >= FIELDS.length) {
          nextFieldIdx = 0;
          nextStudentIdx = currentStudentIdx + 1;
        }
      }

      if (nextStudentIdx >= 0 && nextStudentIdx < studentIds.length) {
        focusField(studentIds[nextStudentIdx], FIELDS[nextFieldIdx]);
      }
    },
    [students, focusField]
  );

  const updateEntry = useCallback((studentId: string, field: keyof BulkEntry, value: string) => {
    setEntries((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] ?? { amount: "", paymentMethod: "CASH" as PaymentMethod, receiptNumber: "" }),
        [field]: value,
      },
    }));
  }, []);

  const handleSubmitBatch = () => {
    const payloads: Array<{
      ledgerId: string;
      amount: number;
      paymentMethod: string;
      receiptNumber?: string;
    }> = [];

    let offlineCount = 0;

    for (const student of students) {
      const entry = entries[student.studentId];
      if (!entry) continue;
      if (!student.ledgerId) continue;

      const amount = parseFloat(entry.amount);
      if (isNaN(amount) || amount <= 0) continue;

      if (amount > student.remaining) {
        addToast({
          title: "Amount exceeded",
          description: `₹${amount.toLocaleString("en-IN")} exceeds remaining ₹${student.remaining.toLocaleString("en-IN")} for ${student.studentName}.`,
          variant: "error",
        });
        continue;
      }

      if (!isOnline) {
        const offlinePayload: PaymentPayload = {
          id: crypto.randomUUID(),
          ledgerId: student.ledgerId,
          studentId: student.studentId,
          studentName: student.studentName,
          amount,
          paymentMethod: entry.paymentMethod,
          receiptNumber: entry.receiptNumber || undefined,
          createdAt: new Date().toISOString(),
        };
        addToQueue(offlinePayload);
        offlineCount++;
      } else {
        payloads.push({
          ledgerId: student.ledgerId,
          amount,
          paymentMethod: entry.paymentMethod,
          receiptNumber: entry.receiptNumber || undefined,
        });
      }
    }

    if (payloads.length > 0 && isOnline) {
      mutation.mutate(payloads);
    }

    if (offlineCount > 0) {
      setEntries({});
      addToast({
        title: "Saved offline",
        description: `${offlineCount} payment(s) will sync when connected.`,
        variant: "default",
      });
    }
  };

  const getFilledCount = () => {
    return Object.values(entries).filter((e) => e.amount && parseFloat(e.amount) > 0).length;
  };

  return (
    <div className={cn("ml-64 min-h-screen transition-all duration-300", sidebarCollapsed && "ml-[72px]")}>
      <div className="pt-24 px-8 pb-8">
        {/* Header */}
        <div className="mb-8 animate-fade-slide-up">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-3xl font-bold text-on-surface" style={{ fontFamily: "Crimson Text" }}>
              Bulk Reconciliation
            </h2>
            <div className="w-2 h-2 rounded-full bg-primary mt-1 animate-pulse-dot" />
          </div>
          <p className="text-on-surface-variant text-sm font-medium">
            Record multiple cash and cheque payments in a single batch. Use Tab to move between fields.
          </p>
        </div>

        {/* Offline Warning */}
        {!isOnline && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 mb-6">
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            <span>You are offline. Payments will be saved locally and synced when connected.</span>
          </div>
        )}

        {/* Table */}
        <div className="paper-stack rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-8 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-stone-100 animate-pulse rounded" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-tertiary mx-auto mb-3" />
              <p className="text-lg font-bold text-on-surface" style={{ fontFamily: "Crimson Text" }}>
                All clear!
              </p>
              <p className="text-sm text-on-surface-variant mt-1">
                No pending payments to reconcile.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-stone-50">
                      <TableHead className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider w-8">#</TableHead>
                      <TableHead className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Student</TableHead>
                      <TableHead className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Class</TableHead>
                      <TableHead className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Remaining</TableHead>
                      <TableHead className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-right w-32">Amount to Pay</TableHead>
                      <TableHead className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider w-32">Method</TableHead>
                      <TableHead className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider w-40">Receipt No.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student, index) => {
                      const entry = entries[student.studentId];
                      const hasAmount = entry?.amount && parseFloat(entry.amount) > 0;

                      return (
                        <TableRow
                          key={student.studentId}
                          className={cn("transition-colors", hasAmount && "bg-primary/5")}
                        >
                          <TableCell className="text-xs text-stone-400 font-medium">{index + 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-primary text-xs font-bold">
                                {student.studentName.charAt(0)}
                              </div>
                              <span className="text-sm font-semibold text-on-surface">{student.studentName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-on-surface-variant">{student.class}</TableCell>
                          <TableCell className="text-right text-sm font-semibold text-on-surface">
                            ₹{student.remaining.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell>
                            <Input
                              ref={(el) => registerRef(`${student.studentId}-amount`, el)}
                              type="number"
                              placeholder="0"
                              min={0}
                              max={student.remaining}
                              value={entry?.amount ?? ""}
                              onChange={(e) => updateEntry(student.studentId, "amount", e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, student.studentId, "amount")}
                              className="h-9 text-sm bg-white border-outline-variant text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <select
                              ref={(el) => registerRef(`${student.studentId}-paymentMethod`, el)}
                              value={entry?.paymentMethod ?? "CASH"}
                              onChange={(e) => updateEntry(student.studentId, "paymentMethod", e.target.value as PaymentMethod)}
                              onKeyDown={(e) => handleKeyDown(e as unknown as React.KeyboardEvent, student.studentId, "paymentMethod")}
                              className="h-9 w-full text-sm rounded-md border border-outline-variant bg-white px-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                              <option value="CASH">Cash</option>
                              <option value="CHEQUE">Cheque</option>
                            </select>
                          </TableCell>
                          <TableCell>
                            <Input
                              ref={(el) => registerRef(`${student.studentId}-receiptNumber`, el)}
                              type="text"
                              placeholder="Receipt #"
                              value={entry?.receiptNumber ?? ""}
                              onChange={(e) => updateEntry(student.studentId, "receiptNumber", e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, student.studentId, "receiptNumber")}
                              className="h-9 text-sm bg-white border-outline-variant"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-4 bg-stone-50 border-t border-outline-variant">
                <p className="text-sm text-on-surface-variant">
                  <span className="font-bold text-on-surface">{getFilledCount()}</span> of {students.length} students filled
                </p>
                <Button
                  onClick={handleSubmitBatch}
                  disabled={getFilledCount() === 0 || mutation.isPending}
                  className="bg-primary text-white hover:bg-primary/90 flex items-center gap-2"
                >
                  {mutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {isOnline ? "Submit Batch" : "Save Batch Offline"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
