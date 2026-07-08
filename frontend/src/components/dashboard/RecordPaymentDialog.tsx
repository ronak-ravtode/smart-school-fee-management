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

interface RecordPaymentDialogProps {
  studentId: string;
  studentName: string;
  remaining: number;
}

export function RecordPaymentDialog({
  studentId,
  studentName,
  remaining,
}: RecordPaymentDialogProps) {
  const { activeModal, closeModal } = useUIStore();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI" | "CHEQUE">("CASH");

  const isOpen = activeModal === `payment-${studentId}`;

  const mutation = useMutation({
    mutationFn: async (data: { amount: number; paymentMethod: string }) => {
      const ledgers = await apiClient.get<{ id: string }[]>(
        `/ledgers/student/${studentId}`
      );
      const ledgerId = ledgers.data[0]?.id;
      if (!ledgerId) throw new Error("No ledger found");

      return apiClient.post("/transactions/pay", {
        ledgerId,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-defaulters"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-revenue"] });
      closeModal();
      setAmount("");
    },
  });

  const handleSubmit = () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    if (parsedAmount > remaining) return;
    mutation.mutate({ amount: parsedAmount, paymentMethod });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && closeModal()}>
      <DialogContent className="bg-white/95 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Record Payment</DialogTitle>
          <DialogDescription className="text-slate-600">
            Recording payment for {studentName}. Remaining: ₹{remaining.toLocaleString("en-IN")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">
              Amount (₹)
            </label>
            <Input
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              max={remaining}
              min={0}
              className="bg-white"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">
              Payment Method
            </label>
            <div className="flex gap-2">
              {(["CASH", "UPI", "CHEQUE"] as const).map((method) => (
                <Button
                  key={method}
                  variant={paymentMethod === method ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPaymentMethod(method)}
                >
                  {method}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeModal}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!amount || parseFloat(amount) <= 0 || mutation.isPending}
          >
            {mutation.isPending ? "Processing..." : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
