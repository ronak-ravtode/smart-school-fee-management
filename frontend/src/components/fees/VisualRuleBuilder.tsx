import { useCallback } from "react";
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
import { X, Plus, AlertTriangle } from "lucide-react";
import type { FeeRules, FeeRule } from "@/types/fees";

interface VisualRuleBuilderProps {
  value: FeeRules | null;
  onChange: (rules: FeeRules | null) => void;
}

interface RuleRowProps {
  label: string;
  rule: FeeRule | undefined;
  onChange: (rule: FeeRule | undefined) => void;
  description: string;
}

function RuleRow({ label, rule, onChange, description }: RuleRowProps) {
  const enabled = rule !== undefined;

  const handleToggle = () => {
    if (enabled) {
      onChange(undefined);
    } else {
      onChange({ type: "flat", value: 0 });
    }
  };

  const handleTypeChange = (type: string) => {
    if (rule) {
      onChange({ ...rule, type: type as "flat" | "percentage" });
    }
  };

  const handleValueChange = (val: string) => {
    if (rule) {
      const num = parseFloat(val);
      onChange({ ...rule, value: isNaN(num) ? 0 : num });
    }
  };

  return (
    <div className="p-4 rounded-xl border border-outline-variant bg-stone-50/50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-bold text-on-surface">{label}</Label>
          {!enabled && (
            <span className="text-[10px] text-on-surface-variant font-medium bg-stone-200 px-2 py-0.5 rounded-full">
              Disabled
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleToggle}
          className={`h-7 text-xs font-bold ${
            enabled
              ? "text-error hover:text-error hover:bg-error/5"
              : "text-primary hover:text-primary hover:bg-primary/5"
          }`}
        >
          {enabled ? (
            <>
              <X className="w-3 h-3 mr-1" />
              Remove
            </>
          ) : (
            <>
              <Plus className="w-3 h-3 mr-1" />
              Add Rule
            </>
          )}
        </Button>
      </div>

      <p className="text-[11px] text-on-surface-variant mb-3">{description}</p>

      {enabled && rule && (
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Label className="text-[10px] uppercase tracking-wider text-on-surface-variant mb-1 block">
              Type
            </Label>
            <Select value={rule.type} onValueChange={handleTypeChange}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flat">Flat Amount (Rs.)</SelectItem>
                <SelectItem value="percentage">Percentage (%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-28">
            <Label className="text-[10px] uppercase tracking-wider text-on-surface-variant mb-1 block">
              Value
            </Label>
            <div className="relative">
              <Input
                type="number"
                min={0}
                max={rule.type === "percentage" ? 100 : undefined}
                step="0.01"
                value={rule.value || ""}
                onChange={(e) => handleValueChange(e.target.value)}
                className="h-9 text-sm bg-white pr-10"
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant font-bold">
                {rule.type === "percentage" ? "%" : "Rs."}
              </span>
            </div>
            {rule.type === "percentage" && rule.value > 100 && (
              <div className="flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                <span className="text-[10px] text-amber-600">Cannot exceed 100%</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function VisualRuleBuilder({ value, onChange }: VisualRuleBuilderProps) {
  const updateRule = useCallback(
    (key: keyof FeeRules, rule: FeeRule | undefined) => {
      const next = { ...value };
      if (rule === undefined) {
        delete next[key];
      } else {
        next[key] = rule;
      }
      const hasAny = next.lateFee || next.waiver || next.discount;
      onChange(hasAny ? next : null);
    },
    [value, onChange]
  );

  return (
    <div className="space-y-3">
      <Label className="text-xs uppercase tracking-wider text-on-surface-variant">
        Rules (Optional)
      </Label>

      <RuleRow
        label="Late Fee"
        rule={value?.lateFee}
        onChange={(r) => updateRule("lateFee", r)}
        description="Applied when payment is made after the due date. Percentage is calculated on the base amount."
      />

      <RuleRow
        label="Waiver"
        rule={value?.waiver}
        onChange={(r) => updateRule("waiver", r)}
        description="Reduces the total amount. Flat amount is deducted directly; percentage is calculated on the base amount."
      />

      <RuleRow
        label="Discount"
        rule={value?.discount}
        onChange={(r) => updateRule("discount", r)}
        description="Additional reduction applied before late fee calculation."
      />
    </div>
  );
}
