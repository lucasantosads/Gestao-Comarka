"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { detectFatigueStatus } from "@/lib/fatigue";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import type { DailyMetric, FatigueStatus } from "@/lib/types/metaVideo";

const STATUS_COLORS: Record<FatigueStatus, string> = {
  "saudável": "bg-green-500/20 text-green-400",
  "atenção": "bg-yellow-500/20 text-yellow-400",
  "em_fadiga": "bg-orange-500/20 text-orange-400",
  "fadiga_crítica": "bg-red-500/20 text-red-400",
};

export function CreativeFatigue() {
  const { queryString } = useDateFilter();
  const [data, setData] = useState<Record<string, DailyMetric[]>>({});
  const [loading, setLoading] = useState(true);
  const [onlyFatigued, setOnlyFatigued] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/meta-video/daily?${queryString}`).then((r) => r.json()).then((d) => {
      setData(d.data || {});
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [queryString]);

  if (loading) return <Card><CardContent className="py-8"><div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded" />)}</div></CardContent></Card>;

  const entries = Object.entries(data).map(([adId, metrics]) => ({
    adId,
    adName: metrics[0]?.adName || adId,
    metrics,
    fatigue: detectFatigueStatus(metrics),
    avgHookRate: metrics.length > 0 ? metrics.reduce((s, m) => s + m.hookRate, 0) / metrics.length : 0,
  }));

  const filtered = onlyFatigued ? entries.filter((e) => e.fatigue !== "saudável") : entries;
  const fatigueCount = entries.filter((e) => e.fatigue !== "saudável").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Análise de Fadiga ({fatigueCount} com atenção)</CardTitle>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={onlyFatigued} onChange={(e) => setOnlyFatigued(e.target.checked)} className="rounded" />
            Apenas em fadiga
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">{onlyFatigued ? "Nenhum criativo em fadiga" : "Sem dados de vídeo"}</p>}
        {filtered.slice(0, 6).map((entry) => {
          const chartData = entry.metrics.map((m) => ({ dia: m.date.slice(5), hookRate: Math.round(m.hookRate * 10) / 10 }));
          return (
            <div key={entry.adId} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium truncate max-w-[250px]" title={entry.adName}>{entry.adName}</p>
                <Badge className={`text-[10px] ${STATUS_COLORS[entry.fatigue]}`}>{entry.fatigue.replace("_", " ")}</Badge>
              </div>
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={chartData}>
                  <XAxis dataKey="dia" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 8 }} axisLine={false} tickLine={false} domain={[0, "auto"]} />
                  <Tooltip formatter={(v) => `${v}%`} contentStyle={{ fontSize: 10 }} />
                  <ReferenceLine y={entry.avgHookRate} stroke="#6b7280" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="hookRate" stroke={entry.fatigue === "saudável" ? "#22c55e" : entry.fatigue === "atenção" ? "#f59e0b" : "#ef4444"} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
