"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMonthLabel, getCurrentMonth, getPreviousMonth } from "@/lib/format";

interface MonthSelectorProps {
  value: string;
  onChange: (month: string) => void;
}

export function MonthSelector({ value, onChange }: MonthSelectorProps) {
  const handlePrev = () => onChange(getPreviousMonth(value));

  const handleNext = () => {
    const [year, month] = value.split("-").map(Number);
    const date = new Date(year, month, 1);
    const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (next <= getCurrentMonth()) onChange(next);
  };

  const isCurrentMonth = value === getCurrentMonth();

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={handlePrev} className="h-8 w-8">
        <ChevronLeft size={16} />
      </Button>
      <span className="text-sm font-medium min-w-[140px] text-center capitalize">
        {formatMonthLabel(value)}
      </span>
      <Button
        variant="outline"
        size="icon"
        onClick={handleNext}
        disabled={isCurrentMonth}
        className="h-8 w-8"
      >
        <ChevronRight size={16} />
      </Button>
    </div>
  );
}
