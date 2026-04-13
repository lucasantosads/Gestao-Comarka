"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Cliente } from "@/lib/data";

interface GestorStat {
  nome: string; total: number; notion_ids: string[];
}

export function GestorCapacidade() {
  const [stats, setStats] = useState<GestorStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notion/clientes-filtrados")
      .then((r) => r.json())
      .then((clientes: Cliente[]) => {
        if (!Array.isArray(clientes)) return;
        const map = new Map<string, GestorStat>();
        for (const c of clientes) {
          if (c.status === "Finalizado") continue;
          const nome = c.analista || "Sem gestor";
          const ex = map.get(nome) || { nome, total: 0, notion_ids: [] };
          ex.total++;
          ex.notion_ids.push(c.notion_id);
          map.set(nome, ex);
        }
        setStats(Array.from(map.values()).sort((a, b) => b.total - a.total));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || stats.length === 0) return null;

  const MAX = 20;
  const statusColor = (n: number) => n > 16 ? { label: "Sobrecarregado", cls: "bg-red-500/15 text-red-400", bar: "bg-red-500" }
    : n >= 12 ? { label: "Atenção", cls: "bg-yellow-500/15 text-yellow-400", bar: "bg-yellow-500" }
    : { label: "OK", cls: "bg-green-500/15 text-green-400", bar: "bg-green-500" };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Capacidade por Gestor</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {stats.map((g) => {
          const st = statusColor(g.total);
          const pct = Math.min((g.total / MAX) * 100, 100);
          return (
            <div key={g.nome} className="flex items-center gap-3">
              <div className="w-28 text-xs font-medium truncate">{g.nome}</div>
              <div className="flex-1 relative h-5 bg-muted rounded overflow-hidden">
                <div className={`h-full ${st.bar}`} style={{ width: `${pct}%` }} />
                <div className="absolute inset-0 flex items-center justify-between px-2 text-[10px] font-mono">
                  <span>{g.total} clientes</span>
                </div>
              </div>
              <Badge className={`text-[9px] ${st.cls}`}>{st.label}</Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
