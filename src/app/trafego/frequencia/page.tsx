"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { LeadAdsAttribution } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrafegoFilters, useTrafegoFilters } from "@/components/trafego-filters";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HORAS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}h`);

export default function TrafegoFrequenciaPage() {
  const filters = useTrafegoFilters();
  const [leads, setLeads] = useState<LeadAdsAttribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [filters.dataInicio, filters.dataFim]);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase.from("leads_ads_attribution").select("hora_chegada,dia_semana")
      .gte("created_at", filters.dataInicio + "T00:00:00").lte("created_at", filters.dataFim + "T23:59:59");
    setLeads((data || []) as LeadAdsAttribution[]);
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  let maxVal = 0;
  leads.forEach((l) => {
    if (l.dia_semana >= 0 && l.dia_semana <= 6 && l.hora_chegada >= 0 && l.hora_chegada <= 23) {
      grid[l.dia_semana][l.hora_chegada]++;
      maxVal = Math.max(maxVal, grid[l.dia_semana][l.hora_chegada]);
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold group relative cursor-help inline-flex items-center gap-2">
          Frequência de Leads
          <span className="invisible group-hover:visible absolute left-0 top-full mt-2 z-50 w-80 p-3 text-xs font-normal text-muted-foreground bg-card border rounded-lg shadow-lg">
            Mostra em quais dias e horários os leads chegam com mais frequência. Use para identificar os melhores momentos para investir em anúncios e otimizar a distribuição de orçamento ao longo da semana.
          </span>
        </h1>
        <TrafegoFilters periodo={filters.periodo} onPeriodoChange={filters.setPeriodo} dataInicio={filters.dataInicio} dataFim={filters.dataFim} onDataInicioChange={filters.setDataInicio} onDataFimChange={filters.setDataFim} statusFiltro={filters.statusFiltro} onStatusChange={filters.setStatusFiltro} />
      </div>
      {leads.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum lead com dados de frequência no período</CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Heatmap — Dia da Semana × Hora do Dia</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-auto"><div className="min-w-[700px]">
              <div className="flex"><div className="w-10 shrink-0" />{HORAS.map((h) => (<div key={h} className="flex-1 text-center text-[9px] text-muted-foreground py-1">{h}</div>))}</div>
              {DIAS.map((dia, di) => (
                <div key={dia} className="flex">
                  <div className="w-10 shrink-0 text-xs text-muted-foreground flex items-center justify-end pr-2">{dia}</div>
                  {Array.from({ length: 24 }, (_, hi) => {
                    const val = grid[di][hi];
                    const opacity = maxVal > 0 ? Math.max(0.05, val / maxVal) : 0;
                    return (<div key={hi} className="flex-1 aspect-square m-[1px] rounded-sm flex items-center justify-center text-[9px] font-medium" style={{ backgroundColor: val > 0 ? `rgba(24, 95, 165, ${opacity})` : "rgba(255,255,255,0.03)", color: opacity > 0.5 ? "white" : opacity > 0 ? "rgba(24, 95, 165, 0.8)" : "transparent" }} title={`${dia} ${HORAS[hi]}: ${val} leads`}>{val > 0 ? val : ""}</div>);
                  })}
                </div>
              ))}
            </div></div>
            <div className="flex items-center justify-end gap-2 mt-4 text-xs text-muted-foreground"><span>Menos</span>{[0.1, 0.3, 0.5, 0.7, 1].map((o) => (<div key={o} className="w-4 h-4 rounded-sm" style={{ backgroundColor: `rgba(24, 95, 165, ${o})` }} />))}<span>Mais</span></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
