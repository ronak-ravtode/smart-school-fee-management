import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api";
import { useSyncStore, type SyncConflict, type ServerConflictState } from "@/store/syncStore";
import { useUIStore } from "@/store/uiStore";

export function SyncManager() {
  const queryClient = useQueryClient();
  const {
    isOnline,
    setOnline,
    removeFromQueue,
    incrementRetryCount,
    markFailedPermanently,
    setSyncing,
    _hasHydrated,
    setActiveConflict,
    resolveConflict,
  } = useSyncStore();
  const { addToast } = useUIStore();
  const syncingRef = useRef(false);
  const prevOnlineRef = useRef(isOnline);

  const syncQueue = useCallback(async () => {
    if (syncingRef.current) return;

    const currentQueue = useSyncStore.getState().pendingQueue;
    // Only process pending items (skip failed_permanently)
    const pendingItems = currentQueue.filter((p) => p.status === "pending");
    if (pendingItems.length === 0) return;

    syncingRef.current = true;
    setSyncing(true);

    addToast({
      title: "Syncing...",
      description: `Processing ${pendingItems.length} pending payment(s).`,
      variant: "default",
    });

    let succeeded = 0;
    let failed = 0;
    let rejected = 0;
    let conflicted = 0;
    let entityDeleted = 0;
    let permanentFailures = 0;

    for (const payload of pendingItems) {
      try {
        await apiClient.post("/transactions/pay", {
          ledgerId: payload.ledgerId,
          amount: payload.amount,
          paymentMethod: payload.paymentMethod,
          transactionRef: payload.transactionRef,
          expectedServerState: payload.expectedServerState,
        });

        removeFromQueue(payload.id);
        succeeded++;

        addToast({
          title: "Payment synced",
          description: `₹${payload.amount.toLocaleString("en-IN")} for ${payload.studentName} synced.`,
          variant: "success",
        });
      } catch (err) {
        // Edge Case 1: 404 — Entity deleted while offline. Discard and log.
        if (err instanceof ApiError && err.statusCode === 404) {
          removeFromQueue(payload.id);
          entityDeleted++;

          addToast({
            title: "Payment discarded",
            description: `Ledger for ${payload.studentName} no longer exists. Payment removed from queue.`,
            variant: "error",
          });

          // Log to audit trail
          try {
            await apiClient.post("/audit-logs", {
              action: "DELETED",
              entityType: "Transaction",
              entityId: payload.id,
              newValue: {
                reason: "Sync Failed: Entity Deleted",
                studentName: payload.studentName,
                amount: payload.amount,
                ledgerId: payload.ledgerId,
                source: "offline_sync",
              },
            }).catch(() => {}); // Best effort
          } catch {
            // Ignore audit log failures
          }
          continue;
        }

        // Edge Case 4: 400/422 — Malformed payload. Fail permanently, don't retry.
        if (
          err instanceof ApiError &&
          (err.statusCode === 400 || err.statusCode === 422)
        ) {
          markFailedPermanently(payload.id);
          permanentFailures++;

          addToast({
            title: "Payment failed permanently",
            description: `₹${payload.amount.toLocaleString("en-IN")} for ${payload.studentName}: ${err.message}. Removed from queue.`,
            variant: "error",
          });
          continue;
        }

        // Step 3: 409 — Conflict detected. Stop queue, open resolution modal.
        if (err instanceof ApiError && err.statusCode === 409) {
          const conflictData = err.details as {
            currentServerState?: ServerConflictState;
          };

          const conflict: SyncConflict = {
            queueItemId: payload.id,
            payload,
            serverState: conflictData?.currentServerState ?? {
              outstandingBalance: 0,
              paidAmount: 0,
              lastUpdatedAt: new Date().toISOString(),
              paidAmountChanged: true,
            },
          };

          syncingRef.current = false;
          setSyncing(false);
          setActiveConflict(conflict);
          conflicted++;

          addToast({
            title: "Sync Conflict Detected",
            description: `Conflicting payment for ${payload.studentName}. Resolution required.`,
            variant: "error",
          });

          return; // Exit loop — admin must resolve
        }

        // Edge Case 4: 5xx or network error — retry if under maxRetries
        if (
          err instanceof ApiError &&
          err.statusCode >= 500 &&
          (payload.retryCount ?? 0) < (payload.maxRetries ?? 3)
        ) {
          incrementRetryCount(payload.id);
          failed++;

          addToast({
            title: "Sync failed",
            description: `Failed to sync ₹${payload.amount.toLocaleString("en-IN")} for ${payload.studentName}. Will retry (${(payload.retryCount ?? 0) + 1}/${payload.maxRetries ?? 3}).`,
            variant: "error",
          });
        } else if (
          err instanceof ApiError &&
          err.statusCode >= 500 &&
          (payload.retryCount ?? 0) >= (payload.maxRetries ?? 3)
        ) {
          // Max retries exceeded on server error
          markFailedPermanently(payload.id);
          permanentFailures++;

          addToast({
            title: "Payment failed permanently",
            description: `₹${payload.amount.toLocaleString("en-IN")} for ${payload.studentName}: max retries exceeded.`,
            variant: "error",
          });
        } else {
          // Network error — keep in queue for retry
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

    const totalProcessed = succeeded + rejected + entityDeleted + permanentFailures;
    if (failed === 0 && conflicted === 0 && totalProcessed > 0) {
      addToast({
        title: "Sync complete",
        description: `${succeeded} synced, ${rejected} rejected, ${entityDeleted} discarded, ${permanentFailures} failed permanently.`,
        variant: "success",
      });
    } else if (failed > 0 || conflicted > 0) {
      addToast({
        title: "Partial sync",
        description: `${succeeded} synced, ${failed} will retry, ${conflicted} conflicts, ${entityDeleted} discarded, ${permanentFailures} failed.`,
        variant: "error",
      });
    }

    syncingRef.current = false;
    setSyncing(false);
  }, [
    removeFromQueue,
    incrementRetryCount,
    markFailedPermanently,
    setSyncing,
    addToast,
    queryClient,
    setActiveConflict,
  ]);

  // Resolve a conflict and continue syncing
  const handleResolve = useCallback(
    async (
      conflict: SyncConflict,
      action: "override" | "adjust" | "discard"
    ) => {
      const { removeFromQueue, addToQueue } = useSyncStore.getState();

      if (action === "discard") {
        removeFromQueue(conflict.queueItemId);
        resolveConflict(conflict.queueItemId);
        addToast({
          title: "Action discarded",
          description: `Payment for ${conflict.payload.studentName} removed.`,
          variant: "default",
        });
      } else if (action === "adjust") {
        const adjustedAmount = Math.min(
          conflict.payload.amount,
          conflict.serverState.outstandingBalance
        );

        if (adjustedAmount <= 0) {
          removeFromQueue(conflict.queueItemId);
          resolveConflict(conflict.queueItemId);
          addToast({
            title: "No balance remaining",
            description: `Payment for ${conflict.payload.studentName} discarded — balance already cleared.`,
            variant: "default",
          });
        } else {
          removeFromQueue(conflict.queueItemId);
          addToQueue({
            ...conflict.payload,
            amount: adjustedAmount,
            expectedServerState: undefined,
          });
          resolveConflict(conflict.queueItemId);
          addToast({
            title: "Amount adjusted",
            description: `Payment adjusted to ₹${adjustedAmount.toLocaleString("en-IN")} for ${conflict.payload.studentName}.`,
            variant: "success",
          });
        }
      } else if (action === "override") {
        removeFromQueue(conflict.queueItemId);
        addToQueue({
          ...conflict.payload,
          expectedServerState: undefined,
        });
        resolveConflict(conflict.queueItemId);
        addToast({
          title: "Override queued",
          description: `Payment of ₹${conflict.payload.amount.toLocaleString("en-IN")} for ${conflict.payload.studentName} forced. May create credit.`,
          variant: "default",
        });
      }

      setTimeout(() => syncQueue(), 500);
    },
    [resolveConflict, addToast, syncQueue]
  );

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

  useEffect(() => {
    (window as any).__syncResolve = handleResolve;
    return () => {
      delete (window as any).__syncResolve;
    };
  }, [handleResolve]);

  return null;
}
