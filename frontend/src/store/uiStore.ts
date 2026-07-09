import { create } from "zustand";

interface UIState {
  sidebarCollapsed: boolean;
  activeModal: string | null;
  activeDrawer: DrawerState | null;
  toasts: Toast[];

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
  openDrawer: (drawer: DrawerState) => void;
  closeDrawer: () => void;
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

export interface DrawerState {
  type: "record-payment";
  studentId: string;
  studentName: string;
  remaining: number;
  ledgerId: string;
  riskTier: string;
  totalDue?: number;
  paidAmount?: number;
}

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "error";
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  activeModal: null,
  activeDrawer: null,
  toasts: [],

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  openModal: (modalId) => set({ activeModal: modalId }),
  closeModal: () => set({ activeModal: null }),
  openDrawer: (drawer) => set({ activeDrawer: drawer }),
  closeDrawer: () => set({ activeDrawer: null }),
  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: Math.random().toString(36).slice(2) }],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
