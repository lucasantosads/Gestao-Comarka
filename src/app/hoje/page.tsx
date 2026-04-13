"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import type { LeadCrm, Closer, LancamentoDiario } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/kpi-card";
import { getDiasUteisDoMes, getDiasUteisAte } from "@/lib/calculos";
import { getCurrentMonth, formatNumber } from "@/lib/format";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MetaMensal { meta_contratos_fechados: number; meta_reunioes_agendadas: number; meta_reunioes_feitas: number; leads_totais: number }

export default function HojePage() {
  const [filtroResp, setFiltroResp] = useState<"todos" | "sem" | string>("todos");
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

  const { data, mutate } = useSWR(
    ["hoje-data", dataSelecionada, mesAtual],
    async ([_, ds, ma]) => {
      const [lRes, cRes, lhRes, ldRes, mmRes] = await Promise.all([
        supabase.from("leads_crm").select("*").in("etapa", ["oportunidade", "reuniao_agendada", "follow_up", "proposta_enviada", "assinatura_contrato"]).order("ghl_created_at", { ascending: false, nullsFirst: false }).limit(1000),
        supabase.from("closers").select("*").eq("ativo", true).order("nome"),
        supabase.from("lancamentos_diarios").select("*").eq("data", ds),
        supabase.from("leads_crm").select("*").gte("ghl_created_at", ds + "T00:00:00").lte("ghl_created_at", ds + "T23:59:59").order("ghl_created_at", { ascending: false, nullsFirst: false }),
        supabase.from("metas_mensais").select("meta_contratos_fechados,meta_reunioes_agendadas,meta_reunioes_feitas,leads_totais").eq("mes_referencia", ma).single(),
      ]);
      return {
        leads: (lRes.data || []) as LeadCrm[],
        closers: (cRes.data || []) as Closer[],
        lancDia: (lhRes.data || []) as LancamentoDiario[],
        leadsDoDia: (ldRes.data || []) as LeadCrm[],
        metaMensal: (mmRes.data || null) as MetaMensal | null,
      };
    },
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  );

  const leads = data?.leads || [];
  const closers = data?.closers || [];
  const lancDia = data?.lancDia || [];
  const leadsDoDia = data?.leadsDoDia || [];
  const metaMensal = data?.metaMensal || null;
  const loading = !data;

  // Real-time
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const triggerReload = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        mutate();
      }, 2000);
    };

    const ch = supabase.channel("hoje-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads_crm" }, triggerReload)
      .subscribe();
    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(ch);
    };
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

      {/* Meta diária — não exibe alertas em fim de semana */}
      {metaMensal && diasUteisMes > 0 ? (() => {
        const dataSel = new Date(dataSelecionada + "T12:00:00");
        const isDiaUtil = dataSel.getDay() >= 1 && dataSel.getDay() <= 5;

        if (!isDiaUtil) {
          return (
            <div className="rounded-lg p-3 border text-sm bg-muted/30 text-muted-foreground">
              Fim de semana — sem meta diaria. Meta do mes: {metaMensal.meta_contratos_fechados} contratos em {diasRestantes} dias uteis restantes.
            </div>
          );
        }

        const metaContDia = metaMensal.meta_contratos_fechados / diasUteisMes;
        const metaReunDia = (metaMensal.meta_reunioes_feitas || 0) / diasUteisMes;
        const metaLeadsDia = (metaMensal.leads_totais || 0) / diasUteisMes;
        const atingiuLeads = leadsDoDia.length >= metaLeadsDia;
        const atingiuReun = feitasDia >= metaReunDia;
        const atingiuCont = ganhosDia >= metaContDia;
        const todosOk = atingiuLeads && atingiuReun && atingiuCont;
        return (
          <div className={`rounded-lg p-3 border text-sm ${todosOk ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"}`}>
            <span className="font-medium">Ritmo necessario hoje: </span>
            <span className={atingiuLeads ? "text-green-400" : ""}>{Math.ceil(metaLeadsDia)} leads</span>
            {" · "}<span className={atingiuReun ? "text-green-400" : ""}>{Math.ceil(metaReunDia)} reunioes</span>
            {" · "}<span className={atingiuCont ? "text-green-400" : ""}>{metaContDia.toFixed(1)} contratos</span>
            <span className="text-muted-foreground"> para bater a meta de {metaMensal.meta_contratos_fechados} contratos em {diasRestantes} dias uteis</span>
            {!todosOk && <span className="ml-2 text-xs">
              {!atingiuLeads && `· Faltam ${Math.ceil(metaLeadsDia - leadsDoDia.length)} leads `}
              {!atingiuReun && `· Faltam ${Math.ceil(metaReunDia - feitasDia)} reunioes `}
            </span>}
          </div>
        );
      })() : !metaMensal && (
        <div className="rounded-lg p-3 border text-sm bg-muted/50 text-muted-foreground">
          Configure sua meta mensal em <a href="/metas" className="text-primary underline">Metas</a> para ver o ritmo diário
        </div>
      )}

      {/* KPIs do dia */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard title="Leads que Chegaram" value={formatNumber(leadsDoDia.length)} />
        <KpiCard title="Reuniões Agendadas" value={formatNumber(marcadasDia)} />
        <KpiCard title="Reuniões Feitas" value={formatNumber(feitasDia)} />
        <KpiCard title="Contratos" value={formatNumber(ganhosDia)} />
        <KpiCard title="Reuniões Marcadas" value={formatNumber(reunioesDoDia.length)} />
      </div>

      {/* Leads que chegaram no dia — com filtro de responsável */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Leads que Chegaram ({leadsDoDia.length})</CardTitle>
          <div className="flex bg-muted rounded-lg p-0.5">
            <button onClick={() => setFiltroResp("todos")} className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${filtroResp === "todos" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>Todos</button>
            <button onClick={() => setFiltroResp("sem")} className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${filtroResp === "sem" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>Sem responsável</button>
            {closers.map((cl) => (
              <button key={cl.id} onClick={() => setFiltroResp(cl.id)} className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${filtroResp === cl.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>{cl.nome}</button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            const filtered = filtroResp === "todos" ? leadsDoDia
              : filtroResp === "sem" ? leadsDoDia.filter((l) => !l.closer_id)
                : leadsDoDia.filter((l) => l.closer_id === filtroResp);
            return filtered.length > 0 ? (
              <div className="space-y-2">
                {filtered.map((l) => (
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
                    <div className="flex items-center gap-2">
                      {l.closer_id ? (
                        <Badge variant="outline" className="text-[9px]">{closerName(l.closer_id)}</Badge>
                      ) : (
                        <Badge className="text-[9px] bg-red-500/15 text-red-400">Sem responsável</Badge>
                      )}
                      <Badge className={`text-xs ${etapaColors[l.etapa] || "bg-muted"}`}>
                        {etapaLabels[l.etapa] || l.etapa}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum lead {filtroResp === "sem" ? "sem responsável" : ""} neste dia</p>
            );
          })()}
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
