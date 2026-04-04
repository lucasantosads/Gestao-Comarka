"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { LancamentoDiario, ConfigMensal, LeadCrm } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatPercent, formatMonthLabel } from "@/lib/format";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

interface MesData {
  mes: string;
  label: string;
  leads: number;
  investimento: number;
  reunioesAgendadas: number;
  reunioesFeitas: number;
  noShow: number;
  percentNoShow: number;
  contratos: number;
  mrr: number;
  ltv: number;
  comissao: number;
  custoLead: number;
  percentLeadsReuniao: number;
  custoReuniaoFeita: number;
  percentLeadsContrato: number;
  cacMarketing: number;
  cacAproximado: number;
  ticketMedio: number;
  roas: number;
  resultado: number;
}

const MESES = ["2026-01", "2026-02", "2026-03", "2026-04"];

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "green" | "red" | "blue" | "yellow" }) {
  const colors = {
    green: "text-green-400",
    red: "text-red-400",
    blue: "text-blue-400",
    yellow: "text-yellow-400",
  };
  return (
    <div className="flex justify-between items-baseline py-1 border-b border-muted/30 last:border-0">
      <span className="text-xs text-muted-foreground truncate mr-2">{label}</span>
      <div className="text-right shrink-0">
        <span className={`text-sm font-mono font-medium ${accent ? colors[accent] : ""}`}>{value}</span>
        {sub && <span className="text-[10px] text-muted-foreground ml-1">({sub})</span>}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-3 mb-1">{children}</p>;
}

export default function RelatorioPage() {
  const [dados, setDados] = useState<MesData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);

    const [{ data: lancamentos }, { data: configs }, { data: crmLeads }] =
      await Promise.all([
        supabase.from("lancamentos_diarios").select("*"),
        supabase.from("config_mensal").select("*"),
        supabase.from("leads_crm").select("etapa,valor_total_projeto,mes_referencia").eq("etapa", "comprou"),
      ]);

    const allLanc = (lancamentos || []) as LancamentoDiario[];
    const allConfigs = (configs || []) as ConfigMensal[];
    const allCrm = (crmLeads || []) as LeadCrm[];
    const safe = (n: number, d: number) => (d > 0 ? n / d : 0);

    const result = MESES.map((mes) => {
      const lanc = allLanc.filter((l) => l.mes_referencia === mes);
      const config = allConfigs.find((c) => c.mes_referencia === mes);
      const crm = allCrm.filter((l) => l.mes_referencia === mes);

      const leads = config?.leads_totais ?? 0;
      const investimento = Number(config?.investimento ?? 0);
      const reunioesAgendadas = lanc.reduce((s, l) => s + l.reunioes_marcadas, 0);
      const reunioesFeitas = lanc.reduce((s, l) => s + l.reunioes_feitas, 0);
      const noShow = reunioesAgendadas - reunioesFeitas;
      const contratos = lanc.reduce((s, l) => s + l.ganhos, 0);
      const mrr = lanc.reduce((s, l) => s + Number(l.mrr_dia), 0);
      const ltvCrm = crm.reduce((s, l) => s + Number(l.valor_total_projeto || 0), 0);
      const ltv = ltvCrm > 0 ? ltvCrm : lanc.reduce((s, l) => s + Number(l.ltv || 0), 0);
      const comissao = mrr * 0.1;

      return {
        mes, label: formatMonthLabel(mes), leads, investimento,
        reunioesAgendadas, reunioesFeitas, noShow,
        percentNoShow: safe(noShow, reunioesAgendadas) * 100,
        contratos, mrr, ltv, comissao,
        custoLead: safe(investimento, leads),
        percentLeadsReuniao: safe(reunioesFeitas, leads) * 100,
        custoReuniaoFeita: safe(investimento, reunioesFeitas),
        percentLeadsContrato: safe(contratos, leads) * 100,
        cacMarketing: safe(investimento, contratos),
        cacAproximado: safe(investimento + comissao, contratos),
        ticketMedio: safe(mrr, contratos),
        roas: safe(mrr, investimento),
        resultado: mrr - (comissao + investimento),
      };
    });

    setDados(result);
    setLoading(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;
  }

  const chartData = dados.map((d) => ({
    mes: d.label.split(" ")[0]?.slice(0, 3),
    MRR: d.mrr,
    Resultado: d.resultado,
    Contratos: d.contratos,
    ROAS: d.roas,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Relatório Mensal</h1>

      {/* Mini charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-2">
            <p className="text-xs text-muted-foreground mb-2">MRR x Resultado</p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={chartData} barGap={2}>
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="MRR" fill="#22c55e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Resultado" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-2">
            <p className="text-xs text-muted-foreground mb-2">Contratos Fechados</p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={chartData}>
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="Contratos" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-2">
            <p className="text-xs text-muted-foreground mb-2">ROAS</p>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={chartData}>
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, "auto"]} />
                <Tooltip formatter={(v) => Number(v).toFixed(2)} contentStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="ROAS" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Month cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {dados.map((d) => {
          const hasData = d.leads > 0 || d.contratos > 0;
          return (
            <Card key={d.mes} className={!hasData ? "opacity-40" : ""}>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-sm capitalize">{d.label}</h3>
                  {d.resultado > 0 && (
                    <span className="text-[10px] font-medium bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full">
                      +{formatCurrency(d.resultado)}
                    </span>
                  )}
                </div>

                <SectionTitle>Topo de Funil</SectionTitle>
                <Kpi label="Leads" value={String(d.leads)} />
                <Kpi label="Investimento" value={formatCurrency(d.investimento)} accent="red" />
                <Kpi label="CPL" value={formatCurrency(d.custoLead)} />

                <SectionTitle>Reuniões</SectionTitle>
                <Kpi label="Agendadas" value={String(d.reunioesAgendadas)} />
                <Kpi label="Feitas" value={String(d.reunioesFeitas)} sub={formatPercent(d.percentLeadsReuniao)} />
                <Kpi label="No Show" value={String(d.noShow)} sub={formatPercent(d.percentNoShow)} accent="red" />
                <Kpi label="CPRF" value={formatCurrency(d.custoReuniaoFeita)} />

                <SectionTitle>Conversão</SectionTitle>
                <Kpi label="Contratos" value={String(d.contratos)} accent="green" />
                <Kpi label="% Leads → Contrato" value={formatPercent(d.percentLeadsContrato)} />
                <Kpi label="Ticket Médio" value={formatCurrency(d.ticketMedio)} />

                <SectionTitle>Financeiro</SectionTitle>
                <Kpi label="MRR" value={formatCurrency(d.mrr)} accent="green" />
                <Kpi label="LTV" value={formatCurrency(d.ltv)} accent="blue" />
                <Kpi label="ROAS" value={d.roas.toFixed(2)} accent={d.roas >= 3 ? "green" : d.roas >= 2 ? "yellow" : "red"} />

                <SectionTitle>Custos</SectionTitle>
                <Kpi label="CAC Marketing" value={formatCurrency(d.cacMarketing)} />
                <Kpi label="CAC Aproximado" value={formatCurrency(d.cacAproximado)} />
                <Kpi label="Comissão (10%)" value={formatCurrency(d.comissao)} accent="red" />

                <div className="mt-3 pt-2 border-t border-muted flex justify-between items-baseline">
                  <span className="text-xs font-medium">Resultado</span>
                  <span className={`text-sm font-bold font-mono ${d.resultado >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {formatCurrency(d.resultado)}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
