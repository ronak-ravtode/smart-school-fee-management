import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface AuditLog {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  reason: string | null;
  ipAddress: string | null;
}

const ACTION_COLORS: Record<string, string> = {
  CREATED: "bg-green-100 text-green-700",
  UPDATED: "bg-blue-100 text-blue-700",
  DELETED: "bg-red-100 text-red-700",
  WAIVED: "bg-purple-100 text-purple-700",
  PENALTY_APPLIED: "bg-orange-100 text-orange-700",
  CHEQUE_CLEARED: "bg-emerald-100 text-emerald-700",
  CHEQUE_BOUNCED: "bg-red-100 text-red-700",
  PAYMENT_RECORDED: "bg-green-100 text-green-700",
  PAYMENT_REVERSED: "bg-amber-100 text-amber-700",
  BULK_PAYMENT: "bg-indigo-100 text-indigo-700",
};

const ACTION_OPTIONS = [
  "CREATED", "UPDATED", "DELETED", "WAIVED", "PENALTY_APPLIED",
  "CHEQUE_CLEARED", "CHEQUE_BOUNCED", "PAYMENT_RECORDED", "PAYMENT_REVERSED",
  "BULK_PAYMENT",
];

const ENTITY_OPTIONS = ["Transaction", "StudentFeeLedger", "FeeType", "FeeStructure", "Student"];

function getDefaultFromDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0];
}

