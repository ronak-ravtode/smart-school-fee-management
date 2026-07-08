import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
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
import { useSyncStore, type PaymentPayload, type PaymentMethod } from "@/store/syncStore";
import { CreditCard, Banknote, FileCheck, WifiOff } from "lucide-react";

interface SinglePaymentModalProps {
  studentId: string;
  studentName: string;
  remaining: number;
  ledgerId?: string;
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
}: SinglePaymentModalProps) {
  const { activeModal, closeModal, addToast } = useUIStore();
  const { isOnline, addToQueue } = useSyncStore();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState(remaining.toString());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [transactionRef, setTransactionRef] = useState("");

  const isOpen = activeModal === `payment-${studentId}`;

  const mutation = useMutation({
    mutationFn: async (data: { ledgerId: string; amount: number; paymentMethod: PaymentMethod; transactionRef?: string }) => {
      return apiClient.post("/transactions/pay", {
        ledgerId: data.ledgerId,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        transactionRef: data.transactionRef || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-defaulters"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-revenue"] });
      handleClose();
      addToast({
        title: "Payment recorded",
        description: `₹${parseFloat(amount).toLocaleString("en-IN")} payment for ${studentName} recorded successfully.`,
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
    closeModal();
    setAmount(remaining.toString());
    setPaymentMethod("CASH");
    setTransactionRef("");
  };

  const handleSubmit = async () => {
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
      const payload: PaymentPayload = {
        id: crypto.randomUUID(),
        ledgerId: resolvedLedgerId,
        studentId,
        studentName,
        amount: parsedAmount,
        paymentMethod,
        transactionRef: transactionRef || undefined,
        createdAt: new Date().toISOString(),
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
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && handleClose()}>
      <DialogContent className="paper-stack sm:max-w-md">
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
            disabled={!amount || parseFloat(amount) <= 0 || mutation.isPending || (paymentMethod === "UPI" && !transactionRef)}
            className="bg-primary text-white hover:bg-primary/90"
          >
            {mutation.isPending ? "Processing..." : isOnline ? "Record Payment" : "Save Offline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
