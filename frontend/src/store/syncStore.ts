import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type PaymentMethod = "CASH" | "UPI" | "CHEQUE";

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
}

interface SyncState {
  isOnline: boolean;
  pendingQueue: PaymentPayload[];
  isSyncing: boolean;
  _hasHydrated: boolean;

  setOnline: (online: boolean) => void;
  addToQueue: (payload: PaymentPayload) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  setSyncing: (syncing: boolean) => void;
  setHasHydrated: (hydrated: boolean) => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      pendingQueue: [],
      isSyncing: false,
      _hasHydrated: false,

      setOnline: (online) => set({ isOnline: online }),

      addToQueue: (payload) =>
        set((state) => ({
          pendingQueue: [...state.pendingQueue, payload],
        })),

      removeFromQueue: (id) =>
        set((state) => ({
          pendingQueue: state.pendingQueue.filter((p) => p.id !== id),
        })),

      clearQueue: () => set({ pendingQueue: [] }),

      setSyncing: (syncing) => set({ isSyncing: syncing }),

      setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }),
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
