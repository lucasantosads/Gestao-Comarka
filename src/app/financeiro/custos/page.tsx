"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/currency-input";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { ResponsiveContainer, Bar, XAxis, YAxis, Tooltip, Legend, ComposedChart } from "recharts";
import { TrendingDown, TrendingUp, DollarSign, Plus, Trash2, X, ChevronDown, ChevronRight, Users, Building2, Wrench, BarChart3, MoreHorizontal, FileText, Download, Upload } from "lucide-react";

const CATEGORIAS = [
  "Aluguel", "Audiovisual", "Bonificações", "Comemoração", "Comissões", "Contador",
  "Cursos e Treinamentos", "Energia", "Equipamento", "Equipe Comercial", "Equipe Operacional",
  "Equipe de MKT", "Eventos/Viagens", "Ferramentas/Softwares", "Imposto", "Internet",
  "Investimentos", "Limpeza", "Manutenção", "Mentoria", "Mercado", "Obra", "Outros",
  "Prejuizo", "Prolabore", "Telefone",
];

const GRUPOS_CATEGORIAS = [
  {
    nome: "Pessoas",
    icon: Users,
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/10",
    categorias: ["Equipe Operacional", "Equipe Comercial", "Equipe de MKT", "Prolabore", "Comissões", "Bonificações"],
  },
  {
    nome: "Infraestrutura",
    icon: Building2,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    categorias: ["Aluguel", "Energia", "Internet", "Limpeza", "Telefone", "Manutenção"],
  },
  {
    nome: "Ferramentas & Serviços",
    icon: Wrench,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    categorias: ["Ferramentas/Softwares", "Mentoria", "Contador", "Cursos e Treinamentos"],
  },
  {
    nome: "Investimentos",
    icon: BarChart3,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    categorias: ["Equipamento", "Obra", "Investimentos", "Audiovisual"],
  },
  {
    nome: "Outros",
    icon: MoreHorizontal,
    color: "text-slate-400",
    bgColor: "bg-slate-500/10",
    categorias: ["Comemoração", "Eventos/Viagens", "Imposto", "Mercado", "Prejuizo", "Outros"],
  },
];

const CONTAS = ["Nu PJ", "BB", "Nu LU", "American", "Mercado Pago", "Outro"];

const MESES_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface Despesa {
  id: string; data_lancamento: string; descricao: string; conta: string;
  categoria: string; valor: number; tipo: string; parcela_atual: number | null;
  parcelas_total: number | null; mes_referencia: string;
}

interface Historico {
  meses: string[]; categorias: string[];
  matriz: Record<string, Record<string, number>>;
  medias: Record<string, number>;
  totais: Record<string, number>;
}

const ANOS_DISPONIVEIS = Array.from({ length: new Date().getFullYear() - 2025 + 1 }, (_, i) => 2025 + i);

