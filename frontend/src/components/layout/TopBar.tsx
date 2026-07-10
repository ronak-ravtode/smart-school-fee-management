import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useUIStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import { useSyncStore } from "@/store/syncStore";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import { LogOut, User, Shield, CheckCircle, Loader2, AlertCircle, CloudOff, Menu } from "lucide-react";

export function TopBar() {
  const { sidebarCollapsed, openMobileSidebar } = useUIStore();
  const { user, logout } = useAuthStore();
  const { isOnline, pendingQueue, isSyncing, activeConflict } = useSyncStore();
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

  const queueCount = pendingQueue.length;
  const hasConflicts = !!activeConflict;

  // Step 4: Sync status indicator
  const getSyncStatus = () => {
    if (hasConflicts) {
      return {
        icon: <AlertCircle className="w-4 h-4" />,
        label: `${queueCount} action(s) need attention`,
        bgClass: "bg-red-50 border-red-200 text-red-700",
        pulse: false,
      };
    }
    if (isSyncing) {
      return {
        icon: <Loader2 className="w-4 h-4 animate-spin" />,
        label: `Syncing ${queueCount} action(s)...`,
        bgClass: "bg-amber-50 border-amber-200 text-amber-700",
        pulse: false,
      };
    }
    if (!isOnline) {
      return {
        icon: <CloudOff className="w-4 h-4" />,
        label: `${queueCount} pending`,
        bgClass: "bg-stone-100 border-stone-300 text-stone-600",
        pulse: queueCount > 0,
      };
    }
    if (queueCount > 0) {
      return {
        icon: <Loader2 className="w-4 h-4 animate-spin" />,
        label: `${queueCount} pending`,
        bgClass: "bg-amber-50 border-amber-200 text-amber-700",
        pulse: false,
      };
    }
    return {
      icon: <CheckCircle className="w-4 h-4" />,
      label: "All synced",
      bgClass: "bg-green-50 border-green-200 text-green-700",
      pulse: false,
    };
  };

  const syncStatus = getSyncStatus();

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-40 h-14 md:h-16 lg:h-20 bg-background/90 backdrop-blur-md flex items-center pr-3 md:pr-5 lg:pr-8 border-b border-outline-variant/50 transition-all duration-300",
        sidebarCollapsed ? "xl:left-[72px]" : "xl:left-60"
      )}
    >
      {/* Hamburger - only on mobile/tablet */}
      <button
        onClick={openMobileSidebar}
        className="p-2 ml-1 md:ml-2 rounded-lg hover:bg-stone-100 transition-colors flex-shrink-0 lg:hidden"
      >
        <Menu className="w-5 h-5 text-on-surface-variant" />
      </button>

      {/* Search - hidden below lg */}
      <div className="hidden lg:flex items-center bg-stone-100 px-4 py-2 rounded-lg w-64 xl:w-80 2xl:w-96 border border-outline-variant focus-within:ring-1 focus-within:ring-primary/30 transition-all ml-3 flex-shrink-0">
        <span className="material-symbols-outlined text-stone-400 text-xl">search</span>
        <input
          type="text"
          placeholder="Search students, fees, transactions..."
          className="bg-transparent border-none focus:ring-0 w-full text-sm ml-2 placeholder:text-stone-400 outline-none"
        />
        <span className="text-[10px] text-stone-400 font-bold border border-stone-300 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">
          ⌘K
        </span>
      </div>

      {/* Spacer pushes right items to the edge */}
      <div className="flex-1" />

      {/* Right: Sync Status + Notifications + Profile */}
      <div className="flex items-center gap-1.5 md:gap-3 lg:gap-4 flex-shrink-0">
        {/* Step 4: Sync Status Indicator - hidden below md */}
        <div
          className={cn(
            "hidden md:flex items-center gap-2 px-2.5 lg:px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-default",
            syncStatus.bgClass
          )}
        >
          {syncStatus.icon}
          <span className="hidden xl:inline">{syncStatus.label}</span>
        </div>

        {/* Notifications */}
        <button className="relative hover:bg-stone-100 p-2 rounded-full transition-all">
          <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full border-2 border-background animate-pulse-dot" />
        </button>

        {/* Profile Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 hover:bg-stone-50 rounded-full transition-all cursor-pointer p-0.5"
          >
            <div className="w-9 h-9 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              {(user?.name || "U").charAt(0).toUpperCase()}
            </div>
          </button>

          {/* Dropdown Menu */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-xl border border-outline-variant shadow-xl py-1 z-50 animate-fade-in">
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
