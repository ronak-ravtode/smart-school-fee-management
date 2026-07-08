import { create } from "zustand";

interface UIState {
  sidebarCollapsed: boolean;
  activeModal: string | null;
  toasts: Toast[];

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
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
  toasts: [],

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  openModal: (modalId) => set({ activeModal: modalId }),
  closeModal: () => set({ activeModal: null }),
  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: Math.random().toString(36).slice(2) }],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
