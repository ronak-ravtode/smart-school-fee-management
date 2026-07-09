import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { downloadReceipt } from "@/lib/receipt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUIStore } from "@/store/uiStore";
import { useSyncStore, type PaymentPayload, type PaymentMethod, type ExpectedServerState } from "@/store/syncStore";
import { CreditCard, Banknote, FileCheck, WifiOff, Download, Loader2, CheckCircle2 } from "lucide-react";

interface SinglePaymentModalProps {
  studentId: string;
  studentName: string;
  remaining: number;
  ledgerId?: string;
  totalDue?: number;
  paidAmount?: number;
  ledgerUpdatedAt?: string;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: "CASH", label: "Cash", icon: <Banknote className="w-4 h-4" /> },
  { value: "UPI", label: "UPI", icon: <CreditCard className="w-4 h-4" /> },
  { value: "CHEQUE", label: "Cheque", icon: <FileCheck className="w-4 h-4" /> },
];

export function SinglePaymentModal({
  studentId,
  studentName,
  remaining,
  ledgerId,
  totalDue,
  paidAmount,
  ledgerUpdatedAt,
}: SinglePaymentModalProps) {
  const { activeModal, closeModal, addToast } = useUIStore();
  const { isOnline, addToQueue } = useSyncStore();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState(remaining.toString());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [transactionRef, setTransactionRef] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeBank, setChequeBank] = useState("");
  const [chequeIssueDate, setChequeIssueDate] = useState("");
  const [lastTransactionId, setLastTransactionId] = useState<string | null>(null);
  const [lastWasCheque, setLastWasCheque] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isOpen = activeModal === `payment-${studentId}`;

  const mutation = useMutation({
    mutationFn: async (data: {
      ledgerId: string;
      amount: number;
      paymentMethod: PaymentMethod;
      transactionRef?: string;
      chequeNumber?: string;
      chequeBank?: string;
      chequeIssueDate?: string;
    }) => {
      return apiClient.post<{ transaction: { id: string } }>("/transactions/pay", {
        ledgerId: data.ledgerId,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        transactionRef: data.transactionRef || undefined,
        chequeNumber: data.chequeNumber || undefined,
        chequeBank: data.chequeBank || undefined,
        chequeIssueDate: data.chequeIssueDate || undefined,
      });
    },
    onSuccess: (response) => {
      const txnId = response.data.transaction.id;
      setLastTransactionId(txnId);
      setLastWasCheque(paymentMethod === "CHEQUE");
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-defaulters"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-revenue"] });
      if (paymentMethod === "CHEQUE") {
        queryClient.invalidateQueries({ queryKey: ["pending-cheques"] });
      }
    },
    onError: () => {
      setSubmitting(false);
      addToast({
        title: "Payment failed",
        description: "Failed to record payment. Please try again.",
        variant: "error",
      });
    },
  });

  const handleClose = () => {
    closeModal();
    setAmount(remaining.toString());
    setPaymentMethod("CASH");
    setTransactionRef("");
    setChequeNumber("");
    setChequeBank("");
    setChequeIssueDate("");
    setLastTransactionId(null);
    setLastWasCheque(false);
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      addToast({
        title: "Invalid amount",
        description: "Please enter a valid amount greater than zero.",
        variant: "error",
      });
      return;
    }

    if (parsedAmount > remaining) {
      addToast({
        title: "Amount exceeds balance",
        description: `₹${parsedAmount.toLocaleString("en-IN")} exceeds remaining ₹${remaining.toLocaleString("en-IN")}.`,
        variant: "error",
      });
      return;
    }

    if (paymentMethod === "CHEQUE") {
      if (!chequeNumber.trim()) {
        addToast({
          title: "Cheque number required",
          description: "Please enter the cheque number.",
          variant: "error",
        });
        return;
      }
      if (!chequeBank.trim()) {
        addToast({
          title: "Bank name required",
          description: "Please enter the bank name.",
          variant: "error",
        });
        return;
      }
      if (!chequeIssueDate) {
        addToast({
          title: "Issue date required",
          description: "Please select the cheque issue date.",
          variant: "error",
        });
        return;
      }
    }

    const resolvedLedgerId = ledgerId;

    if (!resolvedLedgerId) {
      addToast({
        title: "Error",
        description: "No ledger found for this student.",
        variant: "error",
      });
      return;
    }

    if (!isOnline) {
      const expectedServerState: ExpectedServerState | undefined =
        totalDue !== undefined && paidAmount !== undefined
          ? {
              outstandingBalance: remaining,
              paidAmount,
              lastUpdatedAt: ledgerUpdatedAt ?? new Date().toISOString(),
            }
          : undefined;

      const payload: PaymentPayload = {
        id: crypto.randomUUID(),
        ledgerId: resolvedLedgerId,
        studentId,
        studentName,
        amount: parsedAmount,
        paymentMethod,
        transactionRef: transactionRef || undefined,
        createdAt: new Date().toISOString(),
        expectedServerState,
      };

      addToQueue(payload);

      queryClient.setQueryData(
        ["dashboard-defaulters"],
        (old: { data: Array<{ studentId: string; remaining: number }> } | undefined) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((d) =>
              d.studentId === studentId
                ? { ...d, remaining: Math.max(0, d.remaining - parsedAmount) }
                : d
            ),
          };
        }
      );

      handleClose();
      addToast({
        title: "Saved offline",
        description: `₹${parsedAmount.toLocaleString("en-IN")} payment for ${studentName} will sync when online.`,
        variant: "default",
      });
      return;
    }

    mutation.mutate({
      ledgerId: resolvedLedgerId,
      amount: parsedAmount,
      paymentMethod,
      transactionRef: transactionRef || undefined,
      chequeNumber: paymentMethod === "CHEQUE" ? chequeNumber.trim() : undefined,
      chequeBank: paymentMethod === "CHEQUE" ? chequeBank.trim() : undefined,
      chequeIssueDate: paymentMethod === "CHEQUE" ? chequeIssueDate : undefined,
    });
  };

  const handleDownloadReceipt = async () => {
    if (!lastTransactionId) return;
    try {
      await downloadReceipt(lastTransactionId);
      addToast({
        title: "Receipt downloaded",
        description: "PDF receipt has been saved to your downloads.",
        variant: "success",
      });
    } catch {
      addToast({
        title: "Download failed",
        description: "Could not download receipt. Please try again.",
        variant: "error",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        {lastTransactionId ? (
          /* Success State */
          <>
            <DialogHeader>
              <div className="flex justify-center mb-2">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </div>
              </div>
              <DialogTitle className="text-center text-on-surface" style={{ fontFamily: "Crimson Text" }}>
                {lastWasCheque ? "Cheque Recorded" : "Payment Recorded"}
              </DialogTitle>
              <DialogDescription className="text-center text-on-surface-variant text-sm">
                Rs. {parseFloat(amount).toLocaleString("en-IN")} payment for{" "}
                <span className="font-semibold text-on-surface">{studentName}</span>{" "}
                {lastWasCheque
                  ? "recorded as pending clearance. The student's balance will not update until the cheque clears."
                  : "recorded successfully."}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                onClick={handleDownloadReceipt}
                className="w-full bg-primary text-white hover:bg-primary/90 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Receipt (PDF)
              </Button>
              <Button
                variant="ghost"
                onClick={handleClose}
                className="w-full"
              >
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* Payment Form */
          <>
            <DialogHeader>
              <DialogTitle className="text-on-surface" style={{ fontFamily: "Crimson Text" }}>
                Record Payment
              </DialogTitle>
              <DialogDescription className="text-on-surface-variant text-sm">
                Recording payment for <span className="font-semibold text-on-surface">{studentName}</span>
                <br />
                Remaining: <span className="font-bold text-primary">₹{remaining.toLocaleString("en-IN")}</span>
              </DialogDescription>
            </DialogHeader>

            {!isOnline && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                <WifiOff className="w-4 h-4 flex-shrink-0" />
                <span>Payment will be saved offline and synced later.</span>
              </div>
            )}

            <div className="space-y-4 py-2">
              {/* Amount */}
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5 block">
                  Amount (₹)
                </label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  max={remaining}
                  min={0}
                  className="bg-white border-outline-variant"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5 block">
                  Payment Method
                </label>
                <div className="flex gap-2">
                  {PAYMENT_METHODS.map((method) => (
                    <Button
                      key={method.value}
                      variant={paymentMethod === method.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPaymentMethod(method.value)}
                      className={`flex items-center gap-2 ${
                        paymentMethod === method.value
                          ? "bg-primary text-white hover:bg-primary/90"
                          : "border-outline-variant"
                      }`}
                    >
                      {method.icon}
                      {method.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Transaction Ref (required for UPI) */}
              {paymentMethod === "UPI" && (
                <div>
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5 block">
                    Transaction Reference *
                  </label>
                  <Input
                    type="text"
                    placeholder="UPI Transaction ID"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    className="bg-white border-outline-variant"
                  />
                </div>
              )}

              {/* Cheque Details (required for CHEQUE) */}
              {paymentMethod === "CHEQUE" && (
                <>
                  <div>
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5 block">
                      Cheque Number *
                    </label>
                    <Input
                      type="text"
                      placeholder="Cheque number"
                      value={chequeNumber}
                      onChange={(e) => setChequeNumber(e.target.value)}
                      className="bg-white border-outline-variant"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5 block">
                      Bank Name *
                    </label>
                    <Input
                      type="text"
                      placeholder="Bank name"
                      value={chequeBank}
                      onChange={(e) => setChequeBank(e.target.value)}
                      className="bg-white border-outline-variant"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5 block">
                      Cheque Issue Date *
                    </label>
                    <Input
                      type="date"
                      value={chequeIssueDate}
                      onChange={(e) => setChequeIssueDate(e.target.value)}
                      className="bg-white border-outline-variant"
                    />
                  </div>
                </>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                className="border-outline-variant"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !amount || parseFloat(amount) <= 0 || mutation.isPending || (paymentMethod === "UPI" && !transactionRef) || (paymentMethod === "CHEQUE" && (!chequeNumber.trim() || !chequeBank.trim() || !chequeIssueDate))}
                className="bg-primary text-white hover:bg-primary/90"
              >
                {submitting || mutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : isOnline ? (
                  "Record Payment"
                ) : (
                  "Save Offline"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
