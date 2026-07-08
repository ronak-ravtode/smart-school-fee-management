import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api";
import { useSyncStore } from "@/store/syncStore";
import { useUIStore } from "@/store/uiStore";

export function SyncManager() {
  const queryClient = useQueryClient();
  const { isOnline, setOnline, removeFromQueue, setSyncing, _hasHydrated } =
    useSyncStore();
  const { addToast } = useUIStore();
  const syncingRef = useRef(false);
  const prevOnlineRef = useRef(isOnline);

  const syncQueue = useCallback(async () => {
    if (syncingRef.current) return;

    const currentQueue = useSyncStore.getState().pendingQueue;
    if (currentQueue.length === 0) return;

    syncingRef.current = true;
    setSyncing(true);

    addToast({
      title: "Syncing...",
      description: `Processing ${currentQueue.length} pending payment(s).`,
      variant: "default",
    });

    const queue = [...currentQueue];
    let succeeded = 0;
    let failed = 0;
    let rejected = 0;

    for (const payload of queue) {
      try {
        await apiClient.post("/transactions/pay", {
          ledgerId: payload.ledgerId,
          amount: payload.amount,
          paymentMethod: payload.paymentMethod,
          transactionRef: payload.transactionRef,
        });

        removeFromQueue(payload.id);
        succeeded++;

        addToast({
          title: "Payment synced",
          description: `₹${payload.amount.toLocaleString("en-IN")} for ${payload.studentName} synced.`,
          variant: "success",
        });
      } catch (err) {
        if (err instanceof ApiError && err.statusCode >= 400 && err.statusCode < 500) {
          removeFromQueue(payload.id);
          rejected++;
          addToast({
            title: "Payment rejected",
            description: `₹${payload.amount.toLocaleString("en-IN")} for ${payload.studentName} rejected: ${err.message}. Removed from queue.`,
            variant: "error",
          });
        } else {
          failed++;
          addToast({
            title: "Sync failed",
            description: `Failed to sync ₹${payload.amount.toLocaleString("en-IN")} for ${payload.studentName}. Will retry.`,
            variant: "error",
          });
        }
      }
    }

    queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-defaulters"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-revenue"] });

    const totalProcessed = succeeded + rejected;
    if (failed === 0 && totalProcessed > 0) {
      addToast({
        title: "Sync complete",
        description: `${succeeded} synced, ${rejected} rejected.`,
        variant: "success",
      });
    } else if (failed > 0) {
      addToast({
        title: "Partial sync",
        description: `${succeeded} synced, ${failed} will retry, ${rejected} rejected.`,
        variant: "error",
      });
    }

    syncingRef.current = false;
    setSyncing(false);
  }, [removeFromQueue, setSyncing, addToast, queryClient]);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setOnline]);

  useEffect(() => {
    if (!_hasHydrated) return;

    const justCameOnline = !prevOnlineRef.current && isOnline;
    prevOnlineRef.current = isOnline;

    if (justCameOnline) {
      const queue = useSyncStore.getState().pendingQueue;
      if (queue.length > 0) {
        syncQueue();
      }
    }
  }, [isOnline, _hasHydrated, syncQueue]);

  return null;
}
