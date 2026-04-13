"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { Search, ArrowUpDown, ChevronDown, ChevronRight, Check, Edit2, FileText, UserMinus, X } from "lucide-react";
import { MarcarPagoModal } from "./MarcarPagoModal";
import { EditarClienteModal } from "./EditarClienteModal";
import { EntradasTimeline } from "./EntradasTimeline";

interface ClienteRow {
  id: string; nome: string; plataforma: string; valor_mensal: number;
  closer: string; tipo_contrato: string; dia_pagamento: number | null;
  status: string; status_financeiro?: string; obs: string | null;
  ltv_meses?: number | null; categoria?: string;
  valor_integral?: number; forma_pagamento?: string; parcelas_integral?: number;
  fidelidade_meses?: number | null; fidelidade_inicio?: string | null; fidelidade_fim?: string | null;
  mes_fechamento?: string | null;
  pagamento_mes: { status: string | null; valor_pago: number | null; dia_pagamento: number | null; justificativa?: string | null; mes_pagamento?: string | null };
  pagamentos_todos?: { mes: string; status: string; valor_pago: number | null; dia_pagamento: number | null }[];
}

type PagFilter = "todos" | "pago" | "pendente" | "atrasado";

const platLabel = (p: string) => {
  const s = p.trim().toUpperCase();
  if (s === "GADS") return "GOOGLE";
  if (s.includes("/") || s.includes("_")) return "META+GOOGLE";
  return s || "META";
};
const platColor = (p: string) => {
  const s = p.trim().toUpperCase();
  if (s.includes("GOOGLE") && s.includes("META")) return "bg-purple-500/15 text-purple-400";
  if (s.includes("GADS") && s.includes("META")) return "bg-purple-500/15 text-purple-400";
  if (s.includes("GOOGLE") || s.includes("GADS")) return "bg-emerald-500/15 text-emerald-400";
  return "bg-blue-500/15 text-blue-400"; // Default META
};
const CONTRATO_COLORS: Record<string, string> = { mensal: "bg-muted text-muted-foreground", "1M": "bg-muted text-muted-foreground", "3M": "bg-blue-500/15 text-blue-400", "6M": "bg-purple-500/15 text-purple-400", "12M": "bg-yellow-500/15 text-yellow-400" };

const SF_LABELS: Record<string, { label: string; color: string }> = {
  ativo: { label: "Ativo", color: "bg-green-500/15 text-green-400" },
  pausado: { label: "Pausado", color: "bg-yellow-500/15 text-yellow-400" },
  pagou_integral: { label: "Pagou Integral", color: "bg-blue-500/15 text-blue-400" },
  parceria: { label: "Parceria", color: "bg-purple-500/15 text-purple-400" },
  churned: { label: "Inativo", color: "bg-red-500/15 text-red-400" },
};
// Churned só via pipeline de churn — não aparece no dropdown de Entradas
const SF_OPTIONS = ["ativo", "pausado", "pagou_integral", "parceria"];

