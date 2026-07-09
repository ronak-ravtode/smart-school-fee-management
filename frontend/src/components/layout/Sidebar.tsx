import { Link, useLocation } from "react-router-dom";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  materialIcon: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", materialIcon: "dashboard" },
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

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const location = useLocation();

  return (
    <aside
      className={cn(
        "bg-stone-900 h-screen fixed left-0 top-0 flex flex-col py-6 z-50 transition-all duration-300",
        sidebarCollapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "mb-10 flex items-center",
        sidebarCollapsed ? "justify-center px-2" : "gap-3 px-6"
      )}>
        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
            school
          </span>
        </div>
        {!sidebarCollapsed && (
          <div>
            <h1 className="text-xl font-bold text-white leading-tight" style={{ fontFamily: "Crimson Text" }}>
              SmartSchool
            </h1>
            <p className="text-[10px] tracking-widest text-primary font-bold opacity-80 uppercase">
              Fee Management
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 w-full text-left transition-all duration-200",
                sidebarCollapsed ? "justify-center px-2 py-3 mx-0 rounded-lg" : "px-4 py-3 mx-2 rounded-lg",
                isActive
                  ? "sidebar-nav-item active"
                  : "text-stone-400 hover:text-white hover:bg-white/5"
              )}
            >
              <span className={cn(
                "material-symbols-outlined text-xl",
                isActive && "text-primary"
              )}>
                {item.materialIcon}
              </span>
              {!sidebarCollapsed && (
                <span className="font-medium text-sm">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Button */}
      <div className={cn(
        "mt-auto pt-6 border-t border-white/5",
        sidebarCollapsed ? "px-2" : "px-4"
      )}>
        <button
          onClick={toggleSidebar}
          className={cn(
            "flex items-center gap-3 w-full rounded-lg text-stone-400 hover:text-white hover:bg-white/5 transition-all duration-200",
            sidebarCollapsed ? "justify-center px-2 py-3" : "px-4 py-3 mx-0"
          )}
        >
          {sidebarCollapsed ? (
            <span className="material-symbols-outlined text-xl">keyboard_double_arrow_right</span>
          ) : (
            <>
              <span className="material-symbols-outlined text-xl">keyboard_double_arrow_left</span>
              <span className="font-medium text-sm">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
