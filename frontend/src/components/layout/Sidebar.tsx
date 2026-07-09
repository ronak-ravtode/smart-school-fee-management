import { Link, useLocation } from "react-router-dom";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  materialIcon: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", materialIcon: "dashboard" },
  { label: "Defaulter Tracker", href: "/defaulter-tracker", materialIcon: "priority_high" },
  { label: "Students", href: "/students", materialIcon: "group" },
  { label: "Fee Types", href: "/fee-types", materialIcon: "payments" },
  { label: "Fee Structures", href: "/fee-structures", materialIcon: "account_tree" },
  { label: "Generate Ledgers", href: "/ledgers/generate", materialIcon: "receipt_long" },
  { label: "Transactions", href: "/transactions", materialIcon: "receipt_long" },
  { label: "Bulk Reconcile", href: "/bulk-reconciliation", materialIcon: "receipt_long" },
  { label: "Cheque Reconciliation", href: "/cheque-reconciliation", materialIcon: "account_balance" },
  { label: "Audit Trail", href: "/audit-trail", materialIcon: "history" },
  { label: "Settings", href: "/settings", materialIcon: "settings" },
];

function SidebarContent({ collapsed, onNavClick, isMobile }: { collapsed: boolean; onNavClick?: () => void; isMobile?: boolean }) {
  const location = useLocation();

  return (
    <>
      {/* Logo + Close button */}
      <div className={cn(
        "mb-6 flex items-center",
        collapsed ? "justify-center px-2" : "justify-between px-5"
      )}>
        <div className={cn("flex items-center", collapsed ? "" : "gap-3")}>
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              school
            </span>
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold text-white leading-tight" style={{ fontFamily: "Crimson Text" }}>
                SmartSchool
              </h1>
              <p className="text-[9px] tracking-widest text-primary font-bold opacity-80 uppercase">
                Fee Management
              </p>
            </div>
          )}
        </div>
        {/* Close button - mobile only */}
        {isMobile && (
          <button
            onClick={onNavClick}
            className="p-2 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide px-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onNavClick}
              className={cn(
                "flex items-center gap-3 w-full text-left transition-all duration-150 rounded-lg",
                collapsed ? "justify-center px-2 py-3" : "px-3 py-2.5",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-stone-400 hover:text-white hover:bg-white/5"
              )}
            >
              <span className={cn(
                "material-symbols-outlined text-[20px] flex-shrink-0",
                isActive && "text-primary"
              )}>
                {item.materialIcon}
              </span>
              {!collapsed && (
                <span className={cn("text-[13px] font-medium truncate", isActive && "font-semibold")}>
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Button (desktop only) */}
      {!isMobile && (
        <div className={cn(
          "mt-auto pt-4 border-t border-white/5",
          collapsed ? "px-2" : "px-3"
        )}>
          <button
            onClick={useUIStore.getState().toggleSidebar}
            className={cn(
              "flex items-center gap-3 w-full rounded-lg text-stone-400 hover:text-white hover:bg-white/5 transition-all duration-150",
              collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
            )}
          >
            {collapsed ? (
              <span className="material-symbols-outlined text-[20px]">keyboard_double_arrow_right</span>
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">keyboard_double_arrow_left</span>
                <span className="text-[13px] font-medium">Collapse</span>
              </>
            )}
          </button>
        </div>
      )}
    </>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, sidebarOpen, closeMobileSidebar } = useUIStore();

  return (
    <>
      {/* Desktop sidebar - visible on xl+ only */}
      <aside
        className={cn(
          "bg-stone-900 h-screen fixed left-0 top-0 flex-col py-4 z-50 transition-all duration-300 hidden xl:flex",
          sidebarCollapsed ? "w-[72px]" : "w-60"
        )}
      >
        <SidebarContent collapsed={sidebarCollapsed} />
      </aside>

      {/* Mobile/Tablet sidebar */}
      <div className={cn(
        "fixed inset-0 z-50 xl:hidden transition-all duration-300",
        sidebarOpen ? "visible" : "invisible pointer-events-none"
      )}>
        {/* Backdrop */}
        <div
          className={cn(
            "absolute inset-0 bg-black/50 transition-opacity duration-300",
            sidebarOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={closeMobileSidebar}
        />
        {/* Sidebar panel */}
        <aside className={cn(
          "absolute left-0 top-0 h-full w-56 bg-stone-900 flex flex-col py-4 shadow-2xl transition-transform duration-300 ease-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <SidebarContent collapsed={false} onNavClick={closeMobileSidebar} isMobile />
        </aside>
      </div>
    </>
  );
}
