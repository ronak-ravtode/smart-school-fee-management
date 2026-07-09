import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PendingCheque {
  transactionId: string;
  ledgerId: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  studentSection: string;
  chequeNumber: string;
  chequeBank: string;
  chequeIssueDate: string;
  amount: number;
  dateReceived: string;
  daysWaiting: number;
}

export function ChequeReconciliation() {
  const queryClient = useQueryClient();
  const { sidebarCollapsed, addToast } = useUIStore();

  const [clearingCheque, setClearingCheque] = useState<PendingCheque | null>(null);
  const [actualAmount, setActualAmount] = useState("");

  const { data: chequesData, isLoading } = useQuery({
    queryKey: ["pending-cheques"],
    queryFn: () => apiClient.get<PendingCheque[]>("/transactions/pending-cheques"),
  });

  const clearMutation = useMutation({
    mutationFn: (data: { transactionId: string; actualClearedAmount?: number }) =>
      apiClient.post<{
        transaction: { id: string; status: string; actualClearedAmount: string | null };
        ledger: { id: string; paidAmount: string; status: string; totalAmount: string };
        remainingTransaction: { id: string; amount: string } | null;
      }>("/transactions/clear-cheque", data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["pending-cheques"] });

      const previousCheques = queryClient.getQueryData(["pending-cheques"]);

      queryClient.setQueryData(["pending-cheques"], (old: { data: PendingCheque[] } | undefined) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((c) => c.transactionId !== data.transactionId),
        };
      });

      return { previousCheques };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousCheques) {
        queryClient.setQueryData(["pending-cheques"], context.previousCheques);
      }
      addToast({
        title: "Failed to clear cheque",
        description: "The cheque could not be cleared. Please try again.",
        variant: "error",
      });
    },
    onSuccess: (response) => {
      const { transaction, remainingTransaction } = response.data;
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-defaulters"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-revenue"] });

      if (transaction.status === "PARTIALLY_CLEARED") {
        addToast({
          title: "Cheque partially cleared",
          description: `₹${Number(transaction.actualClearedAmount).toLocaleString("en-IN")} cleared. ₹${Number(remainingTransaction?.amount ?? 0).toLocaleString("en-IN")} remains uncleared and has been marked as bounced.`,
          variant: "default",
        });
      } else {
        addToast({
          title: "Cheque cleared",
          description: "The cheque has been cleared and the student's balance updated.",
          variant: "success",
        });
      }

      setClearingCheque(null);
      setActualAmount("");
    },
  });

  const bounceMutation = useMutation({
    mutationFn: (transactionId: string) =>
      apiClient.post<{
        transaction: { id: string };
        ledger: { id: string; totalAmount: string; waivedAmount: string };
      }>(
        "/transactions/bounce-cheque",
        { transactionId }
      ),
    onMutate: async (transactionId) => {
      await queryClient.cancelQueries({ queryKey: ["pending-cheques"] });

      const previousCheques = queryClient.getQueryData(["pending-cheques"]);

      queryClient.setQueryData(["pending-cheques"], (old: { data: PendingCheque[] } | undefined) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((c) => c.transactionId !== transactionId),
        };
      });

      return { previousCheques };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousCheques) {
        queryClient.setQueryData(["pending-cheques"], context.previousCheques);
      }
      addToast({
        title: "Failed to mark bounced",
        description: "Could not mark the cheque as bounced. Please try again.",
        variant: "error",
      });
    },
    onSuccess: (response) => {
      const { ledger } = response.data;
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-defaulters"] });
      addToast({
        title: "Cheque bounced",
        description: `Cheque bounced. Late fee penalty recalculated from original due date. New total: ₹${Number(ledger.totalAmount).toLocaleString("en-IN")}.`,
        variant: "success",
      });
    },
  });

  const handleOpenClearModal = (cheque: PendingCheque) => {
    setClearingCheque(cheque);
    setActualAmount(cheque.amount.toString());
  };

  const handleConfirmClear = () => {
    if (!clearingCheque) return;

    const parsed = parseFloat(actualAmount);
    if (isNaN(parsed) || parsed <= 0) {
      addToast({
        title: "Invalid amount",
        description: "Please enter a valid cleared amount.",
        variant: "error",
      });
      return;
    }

    const isPartial = parsed < clearingCheque.amount;

    clearMutation.mutate({
      transactionId: clearingCheque.transactionId,
      actualClearedAmount: isPartial ? parsed : undefined,
    });
  };

  const cheques = chequesData?.data ?? [];

  return (
    <div className={cn(
      "ml-64 min-h-screen transition-all duration-300",
      sidebarCollapsed && "ml-[72px]"
    )}>
      <div className="pt-24 px-8 pb-8">
        <div className="mb-8 animate-fade-slide-up">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-3xl font-bold text-on-surface" style={{ fontFamily: "Crimson Text" }}>
              Cheque Reconciliation
            </h2>
            <div className="w-2 h-2 rounded-full bg-primary mt-1 animate-pulse-dot" />
          </div>
          <p className="text-on-surface-variant text-sm font-medium">
            Review and reconcile pending cheques. Cleared cheques will update student balances.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : cheques.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-6xl text-on-surface-variant/30 mb-4 block">
              check_circle
            </span>
            <p className="text-on-surface-variant font-medium">No pending cheques</p>
            <p className="text-on-surface-variant/60 text-sm mt-1">All cheques have been reconciled.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-outline-variant overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant bg-surface/50">
                  <th className="text-left px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Student</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Class</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Cheque No.</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Bank</th>
                  <th className="text-right px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Amount</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Issue Date</th>
                  <th className="text-center px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Days Waiting</th>
                  <th className="text-right px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cheques.map((cheque) => (
                  <tr
                    key={cheque.transactionId}
                    className="border-b border-outline-variant/50 last:border-0 hover:bg-surface/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span className="font-medium text-on-surface text-sm">{cheque.studentName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-on-surface-variant text-sm">{cheque.studentClass} - {cheque.studentSection}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm text-on-surface">{cheque.chequeNumber}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-on-surface-variant text-sm">{cheque.chequeBank}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-semibold text-on-surface text-sm">
                        ₹{cheque.amount.toLocaleString("en-IN")}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-on-surface-variant text-sm">
                        {new Date(cheque.chequeIssueDate).toLocaleDateString("en-IN")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold",
                        cheque.daysWaiting > 7
                          ? "bg-red-100 text-red-700"
                          : cheque.daysWaiting > 3
                            ? "bg-amber-100 text-amber-700"
                            : "bg-green-100 text-green-700"
                      )}>
                        {cheque.daysWaiting}d
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenClearModal(cheque)}
                          disabled={clearMutation.isPending || bounceMutation.isPending}
                          className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Clear
                        </button>
                        <button
                          onClick={() => bounceMutation.mutate(cheque.transactionId)}
                          disabled={clearMutation.isPending || bounceMutation.isPending}
                          className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Bounced
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Clear Cheque Modal */}
      <Dialog open={!!clearingCheque} onOpenChange={(open) => { if (!open) { setClearingCheque(null); setActualAmount(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-on-surface" style={{ fontFamily: "Crimson Text" }}>
              Clear Cheque
            </DialogTitle>
            <DialogDescription className="text-on-surface-variant text-sm">
              Confirm the actual amount cleared by the bank for this cheque.
            </DialogDescription>
          </DialogHeader>

          {clearingCheque && (
            <div className="space-y-4 py-2">
              <div className="bg-surface/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Student</span>
                  <span className="font-medium text-on-surface">{clearingCheque.studentName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Cheque No.</span>
                  <span className="font-mono text-on-surface">{clearingCheque.chequeNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Bank</span>
                  <span className="text-on-surface">{clearingCheque.chequeBank}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Cheque Amount</span>
                  <span className="font-bold text-on-surface">₹{clearingCheque.amount.toLocaleString("en-IN")}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5 block">
                  Actual Amount Cleared by Bank (₹)
                </label>
                <Input
                  type="number"
                  placeholder="Enter cleared amount"
                  value={actualAmount}
                  onChange={(e) => setActualAmount(e.target.value)}
                  min={0}
                  max={clearingCheque.amount}
                  className="bg-white border-outline-variant"
                />
                <p className="text-xs text-on-surface-variant mt-1.5">
                  If the bank deducted charges or partially cleared, enter the actual amount received.
                </p>
              </div>

              {actualAmount && parseFloat(actualAmount) < clearingCheque.amount && parseFloat(actualAmount) > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                  <span className="font-bold">Partial clearance:</span> ₹{(clearingCheque.amount - parseFloat(actualAmount)).toLocaleString("en-IN")} will be marked as bounced.
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setClearingCheque(null); setActualAmount(""); }}
              className="border-outline-variant"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmClear}
              disabled={!actualAmount || parseFloat(actualAmount) <= 0 || clearMutation.isPending}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {clearMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Confirm Clear"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
