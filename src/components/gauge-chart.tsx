import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";

export function GaugeChart({
  label,
  current,
  target,
}: {
  label: string;
  current: number;
  target: number;
}) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const color = "#22c55e";

  const cx = 120;
  const cy = 110;
  const r = 90;
  const strokeWidth = 18;
  const halfCircumference = Math.PI * r;
  const filledLength = (pct / 100) * halfCircumference;
  const emptyLength = halfCircumference - filledLength;

  return (
    <Card>
      <CardContent className="pt-6 pb-4 flex flex-col items-center">
        <svg width="240" height="130" viewBox="0 0 240 130">
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="#374151"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            opacity={0.3}
          />
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${filledLength} ${emptyLength}`}
          />
          <text x={cx} y={cy - 15} textAnchor="middle" className="fill-current text-2xl font-bold" fontSize="22">
            {pct.toFixed(0)}%
          </text>
        </svg>
        <div className="text-center -mt-2">
          <p className="text-lg font-bold">{formatCurrency(current)}</p>
          <p className="text-xs text-muted-foreground">
            de {formatCurrency(target)}
          </p>
          <p className="text-sm font-medium mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
