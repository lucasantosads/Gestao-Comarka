"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, Wrench } from "lucide-react";
import { toast } from "sonner";

interface Check {
  id: string;
  label: string;
  status: "ok" | "warn" | "error";
  value: string;
  detail?: string;
  fix?: string;
}

interface Report {
  overall: "healthy" | "degraded" | "critical";
  checked_at: string;
  summary: { ok: number; warn: number; error: number };
  checks: Check[];
}

export default function DataHealthPage() {
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/data-health", { cache: "no-store" });
      setData(await res.json());
    } catch { toast.error("Falha ao carregar health"); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function runSync(source: "meta" | "ghl") {
    setSyncing(source);
    try {
      const res = await fetch(`/api/sync?source=${source}`, { method: "POST" });
      if (!res.ok) { toast.error(`Sync ${source} falhou (HTTP ${res.status}: ${res.statusText})`); await load(); setSyncing(null); return; }
      const j = await res.json();
      if (j.error || j.errors > 0) toast.error(`Sync ${source}: ${j.error || j.errors + " erros"}`);
      else toast.success(`Sync ${source} concluído`);
      await load();
    } catch (e: any) { toast.error(`Sync ${source}: ${e?.message || "Erro de rede"}`); }
    setSyncing(null);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Verificando dados…</p></div>;
  if (!data) return <div className="p-4">Sem dados.</div>;

  const overallColor = data.overall === "healthy" ? "text-green-400" : data.overall === "degraded" ? "text-yellow-400" : "text-red-400";
  const overallLabel = data.overall === "healthy" ? "Saudável" : data.overall === "degraded" ? "Degradado" : "Crítico";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Data Health</h1>
          <p className="text-sm text-muted-foreground">
            Estado geral: <span className={`font-bold ${overallColor}`}>{overallLabel}</span>
            <span className="ml-3 text-xs">
              ✅ {data.summary.ok} · ⚠️ {data.summary.warn} · 🔴 {data.summary.error}
            </span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">Verificado: {new Date(data.checked_at).toLocaleString("pt-BR")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw size={12} className="mr-1" /> Recarregar</Button>
          <Button variant="outline" size="sm" onClick={() => runSync("meta")} disabled={!!syncing}>
            <RefreshCw size={12} className={`mr-1 ${syncing === "meta" ? "animate-spin" : ""}`} /> Sync Meta
          </Button>
          <Button variant="outline" size="sm" onClick={() => runSync("ghl")} disabled={!!syncing}>
            <RefreshCw size={12} className={`mr-1 ${syncing === "ghl" ? "animate-spin" : ""}`} /> Sync GHL
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        {data.checks.map((c) => {
          const Icon = c.status === "ok" ? CheckCircle : c.status === "warn" ? AlertTriangle : XCircle;
          const color = c.status === "ok" ? "text-green-400" : c.status === "warn" ? "text-yellow-400" : "text-red-400";
          const border = c.status === "ok" ? "border-green-500/20" : c.status === "warn" ? "border-yellow-500/30" : "border-red-500/40";
          return (
            <Card key={c.id} className={border}>
              <CardContent className="py-4 flex items-start gap-3">
                <Icon size={18} className={`${color} shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{c.label}</p>
                    <Badge variant="outline" className={`text-[11px] font-bold ${color}`}>{c.value}</Badge>
                  </div>
                  {c.detail && <p className="text-xs text-muted-foreground mt-1">{c.detail}</p>}
                  {c.fix && (
                    <div className="flex items-start gap-1.5 text-[11px] text-blue-400 mt-2">
                      <Wrench size={11} className="shrink-0 mt-0.5" />
                      <span>{c.fix}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
