import { Bell, Search, User } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";

export function TopBar() {
  const { sidebarCollapsed } = useUIStore();

  return (
    <header
      className={cn(
        "glass-topbar fixed top-0 right-0 z-30 h-16 flex items-center justify-between px-6 transition-all duration-300",
        sidebarCollapsed ? "left-[72px]" : "left-[260px]"
      )}
    >
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative w-full group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          <input
            type="text"
            placeholder="Search students, fees, transactions..."
            className="w-full h-10 pl-11 pr-4 rounded-xl bg-white/50 border border-slate-200/50 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-300 focus:bg-white/80 transition-all duration-200"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="relative p-2.5 rounded-xl text-slate-500 hover:bg-white/50 hover:text-slate-700 transition-all duration-200">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
        </button>

        <div className="w-px h-8 bg-slate-200/50 mx-1" />

        <button className="flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-xl hover:bg-white/50 transition-all duration-200">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-md shadow-indigo-200">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-semibold text-slate-700">Admin</p>
            <p className="text-xs text-slate-500">admin@school.com</p>
          </div>
        </button>
      </div>
    </header>
  );
}
