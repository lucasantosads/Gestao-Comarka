"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { LeadCrm, Closer, LancamentoDiario } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/kpi-card";
import { getDiasUteisDoMes, getDiasUteisAte } from "@/lib/calculos";
import { getCurrentMonth, formatNumber } from "@/lib/format";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HojePage() {
  const [leads, setLeads] = useState<LeadCrm[]>([]);
  const [closers, setClosers] = useState<Closer[]>([]);
  const [lancDia, setLancDia] = useState<LancamentoDiario[]>([]);
  const [leadsDoDia, setLeadsDoDia] = useState<LeadCrm[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataSelecionada, setDataSelecionada] = useState(new Date().toISOString().split("T")[0]);

  const mesAtual = getCurrentMonth();
  const diasUteisMes = getDiasUteisDoMes(mesAtual);
  const diasUteisPassados = getDiasUteisAte(mesAtual, new Date());
  const diasRestantes = diasUteisMes - diasUteisPassados;

  const navegarDia = (dir: number) => {
    const d = new Date(dataSelecionada + "T12:00:00");
    d.setDate(d.getDate() + dir);
    setDataSelecionada(d.toISOString().split("T")[0]);
  };

  const isHoje = dataSelecionada === new Date().toISOString().split("T")[0];

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase.from("leads_crm").select("*").in("etapa", ["oportunidade", "reuniao_agendada", "follow_up", "proposta_enviada", "assinatura_contrato"]).order("created_at", { ascending: false }),
      supabase.from("closers").select("*").eq("ativo", true).order("nome"),
      supabase.from("lancamentos_diarios").select("*").eq("data", dataSelecionada),
      supabase.from("leads_crm").select("*").gte("created_at", dataSelecionada + "T00:00:00").lte("created_at", dataSelecionada + "T23:59:59").order("created_at", { ascending: false }),
    ]).then(([{ data: l }, { data: c }, { data: lh }, { data: ld }]) => {
      setLeads((l || []) as LeadCrm[]);
      setClosers((c || []) as Closer[]);
      setLancDia((lh || []) as LancamentoDiario[]);
      setLeadsDoDia((ld || []) as LeadCrm[]);
      setLoading(false);
    });
  }, [dataSelecionada]);

  // Real-time
  useEffect(() => {
    const ch = supabase.channel("hoje-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads_crm" }, () => {
        // Recarregar leads do dia
        supabase.from("leads_crm").select("*").gte("created_at", dataSelecionada + "T00:00:00").lte("created_at", dataSelecionada + "T23:59:59").order("created_at", { ascending: false })
          .then(({ data }) => setLeadsDoDia((data || []) as LeadCrm[]));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [dataSelecionada]);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  const closerName = (id: string | null) => closers.find((c) => c.id === id)?.nome || "—";

  const dataSel = new Date(dataSelecionada + "T12:00:00");
  const labelDia = dataSel.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  // Follow-ups atrasados (>3 dias)
  const hojeMs = Date.now();
  const followUpAtrasados = leads.filter((l) => {
    if (l.etapa !== "follow_up") return false;
    const dt = l.data_follow_up || l.updated_at;
    if (!dt) return false;
    return Math.floor((hojeMs - new Date(dt).getTime()) / (1000 * 60 * 60 * 24)) > 3;
  });

  // Reuniões do dia
  const reunioesDoDia = leads.filter((l) => l.agendamento?.startsWith(dataSelecionada));

  // Quem lançou
  const closersQueLancaram = new Set(lancDia.map((l) => l.closer_id));

  // Totais do dia (lancamentos)
  const marcadasDia = lancDia.reduce((s, l) => s + l.reunioes_marcadas, 0);
  const feitasDia = lancDia.reduce((s, l) => s + l.reunioes_feitas, 0);
  const ganhosDia = lancDia.reduce((s, l) => s + l.ganhos, 0);

  // Etapa badges
  const etapaColors: Record<string, string> = {
    oportunidade: "bg-slate-500/20 text-slate-400",
    reuniao_agendada: "bg-blue-500/20 text-blue-500",
    proposta_enviada: "bg-purple-500/20 text-purple-500",
    follow_up: "bg-yellow-500/20 text-yellow-500",
    assinatura_contrato: "bg-orange-500/20 text-orange-500",
    comprou: "bg-green-500/20 text-green-500",
    desistiu: "bg-red-500/20 text-red-500",
  };
  const etapaLabels: Record<string, string> = {
    oportunidade: "Oportunidade", reuniao_agendada: "Reunião Agendada",
    proposta_enviada: "Proposta Enviada", follow_up: "Follow Up",
    assinatura_contrato: "Assinatura", comprou: "Comprou", desistiu: "Desistiu",
  };

  return (
    <div className="space-y-6">
      {/* Header com navegação de data */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{isHoje ? "Hoje" : "Dia Selecionado"}</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {labelDia}
            {isHoje && ` · ${diasRestantes} dias úteis restantes no mês`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navegarDia(-1)} className="h-8 w-8 p-0">
            <ChevronLeft size={16} />
          </Button>
          <input
            type="date"
            value={dataSelecionada}
            onChange={(e) => setDataSelecionada(e.target.value)}
            className="text-sm bg-transparent border rounded-lg px-3 py-1.5"
          />
          <Button variant="ghost" size="sm" onClick={() => navegarDia(1)} className="h-8 w-8 p-0">
            <ChevronRight size={16} />
          </Button>
          {!isHoje && (
            <Button variant="outline" size="sm" onClick={() => setDataSelecionada(new Date().toISOString().split("T")[0])} className="text-xs">
              Hoje
            </Button>
          )}
        </div>
      </div>

      {/* KPIs do dia */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard title="Leads que Chegaram" value={formatNumber(leadsDoDia.length)} />
        <KpiCard title="Reuniões Agendadas" value={formatNumber(marcadasDia)} />
        <KpiCard title="Reuniões Feitas" value={formatNumber(feitasDia)} />
        <KpiCard title="Contratos" value={formatNumber(ganhosDia)} />
        <KpiCard title="Reuniões Marcadas" value={formatNumber(reunioesDoDia.length)} />
      </div>

      {/* Leads que chegaram no dia */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leads que Chegaram ({leadsDoDia.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {leadsDoDia.length > 0 ? (
            <div className="space-y-2">
              {leadsDoDia.map((l) => (
                <div key={l.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-sm">{l.nome || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.telefone || "—"} · {l.canal_aquisicao || "—"}
                        {l.ad_name && ` · ${l.ad_name}`}
                      </p>
                    </div>
                  </div>
                  <Badge className={`text-xs ${etapaColors[l.etapa] || "bg-muted"}`}>
                    {etapaLabels[l.etapa] || l.etapa}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum lead chegou neste dia</p>
          )}
        </CardContent>
      </Card>

      {/* Reuniões do dia */}
      <Card>
        <CardHeader><CardTitle className="text-base">Reuniões do Dia ({reunioesDoDia.length})</CardTitle></CardHeader>
        <CardContent>
          {reunioesDoDia.length > 0 ? (
            <div className="space-y-2">
              {reunioesDoDia.map((l) => (
                <div key={l.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{l.nome}</p>
                    <p className="text-xs text-muted-foreground">{closerName(l.closer_id)}</p>
                  </div>
                  <Badge variant="outline" className="border-blue-500 text-blue-500">Agendada</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma reunião agendada para este dia</p>
          )}
        </CardContent>
      </Card>

      {/* Follow-ups atrasados */}
      {isHoje && followUpAtrasados.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Follow-ups Atrasados ({followUpAtrasados.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {followUpAtrasados.slice(0, 10).map((l) => {
                const dias = Math.floor((hojeMs - new Date(l.data_follow_up || l.updated_at).getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={l.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{l.nome}</p>
                      <p className="text-xs text-muted-foreground">{closerName(l.closer_id)}</p>
                    </div>
                    <Badge className="bg-red-500/20 text-red-500">{dias} dias</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lançamentos do dia */}
      <Card>
        <CardHeader><CardTitle className="text-base">Lançamentos do Dia</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {closers.map((c) => {
              const lancou = closersQueLancaram.has(c.id);
              const lanc = lancDia.find((l) => l.closer_id === c.id);
              return (
                <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium text-sm">{c.nome}</span>
                  {lancou ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{lanc?.reunioes_marcadas} agend. · {lanc?.reunioes_feitas} feitas · {lanc?.ganhos} contratos</span>
                      <Badge className="bg-green-500/20 text-green-500">Lançou</Badge>
                    </div>
                  ) : (
                    <Badge className="bg-yellow-500/20 text-yellow-500">Pendente</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Leads ativos (pipeline) */}
      <Card>
        <CardHeader><CardTitle className="text-base">Leads Ativos ({leads.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {["oportunidade", "reuniao_agendada", "proposta_enviada", "follow_up", "assinatura_contrato"].map((etapa) => {
              const count = leads.filter((l) => l.etapa === etapa).length;
              if (count === 0) return null;
              return (
                <div key={etapa} className="p-3 border rounded-lg text-center">
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">{etapaLabels[etapa] || etapa}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
