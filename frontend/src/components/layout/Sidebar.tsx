import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Receipt,
  Settings,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/uiStore";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Users, label: "Students", href: "/students" },
  { icon: CreditCard, label: "Fee Types", href: "/fee-types" },
  { icon: Receipt, label: "Transactions", href: "/transactions" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const [activeItem, setActiveItem] = useState("/");

  return (
    <aside
      className={cn(
        "glass-sidebar fixed left-0 top-0 z-40 h-screen transition-all duration-300 flex flex-col",
        sidebarCollapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      <div className={cn(
        "flex items-center h-16 border-b border-indigo-100/50",
        sidebarCollapsed ? "justify-center px-2" : "gap-3 px-5"
      )}>
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-indigo-200">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        {!sidebarCollapsed && (
          <span className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            SmartSchool
          </span>
        )}
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.href;
          return (
            <button
              key={item.href}
              onClick={() => setActiveItem(item.href)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive
                  ? "nav-item-active"
                  : "text-slate-500 hover:bg-white/40 hover:text-slate-700"
              )}
            >
              <Icon className={cn(
                "w-5 h-5 shrink-0 transition-colors",
                isActive ? "nav-icon" : "text-slate-400"
              )} />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-indigo-100/50">
        <button
          onClick={toggleSidebar}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-white/40 hover:text-slate-700 transition-all duration-200",
            sidebarCollapsed && "justify-center px-0"
          )}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
