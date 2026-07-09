import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { VisualRuleBuilder } from "@/components/fees/VisualRuleBuilder";
import { useUIStore } from "@/store/uiStore";
import { Plus, Trash2, Loader2, Pencil } from "lucide-react";
import type { FeeType, FeeRules, CreateFeeTypeInput } from "@/types/fees";

export function FeeTypesPage() {
  const queryClient = useQueryClient();
  const { addToast, sidebarCollapsed } = useUIStore();
  const { user } = useAuthStore();
  const [showCreate, setShowCreate] = useState(false);
  const [editingFeeType, setEditingFeeType] = useState<FeeType | null>(null);
  const isAdmin = user?.role === "ADMIN";

  const { data: feeTypesData, isLoading } = useQuery({
    queryKey: ["fee-types"],
    queryFn: () => apiClient.get<FeeType[]>("/fee-types?limit=50"),
  });

  const feeTypes = feeTypesData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (data: CreateFeeTypeInput) =>
      apiClient.post("/fee-types", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-types"] });
      setShowCreate(false);
      addToast({ title: "Fee type created", variant: "success" });
    },
    onError: (err: { message?: string }) => {
      addToast({
        title: "Failed to create fee type",
        description: err.message || "Unknown error",
        variant: "error",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/fee-types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-types"] });
      addToast({ title: "Fee type deleted", variant: "success" });
    },
    onError: (err: { message?: string }) => {
      addToast({
        title: "Failed to delete",
        description: err.message || "May be linked to fee structures",
        variant: "error",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateFeeTypeInput> }) =>
      apiClient.put(`/fee-types/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-types"] });
      setEditingFeeType(null);
      addToast({ title: "Fee type updated", variant: "success" });
    },
    onError: (err: { message?: string }) => {
      addToast({
        title: "Failed to update",
        description: err.message || "Unknown error",
        variant: "error",
      });
    },
  });

  return (
    <div className={cn("xl:ml-60 ml-0 min-h-screen transition-all duration-300", sidebarCollapsed && "xl:ml-[72px] ml-0")}>
      <div className="pt-20 md:pt-24 lg:pt-28 px-3 md:px-5 lg:px-8 pb-8">
        {/* Header */}
        <div className="mb-8 animate-fade-slide-up">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-3xl font-bold text-on-surface" style={{ fontFamily: "Crimson Text" }}>
                  Fee Types
                </h2>
                <div className="w-2 h-2 rounded-full bg-primary mt-1 animate-pulse-dot" />
              </div>
              <p className="text-on-surface-variant text-sm font-medium">
                Configure fee categories and their rules
              </p>
            </div>
            {isAdmin && (
              <Button
                onClick={() => setShowCreate(true)}
                className="bg-primary text-white hover:bg-primary/90 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Fee Type
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="paper-stack rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-stone-100 animate-pulse rounded" />
              ))}
            </div>
          ) : feeTypes.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-lg font-bold text-on-surface" style={{ fontFamily: "Crimson Text" }}>
                No Fee Types
              </p>
              <p className="text-sm text-on-surface-variant mt-1">
                Create your first fee type to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-stone-50">
                    <TableHead className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Name</TableHead>
                    <TableHead className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Base Amount</TableHead>
                    <TableHead className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Late Fee</TableHead>
                    <TableHead className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Waiver</TableHead>
                    <TableHead className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Discount</TableHead>
                    <TableHead className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feeTypes.map((ft) => (
                    <TableRow key={ft.id} className="border-outline-variant/50 hover:bg-stone-50 transition-colors">
                      <TableCell>
                        <span className="text-sm font-semibold text-on-surface">{ft.name}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-semibold text-on-surface">
                          {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(ft.baseAmount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <RuleBadge rule={ft.rules?.lateFee} />
                      </TableCell>
                      <TableCell>
                        <RuleBadge rule={ft.rules?.waiver} />
                      </TableCell>
                      <TableCell>
                        <RuleBadge rule={ft.rules?.discount} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-stone-400 hover:text-primary hover:bg-primary-container rounded-lg"
                            onClick={() => setEditingFeeType(ft)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-stone-400 hover:text-error hover:bg-error/5 rounded-lg"
                            onClick={() => {
                              if (confirm(`Delete fee type "${ft.name}"?`)) {
                                deleteMutation.mutate(ft.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Create Dialog */}
      {showCreate && (
        <FeeTypeFormDialog
          title="Create Fee Type"
          onSubmit={(data) => createMutation.mutate(data)}
          isPending={createMutation.isPending}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Edit Dialog */}
      {editingFeeType && (
        <FeeTypeFormDialog
          title="Edit Fee Type"
          initial={editingFeeType}
          onSubmit={(data) =>
            updateMutation.mutate({ id: editingFeeType.id, data })
          }
          isPending={updateMutation.isPending}
          onClose={() => setEditingFeeType(null)}
        />
      )}
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function RuleBadge({ rule }: { rule: { type: string; value: number } | undefined }) {
  if (!rule) {
    return <Badge variant="outline" className="text-[10px] text-on-surface-variant">None</Badge>;
  }
  const label =
    rule.type === "flat"
      ? `Rs. ${rule.value.toLocaleString("en-IN")}`
      : `${rule.value}%`;
  return (
    <Badge variant="secondary" className="text-[10px] font-bold">
      {label}
    </Badge>
  );
}

interface FeeTypeFormDialogProps {
  title: string;
  initial?: FeeType;
  onSubmit: (data: CreateFeeTypeInput) => void;
  isPending: boolean;
  onClose: () => void;
}

function FeeTypeFormDialog({
  title,
  initial,
  onSubmit,
  isPending,
  onClose,
}: FeeTypeFormDialogProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [baseAmount, setBaseAmount] = useState(initial?.baseAmount?.toString() ?? "");
  const [rules, setRules] = useState<FeeRules | null>(initial?.rules ?? null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(baseAmount);
    if (!name.trim() || isNaN(amount) || amount <= 0) return;
    onSubmit({ name: name.trim(), baseAmount: amount, rules });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto scrollbar-hide">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "Crimson Text" }}>{title}</DialogTitle>
          <DialogDescription>
            {initial ? "Update the fee type details." : "Add a new fee category for your school."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div className="space-y-4">
            <Label htmlFor="ft-name">Fee Type Name</Label>
            <Input
              id="ft-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Tuition Fee, Library Fee"
              className="bg-white"
              required
            />
          </div>

          {/* Base Amount */}
          <div className="space-y-4">
            <Label htmlFor="ft-amount">Base Amount (Rs.)</Label>
            <Input
              id="ft-amount"
              type="number"
              min={0}
              step="0.01"
              value={baseAmount}
              onChange={(e) => setBaseAmount(e.target.value)}
              placeholder="0"
              className="bg-white"
              required
            />
          </div>

          {/* Visual Rule Builder */}
          <VisualRuleBuilder value={rules} onChange={setRules} />

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || !baseAmount || isPending}
              className="bg-primary text-white hover:bg-primary/90"
            >
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {initial ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
