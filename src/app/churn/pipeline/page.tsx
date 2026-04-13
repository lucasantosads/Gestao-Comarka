"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/currency-input";
import { ChevronRight, ChevronLeft, X, Save, Trash2 } from "lucide-react";

interface Cliente {
  id: string; nome: string; mrr: number; motivo_cancelamento: string | null;
  data_cancelamento: string | null; etapa_churn: string; status: string;
  observacao: string | null;
}

const ETAPAS = [
  { key: "aviso_recebido", label: "Aviso de Saida", color: "#e03e3e", bg: "bg-red-500/10", border: "border-red-500/30", badge: "bg-red-500/15 text-red-400", icon: "📩" },
  { key: "juridico", label: "Juridico", color: "#9b9a97", bg: "bg-neutral-500/10", border: "border-neutral-500/30", badge: "bg-neutral-500/15 text-neutral-400", icon: "⚖️" },
  { key: "no_prazo_aviso", label: "No Prazo do Aviso", color: "#d9730d", bg: "bg-orange-500/10", border: "border-orange-500/30", badge: "bg-orange-500/15 text-orange-400", icon: "⏳" },
  { key: "procedimentos_finais", label: "Procedimentos Finais", color: "#2f80ed", bg: "bg-blue-500/10", border: "border-blue-500/30", badge: "bg-blue-500/15 text-blue-400", icon: "📋" },
  { key: "finalizado", label: "Finalizado", color: "#0f7b6c", bg: "bg-emerald-500/10", border: "border-emerald-500/30", badge: "bg-emerald-500/15 text-emerald-400", icon: "✅" },
];

const CHECKLIST: Record<string, string[]> = {
  aviso_recebido: [
    "Analisar se realmente nao tem mais volta",
    "Conferir pagamentos pendentes e multa",
    "Perguntar se mantem campanhas no aviso",
    "Avisar time operacional",
    "Alterar em Controle de Clientes",
    "Avisar time financeiro",
  ],
  juridico: [
    "Departamento juridico acionado",
    "Juridico entrou em contato com cliente",
  ],
  no_prazo_aviso: [
    "Manter campanhas se solicitado",
    "Acompanhar periodo de 30 dias",
  ],
  procedimentos_finais: [
    "Pausar campanhas",
    "Remover da planilha",
    "Remover da comunidade",
    "Apagar pasta de criativos",
    "Conferir acesso do cliente",
    "Passar para inativo",
    "Retirar do NPS",
    "Retirar acesso ao dashboard",
    "Enviar mensagem de agradecimento",
  ],
  finalizado: [],
};

type PipelinePeriodo = "este_mes" | "3m" | "6m" | "12m" | "all";

