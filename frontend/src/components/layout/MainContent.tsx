import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CreditCard, TrendingUp, AlertTriangle } from "lucide-react";
import { QueryCacheTest } from "@/components/test/QueryCacheTest";

const stats = [
  {
    title: "Total Students",
    value: "1,234",
    icon: Users,
    change: "+12%",
    color: "from-blue-500 to-blue-600",
  },
  {
    title: "Fee Collection",
    value: "₹8,45,000",
    icon: CreditCard,
    change: "+8%",
    color: "from-emerald-500 to-emerald-600",
  },
  {
    title: "Pending Dues",
    value: "₹2,15,000",
    icon: TrendingUp,
    change: "-5%",
    color: "from-amber-500 to-amber-600",
  },
  {
    title: "Defaulters",
    value: "23",
    icon: AlertTriangle,
    change: "+2",
    color: "from-red-500 to-red-600",
  },
];

export function MainContent() {
  const { sidebarCollapsed } = useUIStore();

  return (
    <main
      className={cn(
        "pt-16 min-h-screen transition-all duration-300",
        sidebarCollapsed ? "pl-[72px]" : "pl-[260px]"
      )}
    >
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-700 mt-1">
            Welcome back! Here's what's happening with your school fees.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardContent className="p-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-slate-700 font-medium">
                        {stat.title}
                      </p>
                      <p className="text-2xl font-bold text-slate-900 mt-1">
                        {stat.value}
                      </p>
                      <p className={cn(
                        "text-xs font-semibold mt-2",
                        stat.change.startsWith("+") ? "text-emerald-700" : "text-red-700"
                      )}>
                        {stat.change} from last month
                      </p>
                    </div>
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-md",
                        stat.color
                      )}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-slate-600">
              <p className="text-sm">No transactions yet. Start by recording a payment.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-900">Contrast Test</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-slate-700">
                This is standard body text on a glass card. It must be instantly readable.
              </p>
              <p className="text-3xl font-bold text-slate-900">
                ₹1,450.00
              </p>
              <p className="text-lg font-semibold text-slate-800">
                Financial Number Test: ₹8,45,000.00
              </p>
              <p className="text-sm text-slate-600">
                Secondary text should also be readable with sufficient contrast.
              </p>
            </div>
          </CardContent>
        </Card>

        <QueryCacheTest />
      </div>
    </main>
  );
}
