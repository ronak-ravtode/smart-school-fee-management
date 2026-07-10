import { useSyncStore } from "@/store/syncStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, Trash2, Shield } from "lucide-react";

export function SyncConflictModal() {
  const { activeConflict } = useSyncStore();

  if (!activeConflict) return null;

  const { payload, serverState } = activeConflict;

  const handleAction = (action: "override" | "adjust" | "discard") => {
    const resolve = (window as any).__syncResolve;
    if (resolve) {
      resolve(activeConflict, action);
    }
  };

  const adjustedAmount = Math.min(
    payload.amount,
    serverState.outstandingBalance
  );

  return (
    <Dialog open={!!activeConflict} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md border-2 border-red-200 bg-white">
        <DialogHeader>
          <div className="flex justify-center mb-2">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>
          <DialogTitle
            className="text-center text-on-surface text-lg"
            style={{ fontFamily: "Crimson Text" }}
          >
            Sync Conflict Detected
          </DialogTitle>
          <DialogDescription className="text-center text-on-surface-variant text-sm">
            Data changed on the server while you were offline.
          </DialogDescription>
        </DialogHeader>

        {/* Conflict Details */}
        <div className="bg-stone-50 rounded-xl p-4 space-y-3 border border-outline-variant">
          <div className="text-sm">
            <p className="text-on-surface-variant">
              You attempted to record a{" "}
              <span className="font-bold text-on-surface">
                ₹{payload.amount.toLocaleString("en-IN")} {payload.paymentMethod}
              </span>{" "}
              payment for{" "}
              <span className="font-bold text-on-surface">
                {payload.studentName}
              </span>
              .
            </p>
          </div>

          <div className="text-sm">
            <p className="text-on-surface-variant">
              However, while you were offline, the server state changed:
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white rounded-lg p-3 border border-outline-variant">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                Your Recorded Payment
              </p>
              <p className="text-lg font-bold text-on-surface mt-1">
                ₹{payload.amount.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-outline-variant">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                Current Outstanding
              </p>
              <p className="text-lg font-bold text-error mt-1">
                ₹{serverState.outstandingBalance.toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          {serverState.paidAmountChanged && (
            <p className="text-xs text-amber-600 font-medium">
              The paid amount on the server changed from ₹
              {(payload.expectedServerState?.paidAmount ?? 0).toLocaleString("en-IN")} to ₹
              {serverState.paidAmount.toLocaleString("en-IN")} while you were offline.
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 mt-2">
          <Button
            onClick={() => handleAction("override")}
            className="w-full bg-amber-500 text-white hover:bg-amber-600 flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4" />
            Override — Force ₹{payload.amount.toLocaleString("en-IN")} Payment
          </Button>

          <Button
            onClick={() => handleAction("adjust")}
            className="w-full bg-primary text-white hover:bg-primary/90 flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Adjust — Pay ₹{adjustedAmount.toLocaleString("en-IN")} (Current Balance)
          </Button>

          <Button
            onClick={() => handleAction("discard")}
            variant="outline"
            className="w-full border-outline-variant text-on-surface-variant hover:bg-stone-50 flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Discard — Remove This Payment
          </Button>
        </div>

        <p className="text-[10px] text-on-surface-variant text-center mt-1">
          {useSyncStore.getState().conflictQueue.length} conflict(s) remaining in queue.
        </p>
      </DialogContent>
    </Dialog>
  );
}
