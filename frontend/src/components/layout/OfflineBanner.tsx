import { useSyncStore } from "@/store/syncStore";
import { WifiOff, Loader2 } from "lucide-react";

export function OfflineBanner() {
  const { isOnline, pendingQueue, isSyncing } = useSyncStore();

  if (isOnline && pendingQueue.length === 0 && !isSyncing) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors duration-300 ${
        !isOnline
          ? "bg-rose-600 text-white"
          : isSyncing
          ? "bg-amber-500 text-white"
          : "bg-emerald-600 text-white"
      }`}
    >
      {!isOnline ? (
        <>
          <WifiOff className="w-4 h-4" />
          <span>Offline Mode — Data will sync automatically when connected</span>
          {pendingQueue.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
              {pendingQueue.length} pending
            </span>
          )}
        </>
      ) : isSyncing ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Syncing {pendingQueue.length} pending payment(s)...</span>
        </>
      ) : null}
    </div>
  );
}
