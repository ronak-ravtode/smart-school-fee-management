import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { SyncManager } from "@/components/sync/SyncManager";
import { Dashboard } from "@/pages/Dashboard";
import { BulkReconciliation } from "@/pages/BulkReconciliation";
import { useSyncStore } from "@/store/syncStore";

function App() {
  const { isOnline } = useSyncStore();
  const bannerOffset = !isOnline ? "pt-10" : "";

  return (
    <BrowserRouter>
      <SyncManager />
      <OfflineBanner />
      <div className={`min-h-screen ${bannerOffset} transition-all duration-300`}>
        <Sidebar />
        <TopBar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/bulk-reconciliation" element={<BulkReconciliation />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
