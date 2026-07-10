import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

let socket: Socket | null = null;
let reconnectCallback: (() => void) | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      withCredentials: true,
      // Edge Case 2: Auto-reconnect with exponential backoff
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    });

    // Edge Case 2: On reconnect, force-fetch latest dashboard data
    socket.on("connect", () => {
      console.log(`Socket connected: ${socket?.id}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`Socket disconnected: ${reason}`);
      // Auto-reconnect unless explicitly disconnected
      if (reason === "io server disconnect") {
        socket?.connect();
      }
    });

    socket.on("reconnect", (attemptNumber) => {
      console.log(`Socket reconnected after ${attemptNumber} attempts`);
      // Force-fetch dashboard data to reconcile any missed events
      if (reconnectCallback) {
        reconnectCallback();
      }
    });

    socket.on("reconnect_attempt", (attemptNumber) => {
      console.log(`Socket reconnect attempt #${attemptNumber}`);
    });

    socket.on("reconnect_error", (error) => {
      console.warn(`Socket reconnect error: ${error.message}`);
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

// Edge Case 2: Register callback to force-fetch data on reconnect
export function onReconnect(callback: () => void): () => void {
  reconnectCallback = callback;
  return () => {
    reconnectCallback = null;
  };
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    reconnectCallback = null;
  }
}

export interface PaymentVerifiedEvent {
  studentId?: string;
  studentName?: string;
  amount: number;
  transactionId: string;
  ledgerId: string;
  ledgerStatus: string;
  newTotalRevenue: number;
  newTotalPending: number;
  timestamp: string;
}

export interface RefundVerifiedEvent {
  studentId?: string;
  studentName?: string;
  refundAmount: number;
  transactionId: string;
  ledgerId: string;
  ledgerStatus: string;
  newTotalRevenue: number;
  newTotalPending: number;
  timestamp: string;
}