function ClienteTable({ clientes, mesReferencia, onRefresh, title, defaultSort }: {
  clientes: ClienteRow[]; mesReferencia: string; onRefresh: () => void; title?: string; defaultSort?: string;
}) {
  const [busca, setBusca] = useState("");
  const [pagFilter, setPagFilter] = useState<PagFilter>("todos");
  const [closerFilter, setCloserFilter] = useState("todos");
  const [sortCol, setSortCol] = useState(defaultSort || "dia_pagamento");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pagoModal, setPagoModal] = useState<ClienteRow | null>(null);
  const [pagoModalMes, setPagoModalMes] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<ClienteRow | null>(null);
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null);
  const [churnModal, setChurnModal] = useState<ClienteRow | null>(null);
  const [churnMotivo, setChurnMotivo] = useState("Falta de resultados");
  const [churnObs, setChurnObs] = useState("");
  const [churnSaving, setChurnSaving] = useState(false);


  const MOTIVOS_CHURN = ["Falta de resultados", "Financeiro da empresa", "Não precisa mais do serviço", "Problema de atendimento", "Concorrente", "Desistência da empresa", "Problemas pessoais", "Outro"];

  const executarChurn = async () => {
    if (!churnModal) return;
    setChurnSaving(true);
    const res = await fetch("/api/financeiro/churnar-cliente", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cliente_receita_id: churnModal.id, motivo: churnMotivo, observacao: churnObs }),
    });
    const data = await res.json();
    if (data.error) toast.error(data.error);
    else { toast.success(`${churnModal.nome} registrado como churn`); onRefresh(); }
    setChurnModal(null);
    setChurnMotivo("Falta de resultados");
    setChurnObs("");
    setChurnSaving(false);
  };

  let filtered = clientes;
  if (pagFilter !== "todos") filtered = filtered.filter((c) => {
    const ps = c.pagamento_mes.status;
    if (pagFilter === "pago") return ps === "pago";
    if (pagFilter === "pendente") return ps === "pendente" || ps === null;
    if (pagFilter === "atrasado") return ps === "atrasado";
    return true;
  });
  if (closerFilter !== "todos") filtered = filtered.filter((c) => c.closer === closerFilter);
  if (busca) { const q = busca.toLowerCase(); filtered = filtered.filter((c) => c.nome.toLowerCase().includes(q)); }

  filtered = [...filtered].sort((a, b) => {
    let va: string | number = ""; let vb: string | number = "";
    if (sortCol === "nome") { va = a.nome; vb = b.nome; }
    else if (sortCol === "valor_mensal") { va = a.valor_mensal; vb = b.valor_mensal; }
    else if (sortCol === "closer") { va = a.closer; vb = b.closer; }
    else if (sortCol === "dia_pagamento") { va = a.dia_pagamento || 99; vb = b.dia_pagamento || 99; }
    else if (sortCol === "ltv_meses") { va = a.ltv_meses || 0; vb = b.ltv_meses || 0; }
    else if (sortCol === "status") { va = a.pagamento_mes.status || "z"; vb = b.pagamento_mes.status || "z"; }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const toggleSort = (col: string) => { if (sortCol === col) setSortDir(sortDir === "asc" ? "desc" : "asc"); else { setSortCol(col); setSortDir("asc"); } };
  const closers = Array.from(new Set(clientes.map((c) => c.closer).filter((c) => c && c !== "-"))).sort();
  const totalValor = filtered.reduce((s, c) => s + c.valor_mensal, 0);
  const totalPago = filtered.reduce((s, c) => s + Number(c.pagamento_mes.valor_pago || 0), 0);

  const mudarStatus = async (c: ClienteRow, novoStatus: string) => {
    const res = await fetch(`/api/financeiro/entradas/cliente/${c.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novoStatus === "churned" ? "churned" : "ativo", status_financeiro: novoStatus }),
    });
    if (res.ok) { toast.success(`${c.nome} → ${SF_LABELS[novoStatus]?.label}`); onRefresh(); }
    else toast.error("Erro ao alterar status");
    setStatusDropdown(null);
  };

  const rowBg = (c: ClienteRow) => {
    if (c.pagamento_mes.status === "pago") return "bg-green-500/[0.03]";
    if (c.pagamento_mes.status === "atrasado") return "bg-red-500/[0.03]";
    return "";
  };

  const diasAtraso = (c: ClienteRow) => {
    if (c.pagamento_mes.status !== "atrasado" || !c.dia_pagamento) return 0;
    const [ano, mesNum] = mesReferencia.split("-").map(Number);
    const vencimento = new Date(ano, mesNum - 1, c.dia_pagamento);
    const hoje = new Date();
    const diff = Math.ceil((hoje.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  return (
    <div className="space-y-3">
      {title && <p className="text-sm font-medium">{title} ({clientes.length})</p>}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex bg-muted rounded-lg p-0.5">
          {(["todos", "pago", "pendente", "atrasado"] as PagFilter[]).map((s) => (
            <button key={s} onClick={() => setPagFilter(s)}
              className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${pagFilter === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
              {s === "todos" ? "Todos" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        {closers.length > 1 && (
          <select value={closerFilter} onChange={(e) => setCloserFilter(e.target.value)} className="text-xs bg-transparent border rounded-lg px-3 py-1.5">
            <option value="todos">Todos Closers</option>
            {closers.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <div className="relative flex-1 min-w-[150px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..."
            className="w-full pl-7 pr-3 py-1.5 text-xs bg-transparent border rounded-lg" />
        </div>
      </div>

      {/* Tabela */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b">
              <th className="w-6 px-2 py-2" />
              {[
                { key: "nome", label: "Cliente", w: "min-w-[180px]" },
                { key: "plataforma", label: "Plat.", w: "min-w-[60px]" },
                { key: "valor_mensal", label: "Valor", w: "min-w-[80px]" },
                { key: "tipo_contrato", label: "Contrato", w: "min-w-[70px]" },
                { key: "dia_pagamento", label: "Vence", w: "min-w-[50px]" },
                { key: "status_financeiro", label: "Status", w: "min-w-[80px]" },
                { key: "status", label: "Pgto", w: "min-w-[80px]" },
                { key: "dia_pago", label: "Pago em", w: "min-w-[55px]" },
                { key: "ltv_meses", label: "LTV", w: "min-w-[45px]" },
              ].map((col) => (
                <th key={col.key} onClick={() => toggleSort(col.key)}
                  className={`${col.w} px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap`}>
                  <span className="flex items-center gap-1">{col.label}{sortCol === col.key && <ArrowUpDown size={9} />}</span>
                </th>
              ))}
              <th className="min-w-[80px] px-2 py-2 text-[10px] font-medium uppercase text-muted-foreground">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={11} className="py-12 text-center">
                <FileText size={28} className="mx-auto mb-2 text-muted-foreground opacity-30" />
                <p className="text-sm text-muted-foreground">Nenhum cliente encontrado</p>
              </td></tr>
            )}
            {filtered.map((c) => {
              const isExp = expandedId === c.id;
              const sf = c.status_financeiro || (c.status === "churned" ? "churned" : "ativo");
              const sfInfo = SF_LABELS[sf] || SF_LABELS.ativo;
              return (
                <>
                  <tr key={c.id} className={`border-b hover:bg-muted/20 transition-colors ${rowBg(c)}`}>
                    <td className="px-2 py-2">
                      <button onClick={() => setExpandedId(isExp ? null : c.id)} className="text-muted-foreground hover:text-foreground">
                        {isExp ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </button>
                    </td>
                    <td className="px-2 py-2 font-medium truncate max-w-[180px]" title={c.nome}>{c.nome}</td>
                    <td className="px-2 py-2"><Badge className={`text-[8px] ${platColor(c.plataforma)}`}>{platLabel(c.plataforma)}</Badge></td>
                    <td className="px-2 py-2 font-mono text-xs">{formatCurrency(c.valor_mensal)}</td>
                    <td className="px-2 py-2"><Badge className={`text-[8px] ${CONTRATO_COLORS[c.tipo_contrato] || "bg-muted"}`}>{c.tipo_contrato}</Badge></td>
                    <td className="px-2 py-2 text-xs text-center">{c.dia_pagamento || "—"}</td>
                    {/* Status financeiro — clicável */}
                    <td className="px-2 py-2 relative">
                      <button onClick={(e) => { e.stopPropagation(); setStatusDropdown(statusDropdown === c.id ? null : c.id); }}
                        className="cursor-pointer">
                        <Badge className={`text-[8px] ${sfInfo.color}`}>{sfInfo.label}</Badge>
                      </button>
                      {statusDropdown === c.id && (
                        <div className="absolute top-full left-0 z-50 mt-1 bg-card border rounded-lg p-1 min-w-[140px] shadow-lg">
                          {SF_OPTIONS.map((opt) => {
                            const info = SF_LABELS[opt];
                            return (
                              <button key={opt} onClick={() => mudarStatus(c, opt)}
                                className={`w-full text-left px-3 py-1.5 rounded text-xs hover:bg-muted transition-colors flex items-center gap-2 ${sf === opt ? "font-medium" : ""}`}>
                                <span className={`w-2 h-2 rounded-full ${info.color.split(" ")[0]}`} />
                                {info.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    {/* Pagamento do mês */}
                    <td className="px-2 py-2">
                      {c.pagamento_mes.status === "pago" && (
                        <button onClick={() => setPagoModal(c)} title="Clique para editar valor">
                          <Badge className="text-[9px] bg-green-500/15 text-green-400 cursor-pointer hover:bg-green-500/25 transition-colors">
                            <Check size={10} className="mr-0.5" />{formatCurrency(Number(c.pagamento_mes.valor_pago))}
                          </Badge>
                        </button>
                      )}
                      {c.pagamento_mes.status === "perdoado" && (
                        <button onClick={() => setPagoModal(c)} title="Clique para editar">
                          <Badge className="text-[9px] bg-purple-500/15 text-purple-400 cursor-pointer hover:bg-purple-500/25 transition-colors" title={c.pagamento_mes.justificativa || undefined}>
                            Perdoado{c.pagamento_mes.justificativa ? " *" : ""}
                          </Badge>
                        </button>
                      )}
                      {c.pagamento_mes.status === "parceria" && <Badge className="text-[9px] bg-purple-500/15 text-purple-400">Parceria</Badge>}
                      {c.pagamento_mes.status === "pendente" && <Badge className="text-[9px] bg-yellow-500/15 text-yellow-400">Aguardando</Badge>}
                      {c.pagamento_mes.status === "atrasado" && <Badge className="text-[9px] bg-red-500/15 text-red-400 animate-pulse">{diasAtraso(c)}d atraso</Badge>}
                      {!c.pagamento_mes.status && <Badge className="text-[9px] bg-muted text-muted-foreground">—</Badge>}
                    </td>
                    {/* Dia que pagou */}
                    <td className="px-2 py-2 text-xs text-center">
                      {(c.pagamento_mes.status === "pago" || c.pagamento_mes.status === "perdoado") && c.pagamento_mes.dia_pagamento
                        ? (() => {
                            const mesPag = c.pagamento_mes.mes_pagamento;
                            const mesRef = mesReferencia.slice(0, 7);
                            const mesLabel = mesPag && mesPag !== mesRef
                              ? `${c.pagamento_mes.dia_pagamento}/${mesPag.slice(5, 7)}`
                              : `dia ${c.pagamento_mes.dia_pagamento}`;
                            return <span className={`font-mono ${c.pagamento_mes.status === "pago" ? "text-green-400" : "text-purple-400"}`}>{mesLabel}</span>;
                          })()
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    {/* LTV */}
                    <td className="px-2 py-2 text-xs text-center">
                      {c.ltv_meses ? <span className="font-mono text-muted-foreground">{c.ltv_meses}m</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-1">
                        {(c.pagamento_mes.status !== "pago") && sf === "ativo" && (
                          <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] text-green-400" onClick={() => setPagoModal(c)}>
                            <Check size={10} />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={() => setEditModal(c)}>
                          <Edit2 size={10} />
                        </Button>
                        {sf === "ativo" && (
                          <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] text-red-400" onClick={() => setChurnModal(c)}>
                            <UserMinus size={10} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExp && (
                    <tr key={`${c.id}-tl`}>
                      <td colSpan={11} className="px-8 py-3 bg-muted/10 border-b">
                        {/* Info do cliente */}
                        <div className="flex flex-wrap gap-4 text-xs mb-3">
                          <span>Closer: <strong>{c.closer !== "-" ? c.closer : "—"}</strong></span>
                          {c.fidelidade_meses ? (
                            <>
                              <span>Fidelidade: <strong>{c.fidelidade_meses} meses</strong></span>
                              {c.fidelidade_inicio && <span>Inicio: <strong>{new Date(c.fidelidade_inicio).toLocaleDateString("pt-BR")}</strong></span>}
                              {c.fidelidade_fim && (() => {
                                const fim = new Date(c.fidelidade_fim);
                                const hoje = new Date();
                                const diasRestantes = Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                                const venceu = diasRestantes <= 0;
                                const proximo = diasRestantes > 0 && diasRestantes <= 30;
                                return (
                                  <>
                                    <span>Fim: <strong className={venceu ? "text-red-400" : proximo ? "text-yellow-400" : ""}>{fim.toLocaleDateString("pt-BR")}</strong></span>
                                    {venceu && <span className="text-red-400 font-medium bg-red-500/10 px-2 py-0.5 rounded">Fidelidade vencida — renovar</span>}
                                    {proximo && <span className="text-yellow-400 font-medium bg-yellow-500/10 px-2 py-0.5 rounded">Vence em {diasRestantes} dias</span>}
                                  </>
                                );
                              })()}
                            </>
                          ) : <span className="text-muted-foreground">Sem fidelidade</span>}
                          {c.obs && <span className="text-muted-foreground">Obs: {c.obs}</span>}
                        </div>
                        {sf === "pagou_integral" && (() => {
                          const mrrCalc = c.valor_integral && c.parcelas_integral ? c.valor_integral / c.parcelas_integral : c.valor_mensal;
                          return (
                            <div className="flex flex-wrap gap-4 text-xs mb-3 p-2 bg-blue-500/5 rounded-lg border border-blue-500/10">
                              <span className="text-blue-400 font-medium">Pagamento Integral</span>
                              {c.valor_integral ? <span>Total: <strong className="text-blue-400">{formatCurrency(c.valor_integral)}</strong></span> : <span className="text-yellow-400">Valor nao informado</span>}
                              {c.forma_pagamento && <span>Forma: <strong>{c.forma_pagamento}</strong></span>}
                              {c.parcelas_integral ? <span>Parcelas: <strong>{c.parcelas_integral}x</strong></span> : null}
                              <span>MRR equiv.: <strong>{formatCurrency(mrrCalc)}</strong></span>
                            </div>
                          );
                        })()}
                        {c.pagamento_mes.status === "perdoado" && c.pagamento_mes.justificativa && (
                          <div className="flex gap-2 text-xs mb-3 p-2 bg-purple-500/5 rounded-lg border border-purple-500/10">
                            <span className="text-purple-400 font-medium">Justificativa:</span>
                            <span>{c.pagamento_mes.justificativa}</span>
                          </div>
                        )}
                        {/* Pagamentos mês a mês (modo Tudo) */}
                        {c.pagamentos_todos && c.pagamentos_todos.length > 0 ? (
                          <div className="space-y-1 mb-3">
                            <p className="text-[10px] text-muted-foreground font-medium mb-1">Pagamentos por mes</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {["01","02","03","04","05","06","07","08","09","10","11","12"].map((m) => {
                                const mesLabel = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][parseInt(m)-1];
                                const pag = c.pagamentos_todos?.find((p) => p.mes.slice(5,7) === m);
                                if (!pag && !c.mes_fechamento) return null;
                                const mesRef = `2026-${m}-01`;
                                if (c.mes_fechamento && c.mes_fechamento > mesRef) return null;
                                return (
                                  <div key={m} className={`flex items-center justify-between p-1.5 rounded border text-[11px] ${
                                    pag?.status === "pago" ? "border-green-500/20 bg-green-500/5" :
                                    pag?.status === "perdoado" ? "border-purple-500/20 bg-purple-500/5" :
                                    pag?.status === "parceria" ? "border-purple-500/20 bg-purple-500/5" :
                                    "border-red-500/20 bg-red-500/5"
                                  }`}>
                                    <span className="font-medium">{mesLabel}</span>
                                    <div className="flex items-center gap-1.5">
                                      {pag?.status === "pago" && <button onClick={() => { setPagoModal(c); setPagoModalMes(mesRef); }} className="text-green-400 font-mono hover:underline">{formatCurrency(Number(pag.valor_pago))}</button>}
                                      {pag?.status === "pago" && pag.dia_pagamento && <span className="text-green-400/60 text-[9px]">dia {pag.dia_pagamento}</span>}
                                      {pag?.status === "perdoado" && <button onClick={() => { setPagoModal(c); setPagoModalMes(mesRef); }} className="text-purple-400 hover:underline">Perdoado</button>}
                                      {pag?.status === "parceria" && <span className="text-purple-400">Parceria</span>}
                                      {!pag && <button onClick={() => { setPagoModal(c); setPagoModalMes(mesRef); }} className="text-red-400 hover:text-red-300">Devendo</button>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <EntradasTimeline clienteId={c.id} />
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {filtered.length > 0 && (
              <tr className="bg-muted/30 font-medium">
                <td className="px-2 py-2" />
                <td className="px-2 py-2 text-xs">{filtered.length} clientes</td>
                <td className="px-2 py-2" />
                <td className="px-2 py-2 font-mono text-xs">{formatCurrency(totalValor)}</td>
                <td colSpan={4} />
                <td className="px-2 py-2 font-mono text-xs text-green-400">{formatCurrency(totalPago)}</td>
                <td />
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagoModal && <MarcarPagoModal clienteId={pagoModal.id} clienteNome={pagoModal.nome} valorMensal={pagoModal.valor_mensal} mesReferencia={pagoModalMes || mesReferencia} pagamentoAtual={pagoModal.pagamento_mes} pagamentosTodos={pagoModal.pagamentos_todos} mesFechamento={pagoModal.mes_fechamento} statusFinanceiro={pagoModal.status_financeiro || pagoModal.status} onSaved={() => { setPagoModal(null); setPagoModalMes(null); onRefresh(); }} onClose={() => { setPagoModal(null); setPagoModalMes(null); }} />}
      {editModal && <EditarClienteModal cliente={editModal} onSaved={() => { setEditModal(null); onRefresh(); }} onClose={() => setEditModal(null)} />}

      {/* Modal de Churn */}
      {churnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setChurnModal(null)}>
          <div className="bg-card border rounded-xl shadow-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-red-400">Registrar Churn</h3>
              <button onClick={() => setChurnModal(null)}><X size={16} className="text-muted-foreground" /></button>
            </div>
            <p className="text-xs text-muted-foreground">{churnModal.nome} — {formatCurrency(churnModal.valor_mensal)}/mes</p>
            <p className="text-[10px] text-red-400">O cliente sera marcado como inativo em Entradas e registrado no Pipeline de Churn.</p>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Motivo</label>
                <select value={churnMotivo} onChange={(e) => setChurnMotivo(e.target.value)} className="w-full text-sm bg-transparent border rounded-lg px-3 py-2">
                  {MOTIVOS_CHURN.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Observacao (opcional)</label>
                <input value={churnObs} onChange={(e) => setChurnObs(e.target.value)} className="w-full text-sm bg-transparent border rounded-lg px-3 py-2" placeholder="Detalhes..." />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setChurnModal(null)}>Cancelar</Button>
              <Button className="flex-1 bg-red-500 hover:bg-red-600" onClick={executarChurn} disabled={churnSaving}>
                {churnSaving ? "Processando..." : "Confirmar Churn"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function EntradasTabela({ clientes, mesReferencia, onRefresh }: { clientes: ClienteRow[]; mesReferencia: string; onRefresh: () => void }) {
  const [showInativos, setShowInativos] = useState(false);

  const ativos = clientes.filter((c) => (c.status_financeiro || c.status) === "ativo");
  const pausados = clientes.filter((c) => c.status_financeiro === "pausado");
  const integrais = clientes.filter((c) => c.status_financeiro === "pagou_integral");
  const parcerias = clientes.filter((c) => c.status_financeiro === "parceria");
  const inativos = clientes.filter((c) => c.status === "churned" || c.status_financeiro === "churned");

  // Subdividir ativos por categoria
  const getCat = (c: ClienteRow) => c.categoria || "Advogados";
  const ativosAdv = ativos.filter((c) => getCat(c) === "Advogados");
  const ativosNL = ativos.filter((c) => getCat(c) === "Negócio Local");
  const ativosMDS = ativos.filter((c) => getCat(c) === "MDS");

  return (
    <div className="space-y-4">
      {/* Advogados — ativos recorrentes */}
      <ClienteTable clientes={ativosAdv} mesReferencia={mesReferencia} onRefresh={onRefresh} title="Advogados" defaultSort="dia_pagamento" />

      {/* Pagou integral — dentro da seção Advogados com divisória */}
      {integrais.length > 0 && (
        <div className="pt-1">
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="h-px flex-1 bg-blue-500/20" />
            <span className="text-xs font-medium text-blue-400 flex items-center gap-1">Pagou Integral <Badge className="text-[8px] bg-blue-500/15 text-blue-400">{integrais.length}</Badge></span>
            <div className="h-px flex-1 bg-blue-500/20" />
          </div>
          <ClienteTable clientes={integrais} mesReferencia={mesReferencia} onRefresh={onRefresh} />
        </div>
      )}

      {/* Negócio Local */}
      {ativosNL.length > 0 && (
        <ClienteTable clientes={ativosNL} mesReferencia={mesReferencia} onRefresh={onRefresh} title="Negocio Local" defaultSort="dia_pagamento" />
      )}

      {/* MDS */}
      {ativosMDS.length > 0 && (
        <ClienteTable clientes={ativosMDS} mesReferencia={mesReferencia} onRefresh={onRefresh} title="MDS" defaultSort="dia_pagamento" />
      )}

      {/* Parcerias */}
      {parcerias.length > 0 && (
        <div className="border rounded-lg border-purple-500/20">
          <div className="px-4 py-2 border-b border-purple-500/10 flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2">Parcerias <Badge className="text-[8px] bg-purple-500/15 text-purple-400">{parcerias.length}</Badge></span>
          </div>
          <div className="p-3">
            <ClienteTable clientes={parcerias} mesReferencia={mesReferencia} onRefresh={onRefresh} />
          </div>
        </div>
      )}

      {/* Pausados */}
      {pausados.length > 0 && (
        <details className="border rounded-lg">
          <summary className="px-4 py-3 cursor-pointer text-sm font-medium flex items-center justify-between hover:bg-muted/20">
            <span>Pausados ({pausados.length})</span>
            <span className="text-xs text-yellow-400 font-mono">{formatCurrency(pausados.reduce((s, c) => s + c.valor_mensal, 0))}</span>
          </summary>
          <div className="p-3 border-t">
            <ClienteTable clientes={pausados} mesReferencia={mesReferencia} onRefresh={onRefresh} />
          </div>
        </details>
      )}

      {/* Inativos — minimizado */}
      {inativos.length > 0 && (
        <details className="border rounded-lg border-dashed" open={showInativos}>
          <summary className="px-4 py-3 cursor-pointer text-sm text-muted-foreground flex items-center justify-between hover:bg-muted/20"
            onClick={(e) => { e.preventDefault(); setShowInativos(!showInativos); }}>
            <span>Inativos / Churned ({inativos.length})</span>
            <span className="text-xs text-red-400 font-mono">{formatCurrency(inativos.reduce((s, c) => s + c.valor_mensal, 0))}</span>
          </summary>
          {showInativos && (
            <div className="p-3 border-t">
              <ClienteTable clientes={inativos} mesReferencia={mesReferencia} onRefresh={onRefresh} defaultSort="nome" />
            </div>
          )}
        </details>
      )}
    </div>
  );
}
