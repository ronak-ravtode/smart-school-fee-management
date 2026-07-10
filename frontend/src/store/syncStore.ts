import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type PaymentMethod = "CASH" | "UPI" | "CHEQUE";

// Snapshot of server state when admin queued the action offline
export interface ExpectedServerState {
  outstandingBalance: number;
  paidAmount: number;
  lastUpdatedAt: string;
}

export interface PaymentPayload {
  id: string;
  ledgerId: string;
  studentId: string;
  studentName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  transactionRef?: string;
  receiptNumber?: string;
  createdAt: string;
  // Edge Case: Conflict detection
  expectedServerState?: ExpectedServerState;
  // Edge Case 4: Retry tracking (set by addToQueue)
  retryCount?: number;
  maxRetries?: number;
  // Edge Case 1: Status tracking (set by addToQueue)
  status?: "pending" | "failed_permanently";
}

// Conflict details returned from backend on 409
export interface ServerConflictState {
  outstandingBalance: number;
  paidAmount: number;
  lastUpdatedAt: string;
  paidAmountChanged: boolean;
}

export interface SyncConflict {
  queueItemId: string;
  payload: PaymentPayload;
  serverState: ServerConflictState;
}

const MAX_RETRIES = 3;
const DEDUP_WINDOW_MS = 10_000; // 10 seconds

interface SyncState {
  isOnline: boolean;
  pendingQueue: PaymentPayload[];
  isSyncing: boolean;
  _hasHydrated: boolean;
  // Conflict resolution
  activeConflict: SyncConflict | null;
  conflictQueue: SyncConflict[];

  setOnline: (online: boolean) => void;
  addToQueue: (payload: PaymentPayload) => void;
  removeFromQueue: (id: string) => void;
  incrementRetryCount: (id: string) => void;
  markFailedPermanently: (id: string) => void;
  clearQueue: () => void;
  setSyncing: (syncing: boolean) => void;
  setHasHydrated: (hydrated: boolean) => void;
  // Conflict actions
  setActiveConflict: (conflict: SyncConflict | null) => void;
  resolveConflict: (queueItemId: string) => void;
  nextConflict: () => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      pendingQueue: [],
      isSyncing: false,
      _hasHydrated: false,
      activeConflict: null,
      conflictQueue: [],

      setOnline: (online) => set({ isOnline: online }),

      addToQueue: (payload) =>
        set((state) => {
          // Edge Case 2: Deduplicate — drop if same ledgerId + amount within 10 seconds
          const now = Date.now();
          const isDuplicate = state.pendingQueue.some((existing) => {
            const timeDiff = now - new Date(existing.createdAt).getTime();
            return (
              existing.ledgerId === payload.ledgerId &&
              existing.amount === payload.amount &&
              existing.paymentMethod === payload.paymentMethod &&
              timeDiff < DEDUP_WINDOW_MS &&
              existing.status !== "failed_permanently"
            );
          });

          if (isDuplicate) {
            return state; // Drop duplicate
          }

          return {
            pendingQueue: [
              ...state.pendingQueue,
              {
                ...payload,
                retryCount: payload.retryCount ?? 0,
                maxRetries: payload.maxRetries ?? MAX_RETRIES,
                status: payload.status ?? "pending",
              },
            ],
          };
        }),

      removeFromQueue: (id) =>
        set((state) => ({
          pendingQueue: state.pendingQueue.filter((p) => p.id !== id),
        })),

      incrementRetryCount: (id) =>
        set((state) => ({
          pendingQueue: state.pendingQueue.map((p) =>
            p.id === id ? { ...p, retryCount: (p.retryCount ?? 0) + 1 } : p
          ),
        })),

      markFailedPermanently: (id) =>
        set((state) => ({
          pendingQueue: state.pendingQueue.map((p) =>
            p.id === id ? { ...p, status: "failed_permanently" } : p
          ),
        })),

      clearQueue: () => set({ pendingQueue: [] }),

      setSyncing: (syncing) => set({ isSyncing: syncing }),

      setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }),

      setActiveConflict: (conflict) => set({ activeConflict: conflict }),

      resolveConflict: (queueItemId) =>
        set((state) => ({
          conflictQueue: state.conflictQueue.filter((c) => c.queueItemId !== queueItemId),
          activeConflict:
            state.activeConflict?.queueItemId === queueItemId
              ? state.conflictQueue.find((c) => c.queueItemId !== queueItemId) ?? null
              : state.activeConflict,
        })),

      nextConflict: () =>
        set((state) => {
          if (!state.activeConflict) return {};
          const remaining = state.conflictQueue.filter(
            (c) => c.queueItemId !== state.activeConflict!.queueItemId
          );
          return {
            conflictQueue: remaining,
            activeConflict: remaining[0] ?? null,
          };
        }),
    }),
    {
      name: "smartschool-sync-queue",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        pendingQueue: state.pendingQueue,
      }),
      onRehydrateStorage: () => {
        return (_state, _error) => {
          useSyncStore.getState().setHasHydrated(true);
        };
      },
    }
  )
);
