import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Dashboard } from "@/pages/Dashboard";

function App() {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <TopBar />
      <Dashboard />
    </div>
  );
}

export default App;
