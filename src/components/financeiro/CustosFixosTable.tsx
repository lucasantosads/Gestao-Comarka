"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import {
  ChevronDown, ChevronRight, Users, Building, CreditCard,
  Copy, Check, Pencil, X, AlertTriangle, TrendingDown, Calendar, ArrowDown,
} from "lucide-react";

// === Types ===

interface FolhaItem {
  id: string; nome: string; cargo: string | null; valor: number; valor_mensal: number;
  dia_vencimento: number | null; meio_pagamento: string | null;
}
interface FixoItem {
  id: string; descricao: string; categoria: string | null; valor: number;
  dia_vencimento: number | null; meio_pagamento: string | null;
}
interface ParcelamentoItem {
  id: string; descricao: string; categoria: string | null; valor: number; valor_parcela: number;
  dia_vencimento: number | null; meio_pagamento: string | null;
  parcela_atual: number; parcelas_total: number; parcelas_restantes: number;
}
interface Alerta { tipo: string; nome: string; valor: number; dia: number; meio: string | null }
interface Projecao {
  descricao: string; categoria: string | null; parcelas_restantes: number;
  valor_parcela: number; valor_total_restante: number; data_fim_estimada: string; reducao_mensal: number;
}
interface CustosData {
  folha: { itens: FolhaItem[]; total: number; setores: Record<string, { pessoas: number; total: number }> };
  fixos: { itens: FixoItem[]; total: number };
  parcelamentos: { itens: ParcelamentoItem[]; total: number };
  total_geral: number;
  alertas_hoje: Alerta[];
  alertas_proximos: Alerta[];
  projecoes: Projecao[];
  distribuicao: { folha_pct: number; fixos_pct: number; parcelamentos_pct: number };
}

// === Helpers ===

const CARGO_COLORS: Record<string, string> = {
  "Diretor": "bg-purple-500/15 text-purple-400", "Closer": "bg-blue-500/15 text-blue-400",
  "SDR": "bg-green-500/15 text-green-400", "Head": "bg-orange-500/15 text-orange-400",
  "G. Pleno": "bg-cyan-500/15 text-cyan-400", "G. Junior": "bg-teal-500/15 text-teal-400",
  "Adm/Comercial": "bg-slate-500/15 text-slate-400", "SM": "bg-pink-500/15 text-pink-400",
  "Edicao": "bg-rose-500/15 text-rose-400", "DESENVOLV": "bg-indigo-500/15 text-indigo-400",
};
const CAT_COLORS: Record<string, string> = {
  "Aluguel": "bg-amber-500/15 text-amber-400", "Internet": "bg-cyan-500/15 text-cyan-400",
  "Limpeza": "bg-emerald-500/15 text-emerald-400", "Ferramentas/Softwares": "bg-indigo-500/15 text-indigo-400",
  "Contador": "bg-slate-500/15 text-slate-400", "Equipamento": "bg-purple-500/15 text-purple-400",
  "Obra": "bg-orange-500/15 text-orange-400", "Investimentos": "bg-blue-500/15 text-blue-400",
  "Cursos e Treinamentos": "bg-teal-500/15 text-teal-400", "Outros": "bg-muted text-muted-foreground",
  "Eventos/Viagens": "bg-pink-500/15 text-pink-400",
};
const SETOR_COLORS: Record<string, string> = {
  "Comercial": "text-blue-400", "Operacional": "text-cyan-400", "Marketing": "text-pink-400",
  "Diretoria": "text-purple-400", "Tecnologia": "text-indigo-400", "Outros": "text-muted-foreground",
};
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="inline-flex items-center gap-1 text-xs font-mono hover:text-foreground transition-colors group" title="Clique para copiar">
      <span className="group-hover:underline">{text}</span>
      {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} className="opacity-0 group-hover:opacity-50" />}
    </button>
  );
}

// === Inline Edit ===