export default function ChurnPipelinePage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  const [showFinalizados, setShowFinalizados] = useState(false);
  const [periodo, setPeriodo] = useState<PipelinePeriodo>("all");
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [checkStates, setCheckStates] = useState<Record<string, Record<string, boolean>>>(() => {
    if (typeof window !== "undefined") {
      try { return JSON.parse(localStorage.getItem("churn_checks") || "{}"); } catch { return {}; }
    }
    return {};
  });

  useEffect(() => {
    supabase.from("clientes").select("*").eq("status", "cancelado").order("data_cancelamento", { ascending: false })
      .then(({ data }) => { setClientes((data || []) as Cliente[]); setLoading(false); });
  }, []);

  const mudarEtapa = async (id: string, novaEtapa: string) => {
    setClientes((prev) => prev.map((c) => c.id === id ? { ...c, etapa_churn: novaEtapa } : c));
    const { error } = await supabase.from("clientes").update({ etapa_churn: novaEtapa }).eq("id", id);
    if (error) toast.error("Erro: " + error.message);
    else toast.success("Etapa atualizada");
  };

  const toggleCheck = (clienteId: string, item: string) => {
    setCheckStates((prev) => {
      const clienteChecks = prev[clienteId] || {};
      const next = { ...prev, [clienteId]: { ...clienteChecks, [item]: !clienteChecks[item] } };
      localStorage.setItem("churn_checks", JSON.stringify(next));
      return next;
    });
  };

  const getEtapaIdx = (etapa: string) => ETAPAS.findIndex((e) => e.key === etapa);

  const selectedCliente = selected ? clientes.find((c) => c.id === selected) : null;

  // Edit state for selected client
  const [editNome, setEditNome] = useState("");
  const [editMrr, setEditMrr] = useState(0);
  const [editMotivo, setEditMotivo] = useState("");
  const [editData, setEditData] = useState("");
  const [editObs, setEditObs] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selectedCliente) {
      setEditNome(selectedCliente.nome);
      setEditMrr(Number(selectedCliente.mrr));
      setEditMotivo(selectedCliente.motivo_cancelamento || "");
      setEditData(selectedCliente.data_cancelamento || "");
      setEditObs(selectedCliente.observacao || "");
    }
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const deletarChurn = async (id: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja remover "${nome}" do pipeline de churn? O cliente será reativado.`)) return;
    // 1. Reativar em clientes_receita se existir
    await supabase.from("clientes_receita").update({ status: "ativo", status_financeiro: "ativo" }).eq("nome", nome);
    // 2. Deletar de clientes (tabela de churn)
    const { error } = await supabase.from("clientes").delete().eq("id", id);
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success(`${nome} removido do churn e reativado`);
      setClientes((prev) => prev.filter((c) => c.id !== id));
      if (selected === id) setSelected(null);
    }
  };

  const salvarEdicao = async () => {
    if (!selectedCliente) return;
    setSaving(true);
    const { error } = await supabase.from("clientes").update({
      nome: editNome,
      mrr: editMrr,
      motivo_cancelamento: editMotivo || null,
      data_cancelamento: editData || null,
      observacao: editObs || null,
    }).eq("id", selectedCliente.id);
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success("Cliente atualizado");
      setClientes((prev) => prev.map((c) => c.id === selectedCliente.id ? {
        ...c, nome: editNome, mrr: editMrr,
        motivo_cancelamento: editMotivo || null,
        data_cancelamento: editData || null,
        observacao: editObs || null,
      } : c));
    }
    setSaving(false);
  };

  // Period filter
  const filteredClientes = (() => {
    if (periodo === "all") return clientes;
    const now = new Date();
    let months = 0;
    if (periodo === "este_mes") months = 0;
    else if (periodo === "3m") months = 3;
    else if (periodo === "6m") months = 6;
    else if (periodo === "12m") months = 12;

    if (periodo === "este_mes") {
      const mesAtual = now.toISOString().slice(0, 7);
      return clientes.filter((c) => c.data_cancelamento?.startsWith(mesAtual));
    }
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months, 1).toISOString().slice(0, 10);
    return clientes.filter((c) => !c.data_cancelamento || c.data_cancelamento >= cutoff);
  })();

  const etapasVisiveis = showFinalizados ? ETAPAS : ETAPAS.filter((e) => e.key !== "finalizado");

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Pipeline de Churn</h1>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-lg p-0.5">
            {(["este_mes", "3m", "6m", "12m", "all"] as PipelinePeriodo[]).map((p) => (
              <button key={p} onClick={() => setPeriodo(p)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${periodo === p ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
                {p === "all" ? "Tudo" : p === "este_mes" ? "Este mes" : p.toUpperCase()}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFinalizados(!showFinalizados)}>
            {showFinalizados ? "Ocultar finalizados" : "Mostrar finalizados"}
          </Button>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {etapasVisiveis.map((etapa) => {
          const etapaClientes = filteredClientes.filter((c) => (c.etapa_churn || "aviso_recebido") === etapa.key);
          const mrrEtapa = etapaClientes.reduce((s, c) => s + Number(c.mrr), 0);
          return (
            <div key={etapa.key} className="min-w-[220px] flex-1"
              onDragOver={(e) => { e.preventDefault(); setDragOver(etapa.key); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (dragging) {
                  const c = clientes.find((cl) => cl.id === dragging);
                  if (c && (c.etapa_churn || "aviso_recebido") !== etapa.key) {
                    mudarEtapa(dragging, etapa.key);
                  }
                }
                setDragging(null);
                setDragOver(null);
              }}
            >
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-1.5">
                  <span>{etapa.icon}</span>
                  <span className="text-xs font-medium">{etapa.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-[9px]">{etapaClientes.length}</Badge>
                  {mrrEtapa > 0 && <span className="text-[9px] text-red-400 font-mono">{formatCurrency(mrrEtapa)}</span>}
                </div>
              </div>

              <div className={`space-y-2 min-h-[200px] p-2 rounded-lg border border-dashed ${etapa.border} transition-colors ${dragOver === etapa.key ? "bg-primary/5 border-primary" : ""}`}>
                {(showAll[etapa.key] ? etapaClientes : etapaClientes.slice(0, 5)).map((c) => {
                  const checks = checkStates[c.id] || {};
                  const etapaChecks = CHECKLIST[etapa.key] || [];
                  const totalChecks = etapaChecks.length;
                  const doneChecks = etapaChecks.filter((item) => checks[item]).length;

                  return (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={(e) => { setDragging(c.id); e.dataTransfer.effectAllowed = "move"; }}
                      onDragEnd={() => { setDragging(null); setDragOver(null); }}
                      onClick={() => setSelected(c.id)}
                      className={`p-2.5 rounded-lg border cursor-grab active:cursor-grabbing transition-colors hover:border-primary/50 ${selected === c.id ? "border-primary bg-primary/5" : "bg-card"} ${dragging === c.id ? "opacity-40" : ""} ${(() => {
                        if (!c.data_cancelamento) return "";
                        const dias = Math.ceil((new Date().getTime() - new Date(c.data_cancelamento + "T12:00:00").getTime()) / 86400000);
                        return dias >= 23 ? "border-red-500/50 animate-pulse" : "";
                      })()}`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate flex-1">☹️ {(!c.nome || c.nome === "Cliente") ? <span className="text-red-400">— sem nome —</span> : c.nome}</p>
                        {Number(c.mrr) >= 2000 && <Badge className="text-[7px] bg-yellow-500/15 text-yellow-400 shrink-0 ml-1">Alto valor</Badge>}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-mono text-red-400">{formatCurrency(c.mrr)}</span>
                        {c.data_cancelamento && (() => {
                          const dias = Math.ceil((new Date().getTime() - new Date(c.data_cancelamento + "T12:00:00").getTime()) / 86400000);
                          const prazoFim = 30 - dias;
                          return (
                            <span className={`text-[9px] font-mono ${prazoFim <= 7 ? "text-red-400 font-medium" : prazoFim <= 14 ? "text-yellow-400" : "text-muted-foreground"}`}>
                              {prazoFim > 0 ? `${prazoFim}d restantes` : `${Math.abs(prazoFim)}d vencido`}
                            </span>
                          );
                        })()}
                      </div>
                      {c.motivo_cancelamento && (
                        <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{c.motivo_cancelamento}</p>
                      )}
                      {totalChecks > 0 && (
                        <div className="mt-1.5">
                          <div className="h-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${(doneChecks / totalChecks) * 100}%` }} />
                          </div>
                          <p className="text-[8px] text-muted-foreground mt-0.5">{doneChecks}/{totalChecks} tarefas</p>
                        </div>
                      )}
                    </div>
                  );
                })}
                {!showAll[etapa.key] && etapaClientes.length > 5 && (
                  <button onClick={() => setShowAll((prev) => ({ ...prev, [etapa.key]: true }))}
                    className="w-full text-[10px] text-primary hover:underline py-2">
                    + {etapaClientes.length - 5} mais
                  </button>
                )}
                {showAll[etapa.key] && etapaClientes.length > 5 && (
                  <button onClick={() => setShowAll((prev) => ({ ...prev, [etapa.key]: false }))}
                    className="w-full text-[10px] text-muted-foreground hover:underline py-2">
                    Mostrar menos
                  </button>
                )}
                {etapaClientes.length === 0 && (
                  <p className="text-[10px] text-muted-foreground text-center py-8">Nenhum</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Painel lateral — detalhes do cliente selecionado */}
      {selectedCliente && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                ☹️ {selectedCliente.nome}
                <Badge className={`text-[9px] ${ETAPAS.find((e) => e.key === selectedCliente.etapa_churn)?.badge || "bg-muted"}`}>
                  {ETAPAS.find((e) => e.key === selectedCliente.etapa_churn)?.label || selectedCliente.etapa_churn}
                </Badge>
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}><X size={14} /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Campos editáveis */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px]">Cliente</Label>
                <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">MRR Perdido</Label>
                <CurrencyInput value={editMrr} onChange={setEditMrr} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Motivo</Label>
                <select value={editMotivo} onChange={(e) => setEditMotivo(e.target.value)} className="w-full h-8 text-xs bg-transparent border rounded-lg px-2">
                  <option value="">Selecione...</option>
                  <option>Falta de resultados</option>
                  <option>Financeiro da empresa</option>
                  <option>Não precisa mais do serviço</option>
                  <option>Problema de atendimento</option>
                  <option>Concorrente</option>
                  <option>Desistência da empresa</option>
                  <option>Problemas pessoais</option>
                  <option>Outro</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Data Cancelamento</Label>
                <Input type="date" value={editData} onChange={(e) => setEditData(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Observacao</Label>
                <Input value={editObs} onChange={(e) => setEditObs(e.target.value)} className="h-8 text-xs" placeholder="Detalhes..." />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={salvarEdicao} disabled={saving} className="h-7 text-xs">
                <Save size={12} className="mr-1" /> {saving ? "Salvando..." : "Salvar Alteracoes"}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400 hover:bg-red-500/10"
                onClick={() => deletarChurn(selectedCliente.id, selectedCliente.nome)}>
                <Trash2 size={12} className="mr-1" /> Remover Churn
              </Button>
            </div>

            {/* Navegação de etapas */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Etapa:</span>
              {ETAPAS.map((etapa, idx) => {
                const currentIdx = getEtapaIdx(selectedCliente.etapa_churn || "aviso_recebido");
                const isActive = etapa.key === selectedCliente.etapa_churn;
                const isPast = idx < currentIdx;
                return (
                  <button
                    key={etapa.key}
                    onClick={() => mudarEtapa(selectedCliente.id, etapa.key)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${isActive ? etapa.badge + " font-medium" : isPast ? "bg-muted text-muted-foreground" : "border hover:bg-muted"}`}
                  >
                    {etapa.icon} {etapa.label}
                  </button>
                );
              })}
            </div>

            {/* Botões avançar/retroceder */}
            <div className="flex gap-2">
              {getEtapaIdx(selectedCliente.etapa_churn) > 0 && (
                <Button variant="outline" size="sm" onClick={() => mudarEtapa(selectedCliente.id, ETAPAS[getEtapaIdx(selectedCliente.etapa_churn) - 1].key)}>
                  <ChevronLeft size={14} className="mr-1" /> Retroceder
                </Button>
              )}
              {getEtapaIdx(selectedCliente.etapa_churn) < ETAPAS.length - 1 && (
                <Button size="sm" onClick={() => mudarEtapa(selectedCliente.id, ETAPAS[getEtapaIdx(selectedCliente.etapa_churn) + 1].key)}>
                  Avancar <ChevronRight size={14} className="ml-1" />
                </Button>
              )}
            </div>

            {/* Checklist da etapa */}
            {(() => {
              const items = CHECKLIST[selectedCliente.etapa_churn || "aviso_recebido"] || [];
              if (items.length === 0) return <p className="text-xs text-muted-foreground">Processo finalizado.</p>;
              const checks = checkStates[selectedCliente.id] || {};
              return (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium">Checklist — {ETAPAS.find((e) => e.key === selectedCliente.etapa_churn)?.label}</p>
                  {items.map((item) => (
                    <label key={item} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/30 p-1.5 rounded transition-colors">
                      <input
                        type="checkbox"
                        checked={!!checks[item]}
                        onChange={() => toggleCheck(selectedCliente.id, item)}
                        className="rounded border-muted-foreground"
                      />
                      <span className={checks[item] ? "line-through text-muted-foreground" : ""}>{item}</span>
                    </label>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
