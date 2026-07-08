import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";

export function TopBar() {
  const { sidebarCollapsed } = useUIStore();

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-40 h-20 bg-background/90 backdrop-blur-md flex justify-between items-center px-8 border-b border-outline-variant/50 transition-all duration-300",
        sidebarCollapsed ? "left-[72px]" : "left-64"
      )}
    >
      {/* Search */}
      <div className="flex items-center bg-stone-100 px-4 py-2 rounded-lg w-96 border border-outline-variant focus-within:ring-1 focus-within:ring-primary/30 transition-all">
        <span className="material-symbols-outlined text-stone-400 text-xl">search</span>
        <input
          type="text"
          placeholder="Search students, fees, transactions..."
          className="bg-transparent border-none focus:ring-0 w-full text-sm ml-2 placeholder:text-stone-400 outline-none"
        />
        <span className="text-[10px] text-stone-400 font-bold border border-stone-300 px-1.5 py-0.5 rounded ml-2">
          ⌘K
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-6">
        {/* Notifications */}
        <button className="relative hover:bg-stone-100 p-2 rounded-full transition-all">
          <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-background animate-pulse-dot" />
        </button>

        {/* Profile */}
        <div className="flex items-center gap-3 bg-white border border-outline-variant px-3 py-1.5 rounded-lg hover:border-primary/50 transition-all cursor-pointer shadow-sm">
          <div className="text-right">
            <p className="font-semibold text-xs text-on-surface leading-none">Admin</p>
            <p className="text-[10px] text-on-surface-variant mt-1">admin@school.com</p>
          </div>
          <div className="w-10 h-10 rounded-full overflow-hidden border border-outline-variant bg-stone-50 flex items-center justify-center">
            <span className="material-symbols-outlined text-stone-500">person</span>
          </div>
        </div>
      </div>
    </header>
  );
}
