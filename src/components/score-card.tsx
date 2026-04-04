"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ScoreDetalhe } from "@/lib/calculos";

export function ScoreCard({
  nome,
  score,
  status,
  detalhes,
  closerId,
}: {
  nome: string;
  score: number;
  status: "saudavel" | "atencao" | "critico";
  detalhes: ScoreDetalhe[];
  closerId?: string;
}) {
  const color = status === "saudavel" ? "#22c55e" : status === "atencao" ? "#f59e0b" : "#ef4444";
  const cx = 60, cy = 55, r = 45;
  const halfCirc = Math.PI * r;
  const filled = (Math.min(score, 100) / 100) * halfCirc;

  const content = (
    <Card className={closerId ? "hover:border-primary/50 transition-colors cursor-pointer" : ""}>
      <CardContent className="pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{nome}</span>
          <Badge className={`${status === "saudavel" ? "bg-green-500/20 text-green-500" : status === "atencao" ? "bg-yellow-500/20 text-yellow-500" : "bg-red-500/20 text-red-500"}`}>
            {status === "saudavel" ? "Saudável" : status === "atencao" ? "Atenção" : "Crítico"}
          </Badge>
        </div>
        <div className="flex justify-center">
          <svg width="120" height="70" viewBox="0 0 120 70">
            <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#374151" strokeWidth={10} strokeLinecap="round" opacity={0.3} />
            <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" strokeDasharray={`${filled} ${halfCirc - filled}`} />
            <text x={cx} y={cy - 5} textAnchor="middle" className="fill-current font-bold" fontSize="20">{score}</text>
          </svg>
        </div>
        <div className="space-y-1.5">
          {detalhes.map((d) => (
            <div key={d.label} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground flex-1">{d.label}</span>
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-green-500" style={{ width: `${d.pontos}%` }} />
              </div>
              <span className="w-6 text-right font-mono">{d.pontos}</span>
            </div>
          ))}
        </div>
        {closerId && (
          <p className="text-[10px] text-center text-muted-foreground pt-1">Clique para ver análise completa</p>
        )}
      </CardContent>
    </Card>
  );

  if (closerId) {
    return <Link href={`/dashboard/closers/${closerId}`}>{content}</Link>;
  }
  return content;
}
