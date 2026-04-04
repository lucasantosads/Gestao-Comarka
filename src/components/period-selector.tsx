"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PeriodMode, PeriodRange } from "@/hooks/use-period-filter";

const MODES: { value: PeriodMode; label: string }[] = [
  { value: "mes", label: "Este mês" },
  { value: "semana", label: "Esta semana" },
  { value: "dia", label: "Hoje" },
  { value: "custom", label: "Personalizado" },
];

interface PeriodSelectorProps {
  mode: PeriodMode;
  label: string;
  compareLabel: string;
  onModeChange: (m: PeriodMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onCustomApply: (current: PeriodRange, previous: PeriodRange) => void;
}

export function PeriodSelector({
  mode, label, compareLabel, onModeChange, onPrev, onNext, onCustomApply,
}: PeriodSelectorProps) {
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [customPrevStart, setCustomPrevStart] = useState("");
  const [customPrevEnd, setCustomPrevEnd] = useState("");

  const applyCustom = () => {
    if (customStart && customEnd && customPrevStart && customPrevEnd) {
      onCustomApply(
        { start: new Date(customStart + "T00:00:00"), end: new Date(customEnd + "T23:59:59") },
        { start: new Date(customPrevStart + "T00:00:00"), end: new Date(customPrevEnd + "T23:59:59") },
      );
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Mode tabs */}
        <div className="flex bg-muted rounded-lg p-0.5">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => onModeChange(m.value)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                mode === m.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Navigation */}
        {mode !== "custom" && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onPrev} className="h-7 w-7 p-0">
              <ChevronLeft size={14} />
            </Button>
            <span className="text-sm font-medium capitalize min-w-[140px] text-center">{label}</span>
            <Button variant="ghost" size="sm" onClick={onNext} className="h-7 w-7 p-0">
              <ChevronRight size={14} />
            </Button>
          </div>
        )}

        {/* Compare badge */}
        <Badge variant="outline" className="text-[10px] text-muted-foreground">
          vs. {compareLabel}
        </Badge>
      </div>

      {/* Custom date pickers */}
      {mode === "custom" && (
        <div className="flex flex-wrap items-end gap-2 p-3 bg-muted/30 rounded-lg border">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase">Período atual</label>
            <div className="flex gap-1">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                className="text-xs bg-transparent border rounded px-2 py-1 w-[130px]" />
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                className="text-xs bg-transparent border rounded px-2 py-1 w-[130px]" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase">Comparar com</label>
            <div className="flex gap-1">
              <input type="date" value={customPrevStart} onChange={(e) => setCustomPrevStart(e.target.value)}
                className="text-xs bg-transparent border rounded px-2 py-1 w-[130px]" />
              <input type="date" value={customPrevEnd} onChange={(e) => setCustomPrevEnd(e.target.value)}
                className="text-xs bg-transparent border rounded px-2 py-1 w-[130px]" />
            </div>
          </div>
          <Button size="sm" onClick={applyCustom} className="text-xs h-7">Aplicar</Button>
        </div>
      )}
    </div>
  );
}