export default function CustosPage() {
  const [ano, setAno] = useState(() => new Date().getFullYear());
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [dados, setDados] = useState<{
    total: number; folha_total: number; custos_fixos: number;
    parcelamentos_total: number; parcelamentos_ativos: number;
    lancamentos: Despesa[];
    por_categoria: Record<string, { total: number; items: Despesa[] }>;
  } | null>(null);
  const [prevTotal, setPrevTotal] = useState(0);
  const [receitaAno, setReceitaAno] = useState(0);
  const [historico, setHistorico] = useState<Historico | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [detailModal, setDetailModal] = useState<{ cat: string; mes: string; items: Despesa[] } | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [showReport, setShowReport] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [importText, setImportText] = useState("");
  const [batchSaving, setBatchSaving] = useState(false);
  const [limitLanc, setLimitLanc] = useState(20);
  const [editRow, setEditRow] = useState<string | null>(null);

  const CAT_COLOR: Record<string, string> = {
    "Aluguel": "bg-amber-500/20 text-amber-300 border-amber-500/30",
    "Audiovisual": "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30",
    "Bonificações": "bg-lime-500/20 text-lime-300 border-lime-500/30",
    "Comemoração": "bg-pink-500/20 text-pink-300 border-pink-500/30",
    "Comissões": "bg-green-500/20 text-green-300 border-green-500/30",
    "Contador": "bg-slate-500/20 text-slate-300 border-slate-500/30",
    "Cursos e Treinamentos": "bg-teal-500/20 text-teal-300 border-teal-500/30",
    "Energia": "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    "Equipamento": "bg-purple-500/20 text-purple-300 border-purple-500/30",
    "Equipe Comercial": "bg-blue-500/20 text-blue-300 border-blue-500/30",
    "Equipe Operacional": "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    "Equipe de MKT": "bg-rose-500/20 text-rose-300 border-rose-500/30",
    "Eventos/Viagens": "bg-orange-500/20 text-orange-300 border-orange-500/30",
    "Ferramentas/Softwares": "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    "Imposto": "bg-red-500/20 text-red-300 border-red-500/30",
    "Internet": "bg-sky-500/20 text-sky-300 border-sky-500/30",
    "Investimentos": "bg-violet-500/20 text-violet-300 border-violet-500/30",
    "Limpeza": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    "Mentoria": "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    "Mercado": "bg-green-600/20 text-green-300 border-green-600/30",
    "Obra": "bg-orange-600/20 text-orange-300 border-orange-600/30",
    "Outros": "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
    "Prejuizo": "bg-red-600/20 text-red-300 border-red-600/30",
    "Prolabore": "bg-purple-600/20 text-purple-300 border-purple-600/30",
    "Telefone": "bg-blue-600/20 text-blue-300 border-blue-600/30",
    "Ads": "bg-pink-600/20 text-pink-300 border-pink-600/30",
  };
  const catColor = (c: string) => CAT_COLOR[c] || "bg-zinc-500/20 text-zinc-200 border-zinc-500/30";

  const patchDespesa = async (id: string, fields: Record<string, unknown>) => {
    const res = await fetch(`/api/despesas/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (res.ok) { toast.success("Atualizado"); loadData(); }
    else toast.error("Erro ao atualizar");
  };

  // Form state
  const [form, setForm] = useState({
    data_lancamento: new Date().toISOString().split("T")[0],
    descricao: "", conta: "Nu PJ", categoria: "Outros", valor: 0,
    isParcelamento: false, parcela_atual: 1, parcelas_total: 1,
  });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [resAtual, resPrev, resHist, resEntradas] = await Promise.all([
      fetch(`/api/despesas?mes=${mes}`),
      fetch(`/api/despesas?mes=${(() => { const [y, m] = mes.split("-").map(Number); const d = new Date(y, m - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })()}`),
      fetch(`/api/despesas/historico?ano=${ano}`),
      fetch(`/api/financeiro/entradas?mes=tudo`),
    ]);
    const [atual, prev, hist, entradas] = await Promise.all([resAtual.json(), resPrev.json(), resHist.json(), resEntradas.json()]);
    setDados(atual);
    setPrevTotal(prev.total || 0);
    setHistorico(hist);
    setReceitaAno(Number(entradas?.resumo?.receita_total || 0));
    setLoading(false);
  }, [mes, ano]);

  useEffect(() => { loadData(); }, [loadData]);

  const lancar = async () => {
    if (!form.descricao || form.valor <= 0) { toast.error("Descrição e valor obrigatórios"); return; }
    setSaving(true);
    const res = await fetch("/api/despesas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data_lancamento: form.data_lancamento, descricao: form.descricao,
        conta: form.conta, categoria: form.categoria, valor: form.valor,
        tipo: form.isParcelamento ? "parcelamento" : "variavel",
        parcela_atual: form.isParcelamento ? form.parcela_atual : null,
        parcelas_total: form.isParcelamento ? form.parcelas_total : null,
      }),
    });
    if (res.ok) {
      toast.success("Despesa lançada");
      setForm({ ...form, descricao: "", valor: 0, isParcelamento: false, parcela_atual: 1, parcelas_total: 1 });
      loadData();
    } else toast.error("Erro ao lançar");
    setSaving(false);
  };

  const deletar = async (id: string) => {
    const res = await fetch(`/api/despesas/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Removido"); loadData(); }
  };

  const variacao = prevTotal > 0 ? ((dados?.total || 0) - prevTotal) / prevTotal * 100 : 0;

  const exportCSV = () => {
    if (!dados?.lancamentos.length) { toast.error("Sem lançamentos para exportar"); return; }
    const header = "data,descricao,categoria,conta,valor,tipo,parcela_atual,parcelas_total";
    const rows = dados.lancamentos.map((d) => [
      d.data_lancamento, `"${(d.descricao || "").replace(/"/g, '""')}"`,
      d.categoria, d.conta || "", d.valor, d.tipo || "",
      d.parcela_atual ?? "", d.parcelas_total ?? "",
    ].join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `despesas-${mes}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${dados.lancamentos.length} lançamentos exportados`);
  };

  const lancarLote = async () => {
    const linhas = batchText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!linhas.length) { toast.error("Cole pelo menos uma linha"); return; }
    setBatchSaving(true);
    let ok = 0, fail = 0;
    for (const l of linhas) {
      const parts = l.split("|").map((p) => p.trim());
      const [descricao, valorStr, categoria = "Outros", conta = "Nu PJ"] = parts;
      const valor = Number(valorStr.replace(/[^\d.,-]/g, "").replace(".", "").replace(",", "."));
      if (!descricao || isNaN(valor) || valor <= 0) { fail++; continue; }
      const res = await fetch("/api/despesas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data_lancamento: `${mes}-01`, descricao, categoria, conta, valor, tipo: "variavel",
        }),
      });
      if (res.ok) ok++; else fail++;
    }
    setBatchSaving(false);
    toast.success(`${ok} lançados${fail ? `, ${fail} falharam` : ""}`);
    setBatchText("");
    loadData();
  };

  const importarCSV = async () => {
    const linhas = importText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (linhas.length < 2) { toast.error("Cole um CSV com header + linhas"); return; }
    const header = linhas[0].toLowerCase().split(",").map((h) => h.trim());
    const idx = (k: string) => header.indexOf(k);
    const iData = idx("data"), iDesc = idx("descricao"), iCat = idx("categoria"),
      iConta = idx("conta"), iVal = idx("valor"), iTipo = idx("tipo");
    if (iDesc < 0 || iVal < 0) { toast.error("CSV precisa ter colunas: descricao, valor"); return; }
    setBatchSaving(true);
    let ok = 0, fail = 0;
    for (const l of linhas.slice(1)) {
      const cells = l.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map((c) => c.replace(/^"|"$/g, "").replace(/""/g, '"').trim()) || [];
      const descricao = cells[iDesc];
      const valor = Number(cells[iVal]);
      if (!descricao || isNaN(valor) || valor <= 0) { fail++; continue; }
      const res = await fetch("/api/despesas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data_lancamento: iData >= 0 && cells[iData] ? cells[iData] : `${mes}-01`,
          descricao, categoria: (iCat >= 0 && cells[iCat]) || "Outros",
          conta: (iConta >= 0 && cells[iConta]) || "Nu PJ",
          valor, tipo: (iTipo >= 0 && cells[iTipo]) || "variavel",
        }),
      });
      if (res.ok) ok++; else fail++;
    }
    setBatchSaving(false);
    toast.success(`${ok} importados${fail ? `, ${fail} falharam` : ""}`);
    setImportText("");
    loadData();
  };
  const despesasAno = historico ? Object.values(historico.totais).reduce((s, v) => s + Number(v || 0), 0) : 0;
  const lucroLiquido = receitaAno - despesasAno;

  // Dados do gráfico
  const chartData = historico ? historico.meses.map((m) => {
    const pessoasCats = ["Equipe Operacional", "Equipe Comercial", "Equipe de MKT", "Prolabore", "Comissões", "Bonificações"];
    const infraCats = ["Aluguel", "Energia", "Internet", "Limpeza"];
    const ferrCats = ["Ferramentas/Softwares", "Mentoria"];
    const investCats = ["Equipamento", "Obra", "Investimentos"];

    const sum = (cats: string[]) => cats.reduce((s, c) => s + (historico.matriz[c]?.[m] || 0), 0);
    const outros = (historico.totais[m] || 0) - sum(pessoasCats) - sum(infraCats) - sum(ferrCats) - sum(investCats);

    return {
      mes: MESES_LABELS[parseInt(m.slice(5)) - 1] || m,
      Pessoas: sum(pessoasCats),
      Infraestrutura: sum(infraCats),
      Ferramentas: sum(ferrCats),
      Investimentos: sum(investCats),
      Outros: Math.max(0, outros),
    };
  }) : [];

  // C1 — fallback do mês quando zerado
  const mesSemDados = !!dados && dados.total === 0;
  const ultimoMesComDados = (() => {
    if (!historico) return null;
    const comDados = historico.meses.filter((m) => (historico.totais[m] || 0) > 0);
    return comDados.length ? comDados[comDados.length - 1] : null;
  })();

  // C2 — Top 5 categorias + variação vs mês anterior
  type TopCat = { cat: string; valor: number; variacao: number; pctTotal: number };
  const top5: TopCat[] = (() => {
    if (!dados?.por_categoria) return [];
    const prevMes = (() => {
      const [y, m] = mes.split("-").map(Number);
      const d = new Date(y, m - 2, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();
    const total = dados.total || 1;
    const entries = Object.entries(dados.por_categoria).map(([cat, info]) => {
      const prev = historico?.matriz[cat]?.[prevMes] || 0;
      const variacao = prev > 0 ? ((info.total - prev) / prev) * 100 : 0;
      return { cat, valor: info.total, variacao, pctTotal: (info.total / total) * 100 };
    });
    return entries.sort((a, b) => b.valor - a.valor).slice(0, 5);
  })();

  // C4 — alertas de variação
  type Alerta = { cat: string; msg: string; severity: "red" | "orange" | "yellow" };
  const alertasVariacao: Alerta[] = (() => {
    const arr: Alerta[] = [];
    for (const t of top5) {
      if (t.variacao > 60) arr.push({ cat: t.cat, msg: `${t.cat} subiu +${t.variacao.toFixed(0)}% vs mês anterior`, severity: "red" });
      else if (t.variacao > 30) arr.push({ cat: t.cat, msg: `${t.cat} subiu +${t.variacao.toFixed(0)}% vs mês anterior`, severity: "orange" });
      if (t.pctTotal > 40) arr.push({ cat: t.cat, msg: `${t.cat} representa ${t.pctTotal.toFixed(0)}% do total do mês`, severity: "yellow" });
    }
    return arr;
  })();

  if (loading) return <div className="space-y-4"><div className="h-8 bg-muted animate-pulse rounded w-48" /><div className="grid grid-cols-4 gap-3">{[1,2,3,4].map((i) => <div key={i} className="h-20 bg-muted animate-pulse rounded" />)}</div></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Custos da Agencia</h1>
        <div className="flex items-center gap-2">
          {/* Seletor de ano */}
          <div className="flex bg-muted rounded-lg p-0.5">
            {ANOS_DISPONIVEIS.map((a) => (
              <button key={a} onClick={() => { setAno(a); setMes(`${a}-${mes.slice(5)}`); }}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${ano === a ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {a}
              </button>
            ))}
          </div>
          {/* Seletor de mês */}
          <div className="flex bg-muted rounded-lg p-0.5">
            {MESES_LABELS.map((label, i) => {
              const m = `${ano}-${String(i + 1).padStart(2, "0")}`;
              return (
                <button key={m} onClick={() => setMes(m)}
                  className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${mes === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {label}
                </button>
              );
            })}
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowReport(true)}>
            <FileText size={14} className="mr-1" />Relatório
          </Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus size={14} className="mr-1" />{showForm ? "Fechar" : "Lancar"}
          </Button>
          <Button size="sm" variant="outline" onClick={loadData}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
          </Button>
        </div>
      </div>

      {/* KPI Ano */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="border-green-500/20">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground mb-1">Receita do Ano</p>
            <p className="text-lg font-bold text-green-400">{formatCurrency(receitaAno)}</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/20">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground mb-1">Despesas do Ano</p>
            <p className="text-lg font-bold text-red-400">{formatCurrency(despesasAno)}</p>
          </CardContent>
        </Card>
        <Card className={lucroLiquido >= 0 ? "border-emerald-500/30" : "border-red-500/30"}>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground mb-1">Lucro Líquido (ano)</p>
            <p className={`text-lg font-bold ${lucroLiquido >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatCurrency(lucroLiquido)}</p>
            <p className="text-[10px] text-muted-foreground">{receitaAno > 0 ? ((lucroLiquido / receitaAno) * 100).toFixed(1) : "0"}% de margem</p>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards */}
      {dados && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Total Custos</p>
                  <p className="text-lg font-bold">{formatCurrency(dados.total)}</p>
                </div>
                <DollarSign size={16} className="text-muted-foreground" />
              </div>
              {Math.abs(variacao) > 0.5 && (
                <div className="flex items-center gap-1 mt-1">
                  {variacao > 0 ? <TrendingUp size={11} className="text-red-400" /> : <TrendingDown size={11} className="text-green-400" />}
                  <span className={`text-[10px] ${variacao > 0 ? "text-red-400" : "text-green-400"}`}>{variacao > 0 ? "+" : ""}{variacao.toFixed(1)}%</span>
                </div>
              )}
            </CardContent>
          </Card>
          {(() => {
            const comissoes = dados.por_categoria?.["Comissões"]?.total || 0;
            return (
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground mb-1">Comissões</p>
                  <p className="text-lg font-bold">{formatCurrency(comissoes)}</p>
                  <p className="text-[10px] text-muted-foreground">{dados.total > 0 ? ((comissoes / dados.total) * 100).toFixed(0) : 0}% do total</p>
                </CardContent>
              </Card>
            );
          })()}
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground mb-1">Custos Fixos</p>
              <p className="text-lg font-bold">{formatCurrency(dados.custos_fixos)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground mb-1">Parcelamentos</p>
              <p className="text-lg font-bold">{formatCurrency(dados.parcelamentos_total)}</p>
              <p className="text-[10px] text-muted-foreground">{dados.parcelamentos_ativos} ativos</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* C1 — Fallback quando mês zerado */}
      {mesSemDados && ultimoMesComDados && (
        <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-xs flex items-center justify-between">
          <span className="text-blue-400">Nenhum lançamento em {MESES_LABELS[parseInt(mes.slice(5)) - 1]}. Exibindo referência do último mês com dados: <strong>{MESES_LABELS[parseInt(ultimoMesComDados.slice(5)) - 1]}/{ultimoMesComDados.slice(0, 4)}</strong> — {formatCurrency(historico?.totais[ultimoMesComDados] || 0)}</span>
          <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setMes(ultimoMesComDados)}>Ir para {MESES_LABELS[parseInt(ultimoMesComDados.slice(5)) - 1]}</Button>
        </div>
      )}

      {/* C4 — Alertas de variação */}
      {alertasVariacao.length > 0 && (
        <div className="space-y-1">
          {alertasVariacao.map((a, i) => {
            const cls = a.severity === "red" ? "bg-red-500/5 border-red-500/20 text-red-400"
              : a.severity === "orange" ? "bg-orange-500/5 border-orange-500/20 text-orange-400"
              : "bg-yellow-500/5 border-yellow-500/20 text-yellow-400";
            return <div key={i} className={`p-2 rounded border text-xs flex items-center gap-2 ${cls}`}>
              <TrendingUp size={12} /> {a.msg}
            </div>;
          })}
        </div>
      )}

      {/* C2 — Top 5 maiores gastos */}
      {top5.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Top 5 Maiores Gastos</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {top5.map((t, i) => (
                <div key={t.cat} className="p-3 border rounded-lg">
                  <p className="text-[9px] text-muted-foreground uppercase">#{i + 1}</p>
                  <p className="text-xs font-medium truncate" title={t.cat}>{t.cat}</p>
                  <p className="text-sm font-bold font-mono mt-1">{formatCurrency(t.valor)}</p>
                  <div className="flex items-center justify-between mt-1 text-[10px]">
                    <span className="text-muted-foreground">{t.pctTotal.toFixed(0)}%</span>
                    {Math.abs(t.variacao) > 0.5 && (
                      <Badge className={`text-[8px] ${t.variacao > 30 ? "bg-red-500/15 text-red-400" : t.variacao > 0 ? "bg-orange-500/15 text-orange-400" : "bg-green-500/15 text-green-400"}`}>
                        {t.variacao > 0 ? "+" : ""}{t.variacao.toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formulário de lançamento */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Lancar Despesa</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1"><Label className="text-xs">Data</Label><Input type="date" value={form.data_lancamento} onChange={(e) => setForm({ ...form, data_lancamento: e.target.value })} /></div>
              <div className="col-span-2 space-y-1"><Label className="text-xs">Descricao</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Notebook 4/12" /></div>
              <div className="space-y-1"><Label className="text-xs">Valor</Label><CurrencyInput value={form.valor} onChange={(v) => setForm({ ...form, valor: v })} /></div>
              <div className="space-y-1"><Label className="text-xs">Conta</Label>
                <select value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} className="w-full text-sm bg-transparent border rounded-lg px-3 py-2">
                  {CONTAS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Categoria</Label>
                <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="w-full text-sm bg-transparent border rounded-lg px-3 py-2">
                  {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Parcelamento?</Label>
                <div className="flex items-center gap-2 pt-1">
                  <input type="checkbox" checked={form.isParcelamento} onChange={(e) => setForm({ ...form, isParcelamento: e.target.checked })} />
                  {form.isParcelamento && (
                    <span className="flex gap-1 text-xs">
                      <Input type="number" min={1} className="w-12 h-7 text-xs" value={form.parcela_atual} onChange={(e) => setForm({ ...form, parcela_atual: Number(e.target.value) })} />
                      /
                      <Input type="number" min={1} className="w-12 h-7 text-xs" value={form.parcelas_total} onChange={(e) => setForm({ ...form, parcelas_total: Number(e.target.value) })} />
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-end">
                <Button onClick={lancar} disabled={saving} className="w-full">{saving ? "Lancando..." : "Lancar"}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela Custos por Categoria (agrupada) */}
      {historico && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Custos por Categoria</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 min-w-[160px]">Categoria</th>
                    {historico.meses.map((m) => (
                      <th key={m} className="text-right py-2 px-2 min-w-[80px]">{MESES_LABELS[parseInt(m.slice(5)) - 1]}</th>
                    ))}
                    <th className="text-right py-2 px-2 min-w-[80px] text-muted-foreground">Media</th>
                  </tr>
                </thead>
                <tbody>
                  {GRUPOS_CATEGORIAS.map((grupo) => {
                    const catsComDados = grupo.categorias.filter((cat) =>
                      historico.categorias.includes(cat)
                    );
                    if (catsComDados.length === 0) return null;

                    const isCollapsed = collapsedGroups[grupo.nome] ?? false;
                    const Icon = grupo.icon;

                    const subtotalPorMes = (m: string) =>
                      catsComDados.reduce((s, cat) => s + (historico.matriz[cat]?.[m] || 0), 0);
                    const mediaGrupo = catsComDados.reduce((s, cat) => s + (historico.medias[cat] || 0), 0);

                    return (
                      <React.Fragment key={grupo.nome}>
                        {/* Linha do grupo (subtotal) */}
                        <tr
                          className={`${grupo.bgColor} cursor-pointer select-none`}
                          onClick={() => setCollapsedGroups((prev) => ({ ...prev, [grupo.nome]: !isCollapsed }))}
                        >
                          <td className="py-2 px-2 font-semibold">
                            <div className="flex items-center gap-1.5">
                              {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                              <Icon size={12} className={grupo.color} />
                              <span>{grupo.nome}</span>
                              <span className="text-[9px] text-muted-foreground font-normal ml-1">({catsComDados.length})</span>
                            </div>
                          </td>
                          {historico.meses.map((m) => {
                            const val = subtotalPorMes(m);
                            return (
                              <td key={m} className={`text-right py-2 px-2 font-mono font-semibold ${grupo.color}`}>
                                {val > 0 ? formatCurrency(val) : "—"}
                              </td>
                            );
                          })}
                          <td className={`text-right py-2 px-2 font-mono font-semibold text-muted-foreground`}>
                            {mediaGrupo > 0 ? formatCurrency(mediaGrupo) : "—"}
                          </td>
                        </tr>

                        {/* Linhas individuais (colapsáveis) */}
                        {!isCollapsed && catsComDados.map((cat) => (
                          <tr key={cat} className="border-b border-muted/30 hover:bg-muted/20">
                            <td className="py-1.5 px-2 pl-8 text-muted-foreground">{cat}</td>
                            {historico.meses.map((m) => {
                              const val = historico.matriz[cat]?.[m] || 0;
                              const media = historico.medias[cat] || 0;
                              const isHigh = val > media * 1.3 && val > 0;
                              const isLow = val < media * 0.7 && val > 0 && media > 0;
                              return (
                                <td key={m} className={`text-right py-1.5 px-2 font-mono cursor-pointer hover:underline ${isHigh ? "text-red-400 bg-red-500/5" : isLow ? "text-green-400 bg-green-500/5" : ""}`}
                                  onClick={() => {
                                    const items = dados?.lancamentos.filter((d) => d.categoria === cat && d.mes_referencia === m) || [];
                                    if (items.length > 0) setDetailModal({ cat, mes: m, items });
                                  }}>
                                  {val > 0 ? formatCurrency(val) : "—"}
                                </td>
                              );
                            })}
                            <td className="text-right py-1.5 px-2 font-mono text-muted-foreground">
                              {historico.medias[cat] > 0 ? formatCurrency(historico.medias[cat]) : "—"}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}

                  {/* Total geral */}
                  <tr className="bg-muted/30 font-bold border-t-2">
                    <td className="py-2.5 px-2">Total Geral</td>
                    {historico.meses.map((m) => (
                      <td key={m} className="text-right py-2.5 px-2 font-mono">{formatCurrency(historico.totais[m] || 0)}</td>
                    ))}
                    <td className="text-right py-2.5 px-2 font-mono text-muted-foreground">
                      {formatCurrency(Object.values(historico.totais).reduce((s, v) => s + v, 0) / Math.max(1, Object.values(historico.totais).filter((v) => v > 0).length))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráfico de Evolução */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Evolução de Custos</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData}>
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Pessoas" stackId="a" fill="#6366f1" />
                <Bar dataKey="Infraestrutura" stackId="a" fill="#f59e0b" />
                <Bar dataKey="Ferramentas" stackId="a" fill="#06b6d4" />
                <Bar dataKey="Investimentos" stackId="a" fill="#8b5cf6" />
                <Bar dataKey="Outros" stackId="a" fill="#64748b" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Últimos lançamentos */}
      {dados && dados.lancamentos.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Lançamentos do Mês ({dados.lancamentos.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Data</th>
                    <th className="text-left py-2 px-2">Descricao</th>
                    <th className="text-left py-2 px-2">Categoria</th>
                    <th className="text-left py-2 px-2">Conta</th>
                    <th className="text-right py-2 px-2">Valor</th>
                    <th className="py-2 px-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {dados.lancamentos.slice(0, limitLanc).map((d) => {
                    const isEdit = editRow === d.id;
                    return (
                      <tr key={d.id} className="border-b hover:bg-muted/20">
                        <td className="py-1.5 px-2 font-mono">
                          {isEdit ? (
                            <Input type="date" defaultValue={d.data_lancamento} className="h-7 text-xs"
                              onBlur={(e) => e.target.value !== d.data_lancamento && patchDespesa(d.id, { data_lancamento: e.target.value })} />
                          ) : new Date(d.data_lancamento).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="py-1.5 px-2">
                          {isEdit ? (
                            <Input defaultValue={d.descricao} className="h-7 text-xs"
                              onBlur={(e) => e.target.value !== d.descricao && patchDespesa(d.id, { descricao: e.target.value })} />
                          ) : (
                            <span className="truncate max-w-[240px] inline-block" title={d.descricao}>
                              {d.descricao}
                              {d.tipo === "parcelamento" && <Badge className="ml-1 text-[8px] bg-purple-500/15 text-purple-400">{d.parcela_atual}/{d.parcelas_total}</Badge>}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2">
                          {isEdit ? (
                            <select defaultValue={d.categoria} className="text-xs bg-transparent border rounded px-2 py-1"
                              onChange={(e) => patchDespesa(d.id, { categoria: e.target.value })}>
                              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          ) : (
                            <Badge className={`text-[9px] border ${catColor(d.categoria)}`}>{d.categoria}</Badge>
                          )}
                        </td>
                        <td className="py-1.5 px-2">
                          {isEdit ? (
                            <select defaultValue={d.conta || ""} className="text-xs bg-transparent border rounded px-2 py-1"
                              onChange={(e) => patchDespesa(d.id, { conta: e.target.value })}>
                              {CONTAS.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          ) : <span className="text-muted-foreground">{d.conta || "—"}</span>}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono">
                          {isEdit ? (
                            <Input type="number" step="0.01" defaultValue={d.valor} className="h-7 text-xs text-right w-24"
                              onBlur={(e) => Number(e.target.value) !== Number(d.valor) && patchDespesa(d.id, { valor: Number(e.target.value) })} />
                          ) : formatCurrency(Number(d.valor))}
                        </td>
                        <td className="py-1.5 px-2">
                          <div className="flex gap-1">
                            <button onClick={() => setEditRow(isEdit ? null : d.id)} className="text-muted-foreground hover:text-foreground" title={isEdit ? "Fechar" : "Editar"}>
                              {isEdit ? <X size={12} /> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>}
                            </button>
                            <button onClick={() => deletar(d.id)} className="text-muted-foreground hover:text-red-400"><Trash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {limitLanc < dados.lancamentos.length && (
              <div className="flex justify-center mt-3">
                <Button size="sm" variant="outline" onClick={() => setLimitLanc(limitLanc + 20)}>
                  Carregar mais ({dados.lancamentos.length - limitLanc} restantes)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Drawer Relatório */}
      {showReport && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setShowReport(false)}>
          <div className="bg-card border-l h-full w-full max-w-2xl overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-card border-b p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Relatório — {MESES_LABELS[parseInt(mes.slice(5)) - 1]}/{mes.slice(0, 4)}</h2>
              <button onClick={() => setShowReport(false)}><X size={18} className="text-muted-foreground hover:text-foreground" /></button>
            </div>
            <div className="p-4 space-y-5">
              {/* Resumo */}
              {dados && (
                <div>
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Resumo do mês</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-3 border rounded-lg"><p className="text-muted-foreground">Total Custos</p><p className="text-base font-bold">{formatCurrency(dados.total)}</p></div>
                    <div className="p-3 border rounded-lg"><p className="text-muted-foreground">vs mês anterior</p><p className={`text-base font-bold ${variacao > 0 ? "text-red-400" : "text-green-400"}`}>{variacao > 0 ? "+" : ""}{variacao.toFixed(1)}%</p></div>
                    <div className="p-3 border rounded-lg"><p className="text-muted-foreground">Folha</p><p className="text-base font-bold">{formatCurrency(dados.folha_total)}</p></div>
                    <div className="p-3 border rounded-lg"><p className="text-muted-foreground">Fixos</p><p className="text-base font-bold">{formatCurrency(dados.custos_fixos)}</p></div>
                    <div className="p-3 border rounded-lg"><p className="text-muted-foreground">Parcelamentos</p><p className="text-base font-bold">{formatCurrency(dados.parcelamentos_total)}</p></div>
                    <div className="p-3 border rounded-lg"><p className="text-muted-foreground">Lançamentos</p><p className="text-base font-bold">{dados.lancamentos.length}</p></div>
                  </div>
                </div>
              )}

              {/* Export / Import CSV */}
              <div>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">CSV</h3>
                <div className="flex gap-2 mb-2">
                  <Button size="sm" variant="outline" onClick={exportCSV}><Download size={12} className="mr-1" />Exportar mês</Button>
                </div>
                <Label className="text-xs">Importar CSV (header: data,descricao,categoria,conta,valor,tipo)</Label>
                <textarea value={importText} onChange={(e) => setImportText(e.target.value)}
                  placeholder="data,descricao,categoria,conta,valor,tipo&#10;2026-04-01,Energia,Energia,Nu PJ,450.00,variavel"
                  className="w-full h-24 text-xs font-mono bg-transparent border rounded-lg p-2 mt-1" />
                <Button size="sm" className="mt-2" onClick={importarCSV} disabled={batchSaving}>
                  <Upload size={12} className="mr-1" />{batchSaving ? "Importando..." : "Importar"}
                </Button>
              </div>

              {/* Lançamento em lote */}
              <div>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Lançamento em lote</h3>
                <Label className="text-xs">Formato por linha: <code>descrição | valor | categoria | conta</code></Label>
                <textarea value={batchText} onChange={(e) => setBatchText(e.target.value)}
                  placeholder="Energia abril | 450,00 | Energia | Nu PJ&#10;Internet abril | 199,90 | Internet | Nu PJ"
                  className="w-full h-32 text-xs font-mono bg-transparent border rounded-lg p-2 mt-1" />
                <Button size="sm" className="mt-2" onClick={lancarLote} disabled={batchSaving}>
                  {batchSaving ? "Lançando..." : "Lançar em lote"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalhes */}
      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDetailModal(null)}>
          <div className="bg-card border rounded-xl shadow-2xl p-6 w-full max-w-lg space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{detailModal.cat} — {MESES_LABELS[parseInt(detailModal.mes.slice(5)) - 1]}</h3>
              <button onClick={() => setDetailModal(null)}><X size={16} className="text-muted-foreground" /></button>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {detailModal.items.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-2 border rounded text-xs">
                  <div>
                    <span className="font-medium">{d.descricao}</span>
                    <span className="text-muted-foreground ml-2">{new Date(d.data_lancamento).toLocaleDateString("pt-BR")}</span>
                  </div>
                  <span className="font-mono">{formatCurrency(Number(d.valor))}</span>
                </div>
              ))}
            </div>
            <p className="text-xs font-bold text-right">Total: {formatCurrency(detailModal.items.reduce((s, d) => s + Number(d.valor), 0))}</p>
          </div>
        </div>
      )}
    </div>
  );
}
