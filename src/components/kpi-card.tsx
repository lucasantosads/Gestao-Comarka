import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  previousValue?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function KpiCard({ title, value, previousValue, trend, className }: KpiCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground mb-1">{title}</p>
        <p className="text-xl font-bold">{value}</p>
        {previousValue !== undefined && (
          <div className="flex items-center gap-1 mt-1">
            {trend === "up" && <TrendingUp size={14} className="text-green-500" />}
            {trend === "down" && <TrendingDown size={14} className="text-red-500" />}
            {trend === "neutral" && <Minus size={14} className="text-muted-foreground" />}
            <span className="text-xs text-muted-foreground">
              Anterior: {previousValue}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