function DiffView({ previous, current }: { previous: Record<string, unknown> | null; current: Record<string, unknown> | null }) {
  const prev = previous ?? {};
  const curr = current ?? {};
  const allKeys = [...new Set([...Object.keys(prev), ...Object.keys(curr)])];

  if (allKeys.length === 0) {
    return <p className="text-on-surface-variant text-xs italic">No data</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-1 text-xs font-mono">
      {allKeys.map((key) => {
        const pVal = prev[key];
        const cVal = curr[key];
        const pStr = pVal === undefined ? "—" : JSON.stringify(pVal);
        const cStr = cVal === undefined ? "—" : JSON.stringify(cVal);
        const isChanged = pStr !== cStr;

        return (
          <div key={key} className={cn("flex gap-2 rounded px-2 py-1", isChanged && "bg-slate-50")}>
            <span className="text-on-surface-variant font-semibold min-w-[120px] shrink-0">{key}</span>
            <span className={cn("flex-1 truncate", pVal !== undefined && isChanged ? "text-red-600 line-through" : "text-on-surface-variant")}>
              {pStr}
            </span>
            <span className="text-on-surface-variant">&rarr;</span>
            <span className={cn("flex-1 truncate", cVal !== undefined && isChanged ? "text-green-600 font-medium" : "text-on-surface-variant")}>
              {cStr}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AuditLogTable() {
  const { sidebarCollapsed } = useUIStore();
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [entityIdFilter, setEntityIdFilter] = useState("");
  const defaultFromDate = useMemo(() => getDefaultFromDate(), []);
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Edge Case 5: Default 50 rows per page for performance
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", page, actionFilter, entityFilter, actorFilter, entityIdFilter, fromDate, toDate],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      if (actionFilter) params.set("action", actionFilter);
      if (entityFilter) params.set("entityType", entityFilter);
      if (actorFilter) params.set("actorName", actorFilter);
      if (entityIdFilter) params.set("entityId", entityIdFilter);
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      return apiClient.get<AuditLog[]>(`/audit-logs?${params.toString()}`);
    },
  });

  const logs = data?.data ?? [];
  const meta = (data as unknown as { meta?: { total: number; page: number; limit: number } })?.meta;
  const total = meta?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className={cn(
      "ml-64 min-h-screen transition-all duration-300",
      sidebarCollapsed && "ml-[72px]"
    )}>
      <div className="pt-24 px-8 pb-8">
        <div className="mb-8 animate-fade-slide-up">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-3xl font-bold text-on-surface" style={{ fontFamily: "Crimson Text" }}>
              Audit Trail
            </h2>
            <div className="w-2 h-2 rounded-full bg-primary mt-1 animate-pulse-dot" />
          </div>
          <p className="text-on-surface-variant text-sm font-medium">
            Immutable log of all financial actions. This data cannot be modified or deleted.
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-outline-variant p-4 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">Action</label>
              <select
                value={actionFilter}
                onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                className="w-full text-sm border border-outline-variant rounded-lg px-3 py-1.5 bg-white"
              >
                <option value="">All Actions</option>
                {ACTION_OPTIONS.map((a) => (
                  <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">Entity Type</label>
              <select
                value={entityFilter}
                onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
                className="w-full text-sm border border-outline-variant rounded-lg px-3 py-1.5 bg-white"
              >
                <option value="">All Entities</option>
                {ENTITY_OPTIONS.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">Admin Name</label>
              <input
                type="text"
                value={actorFilter}
                onChange={(e) => { setActorFilter(e.target.value); setPage(1); }}
                placeholder="Search by name"
                className="w-full text-sm border border-outline-variant rounded-lg px-3 py-1.5"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">Entity ID</label>
              <input
                type="text"
                value={entityIdFilter}
                onChange={(e) => { setEntityIdFilter(e.target.value); setPage(1); }}
                placeholder="UUID"
                className="w-full text-sm border border-outline-variant rounded-lg px-3 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
                className="w-full text-sm border border-outline-variant rounded-lg px-3 py-1.5"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setPage(1); }}
                className="w-full text-sm border border-outline-variant rounded-lg px-3 py-1.5"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-6xl text-on-surface-variant/30 mb-4 block">history</span>
            <p className="text-on-surface-variant font-medium">No audit logs found</p>
            <p className="text-on-surface-variant/60 text-sm mt-1">Try adjusting your filters or date range.</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-outline-variant overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-outline-variant bg-surface/50">
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider w-8"></th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Timestamp</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Admin</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Action</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Entity</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Entity ID</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <>
                      <tr
                        key={log.id}
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                        className="border-b border-outline-variant/50 last:border-0 hover:bg-surface/30 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className={cn(
                            "material-symbols-outlined text-sm transition-transform",
                            expandedId === log.id && "rotate-90"
                          )}>chevron_right</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-on-surface-variant whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-on-surface">{log.actorName}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold",
                            ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-700"
                          )}>
                            {log.action.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-on-surface-variant">{log.entityType}</td>
                        <td className="px-4 py-3 text-[10px] font-mono text-on-surface-variant truncate max-w-[140px]">
                          {log.entityId}
                        </td>
                        <td className="px-4 py-3 text-xs text-on-surface-variant max-w-[200px] truncate">
                          {log.reason ?? "—"}
                        </td>
                      </tr>
                      {expandedId === log.id && (
                        <tr key={`${log.id}-expand`}>
                          <td colSpan={7} className="px-6 py-4 bg-slate-50 border-b border-outline-variant">
                            <div className="space-y-2">
                              <div className="flex items-center gap-4 text-xs text-on-surface-variant">
                                <span><strong>Actor ID:</strong> <span className="font-mono">{log.actorId}</span></span>
                                {log.ipAddress && <span><strong>IP:</strong> {log.ipAddress}</span>}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Previous Value</p>
                                  <div className="bg-white rounded-lg border border-outline-variant p-3">
                                    <DiffView previous={log.previousValue} current={null} />
                                  </div>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">New Value</p>
                                  <div className="bg-white rounded-lg border border-outline-variant p-3">
                                    <DiffView previous={null} current={log.newValue} />
                                  </div>
                                </div>
                              </div>
                              {log.previousValue && log.newValue && (
                                <div>
                                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Change Diff</p>
                                  <div className="bg-white rounded-lg border border-outline-variant p-3">
                                    <DiffView previous={log.previousValue} current={log.newValue} />
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-on-surface-variant">
                  Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-outline-variant disabled:opacity-40 hover:bg-surface/50"
                  >
                    Prev
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                    const p = start + i;
                    if (p > totalPages) return null;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={cn(
                          "px-3 py-1.5 text-xs font-medium rounded-lg border",
                          p === page
                            ? "bg-primary text-white border-primary"
                            : "border-outline-variant hover:bg-surface/50"
                        )}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-outline-variant disabled:opacity-40 hover:bg-surface/50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