function InlineEdit({ value, onSave, type = "text", prefix, raw }: { value: string | number; onSave: (v: string) => void; type?: string; prefix?: string; raw?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value));

  if (!editing) return (
    <button onClick={() => { setVal(String(value)); setEditing(true); }} className="inline-flex items-center gap-1 hover:text-foreground group" title="Editar">
      <span>{prefix}{type === "number" && !raw ? formatCurrency(Number(value)) : value}</span>
      <Pencil size={9} className="opacity-0 group-hover:opacity-40" />
    </button>
  );

  return (
    <span className="inline-flex items-center gap-1">
      <Input type={type} value={val} onChange={(e) => setVal(e.target.value)}
        className="h-6 w-20 text-xs px-1" autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") { onSave(val); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
      />
      <button onClick={() => { onSave(val); setEditing(false); }} className="text-green-400"><Check size={12} /></button>
      <button onClick={() => setEditing(false)} className="text-muted-foreground"><X size={12} /></button>
    </span>
  );
}

// === Section ===

function Section({ title, icon: Icon, total, count, children, defaultOpen, color }: {
  title: string; icon: React.ElementType; total: number; count: number;
  children: React.ReactNode; defaultOpen?: boolean; color?: string;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Icon size={14} className={color || "text-muted-foreground"} />
          <span className="text-sm font-medium">{title}</span>
          <span className="text-[10px] text-muted-foreground">({count})</span>
        </div>
        <span className="text-sm font-mono font-bold">{formatCurrency(total)}</span>
      </button>
      {open && <div className="border-t">{children}</div>}
    </div>
  );
}

// === Main Component ===

interface Pagamento { custo_fixo_id: string; tipo: string; mes_referencia: string; status: string; pago_em: string | null }

function getMesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMesAnterior(mes: string, n = 1): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function CustosFixosTable() {
  const [data, setData] = useState<CustosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mesAtual] = useState(getMesAtual());
  const [pagamentos, setPagamentos] = useState<Map<string, Pagamento>>(new Map()); // key: tipo:id:mes
  const [showConfirmAll, setShowConfirmAll] = useState(false);
  const [undoParcela, setUndoParcela] = useState<{ id: string; prev: number; willDelete: boolean; expiresAt: number } | null>(null);
  const [, setUndoTick] = useState(0);

  const keyOf = (tipo: string, id: string, mes: string) => `${tipo}:${id}:${mes}`;

  const loadData = useCallback(async () => {
    setLoading(true);
    const [custosRes, pagRes] = await Promise.all([
      fetch("/api/financeiro/custos-fixos").then((r) => r.json()),
      Promise.all([
        fetch(`/api/financeiro/custos-fixos/pagamentos?mes=${mesAtual}`).then((r) => r.json()),
        fetch(`/api/financeiro/custos-fixos/pagamentos?mes=${getMesAnterior(mesAtual, 1)}`).then((r) => r.json()),
        fetch(`/api/financeiro/custos-fixos/pagamentos?mes=${getMesAnterior(mesAtual, 2)}`).then((r) => r.json()),
        fetch(`/api/financeiro/custos-fixos/pagamentos?mes=${getMesAnterior(mesAtual, 3)}`).then((r) => r.json()),
      ]),
    ]);
    if (!custosRes.error) setData(custosRes);
    const map = new Map<string, Pagamento>();
    for (const arr of pagRes) {
      if (Array.isArray(arr)) {
        for (const p of arr) map.set(keyOf(p.tipo, p.custo_fixo_id, p.mes_referencia), p);
      }
    }
    setPagamentos(map);
    setLoading(false);
  }, [mesAtual]);

  const isPago = (tipo: string, id: string, mes: string) => pagamentos.get(keyOf(tipo, id, mes))?.status === "pago";

  const marcarComoPago = async (tipo: string, id: string, nome: string, valor: number, categoria: string | null) => {
    const res = await fetch("/api/financeiro/custos-fixos/pagamentos", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ custo_fixo_id: id, tipo, mes_referencia: mesAtual, nome, valor, categoria }),
    });
    const d = await res.json();
    if (d.error) toast.error(d.error);
    else {
      toast.success(`${nome} marcado como pago — R$ ${valor.toLocaleString("pt-BR")} lançado em despesas`);
      loadData();
    }
  };

  const statusPagamento = (tipo: string, id: string, diaVencimento: number | null): "pago" | "vencido" | "pendente" => {
    if (isPago(tipo, id, mesAtual)) return "pago";
    const hoje = new Date();
    const [y, m] = mesAtual.split("-").map(Number);
    if (y === hoje.getFullYear() && m === hoje.getMonth() + 1 && diaVencimento && hoje.getDate() > diaVencimento) return "vencido";
    return "pendente";
  };

  useEffect(() => { loadData(); }, [loadData]);

  const patchItem = async (tabela: string, id: string, fields: Record<string, unknown>) => {
    const res = await fetch("/api/financeiro/custos-fixos", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabela, id, ...fields }),
    });
    if (res.ok) { toast.success("Atualizado"); loadData(); }
    else toast.error("Erro ao atualizar");
  };

  const marcarPago = async (id: string, parcelaAtual: number, parcelasTotal: number) => {
    const nova = parcelaAtual + 1;
    const willDelete = nova > parcelasTotal;
    // update otimista no server sem reload (evita piscar)
    await fetch("/api/financeiro/custos-fixos", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabela: "parcelamentos", id, parcela_atual: nova }),
    });
    setUndoParcela({ id, prev: parcelaAtual, willDelete, expiresAt: Date.now() + 10000 });
    toast.success(willDelete ? "Parcelamento quitado — será removido em 10s" : `Parcela ${nova}/${parcelasTotal} paga`);
    loadData();
  };

  const desfazerParcela = async () => {
    if (!undoParcela) return;
    await fetch("/api/financeiro/custos-fixos", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabela: "parcelamentos", id: undoParcela.id, parcela_atual: undoParcela.prev }),
    });
    setUndoParcela(null);
    toast.success("Ação desfeita");
    loadData();
  };

  // timer countdown + delete on expiry
  useEffect(() => {
    if (!undoParcela) return;
    const tick = setInterval(() => setUndoTick((t) => t + 1), 250);
    const timeout = setTimeout(async () => {
      if (undoParcela.willDelete) {
        await fetch("/api/financeiro/custos-fixos", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tabela: "parcelamentos", id: undoParcela.id, ativo: false }),
        });
        loadData();
      }
      setUndoParcela(null);
    }, Math.max(0, undoParcela.expiresAt - Date.now()));
    return () => { clearInterval(tick); clearTimeout(timeout); };
  }, [undoParcela, loadData]);

  const renderPagamentoCell = (tipo: string, id: string, nome: string, valor: number, categoria: string | null, diaVenc: number | null) => {
    const st = statusPagamento(tipo, id, diaVenc);
    const cls = st === "pago" ? "bg-green-500/15 text-green-400" : st === "vencido" ? "bg-red-500/15 text-red-400" : "bg-muted text-muted-foreground";
    const label = st === "pago" ? "Pago" : st === "vencido" ? "Vencido" : "Pendente";

    // Histórico 3 meses anteriores
    const historico = [1, 2, 3].map((n) => {
      const mesPrev = getMesAnterior(mesAtual, n);
      const pg = pagamentos.get(keyOf(tipo, id, mesPrev));
      const pago = pg?.status === "pago";
      const [y, m] = mesPrev.split("-").map(Number);
      return { mes: mesPrev, label: `${String(m).padStart(2, "0")}/${String(y).slice(2)}`, pago };
    });

    return (
      <div className="flex items-center gap-1.5">
        <Badge className={`text-[9px] ${cls}`}>{label}</Badge>
        {st !== "pago" && (
          <button onClick={() => marcarComoPago(tipo, id, nome, valor, categoria)}
            className="text-[9px] text-green-400 hover:underline" title="Marcar como pago e lançar em despesas">
            ✓ Pagar
          </button>
        )}
        <div className="flex gap-0.5 ml-1">
          {historico.map((h) => (
            <span key={h.mes} title={h.label}
              className={`w-1.5 h-4 rounded-sm ${h.pago ? "bg-green-500" : "bg-muted"}`} />
          ))}
        </div>
      </div>
    );
  };

  // Pendentes do mês atual para confirmar em lote
  const pendentesMes = () => {
    if (!data) return [];
    const arr: { tipo: string; id: string; nome: string; valor: number; categoria: string | null; dia: number | null }[] = [];
    for (const f of data.folha.itens) {
      if (statusPagamento("folha", f.id, f.dia_vencimento) !== "pago") {
        arr.push({ tipo: "folha", id: f.id, nome: f.nome, valor: Number(f.valor_mensal || f.valor || 0), categoria: f.cargo, dia: f.dia_vencimento });
      }
    }
    for (const f of data.fixos.itens) {
      if (statusPagamento("fixo", f.id, f.dia_vencimento) !== "pago") {
        arr.push({ tipo: "fixo", id: f.id, nome: f.descricao, valor: Number(f.valor), categoria: f.categoria, dia: f.dia_vencimento });
      }
    }
    for (const p of data.parcelamentos.itens) {
      if (statusPagamento("parcelamento", p.id, p.dia_vencimento) !== "pago") {
        arr.push({ tipo: "parcelamento", id: p.id, nome: p.descricao, valor: Number(p.valor_parcela || p.valor), categoria: p.categoria, dia: p.dia_vencimento });
      }
    }
    return arr;
  };

  const confirmarTodos = async () => {
    const pendentes = pendentesMes();
    for (const p of pendentes) {
      await fetch("/api/financeiro/custos-fixos/pagamentos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ custo_fixo_id: p.id, tipo: p.tipo, mes_referencia: mesAtual, nome: p.nome, valor: p.valor, categoria: p.categoria }),
      });
    }
    toast.success(`${pendentes.length} pagamentos confirmados e lançados em despesas`);
    setShowConfirmAll(false);
    loadData();
  };

  if (loading) return <Card><CardContent className="pt-4"><div className="h-48 bg-muted animate-pulse rounded" /></CardContent></Card>;
  if (!data || data.total_geral === 0) return (
    <Card><CardContent className="flex flex-col items-center gap-2 py-12">
      <Building size={32} className="text-muted-foreground opacity-30" />
      <p className="text-sm text-muted-foreground">Nenhum custo fixo cadastrado</p>
    </CardContent></Card>
  );

  // Agrupar folha por setor
  const setorOrder = ["Diretoria", "Comercial", "Operacional", "Marketing", "Tecnologia", "Outros"];
  const folhaPorSetor: Record<string, FolhaItem[]> = {};
  for (const f of data.folha.itens) {
    const cargo = f.cargo || "Outros";
    let setor = "Outros";
    const c = cargo.toLowerCase();
    if (c.includes("closer") || c.includes("sdr") || c.includes("adm") || c.includes("comercial")) setor = "Comercial";
    else if (c.includes("pleno") || c.includes("junior") || c.includes("head")) setor = "Operacional";
    else if (c.includes("sm") || c.includes("edicao") || c.includes("edição")) setor = "Marketing";
    else if (c.includes("diretor")) setor = "Diretoria";
    else if (c.includes("desenvolv")) setor = "Tecnologia";
    if (!folhaPorSetor[setor]) folhaPorSetor[setor] = [];
    folhaPorSetor[setor].push(f);
  }

  const reducaoTotal = data.projecoes.reduce((s, p) => s + p.reducao_mensal, 0);

  const pendentes = pendentesMes();
  const totalPendentes = pendentes.reduce((s, p) => s + p.valor, 0);

  return (
    <div className="space-y-4">

      {/* Header com botão Confirmar Todos */}
      {pendentes.length > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/10">
          <div className="text-xs">
            <strong>{pendentes.length} pagamentos pendentes</strong> — Total: {formatCurrency(totalPendentes)}
          </div>
          <Button size="sm" onClick={() => setShowConfirmAll(true)}>
            <Check size={12} className="mr-1" />Confirmar Todos Pendentes
          </Button>
        </div>
      )}

      {/* Modal de confirmação em lote */}
      {showConfirmAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowConfirmAll(false)}>
          <div className="bg-card border rounded-xl shadow-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Confirmar {pendentes.length} Pagamentos</h3>
              <button onClick={() => setShowConfirmAll(false)}><X size={16} /></button>
            </div>
            <div className="space-y-1 text-xs max-h-[300px] overflow-y-auto">
              {pendentes.map((p, i) => (
                <div key={i} className="flex justify-between p-2 border rounded">
                  <span>{p.nome} <Badge className="text-[8px] bg-muted">{p.tipo}</Badge></span>
                  <span className="font-mono">{formatCurrency(p.valor)}</span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t flex justify-between items-center">
              <span className="text-sm font-bold">Total: {formatCurrency(totalPendentes)}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowConfirmAll(false)}>Cancelar</Button>
                <Button size="sm" onClick={confirmarTodos}>Confirmar e Lançar</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === ALERTAS DO DIA === */}
      {data.alertas_hoje.length > 0 && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 space-y-2">
          <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
            <AlertTriangle size={14} />
            <span>Pagamentos de HOJE ({data.alertas_hoje.length})</span>
          </div>
          {data.alertas_hoje.map((a, i) => (
            <div key={i} className="flex items-center justify-between text-xs px-2">
              <div className="flex items-center gap-2">
                <Badge className="text-[8px] bg-red-500/15 text-red-400">{a.tipo}</Badge>
                <span className="font-medium">{a.nome}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold">{formatCurrency(a.valor)}</span>
                {a.meio && <CopyButton text={a.meio} />}
              </div>
            </div>
          ))}
        </div>
      )}

      {data.alertas_proximos.length > 0 && (
        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 space-y-2">
          <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium">
            <Calendar size={14} />
            <span>Próximos 3 dias ({data.alertas_proximos.length})</span>
          </div>
          {data.alertas_proximos.map((a, i) => (
            <div key={i} className="flex items-center justify-between text-xs px-2">
              <div className="flex items-center gap-2">
                <Badge className="text-[8px] bg-yellow-500/15 text-yellow-400">{a.tipo}</Badge>
                <span>{a.nome}</span>
                <span className="text-muted-foreground">dia {a.dia}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono">{formatCurrency(a.valor)}</span>
                {a.meio && <CopyButton text={a.meio} />}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* === FOLHA POR SETOR === */}
      <Section title="Folha de Pagamento" icon={Users} total={data.folha.total} count={data.folha.itens.length} defaultOpen color="text-indigo-400">
        <div className="overflow-x-auto">
          {setorOrder.filter((s) => folhaPorSetor[s]).map((setor) => {
            const items = folhaPorSetor[setor];
            const setorTotal = items.reduce((s, f) => s + f.valor, 0);
            return (
              <div key={setor}>
                <div className="flex items-center justify-between px-4 py-1.5 bg-muted/20 border-b">
                  <span className={`text-xs font-semibold ${SETOR_COLORS[setor] || ""}`}>{setor} ({items.length})</span>
                  <span className="text-xs font-mono font-medium">{formatCurrency(setorTotal)}</span>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-[10px] text-muted-foreground uppercase tracking-wider">
                    <th className="py-1.5 px-4 text-left w-[180px]">Nome</th>
                    <th className="py-1.5 px-2 text-left w-[100px]">Cargo</th>
                    <th className="py-1.5 px-2 text-right w-[120px]">Valor</th>
                    <th className="py-1.5 px-2 text-center w-[70px]">Dia pgto</th>
                    <th className="py-1.5 px-2 text-right">Chave PIX</th>
                    <th className="py-1.5 px-2">Status</th>
                  </tr></thead>
                  <tbody>
                    {items.map((f) => (
                      <tr key={f.id} className="border-b border-border/20 hover:bg-muted/10">
                        <td className="py-1.5 px-4 font-medium w-[180px]">
                          <InlineEdit value={f.nome} onSave={(v) => patchItem("folha_pagamento", f.id, { nome: v })} />
                        </td>
                        <td className="py-1.5 px-2 w-[100px]">
                          <Badge className={`text-[8px] ${CARGO_COLORS[f.cargo || ""] || "bg-muted text-muted-foreground"}`}>{f.cargo || "—"}</Badge>
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono w-[120px]">
                          <InlineEdit value={f.valor_mensal || f.valor} type="number" onSave={(v) => patchItem("folha_pagamento", f.id, { valor_mensal: Number(v) })} />
                        </td>
                        <td className="py-1.5 px-2 text-center w-[70px] font-mono">
                          {f.dia_vencimento ? <span>Dia <InlineEdit value={f.dia_vencimento} type="number" raw onSave={(v) => patchItem("folha_pagamento", f.id, { dia_vencimento: Number(v) })} /></span> : <InlineEdit value="" type="number" raw onSave={(v) => patchItem("folha_pagamento", f.id, { dia_vencimento: Number(v) })} />}
                        </td>
                        <td className="py-1.5 px-2 text-right text-muted-foreground text-xs">
                          <div className="flex items-center gap-1 justify-end">
                            <InlineEdit value={f.meio_pagamento || "—"} onSave={(v) => patchItem("folha_pagamento", f.id, { meio_pagamento: v })} />
                            {f.meio_pagamento && <CopyButton text={f.meio_pagamento} />}
                          </div>
                        </td>
                        <td className="py-1.5 px-2">
                          {renderPagamentoCell("folha", f.id, f.nome, Number(f.valor_mensal || f.valor || 0), f.cargo, f.dia_vencimento)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
          <div className="flex justify-between items-center px-4 py-2 bg-muted/30 font-medium text-sm">
            <span>Total Folha</span>
            <span className="font-mono">{formatCurrency(data.folha.total)}</span>
          </div>
        </div>
      </Section>

      {/* === CUSTOS FIXOS === */}
      <Section title="Custos Fixos Recorrentes" icon={Building} total={data.fixos.total} count={data.fixos.itens.length} color="text-amber-400">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-[10px] text-muted-foreground uppercase tracking-wider">
              <th className="py-2 px-4 text-left">Descricao</th>
              <th className="py-2 px-4 text-left">Categoria</th>
              <th className="py-2 px-4 text-right">Valor</th>
              <th className="py-2 px-4 text-center">Vencimento</th>
              <th className="py-2 px-4 text-right">Chave PIX</th>
            </tr></thead>
            <tbody>
              {data.fixos.itens.map((f) => (
                <tr key={f.id} className="border-b border-border/20 hover:bg-muted/10">
                  <td className="py-1.5 px-4 font-medium">
                    <InlineEdit value={f.descricao} onSave={(v) => patchItem("custos_fixos", f.id, { descricao: v })} />
                  </td>
                  <td className="py-1.5 px-2">
                    <Badge className={`text-[8px] ${CAT_COLORS[f.categoria || ""] || "bg-muted text-muted-foreground"}`}>{f.categoria || "—"}</Badge>
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono">
                    <InlineEdit value={f.valor} type="number" onSave={(v) => patchItem("custos_fixos", f.id, { valor: Number(v) })} />
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    {f.dia_vencimento ? <span className="font-mono">Dia <InlineEdit value={f.dia_vencimento} type="number" raw onSave={(v) => patchItem("custos_fixos", f.id, { dia_vencimento: Number(v) })} /></span> : <InlineEdit value="" type="number" raw onSave={(v) => patchItem("custos_fixos", f.id, { dia_vencimento: Number(v) })} />}
                  </td>
                  <td className="py-1.5 px-2 text-right text-muted-foreground text-xs">
                    <div className="flex items-center gap-1 justify-end">
                      <InlineEdit value={f.meio_pagamento || "—"} onSave={(v) => patchItem("custos_fixos", f.id, { meio_pagamento: v })} />
                      {f.meio_pagamento && <CopyButton text={f.meio_pagamento} />}
                    </div>
                  </td>
                  <td className="py-1.5 px-2">
                    {renderPagamentoCell("fixo", f.id, f.descricao, Number(f.valor), f.categoria, f.dia_vencimento)}
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/30 font-medium">
                <td className="py-2 px-4" colSpan={2}>Total</td>
                <td className="py-2 px-4 text-right font-mono">{formatCurrency(data.fixos.total)}</td>
                <td colSpan={3} />
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* === PARCELAMENTOS === */}
      <Section title="Parcelamentos Ativos" icon={CreditCard} total={data.parcelamentos.total} count={data.parcelamentos.itens.length} color="text-purple-400">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-[10px] text-muted-foreground uppercase tracking-wider">
              <th className="py-2 px-4 text-left">Descricao</th>
              <th className="py-2 px-2 text-center">Parcela</th>
              <th className="py-2 px-2 text-right">Valor/mes</th>
              <th className="py-2 px-2 text-center">Venc.</th>
              <th className="py-2 px-2 text-right">Chave PIX</th>
              <th className="py-2 px-2 text-center">Progresso</th>
              <th className="py-2 px-2 text-center w-[80px]">Acao</th>
            </tr></thead>
            <tbody>
              {data.parcelamentos.itens.map((p) => {
                const restantes = p.parcelas_restantes;
                const isUrgent = restantes <= 2;
                const isDone = restantes <= 0;
                const pct = p.parcelas_total > 0 ? (p.parcela_atual / p.parcelas_total) * 100 : 0;
                return (
                  <tr key={p.id} className={`border-b border-border/20 hover:bg-muted/10 ${isUrgent ? "bg-yellow-500/[0.04]" : ""} ${isDone ? "opacity-50" : ""}`}>
                    <td className="py-1.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium"><InlineEdit value={p.descricao} onSave={(v) => patchItem("parcelamentos", p.id, { descricao: v })} /></span>
                        <Badge className={`text-[8px] ${CAT_COLORS[p.categoria || ""] || "bg-muted text-muted-foreground"}`}>{p.categoria || "—"}</Badge>
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <span className="text-xs font-mono">
                        <span className="font-semibold">{restantes}</span>
                        <span className="text-muted-foreground"> restantes (</span>
                        <InlineEdit value={p.parcela_atual} type="number" raw onSave={(v) => patchItem("parcelamentos", p.id, { parcela_atual: Number(v) })} />
                        <span className="text-muted-foreground">/</span>
                        <InlineEdit value={p.parcelas_total} type="number" raw onSave={(v) => patchItem("parcelamentos", p.id, { parcelas_total: Number(v) })} />
                        <span className="text-muted-foreground">)</span>
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono">
                      <InlineEdit value={p.valor_parcela || p.valor} type="number" onSave={(v) => patchItem("parcelamentos", p.id, { valor_parcela: Number(v) })} />
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      {p.dia_vencimento ? <span className="font-mono">Dia <InlineEdit value={p.dia_vencimento} type="number" raw onSave={(v) => patchItem("parcelamentos", p.id, { dia_vencimento: Number(v) })} /></span> : <InlineEdit value="" type="number" raw onSave={(v) => patchItem("parcelamentos", p.id, { dia_vencimento: Number(v) })} />}
                    </td>
                    <td className="py-1.5 px-2 text-right text-muted-foreground text-xs">
                      <div className="flex items-center gap-1 justify-end">
                        <InlineEdit value={p.meio_pagamento || "—"} onSave={(v) => patchItem("parcelamentos", p.id, { meio_pagamento: v })} />
                        {p.meio_pagamento && <CopyButton text={p.meio_pagamento} />}
                      </div>
                    </td>
                    <td className="py-1.5 px-2">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${isDone ? "bg-green-400" : isUrgent ? "bg-yellow-400" : "bg-indigo-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className={`text-[10px] font-mono ${isUrgent ? "text-yellow-400" : "text-muted-foreground"}`}>{restantes}x</span>
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      {undoParcela?.id === p.id ? (
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-yellow-400 hover:bg-yellow-500/10"
                          onClick={desfazerParcela}>
                          Desfazer ({Math.max(0, Math.ceil((undoParcela.expiresAt - Date.now()) / 1000))}s)
                        </Button>
                      ) : !isDone ? (
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-green-400 hover:bg-green-500/10"
                          onClick={() => marcarPago(p.id, p.parcela_atual, p.parcelas_total)}>
                          <Check size={10} className="mr-0.5" /> Pago
                        </Button>
                      ) : (
                        <Badge className="text-[8px] bg-green-500/15 text-green-400">Quitado</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-muted/30 font-medium">
                <td className="py-2 px-4" colSpan={2}>Total</td>
                <td className="py-2 px-2 text-right font-mono">{formatCurrency(data.parcelamentos.total)}</td>
                <td colSpan={4} />
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* === PROJEÇÕES === */}
      {data.projecoes.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingDown size={14} className="text-green-400" /> Projeções de Redução</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
              <p className="text-xs text-muted-foreground">Nos próximos 6 meses, {data.projecoes.length} parcelamento{data.projecoes.length > 1 ? "s" : ""} termina{data.projecoes.length > 1 ? "m" : ""}</p>
              <p className="text-lg font-bold text-green-400 mt-1">-{formatCurrency(reducaoTotal)}/mês</p>
              <p className="text-[10px] text-muted-foreground">Redução total quando todos quitarem</p>
            </div>

            <div className="space-y-2">
              {data.projecoes.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-2 border rounded-lg text-xs">
                  <div className="flex items-center gap-2">
                    <ArrowDown size={12} className="text-green-400" />
                    <div>
                      <span className="font-medium">{p.descricao}</span>
                      <Badge className={`ml-1.5 text-[7px] ${CAT_COLORS[p.categoria || ""] || "bg-muted text-muted-foreground"}`}>{p.categoria}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="text-muted-foreground">{p.parcelas_restantes}x de {formatCurrency(p.valor_parcela)}</p>
                      <p className="font-mono">Restam {formatCurrency(p.valor_total_restante)}</p>
                    </div>
                    <div>
                      <p className="text-green-400 font-medium">{MESES[parseInt(p.data_fim_estimada.slice(5)) - 1]}/{p.data_fim_estimada.slice(2, 4)}</p>
                      <p className="text-green-400/60">-{formatCurrency(p.reducao_mensal)}/mês</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* === ANÁLISE ESTRATÉGICA === */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Análise de Custos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Distribuição */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Distribuição de custos fixos</p>
            <div className="flex h-3 rounded-full overflow-hidden">
              <div className="bg-indigo-500" style={{ width: `${data.distribuicao.folha_pct}%` }} title={`Folha: ${data.distribuicao.folha_pct.toFixed(0)}%`} />
              <div className="bg-amber-500" style={{ width: `${data.distribuicao.fixos_pct}%` }} title={`Fixos: ${data.distribuicao.fixos_pct.toFixed(0)}%`} />
              <div className="bg-purple-500" style={{ width: `${data.distribuicao.parcelamentos_pct}%` }} title={`Parcelamentos: ${data.distribuicao.parcelamentos_pct.toFixed(0)}%`} />
            </div>
            <div className="flex justify-between text-[10px] mt-1">
              <span className="text-indigo-400">Folha {data.distribuicao.folha_pct.toFixed(0)}%</span>
              <span className="text-amber-400">Fixos {data.distribuicao.fixos_pct.toFixed(0)}%</span>
              <span className="text-purple-400">Parcelas {data.distribuicao.parcelamentos_pct.toFixed(0)}%</span>
            </div>
          </div>

          {/* Setores */}
          {data.folha.setores && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Custo por setor</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(data.folha.setores).sort((a, b) => b[1].total - a[1].total).map(([setor, info]) => (
                  <div key={setor} className="p-2 border rounded-lg">
                    <p className={`text-xs font-medium ${SETOR_COLORS[setor] || ""}`}>{setor}</p>
                    <p className="text-sm font-bold font-mono">{formatCurrency(info.total)}</p>
                    <p className="text-[10px] text-muted-foreground">{info.pessoas} pessoa{info.pessoas > 1 ? "s" : ""} • {data.folha.total > 0 ? ((info.total / data.folha.total) * 100).toFixed(0) : 0}% da folha</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alertas estratégicos */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Insights</p>
            {data.distribuicao.folha_pct > 70 && (
              <div className="flex items-start gap-2 p-2 rounded bg-red-500/5 border border-red-500/20 text-xs">
                <AlertTriangle size={12} className="text-red-400 mt-0.5 shrink-0" />
                <span className="text-red-400">Folha representa {data.distribuicao.folha_pct.toFixed(0)}% dos custos fixos — alto risco operacional. Considere otimizar antes de expandir equipe.</span>
              </div>
            )}
            {data.distribuicao.parcelamentos_pct > 20 && (
              <div className="flex items-start gap-2 p-2 rounded bg-yellow-500/5 border border-yellow-500/20 text-xs">
                <AlertTriangle size={12} className="text-yellow-400 mt-0.5 shrink-0" />
                <span className="text-yellow-400">Parcelamentos representam {data.distribuicao.parcelamentos_pct.toFixed(0)}% — evite novos comprometimentos até reduzir para &lt;15%.</span>
              </div>
            )}
            {reducaoTotal > 0 && (
              <div className="flex items-start gap-2 p-2 rounded bg-green-500/5 border border-green-500/20 text-xs">
                <TrendingDown size={12} className="text-green-400 mt-0.5 shrink-0" />
                <span className="text-green-400">Economia projetada: {formatCurrency(reducaoTotal)}/mês quando parcelamentos encerrarem. Custo fixo cairá para {formatCurrency(data.total_geral - reducaoTotal)}.</span>
              </div>
            )}
            {data.distribuicao.folha_pct <= 70 && data.distribuicao.parcelamentos_pct <= 20 && (
              <div className="flex items-start gap-2 p-2 rounded bg-green-500/5 border border-green-500/20 text-xs">
                <Check size={12} className="text-green-400 mt-0.5 shrink-0" />
                <span className="text-green-400">Estrutura de custos saudável — folha controlada e parcelamentos dentro do limite.</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Total Geral */}
      <div className="flex justify-between items-center px-4 py-3 bg-muted/30 rounded-lg">
        <span className="text-sm font-medium">Total Fixo Mensal</span>
        <span className="text-lg font-bold font-mono">{formatCurrency(data.total_geral)}</span>
      </div>
    </div>
  );
}
