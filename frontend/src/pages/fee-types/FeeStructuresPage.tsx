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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUIStore } from "@/store/uiStore";
import { Plus, Trash2, Loader2 } from "lucide-react";
import type { FeeType, FeeStructure, CreateFeeStructureInput } from "@/types/fees";

const CLASS_OPTIONS = [
  "Nursery", "LKG", "UKG",
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "11", "12",
];

const SECTION_OPTIONS = ["A", "B", "C", "D", "E"];

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function FeeStructuresPage() {
  const queryClient = useQueryClient();
  const { addToast, sidebarCollapsed } = useUIStore();
  const { user } = useAuthStore();
  const [showCreate, setShowCreate] = useState(false);
  const isAdmin = user?.role === "ADMIN";

  const { data: feeTypesData } = useQuery({
    queryKey: ["fee-types"],
    queryFn: () => apiClient.get<FeeType[]>("/fee-types?limit=100"),
  });

  const { data: structuresData, isLoading } = useQuery({
    queryKey: ["fee-structures"],
    queryFn: () => apiClient.get<FeeStructure[]>("/fee-structures?limit=100"),
  });

  const feeTypes = feeTypesData?.data ?? [];
  const structures = structuresData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (data: CreateFeeStructureInput) =>
      apiClient.post("/fee-structures", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-structures"] });
      setShowCreate(false);
      addToast({ title: "Fee structure created", variant: "success" });
    },
    onError: (err: { message?: string }) => {
      addToast({
        title: "Failed to create",
        description: err.message || "A structure for this class/section/fee type may already exist",
        variant: "error",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/fee-structures/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-structures"] });
      addToast({ title: "Fee structure deleted", variant: "success" });
    },
    onError: (err: { message?: string }) => {
      addToast({
        title: "Failed to delete",
        description: err.message || "May be linked to existing ledgers",
        variant: "error",
      });
    },
  });

  return (
    <div className={cn("ml-64 min-h-screen transition-all duration-300", sidebarCollapsed && "ml-[72px]")}>
      <div className="pt-24 px-8 pb-8">
        {/* Header */}
        <div className="mb-8 animate-fade-slide-up">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-3xl font-bold text-on-surface" style={{ fontFamily: "Crimson Text" }}>
                  Fee Structures
                </h2>
                <div className="w-2 h-2 rounded-full bg-primary mt-1 animate-pulse-dot" />
              </div>
              <p className="text-on-surface-variant text-sm font-medium">
                Map fee types to classes and sections
              </p>
            </div>
            {isAdmin && (
              <Button
                onClick={() => setShowCreate(true)}
                className="bg-primary text-white hover:bg-primary/90 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Fee Structure
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
          ) : structures.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-lg font-bold text-on-surface" style={{ fontFamily: "Crimson Text" }}>
                No Fee Structures
              </p>
              <p className="text-sm text-on-surface-variant mt-1">
                Map fee types to classes to define what each class pays.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-stone-50">
                    <TableHead className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Class</TableHead>
                    <TableHead className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Section</TableHead>
                    <TableHead className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Fee Type</TableHead>
                    <TableHead className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Amount</TableHead>
                    <TableHead className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {structures.map((fs) => (
                    <TableRow key={fs.id} className="border-outline-variant/50 hover:bg-stone-50 transition-colors">
                      <TableCell className="text-sm font-semibold text-on-surface">{fs.class}</TableCell>
                      <TableCell className="text-sm text-on-surface-variant">{fs.section}</TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-on-surface bg-primary-container text-primary px-2 py-0.5 rounded-md">
                          {fs.feeType?.name ?? "Unknown"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-semibold text-on-surface">
                          {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(fs.amount)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-stone-400 hover:text-error hover:bg-error/5 rounded-lg"
                          onClick={() => {
                            if (confirm("Delete this fee structure?")) {
                              deleteMutation.mutate(fs.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
        <CreateFeeStructureDialog
          feeTypes={feeTypes}
          onSubmit={(data) => createMutation.mutate(data)}
          isPending={createMutation.isPending}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

interface CreateFeeStructureDialogProps {
  feeTypes: FeeType[];
  onSubmit: (data: CreateFeeStructureInput) => void;
  isPending: boolean;
  onClose: () => void;
}

function CreateFeeStructureDialog({
  feeTypes,
  onSubmit,
  isPending,
  onClose,
}: CreateFeeStructureDialogProps) {
  const [feeTypeId, setFeeTypeId] = useState("");
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [amount, setAmount] = useState("");

  const selectedFeeType = feeTypes.find((ft) => ft.id === feeTypeId);

  const handleFeeTypeChange = (id: string) => {
    setFeeTypeId(id);
    const ft = feeTypes.find((f) => f.id === id);
    if (ft && !amount) {
      setAmount(ft.baseAmount.toString());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!feeTypeId || !className || !section || isNaN(amt) || amt <= 0) return;
    onSubmit({ feeTypeId, class: className, section, amount: amt });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "Crimson Text" }}>Create Fee Structure</DialogTitle>
          <DialogDescription>
            Map a fee type to a specific class and section.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Fee Type */}
          <div className="space-y-4">
            <Label>Fee Type</Label>
            <Select value={feeTypeId} onValueChange={handleFeeTypeChange}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select fee type" />
              </SelectTrigger>
              <SelectContent>
                {feeTypes.map((ft) => (
                  <SelectItem key={ft.id} value={ft.id}>
                    {ft.name} — Rs. {ft.baseAmount.toLocaleString("en-IN")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Class + Section */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-4">
              <Label>Class</Label>
              <Select value={className} onValueChange={setClassName}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Class" />
                </SelectTrigger>
                <SelectContent>
                  {CLASS_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      Class {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-4">
              <Label>Section</Label>
              <Select value={section} onValueChange={setSection}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Section" />
                </SelectTrigger>
                <SelectContent>
                  {SECTION_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      Section {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-4">
            <Label>Amount (Rs.)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={selectedFeeType?.baseAmount.toString() ?? "0"}
              className="bg-white"
            />
            {selectedFeeType && (
              <p className="text-[11px] text-on-surface-variant">
                Base amount from "{selectedFeeType.name}" is Rs. {selectedFeeType.baseAmount.toLocaleString("en-IN")}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!feeTypeId || !className || !section || !amount || isPending}
              className="bg-primary text-white hover:bg-primary/90"
            >
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
