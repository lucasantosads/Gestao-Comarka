"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { MonthSelector } from "@/components/month-selector";
import { getCurrentMonth, formatCurrency, formatPercent } from "@/lib/format";
import { FluxoCaixaChart } from "@/components/financeiro/FluxoCaixaChart";
import { LancarDespesaModal } from "@/components/financeiro/LancarDespesaModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, TrendingDown, ChevronDown, ChevronRight, Download, Info, LineChart, PieChart as PieIcon, Calculator } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, Bar, XAxis, YAxis, CartesianGrid, ComposedChart, Line } from "recharts";
import { useDreSWR, useDreEvolucaoSWR } from "@/hooks/use-financeiro-swr";
import { motion, AnimatePresence } from "framer-motion";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const COLORS = ["#6366f1", "#f59e0b", "#06b6d4", "#8b5cf6", "#ec4899", "#10b981", "#64748b"];

function getVariacao(atual: number, anterior: number): number {
  if (!anterior) return 0;
  return ((atual - anterior) / anterior) * 100;
}

function DeltaBadge({ delta, invert }: { delta: number; invert?: boolean }) {
  if (Math.abs(delta) < 0.5) return <span className="text-[10px] text-muted-foreground">—</span>;
  const positive = invert ? delta < 0 : delta > 0;
  return (
    <span className={`text-[9px] font-mono font-bold tracking-widest px-1.5 py-0.5 rounded ${positive ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"} flex items-center gap-0.5`}>
      {delta > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
    </span>
  );
}

function LinhaDRE({ label, valor, anterior, tipo, tooltip, level = 0, compare, invertDelta }: any) {
  const delta = anterior !== undefined ? getVariacao(valor, anterior) : 0;
  const cls = tipo === "total" ? "bg-muted/80 font-black border-y border-border/50 text-foreground"
    : tipo === "subtotal" ? "bg-muted/30 font-bold border-t border-border/20 text-foreground"
      : "text-muted-foreground";
  return (
    <tr className={`${cls} hover:bg-muted/40 transition-colors`}>
      <td className="py-2.5 px-4 text-[11px] font-medium" style={{ paddingLeft: `${16 + level * 16}px` }}>
        <span className="flex items-center gap-1.5 uppercase tracking-widest">
          {label}
          {tooltip && <span title={tooltip} className="cursor-help"><Info size={12} className="text-muted-foreground/30 hover:text-primary transition-colors" /></span>}
        </span>
      </td>
      <td className="py-2.5 px-4 text-right font-mono text-[11px] tracking-tight">
        {valor === 0 && tipo === "detalhe" ? <span className="text-muted-foreground/30">—</span> : formatCurrency(valor)}
      </td>
      {compare && (
        <>
          <td className="py-2.5 px-4 text-right font-mono text-[11px] text-muted-foreground/50 tracking-tight">
            {anterior !== undefined ? formatCurrency(anterior) : "—"}
          </td>
          <td className="py-2.5 px-4 text-right flex justify-end">
            <DeltaBadge delta={delta} invert={invertDelta} />
          </td>
        </>
      )}
    </tr>
  );
}

export default function DREPage() {
  const [mounted, setMounted] = useState(false);
  const [mes, setMes] = useState(getCurrentMonth());
  const [compare, setCompare] = useState(false);
  const [ytd, setYtd] = useState(false);
  const [impostosPct, setImpostosPct] = useState(6);
  const [expandedCat, setExpandedCat] = useState<Record<string, boolean>>({});

  useEffect(() => { setMounted(true); }, []);

  const { data, isLoading, mutate } = useDreSWR(mes, impostosPct, ytd);
  const { evolucao, isLoading: evolLoading } = useDreEvolucaoSWR(mes, impostosPct);

  const ant = data?.comparativo?.mes_anterior;

  const pieData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Folha", value: data.custos_fixos.folha },
      { name: "Tráfego", value: data.aquisicao.trafego_pago },
      { name: "Ferramentas", value: data.custos_fixos.ferramentas },
      { name: "Infra", value: data.custos_fixos.infraestrutura },
      { name: "Comissões", value: data.aquisicao.comissoes },
      { name: "Variáveis", value: data.custos_variaveis.despesas },
      { name: "Outros", value: data.custos_fixos.outros },
    ].filter(x => x.value > 0);
  }, [data]);

  const evolucaoData = useMemo(() =>
    evolucao.map((d: any) => ({
      mes: MESES[parseInt(d.mes.slice(5)) - 1],
      Receita: d.receita.bruta, Folha: d.custos_fixos.folha, Tráfego: d.aquisicao.trafego_pago,
      Ferramentas: d.custos_fixos.ferramentas, Variáveis: d.custos_variaveis.despesas, Lucro: d.lucro_liquido,
    })), [evolucao]);

  const exportCSV = () => {
    if (!data) return;
    const lines = ["Categoria,Item,Valor", ...Object.entries(data.detalhes).flatMap(([cat, items]: [string, any]) => items.map((i: any) => `${cat},"${i.descricao.replace(/"/g, '""')}",${i.valor}`))];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dre-detalhes-${mes}.csv`;
    a.click();
  };

  if (!mounted || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 animate-in fade-in text-muted-foreground">
        <div className="w-8 h-8 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin mb-3" />
        <p className="text-xs uppercase tracking-widest font-bold">Processando Lançamentos...</p>
      </div>
    );
  }

  if (!data) return <div className="text-center py-12 text-muted-foreground">Falha ao computar DRE. Verifique APIs.</div>;

  const ms = data.indicadores.margem_liquida_pct < 15 ? { label: "Crítica", c: "text-rose-400 bg-rose-500/10" } : data.indicadores.margem_liquida_pct < 25 ? { label: "Alerta", c: "text-yellow-400 bg-yellow-500/10" } : data.indicadores.margem_liquida_pct < 40 ? { label: "Saudável", c: "text-emerald-400 bg-emerald-500/10" } : { label: "Excelente", c: "text-cyan-400 bg-cyan-500/10" };

  const catGroups = [
    { key: "folha", label: "Folha de Pagamento" }, { key: "ferramentas", label: "Ferramentas/SaaS" },
    { key: "infraestrutura", label: "Infraestrutura" }, { key: "outros_fixos", label: "Outros Fixos" },
    { key: "comissoes", label: "Comissões" }, { key: "variavel", label: "Despesas Variáveis" },
  ];

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-700 fade-in pb-16">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-card/60 border border-border/50 p-6 rounded-2xl backdrop-blur-xl shadow-[0_4px_24px_-10px_rgba(0,0,0,0.1)] gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter flex items-center gap-2">DRE Corporativo <Calculator size={24} className="text-indigo-500" /></h1>
          <p className="text-muted-foreground font-medium text-xs mt-1 uppercase tracking-widest">{ytd ? `Acumulado ${mes.slice(0, 4)} até ${MESES[parseInt(mes.slice(5)) - 1]}` : `${MESES[parseInt(mes.slice(5)) - 1]}/${mes.slice(0, 4)}`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-muted/20 border border-border/40 p-1.5 rounded-xl shadow-inner text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <span>Taxa Impostível</span>
            <Input type="number" value={impostosPct} onChange={(e) => setImpostosPct(Number(e.target.value))} className="h-6 w-14 text-[10px] font-mono font-black text-center bg-background border-none shadow-sm" step="0.5" />
            <span>%</span>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setCompare(!compare)} className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all border ${compare ? "bg-indigo-500 text-white border-indigo-600 shadow-md" : "bg-background text-muted-foreground hover:bg-muted"}`}>Comparar</button>
            <button onClick={() => setYtd(!ytd)} className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all border ${ytd ? "bg-indigo-500 text-white border-indigo-600 shadow-md" : "bg-background text-muted-foreground hover:bg-muted"}`}>YTD</button>
          </div>

          <LancarDespesaModal onSaved={mutate} />
          {!ytd && <MonthSelector value={mes} onChange={setMes} />}
        </div>
      </div>

      {/* KPIs Gerais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card/40 backdrop-blur-md rounded-xl border border-border/40 shadow">
          <CardContent className="p-4 flex flex-col justify-between">
            <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">Receita Líquida</p>
            <div className="flex justify-between items-end">
              <p className="text-3xl font-black tracking-tight">{formatCurrency(data.receita.liquida)}</p>
              {ant && <DeltaBadge delta={getVariacao(data.receita.liquida, ant.receita.liquida)} />}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 backdrop-blur-md rounded-xl border border-border/40 shadow-sm">
          <CardContent className="p-4 flex flex-col justify-between">
            <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">Lucro Líquido Real</p>
            <div className="flex justify-between items-end">
              <p className={`text-3xl font-black tracking-tight ${data.lucro_liquido < 0 ? "text-rose-400" : "text-emerald-400"}`}>{formatCurrency(data.lucro_liquido)}</p>
              {ant && <DeltaBadge delta={getVariacao(data.lucro_liquido, ant.lucro_liquido)} />}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 backdrop-blur-md rounded-xl border border-border/40 shadow">
          <CardContent className="p-4 flex flex-col justify-between">
            <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">Margem Líquida Profit</p>
            <div className="flex justify-between items-end">
              <p className="text-3xl font-black tracking-tight">{formatPercent(data.indicadores.margem_liquida_pct)}</p>
              <Badge className={`uppercase tracking-widest font-black text-[9px] ${ms.c}`}>{ms.label}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card/40 backdrop-blur-md rounded-xl border border-border/40 shadow">
          <CardContent className="p-4 flex flex-col justify-between">
            <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">Tráfego OTE <span className="opacity-50">({data.aquisicao.trafego_fonte})</span></p>
            <div className="flex justify-between items-end">
              <p className="text-3xl font-black tracking-tight">{formatCurrency(data.aquisicao.trafego_pago)}</p>
              {ant && <DeltaBadge delta={getVariacao(data.aquisicao.trafego_pago, ant.aquisicao.trafego_pago)} invert />}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 backdrop-blur-md rounded-xl border border-border/40 shadow-sm">
          <CardContent className="p-4 flex flex-col justify-between">
            <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">Retorno de Escala (ROAS)</p>
            <div className="flex justify-between items-end">
              <p className="text-3xl font-black tracking-tight text-indigo-400">{data.indicadores.roas.toFixed(2)}x</p>
              {ant && <DeltaBadge delta={getVariacao(data.indicadores.roas, ant.indicadores.roas)} />}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 backdrop-blur-md rounded-xl border border-border/40 shadow-sm">
          <CardContent className="p-4 flex flex-col justify-between">
            <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">Custo Aquisição (CAC) <span className="opacity-50 font-normal">[{data.receita.novos_clientes} Vol]</span></p>
            <div className="flex justify-between items-end">
              <p className="text-3xl font-black tracking-tight text-rose-400">{formatCurrency(data.indicadores.cac)}</p>
              {ant && <DeltaBadge delta={getVariacao(data.indicadores.cac, ant.indicadores.cac)} invert />}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/40 backdrop-blur-md shadow-lg border-border/40">
        <CardHeader className="bg-muted/10 border-b border-border/30 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm uppercase tracking-widest font-black text-indigo-400 flex items-center gap-2"><LineChart size={16} /> Livro Razão Demonstativo (DRE)</CardTitle>
            <Button size="sm" variant="outline" className="h-7 text-[10px] font-black uppercase tracking-widest shadow-sm" onClick={exportCSV}><Download size={12} className="mr-1" /> Exportar Extrato CSV</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 text-[9px] uppercase tracking-widest font-black text-muted-foreground bg-muted/20">
                  <th className="py-3 px-4 text-left">Nomenclatura Contábil</th>
                  <th className="py-3 px-4 text-right w-[150px]">{ytd ? "Acumulado Global" : MESES[parseInt(mes.slice(5)) - 1]}</th>
                  {compare && <><th className="py-3 px-4 text-right w-[150px]">Lanç. Ant.</th><th className="py-3 px-4 text-right w-[100px]">Oscilação (Δ)</th></>}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-emerald-500/10"><td colSpan={compare ? 4 : 2} className="py-1.5 px-4 text-[10px] uppercase font-black tracking-widest text-emerald-500">I. Base de Receita Mapeada</td></tr>
                <LinhaDRE label="(+) Receita Bruta Faturada" valor={data.receita.bruta} anterior={ant?.receita.bruta} compare={compare} />
                <LinhaDRE label="(−) Desfalque / Churn Evadido" valor={-data.receita.cancelamentos} anterior={ant ? -ant.receita.cancelamentos : undefined} compare={compare} invertDelta />
                <LinhaDRE label="(=) Faturamento Líquido Útil" valor={data.receita.liquida} anterior={ant?.receita.liquida} compare={compare} tipo="subtotal" />

                <tr className="bg-orange-500/10"><td colSpan={compare ? 4 : 2} className="py-1.5 px-4 text-[10px] uppercase font-black tracking-widest text-orange-500">II. Escoamento Aquisição (CAC)</td></tr>
                <LinhaDRE label="(−) Queima em Tráfego Ads" valor={-data.aquisicao.trafego_pago} anterior={ant ? -ant.aquisicao.trafego_pago : undefined} compare={compare} />
                <LinhaDRE label="(−) Comissionamento Closers" valor={-data.aquisicao.comissoes} anterior={ant ? -ant.aquisicao.comissoes : undefined} compare={compare} />
                <LinhaDRE label="(=) Total de CAC Diluído" valor={-data.aquisicao.total} anterior={ant ? -ant.aquisicao.total : undefined} compare={compare} tipo="subtotal" />
                <LinhaDRE label="(=) Margem Operacional de Contribuição" valor={data.margem_contribuicao} anterior={ant?.margem_contribuicao} compare={compare} tipo="subtotal" />

                <tr className="bg-indigo-500/10"><td colSpan={compare ? 4 : 2} className="py-1.5 px-4 text-[10px] uppercase font-black tracking-widest text-indigo-500">III. Custos Fixos Ocultos</td></tr>
                <LinhaDRE label="(−) Folha Bruta Fixa" valor={-data.custos_fixos.folha} anterior={ant ? -ant.custos_fixos.folha : undefined} compare={compare} />
                <LinhaDRE label="(−) Locação SaaS (Ferramentas)" valor={-data.custos_fixos.ferramentas} anterior={ant ? -ant.custos_fixos.ferramentas : undefined} compare={compare} />
                <LinhaDRE label="(−) Sobrecarga Infraestrutura" valor={-data.custos_fixos.infraestrutura} anterior={ant ? -ant.custos_fixos.infraestrutura : undefined} compare={compare} />
                <LinhaDRE label="(−) Outros Débitos Paralelos" valor={-data.custos_fixos.outros} anterior={ant ? -ant.custos_fixos.outros : undefined} compare={compare} />
                <LinhaDRE label="(=) Custo Fixo Consolidado" valor={-data.custos_fixos.total} anterior={ant ? -ant.custos_fixos.total : undefined} compare={compare} tipo="subtotal" />

                <tr className="bg-purple-500/10"><td colSpan={compare ? 4 : 2} className="py-1.5 px-4 text-[10px] uppercase font-black tracking-widest text-purple-500">IV. Gastos Exporádicos (Variáveis)</td></tr>
                <LinhaDRE label="(−) Despesas Avulsas Variáveis" valor={-data.custos_variaveis.despesas} anterior={ant ? -ant.custos_variaveis.despesas : undefined} compare={compare} />
                <LinhaDRE label="(=) Saldo Total Variável" valor={-data.custos_variaveis.total} anterior={ant ? -ant.custos_variaveis.total : undefined} compare={compare} tipo="subtotal" />

                <LinhaDRE label="(=) Result. Operacional Primário" valor={data.resultado_operacional} anterior={ant?.resultado_operacional} compare={compare} tipo="subtotal" />
                <LinhaDRE label={`(−) Alíquota Dedutora Imps. (${data.impostos.pct}%)`} valor={-data.impostos.valor} anterior={ant ? -ant.impostos.valor : undefined} compare={compare} />
                <LinhaDRE label="(=) Lucro Livre Retornável" valor={data.lucro_liquido} anterior={ant?.lucro_liquido} compare={compare} tipo="total" />
              </tbody>
            </table>
          </div>
          <div className="bg-muted/10 p-4 border-t border-border/30 grid grid-cols-2 md:grid-cols-5 gap-4">
            <div><p className="text-[9px] uppercase tracking-widest text-muted-foreground font-black mb-1">M. Líquida</p><p className="font-mono text-xs font-bold">{formatPercent(data.indicadores.margem_liquida_pct)}</p></div>
            <div><p className="text-[9px] uppercase tracking-widest text-muted-foreground font-black mb-1">M. Oper.</p><p className="font-mono text-xs font-bold">{formatPercent(data.indicadores.margem_operacional_pct)}</p></div>
            <div><p className="text-[9px] uppercase tracking-widest text-muted-foreground font-black mb-1">Folha/Rec</p><p className="font-mono text-xs font-bold">{formatPercent(data.indicadores.folha_sobre_receita_pct)}</p></div>
            <div><p className="text-[9px] uppercase tracking-widest text-muted-foreground font-black mb-1">CAC Adq.</p><p className="font-mono text-xs font-bold text-rose-400">{formatCurrency(data.indicadores.cac)}</p></div>
            <div><p className="text-[9px] uppercase tracking-widest text-muted-foreground font-black mb-1">ROAS Escala</p><p className="font-mono text-xs font-bold text-indigo-400">{data.indicadores.roas.toFixed(2)}x</p></div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card/40 backdrop-blur-md shadow-lg border-border/40">
          <CardHeader className="border-b border-border/20 pb-3"><CardTitle className="text-xs uppercase font-black tracking-widest text-muted-foreground flex items-center gap-2"><PieIcon size={14} /> Topologia de Custos</CardTitle></CardHeader>
          <CardContent className="pt-6">
            {pieData.length > 0 ? (
              <ResponsiveContainer width={("100%")} height={260}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} label={e => `${e.name} ${((e.percent || 0) * 100).toFixed(0)}%`} stroke="none">
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip cursor={{ fill: "#ffffff05" }} contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", fontSize: "12px" }} formatter={(v: any) => formatCurrency(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-[260px] flex items-center justify-center text-muted-foreground text-xs uppercase tracking-widest font-black">Escuro Contábil: Sem Custos</div>}
          </CardContent>
        </Card>
        <FluxoCaixaChart ano={Number(mes.split("-")[0])} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolução */}
        <Card className="bg-card/40 backdrop-blur-md shadow-lg border-border/40 overflow-hidden">
          <CardHeader className="bg-muted/10 border-b border-border/30 pb-3"><CardTitle className="text-xs uppercase font-black tracking-widest text-muted-foreground">Progresso Histórico Anual ({mes.slice(0, 4)})</CardTitle></CardHeader>
          <CardContent className="pt-6 pb-2">
            {evolucaoData.length > 0 && !evolLoading ? (
              <ResponsiveContainer width={("100%")} height={320}>
                <ComposedChart data={evolucaoData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#888" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip cursor={{ fill: "#ffffff05" }} contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", fontSize: "12px" }} formatter={(v: any) => formatCurrency(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                  <Bar dataKey="Folha" stackId="c" fill="#6366f1" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Tráfego" stackId="c" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Ferramentas" stackId="c" fill="#06b6d4" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Variáveis" stackId="c" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="Receita" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="Lucro" stroke="#ec4899" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : <div className="h-[320px] w-full bg-muted/20 animate-pulse rounded-2xl flex items-center justify-center text-[10px] text-muted-foreground uppercase font-black tracking-widest">Carregando Séries...</div>}
          </CardContent>
        </Card>

        {/* Detalhes Categorias */}
        <Card className="bg-card/40 backdrop-blur-md shadow-lg border-border/40">
          <CardHeader className="bg-muted/10 border-b border-border/30 pb-3"><CardTitle className="text-xs uppercase font-black tracking-widest text-muted-foreground flex items-center gap-2"><Calculator size={14} /> Espectro Extrato Categórico</CardTitle></CardHeader>
          <CardContent className="pt-4 p-4">
            <div className="space-y-3">
              {catGroups.map(({ key, label }) => {
                const items = (data.detalhes as any)[key];
                if (!items || items.length === 0) return null;
                const total = items.reduce((s: number, i: any) => s + i.valor, 0);
                const pct = data.receita.bruta > 0 ? (total / data.receita.bruta) * 100 : 0;
                const isOpen = expandedCat[key];
                return (
                  <motion.div layout key={key} className="bg-muted/10 border border-border/30 rounded-xl overflow-hidden shadow-sm">
                    <button onClick={() => setExpandedCat(p => ({ ...p, [key]: !p[key] }))} className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2">
                        {isOpen ? <ChevronDown size={14} className="text-indigo-400" /> : <ChevronRight size={14} className="text-muted-foreground" />}
                        <span className="text-xs uppercase font-black tracking-widest text-foreground">{label}</span>
                        <span className="text-[9px] text-muted-foreground font-mono">({items.length} LANÇ)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground font-mono">{pct.toFixed(1)}% Rec</span>
                        <span className="text-sm font-black font-mono tracking-tight">{formatCurrency(total)}</span>
                      </div>
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="border-t border-border/30 bg-background/50">
                          <table className="w-full">
                            <tbody>
                              {items.map((i: any, idx: number) => (
                                <tr key={idx} className="border-b border-border/10 hover:bg-muted/20">
                                  <td className="py-2 px-4 text-xs font-medium text-foreground">{i.descricao}</td>
                                  <td className="py-2 px-3 text-right text-[10px] font-mono text-muted-foreground/70">{i.data ? new Date(i.data).toLocaleDateString("pt-BR") : ""}</td>
                                  <td className="py-2 px-4 text-right text-xs font-mono font-bold text-muted-foreground">{formatCurrency(i.valor)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
