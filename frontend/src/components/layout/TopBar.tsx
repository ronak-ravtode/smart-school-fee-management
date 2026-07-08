import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useUIStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import { LogOut, User, Shield } from "lucide-react";

export function TopBar() {
  const { sidebarCollapsed } = useUIStore();
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // Ignore
    }
    logout();
    queryClient.clear();
    navigate("/login", { replace: true });
  };

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
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative hover:bg-stone-100 p-2 rounded-full transition-all">
          <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-background animate-pulse-dot" />
        </button>

        {/* Profile Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-3 bg-white border border-outline-variant px-3 py-1.5 rounded-lg hover:border-primary/50 transition-all cursor-pointer shadow-sm"
          >
            <div className="text-right">
              <p className="font-semibold text-xs text-on-surface leading-none">{user?.name || "User"}</p>
              <p className="text-[10px] text-on-surface-variant mt-1">{user?.email || ""}</p>
            </div>
            <div className="w-10 h-10 rounded-full overflow-hidden border border-outline-variant bg-stone-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-stone-500">person</span>
            </div>
          </button>

          {/* Dropdown Menu */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border border-outline-variant shadow-lg py-1 z-50">
              {/* User Info */}
              <div className="px-4 py-3 border-b border-outline-variant">
                <p className="text-sm font-bold text-on-surface">{user?.name}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">{user?.email}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <Shield className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                    {user?.role}
                  </span>
                </div>
              </div>

              {/* Menu Items */}
              <div className="py-1">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-stone-50 transition-colors"
                >
                  <User className="w-4 h-4 text-on-surface-variant" />
                  My Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-error/5 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
