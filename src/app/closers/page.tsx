"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Closer, LancamentoDiario, MetaCloser } from "@/types/database";
import { calcularScore } from "@/lib/calculos";
import { formatCurrency, getCurrentMonth } from "@/lib/format";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";

export default function ClosersPage() {
  const [closers, setClosers] = useState<Closer[]>([]);
  const [lancamentos, setLancamentos] = useState<LancamentoDiario[]>([]);
  const [prevLanc, setPrevLanc] = useState<LancamentoDiario[]>([]);
  const [metasClosers, setMetasClosers] = useState<Record<string, MetaCloser>>({});
  const mes = getCurrentMonth();

  useEffect(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;

    Promise.all([
      supabase.from("closers").select("*").eq("ativo", true).order("created_at"),
      supabase.from("lancamentos_diarios").select("*").eq("mes_referencia", mes),
      supabase.from("lancamentos_diarios").select("*").eq("mes_referencia", prevMonth),
      supabase.from("metas_closers").select("*").eq("mes_referencia", mes),
    ]).then(([{ data: cls }, { data: lanc }, { data: prev }, { data: mc }]) => {
      setClosers((cls || []) as Closer[]);
      setLancamentos((lanc || []) as LancamentoDiario[]);
      setPrevLanc((prev || []) as LancamentoDiario[]);
      const mcMap: Record<string, MetaCloser> = {};
      for (const m of (mc || []) as MetaCloser[]) mcMap[m.closer_id] = m;
      setMetasClosers(mcMap);
    });
  }, [mes]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Closers</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {closers.map((c) => {
          const myLanc = lancamentos.filter((l) => l.closer_id === c.id);
          const myPrevLanc = prevLanc.filter((l) => l.closer_id === c.id);
          const mc = metasClosers[c.id];

          const marcadas = myLanc.reduce((s, l) => s + l.reunioes_marcadas, 0);
          const feitas = myLanc.reduce((s, l) => s + l.reunioes_feitas, 0);
          const ganhos = myLanc.reduce((s, l) => s + l.ganhos, 0);
          const mrr = myLanc.reduce((s, l) => s + Number(l.mrr_dia), 0);
          const ticketMedio = ganhos > 0 ? mrr / ganhos : 0;

          const sr = calcularScore({
            reunioes_marcadas: marcadas, reunioes_feitas: feitas,
            contratos: ganhos, meta_contratos: mc?.meta_contratos ?? 0,
            ticket_medio: ticketMedio, ticket_meta: c.meta_ticket_medio ?? 0,
          });

          // Previous month score for delta
          const prevMarcadas = myPrevLanc.reduce((s, l) => s + l.reunioes_marcadas, 0);
          const prevFeitas = myPrevLanc.reduce((s, l) => s + l.reunioes_feitas, 0);
          const prevGanhos = myPrevLanc.reduce((s, l) => s + l.ganhos, 0);
          const prevMrr = myPrevLanc.reduce((s, l) => s + Number(l.mrr_dia), 0);
          const prevTicket = prevGanhos > 0 ? prevMrr / prevGanhos : 0;
          const prevSr = calcularScore({
            reunioes_marcadas: prevMarcadas, reunioes_feitas: prevFeitas,
            contratos: prevGanhos, meta_contratos: mc?.meta_contratos ?? 0,
            ticket_medio: prevTicket, ticket_meta: c.meta_ticket_medio ?? 0,
          });
          const scoreDelta = sr.score - prevSr.score;

          // Meta progress
          const metaContratos = mc?.meta_contratos ?? 0;
          const pctMeta = metaContratos > 0 ? Math.min((ganhos / metaContratos) * 100, 100) : 0;

          const statusColor = sr.status === "saudavel" ? "bg-green-500/15 text-green-400" : sr.status === "atencao" ? "bg-yellow-500/15 text-yellow-400" : "bg-red-500/15 text-red-400";
          const statusLabel = sr.status === "saudavel" ? "OK" : sr.status === "atencao" ? "Atenção" : "Crítico";

          return (
            <Link key={c.id} href={`/dashboard/closers/${c.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User size={20} className="text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{c.nome}</p>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-[9px] ${statusColor}`}>{statusLabel}</Badge>
                        <span className="text-sm font-mono font-bold">{sr.score}</span>
                        {scoreDelta !== 0 && (
                          <span className={`text-[10px] ${scoreDelta > 0 ? "text-green-400" : "text-red-400"}`}>
                            {scoreDelta > 0 ? "↑" : "↓"} {Math.abs(scoreDelta)} pts
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{ganhos} contratos</p>
                      <p>{formatCurrency(mrr)}</p>
                    </div>
                  </div>

                  {/* Progress bar de meta */}
                  {metaContratos > 0 && (
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Meta: {ganhos}/{metaContratos}</span>
                        <span>{pctMeta.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${pctMeta >= 100 ? "bg-green-500" : pctMeta >= 60 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${pctMeta}%` }} />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
