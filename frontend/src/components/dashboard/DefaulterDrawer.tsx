import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useUIStore } from "@/store/uiStore";
import { useSyncStore, type PaymentMethod } from "@/store/syncStore";
import { cn } from "@/lib/utils";
import { X, Loader2, CreditCard, Banknote, FileCheck, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: "CASH", label: "Cash", icon: <Banknote className="w-4 h-4" /> },
  { value: "UPI", label: "UPI", icon: <CreditCard className="w-4 h-4" /> },
  { value: "CHEQUE", label: "Cheque", icon: <FileCheck className="w-4 h-4" /> },
];

export function DefaulterDrawer() {
  const { activeDrawer, closeDrawer, addToast } = useUIStore();
  const { isOnline } = useSyncStore();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [transactionRef, setTransactionRef] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeBank, setChequeBank] = useState("");
  const [chequeIssueDate, setChequeIssueDate] = useState("");

  const isOpen = activeDrawer?.type === "record-payment";

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
      return apiClient.post("/transactions/pay", {
        ledgerId: data.ledgerId,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        transactionRef: data.transactionRef || undefined,
        chequeNumber: data.chequeNumber || undefined,
        chequeBank: data.chequeBank || undefined,
        chequeIssueDate: data.chequeIssueDate || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-defaulters"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-revenue"] });
      queryClient.invalidateQueries({ queryKey: ["defaulter-tracker"] });
      handleClose();
      addToast({
        title: "Payment recorded",
        description: `Payment for ${activeDrawer?.studentName} recorded successfully.`,
        variant: "success",
      });
    },
    onError: () => {
      addToast({
        title: "Payment failed",
        description: "Failed to record payment. Please try again.",
        variant: "error",
      });
    },
  });

  const handleClose = () => {
    closeDrawer();
    setAmount("");
    setPaymentMethod("CASH");
    setTransactionRef("");
    setChequeNumber("");
    setChequeBank("");
    setChequeIssueDate("");
  };

  const handleSubmit = () => {
    if (!activeDrawer) return;
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      addToast({ title: "Invalid amount", description: "Enter a valid amount.", variant: "error" });
      return;
    }
    if (parsedAmount > activeDrawer.remaining) {
      addToast({
        title: "Amount exceeded",
        description: `Rs. ${parsedAmount.toLocaleString("en-IN")} exceeds remaining Rs. ${activeDrawer.remaining.toLocaleString("en-IN")}.`,
        variant: "error",
      });
      return;
    }
    if (paymentMethod === "CHEQUE" && (!chequeNumber || !chequeBank || !chequeIssueDate)) {
      addToast({ title: "Cheque details required", description: "Fill in all cheque fields.", variant: "error" });
      return;
    }
    if (paymentMethod === "UPI" && !transactionRef) {
      addToast({ title: "Transaction ref required", description: "Enter UPI transaction ID.", variant: "error" });
      return;
    }

    mutation.mutate({
      ledgerId: activeDrawer.ledgerId,
      amount: parsedAmount,
      paymentMethod,
      transactionRef: transactionRef || undefined,
      chequeNumber: paymentMethod === "CHEQUE" ? chequeNumber : undefined,
      chequeBank: paymentMethod === "CHEQUE" ? chequeBank : undefined,
      chequeIssueDate: paymentMethod === "CHEQUE" ? chequeIssueDate : undefined,
    });
  };

  if (!isOpen || !activeDrawer) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={handleClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
          <div>
            <h3 className="text-lg font-bold text-on-surface" style={{ fontFamily: "Crimson Text" }}>
              Record Payment
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              {activeDrawer.studentName}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Student info */}
          <div className="bg-surface/50 rounded-lg p-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-on-surface-variant">Student</span>
              <span className="font-semibold text-on-surface">{activeDrawer.studentName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Outstanding</span>
              <span className="font-bold text-error">
                Rs. {activeDrawer.remaining.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {!isOnline && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              <WifiOff className="w-4 h-4 flex-shrink-0" />
              <span>Payment will be saved offline.</span>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5 block">
              Amount (Rs.)
            </label>
            <Input
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              max={activeDrawer.remaining}
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
                  className={cn(
                    "flex items-center gap-2",
                    paymentMethod === method.value
                      ? "bg-primary text-white hover:bg-primary/90"
                      : "border-outline-variant"
                  )}
                >
                  {method.icon}
                  {method.label}
                </Button>
              ))}
            </div>
          </div>

          {/* UPI Ref */}
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

          {/* Cheque details */}
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
                  Issue Date *
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

        {/* Footer */}
        <div className="px-6 py-4 border-t border-outline-variant flex gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            className="flex-1 border-outline-variant"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !amount ||
              parseFloat(amount) <= 0 ||
              mutation.isPending ||
              (paymentMethod === "UPI" && !transactionRef) ||
              (paymentMethod === "CHEQUE" && (!chequeNumber || !chequeBank || !chequeIssueDate))
            }
            className="flex-1 bg-primary text-white hover:bg-primary/90"
          >
            {mutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
            ) : (
              "Record Payment"
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
