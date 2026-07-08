import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUIStore } from "@/store/uiStore";
import { Loader2, CheckCircle2 } from "lucide-react";
import type { GenerateLedgerInput, GenerateLedgerResult } from "@/types/fees";

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const CLASS_OPTIONS = [
  "Nursery", "LKG", "UKG",
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "11", "12",
];

const SECTION_OPTIONS = ["A", "B", "C", "D", "E"];

const MONTH_OPTIONS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function GenerateLedgerPage() {
  const { addToast, sidebarCollapsed } = useUIStore();
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [academicSession, setAcademicSession] = useState("2026-2027");
  const [month, setMonth] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [result, setResult] = useState<GenerateLedgerResult | null>(null);

  const mutation = useMutation({
    mutationFn: (data: GenerateLedgerInput) =>
      apiClient.post<{ created: number; skipped: number; total: number }>(
        "/ledgers/generate",
        data
      ),
    onSuccess: (response) => {
      setResult(response.data);
      addToast({
        title: "Ledgers generated",
        description: `Created ${response.data.created} ledger(s), skipped ${response.data.skipped}.`,
        variant: "success",
      });
    },
    onError: (err: { message?: string }) => {
      addToast({
        title: "Generation failed",
        description: err.message || "No students or fee structures found for this class.",
        variant: "error",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!className || !month || !dueDate) return;
    setResult(null);
    mutation.mutate({
      class: className,
      section: section || undefined,
      academicSession,
      month,
      dueDate,
    });
  };

  return (
    <div className={cn("ml-64 min-h-screen transition-all duration-300", sidebarCollapsed && "ml-[72px]")}>
      <div className="pt-24 px-8 pb-8">
        {/* Header */}
        <div className="mb-8 animate-fade-slide-up">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-3xl font-bold text-on-surface" style={{ fontFamily: "Crimson Text" }}>
              Generate Ledgers
            </h2>
            <div className="w-2 h-2 rounded-full bg-primary mt-1 animate-pulse-dot" />
          </div>
          <p className="text-on-surface-variant text-sm font-medium">
            Create fee ledgers for a class based on configured fee structures
          </p>
        </div>

        <div className="max-w-2xl">
          <div className="rounded-xl border border-outline-variant bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-xl">receipt_long</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface" style={{ fontFamily: "Crimson Text" }}>
                  Generate Fee Ledgers
                </h3>
                <p className="text-xs text-on-surface-variant">Creates ledger entries for all students in the selected class</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Class + Section */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <Label>Class *</Label>
                  <Select value={className} onValueChange={setClassName}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select class" />
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
                      <SelectValue placeholder="All sections" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Sections</SelectItem>
                      {SECTION_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          Section {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Academic Session */}
              <div className="space-y-4">
                <Label>Academic Session *</Label>
                <Input
                  value={academicSession}
                  onChange={(e) => setAcademicSession(e.target.value)}
                  placeholder="e.g., 2026-2027"
                  className="bg-white"
                  required
                />
              </div>

              {/* Month */}
              <div className="space-y-4">
                <Label>Month *</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_OPTIONS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Due Date */}
              <div className="space-y-4">
                <Label>Due Date *</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-white"
                  required
                />
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={!className || !month || !dueDate || mutation.isPending}
                className="w-full bg-primary text-white hover:bg-primary/90 flex items-center gap-2"
              >
                {mutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {mutation.isPending ? "Generating..." : "Generate Ledgers"}
              </Button>
            </form>

            {/* Result */}
            {result && (
              <div className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-sm font-bold text-on-surface mb-1">
                  Generation Complete
                </p>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-primary">{result.created}</p>
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Created</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-500">{result.skipped}</p>
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Skipped</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-on-surface">{result.total}</p>
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Total</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
