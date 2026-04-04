"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDateFilter } from "@/contexts/DateFilterContext";
import type { CreativeWithMetrics } from "@/lib/types/metaVideo";

const HOOK_TYPES: Record<string, string[]> = {
  "Problema": ["problema", "dor", "prejuízo", "erro", "perder", "cuidado"],
  "Prova Social": ["prova", "resultado", "caso", "cliente", "ganhou", "faturou"],
  "Pergunta": ["?"],
  "Autoridade": ["advogado", "especialista", "anos de", "experiência"],
};

function detectHookType(name: string): string {
  const lower = name.toLowerCase();
  for (const [tipo, keywords] of Object.entries(HOOK_TYPES)) {
    if (keywords.some((k) => lower.includes(k))) return tipo;
  }
  return "Outro";
}

export function HookRanking() {
  const { queryString } = useDateFilter();
  const [ads, setAds] = useState<CreativeWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/meta-video?${queryString}`).then((r) => r.json()).then((d) => {
      setAds((d.data || []).sort((a: CreativeWithMetrics, b: CreativeWithMetrics) => b.metrics.hookRate - a.metrics.hookRate));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [queryString]);

  if (loading) return <Card><CardContent className="py-8"><div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 bg-muted animate-pulse rounded" />)}</div></CardContent></Card>;

  const maxHook = ads.length > 0 ? ads[0].metrics.hookRate : 100;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Ranking de Hooks</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {ads.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem dados de vídeo</p>}
        {ads.slice(0, 10).map((ad, i) => {
          const hookType = detectHookType(ad.name);
          const isTop3 = i < 3;
          return (
            <div key={ad.id} className={`flex items-center gap-3 p-2 rounded-lg ${isTop3 ? "border border-yellow-500/30 bg-yellow-500/5" : ""}`}>
              <span className={`text-xs font-bold w-6 ${isTop3 ? "text-yellow-400" : "text-muted-foreground"}`}>{i + 1}º</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" title={ad.name}>{ad.name}</p>
                <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                  <div className={`h-full rounded-full ${ad.metrics.hookRate >= 30 ? "bg-green-500" : ad.metrics.hookRate >= 15 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${(ad.metrics.hookRate / maxHook) * 100}%` }} />
                </div>
              </div>
              <span className={`text-xs font-bold shrink-0 ${ad.metrics.hookRate >= 30 ? "text-green-400" : ad.metrics.hookRate >= 15 ? "text-yellow-400" : "text-red-400"}`}>
                {ad.metrics.hookRate.toFixed(1)}%
              </span>
              <Badge variant="outline" className="text-[9px] shrink-0">{hookType}</Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
