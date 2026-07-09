import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { SyncManager } from "@/components/sync/SyncManager";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { BulkReconciliation } from "@/pages/BulkReconciliation";
import { ChequeReconciliation } from "@/pages/ChequeReconciliation";
import { AuditLogTable } from "@/pages/AuditLogTable";
import { FeeTypesPage } from "@/pages/fee-types/FeeTypesPage";
import { FeeStructuresPage } from "@/pages/fee-types/FeeStructuresPage";
import { GenerateLedgerPage } from "@/pages/ledgers/GenerateLedgerPage";
import { useSyncStore } from "@/store/syncStore";
import { useAuthStore } from "@/store/authStore";
import { apiClient } from "@/lib/api";

function App() {
  const { isOnline } = useSyncStore();
  const { setUser, setLoading } = useAuthStore();
  const bannerOffset = !isOnline ? "pt-10" : "";

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await apiClient.get<{ user: { id: string; email: string; name: string; role: "ADMIN" | "CASHIER" } }>("/auth/me");
        setUser(response.data.user);
      } catch {
        setUser(null);
      }
    };
    checkAuth();
  }, [setUser, setLoading]);

  return (
    <BrowserRouter>
      <SyncManager />
      <OfflineBanner />
      <div className={`min-h-screen ${bannerOffset} transition-all duration-300`}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Sidebar />
                <TopBar />
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/bulk-reconciliation" element={<BulkReconciliation />} />
                  <Route path="/cheque-reconciliation" element={<ChequeReconciliation />} />
                  <Route
                    path="/audit-trail"
                    element={
                      <ProtectedRoute allowedRoles={["ADMIN"]}>
                        <AuditLogTable />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/fee-types"
                    element={
                      <ProtectedRoute allowedRoles={["ADMIN"]}>
                        <FeeTypesPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/fee-structures"
                    element={
                      <ProtectedRoute allowedRoles={["ADMIN"]}>
                        <FeeStructuresPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/ledgers/generate"
                    element={
                      <ProtectedRoute allowedRoles={["ADMIN"]}>
                        <GenerateLedgerPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
