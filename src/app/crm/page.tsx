"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { LeadCrm, Closer, Sdr } from "@/types/database";
import { formatCurrency, getCurrentMonth } from "@/lib/format";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Plus, ArrowUpDown, Search, Trash2 } from "lucide-react";

const ETAPAS = [
  { key: "oportunidade", label: "Oportunidade", color: "#94a3b8" },
  { key: "reuniao_agendada", label: "Reunião Agendada", color: "#6366f1" },
  { key: "proposta_enviada", label: "Proposta Enviada", color: "#8b5cf6" },
  { key: "follow_up", label: "Follow Up", color: "#a78a45" },
  { key: "assinatura_contrato", label: "Assinatura", color: "#6b7280" },
  { key: "comprou", label: "Comprou", color: "#22c55e" },
  { key: "desistiu", label: "Desistiu", color: "#ef4444" },
] as const;

const MOTIVOS = ["Clausulas do contrato", "Segmento que nao atendemos", "Nao temos o servico", "Tirar duvidas apenas", "Falta de retorno do lead", "Ira reavaliar em outra oportunidade", "Nao possui investimento necessario", "Optou por concorrente", "Nao entramos em contato", "Mudou o projeto", "Outro"];
const CANAIS = ["Trafego Pago", "Organico", "Social Selling", "Indicacao", "Workshop"];
const FUNIL_OPTIONS = ["Sessao Estrategica", "Social Selling", "Webinar", "Aplicacao", "Evento", "Indicacao", "Isca", "Formulario", "Trafego pago"];
const ORIGEM_OPTIONS = ["facebookads", "instagram", "googleads", "whatsapp", "email", "organic", "Lista", "Prospec. Ativa"];
const ABAS = [{ label: "Todos", etapa: null }, ...ETAPAS.map((e) => ({ label: e.label, etapa: e.key }))];
const etapaCfg = (etapa: string) => ETAPAS.find((e) => e.key === etapa) || ETAPAS[0];

export default function CrmPage() {
  const [mes, setMes] = useState(getCurrentMonth());
  const [leads, setLeads] = useState<LeadCrm[]>([]);
  const [closers, setClosers] = useState<Closer[]>([]);
  const [sdrs, setSdrs] = useState<Sdr[]>([]);
  const [loading, setLoading] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [sortCol, setSortCol] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [editingCell, setEditingCell] = useState<{ rowId: string; col: string } | null>(null);
  const [tempValue, setTempValue] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<{ rowId: string; col: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: l }, { data: c }, { data: s }] = await Promise.all([
      supabase.from("leads_crm").select("*").order("created_at", { ascending: false }),
      supabase.from("closers").select("*").eq("ativo", true).order("nome"),
      supabase.from("sdrs").select("*").eq("ativo", true).order("nome"),
    ]);
    setLeads((l || []) as LeadCrm[]);
    setClosers((c || []) as Closer[]);
    setSdrs((s || []) as Sdr[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const ch = supabase.channel("leads_crm_rt2").on("postgres_changes", { event: "*", schema: "public", table: "leads_crm" }, (p) => {
      if (p.eventType === "UPDATE") setLeads((prev) => prev.map((l) => (l.id === (p.new as LeadCrm).id ? { ...l, ...(p.new as LeadCrm) } : l)));
      if (p.eventType === "INSERT") setLeads((prev) => [p.new as LeadCrm, ...prev]);
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-dropdown-menu]") || target.closest("[data-dropdown-trigger]")) return;
      setOpenDropdown(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const closerName = (id: string | null) => closers.find((c) => c.id === id)?.nome || "—";
  const sdrName = (id: string | null) => sdrs.find((s) => s.id === id)?.nome || "—";
  const getField = (lead: LeadCrm, f: string) => (lead as unknown as Record<string, unknown>)[f];

  const updateLead = async (id: string, campo: string, valor: unknown) => {
    const old = leads.find((l) => l.id === id);
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));
    const { error } = await supabase.from("leads_crm").update({ [campo]: valor }).eq("id", id);
    if (error && old) { setLeads((prev) => prev.map((l) => (l.id === id ? old : l))); toast.error("Erro ao salvar"); }
  };

  const mudarEtapa = async (id: string, novaEtapa: string) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    const agora = new Date().toISOString();
    const df: Record<string, string> = { reuniao_agendada: "data_reuniao_agendada", proposta_enviada: "data_proposta_enviada", follow_up: "data_follow_up", assinatura_contrato: "data_assinatura", comprou: "data_comprou", desistiu: "data_desistiu" };
    const upd: Record<string, unknown> = { etapa: novaEtapa };
    if (df[novaEtapa]) upd[df[novaEtapa]] = agora;
    if (novaEtapa === "comprou") upd.data_venda = agora.split("T")[0];
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, etapa: novaEtapa as LeadCrm["etapa"] } : l)));
    await supabase.from("leads_crm").update(upd).eq("id", id);
    await supabase.from("leads_crm_historico").insert({ lead_id: id, etapa_anterior: lead.etapa, etapa_nova: novaEtapa });

    // Auto-criar contrato quando lead muda para "comprou"
    if (novaEtapa === "comprou" && lead.etapa !== "comprou") {
      const mesRef = lead.mes_referencia || getCurrentMonth();
      const { data: contrato } = await supabase.from("contratos").insert({
        mes_referencia: mesRef,
        closer_id: lead.closer_id || null,
        sdr_id: lead.sdr_id || null,
        cliente_nome: lead.nome || "Sem nome",
        origem_lead: lead.canal_aquisicao || lead.funil || "—",
        valor_entrada: Number(lead.valor_entrada) || 0,
        meses_contrato: Number(lead.fidelidade_meses) || 6,
        mrr: Number(lead.mensalidade) || 0,
        data_fechamento: agora.split("T")[0],
        obs: "",
      }).select("id").single();

      // Vincular contrato ao lead
      if (contrato?.id) {
        await supabase.from("leads_crm").update({ contrato_id: contrato.id }).eq("id", id);
        setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, contrato_id: contrato.id } : l)));
        toast.success("Contrato criado automaticamente!");
      }
    }
  };

  const addNovoLead = async () => {
    const mesRef = mes === "all" ? getCurrentMonth() : mes;
    const { data, error } = await supabase.from("leads_crm").insert({
      nome: "", etapa: (abaAtiva as string) || "oportunidade", mes_referencia: mesRef, ghl_contact_id: `manual-${Date.now()}`,
    }).select().single();
    if (error) { toast.error("Erro: " + error.message); return; }
    if (data) { setLeads((prev) => [data as LeadCrm, ...prev]); setEditingCell({ rowId: data.id, col: "nome" }); setTempValue(""); }
  };

  const deleteLead = async (id: string) => {
    if (!confirm("Excluir este lead?")) return;
    setLeads((prev) => prev.filter((l) => l.id !== id));
    await supabase.from("leads_crm").delete().eq("id", id);
    toast.success("Lead excluido");
  };

  const handleSave = async () => {
    if (!editingCell) return;
    const numCols = ["valor_entrada", "mensalidade", "fidelidade_meses", "valor_total_projeto", "faturamento"];
    const val = numCols.includes(editingCell.col) ? Number(tempValue) || 0 : tempValue || null;
    await updateLead(editingCell.rowId, editingCell.col, val);
    setEditingCell(null);
  };

  // Filter + Sort
  let filtered = leads;
  if (abaAtiva) filtered = filtered.filter((l) => l.etapa === abaAtiva);
  // Filtro de mês só para "Comprou"
  if (abaAtiva === "comprou" && mes !== "all") {
    filtered = filtered.filter((l) => {
      const dv = l.data_venda || l.mes_referencia;
      return dv?.startsWith(mes);
    });
  }
  if (busca) { const q = busca.toLowerCase(); filtered = filtered.filter((l) => l.nome?.toLowerCase().includes(q) || l.telefone?.includes(q) || l.email?.toLowerCase().includes(q)); }
  filtered = [...filtered].sort((a, b) => {
    const va = (a as unknown as Record<string, unknown>)[sortCol] ?? "";
    const vb = (b as unknown as Record<string, unknown>)[sortCol] ?? "";
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const toggleSort = (col: string) => { if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc")); else { setSortCol(col); setSortDir("asc"); } };
  const counts = ETAPAS.reduce<Record<string, number>>((acc, e) => { acc[e.key] = leads.filter((l) => l.etapa === e.key).length; return acc; }, {});

  const EditCell = ({ lead, col, type = "text" }: { lead: LeadCrm; col: string; type?: string }) => {
    const isEditing = editingCell?.rowId === lead.id && editingCell.col === col;
    const val = String(getField(lead, col) ?? "");
    if (isEditing) return (<input autoFocus type={type} value={tempValue} onChange={(e) => setTempValue(e.target.value)} onBlur={handleSave} onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditingCell(null); }} className="w-full bg-transparent border-none outline-none text-[13px]" />);
    return (<span onClick={() => { setEditingCell({ rowId: lead.id, col }); setTempValue(val === "0" && type === "number" ? "" : val); }} className="cursor-text hover:bg-muted/50 px-1 -mx-1 py-0.5 rounded truncate block">
      {["valor_entrada", "mensalidade", "valor_total_projeto", "faturamento"].includes(col) ? (Number(val) > 0 ? formatCurrency(Number(val)) : "—") : val || "—"}
    </span>);
  };

  const DropCell = ({ lead, col, options, display }: { lead: LeadCrm; col: string; options: { value: string; label: string; color?: string }[]; display: string }) => {
    const isOpen = openDropdown?.rowId === lead.id && openDropdown.col === col;
    return (<div className="relative">
      <button onClick={(e) => { e.stopPropagation(); setOpenDropdown(isOpen ? null : { rowId: lead.id, col }); }} className="text-xs hover:bg-muted/50 px-1 -mx-1 py-0.5 rounded cursor-pointer truncate">{display}</button>
      {isOpen && (<div onClick={(e) => e.stopPropagation()} className="absolute top-full left-0 z-50 mt-1 bg-card border rounded-lg p-1 min-w-[160px] shadow-lg max-h-[200px] overflow-y-auto">
        {options.map((o) => (<button key={o.value} onClick={() => { updateLead(lead.id, col, o.value); setOpenDropdown(null); }} className="w-full text-left px-3 py-1.5 rounded text-xs flex items-center gap-2 hover:bg-muted transition-colors">
          {o.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: o.color }} />}{o.label}
        </button>))}
      </div>)}
    </div>);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">CRM de Leads</h1>
        {abaAtiva === "comprou" && (
          <select value={mes} onChange={(e) => setMes(e.target.value)} className="text-sm border rounded-lg px-3 py-2 bg-transparent">
            <option value="all">Todos os meses</option>
            {["2026-04", "2026-03", "2026-02", "2026-01", "2025-12", "2025-11", "2025-10", "2025-09"].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
      </div>

      {/* Abas */}
      <div className="flex flex-wrap gap-1">
        {ABAS.map((aba) => {
          const isActive = abaAtiva === aba.etapa;
          const count = aba.etapa ? counts[aba.etapa] || 0 : leads.length;
          return (<button key={aba.label} onClick={() => setAbaAtiva(aba.etapa)} className={`px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 transition-colors ${isActive ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}>
            {aba.label}<span className="text-[10px] bg-muted-foreground/10 px-1.5 py-0.5 rounded-full">{count}</span>
          </button>);
        })}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, telefone ou email..." className="w-full pl-9 pr-4 py-2 text-sm bg-transparent border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>

      {/* Tabela */}
      <div className="border rounded-lg overflow-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b">
              <th className="w-8 px-2 py-2" />
              {[
                { key: "nome", label: "Nome", w: "min-w-[160px]" },
                { key: "etapa", label: "Etapa", w: "min-w-[130px]" },
                { key: "closer_id", label: "Closer", w: "min-w-[90px]" },
                { key: "sdr_id", label: "SDR", w: "min-w-[90px]" },
                { key: "funil", label: "Funil", w: "min-w-[120px]" },
                { key: "origem_utm", label: "Origem", w: "min-w-[100px]" },
                { key: "canal_aquisicao", label: "Canal", w: "min-w-[110px]" },
                { key: "valor_entrada", label: "Entrada", w: "min-w-[90px]" },
                { key: "mensalidade", label: "Mensal.", w: "min-w-[90px]" },
                { key: "fidelidade_meses", label: "Fidel.", w: "min-w-[60px]" },
                { key: "valor_total_projeto", label: "Total", w: "min-w-[100px]" },
                { key: "data_venda", label: "Dt Venda", w: "min-w-[90px]" },
                { key: "preenchido_em", label: "Criado em", w: "min-w-[90px]" },
              ].map((col) => (
                <th key={col.key} onClick={() => toggleSort(col.key)} className={`${col.w} px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground hover:bg-muted/50 whitespace-nowrap`}>
                  <span className="flex items-center gap-1">{col.label}{sortCol === col.key && <ArrowUpDown size={9} />}</span>
                </th>
              ))}
              <th className="w-8 px-1 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead) => {
              const cfg = etapaCfg(lead.etapa);
              const isExp = expandedRow === lead.id;
              return (
                <Fragment key={lead.id}>
                  <tr className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-2 py-2">
                      <button onClick={() => setExpandedRow(isExp ? null : lead.id)} className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground">
                        {isExp ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </button>
                    </td>
                    <td className="px-2 py-2 font-medium"><EditCell lead={lead} col="nome" /></td>
                    <td className="px-2 py-2 relative">
                      <button
                        data-dropdown-trigger
                        onClick={() => {
                          const isOpen = openDropdown?.rowId === lead.id && openDropdown.col === "etapa";
                          setOpenDropdown(isOpen ? null : { rowId: lead.id, col: "etapa" });
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap cursor-pointer hover:opacity-80"
                        style={{ background: cfg.color + "18", color: cfg.color }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />{cfg.label}
                      </button>
                      {openDropdown?.rowId === lead.id && openDropdown.col === "etapa" && (
                        <div data-dropdown-menu className="absolute top-full left-2 z-50 mt-1 bg-card border rounded-lg p-1 min-w-[170px] shadow-lg max-h-[300px] overflow-y-auto">
                          {ETAPAS.map((e) => (<button key={e.key} onClick={() => { mudarEtapa(lead.id, e.key); setOpenDropdown(null); }} className="w-full text-left px-3 py-1.5 rounded text-xs flex items-center gap-2 hover:bg-muted transition-colors">
                            <span className="w-2 h-2 rounded-full" style={{ background: e.color }} />{e.label}
                          </button>))}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2"><DropCell lead={lead} col="closer_id" options={closers.map((c) => ({ value: c.id, label: c.nome }))} display={closerName(lead.closer_id)} /></td>
                    <td className="px-2 py-2"><DropCell lead={lead} col="sdr_id" options={sdrs.map((s) => ({ value: s.id, label: s.nome }))} display={sdrName(lead.sdr_id)} /></td>
                    <td className="px-2 py-2"><DropCell lead={lead} col="funil" options={FUNIL_OPTIONS.map((f) => ({ value: f, label: f }))} display={String(getField(lead, "funil") || "—")} /></td>
                    <td className="px-2 py-2"><DropCell lead={lead} col="origem_utm" options={ORIGEM_OPTIONS.map((o) => ({ value: o, label: o }))} display={String(getField(lead, "origem_utm") || "—")} /></td>
                    <td className="px-2 py-2"><DropCell lead={lead} col="canal_aquisicao" options={CANAIS.map((c) => ({ value: c, label: c }))} display={lead.canal_aquisicao || "—"} /></td>
                    <td className="px-2 py-2 text-xs"><EditCell lead={lead} col="valor_entrada" type="number" /></td>
                    <td className="px-2 py-2 text-xs"><EditCell lead={lead} col="mensalidade" type="number" /></td>
                    <td className="px-2 py-2 text-xs"><EditCell lead={lead} col="fidelidade_meses" type="number" /></td>
                    <td className="px-2 py-2 text-xs"><EditCell lead={lead} col="valor_total_projeto" type="number" /></td>
                    <td className="px-2 py-2 text-xs"><EditCell lead={lead} col="data_venda" type="date" /></td>
                    <td className="px-2 py-2 text-xs text-muted-foreground">
                      {lead.preenchido_em ? new Date(lead.preenchido_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—"}
                    </td>
                    <td className="px-1 py-2"><button onClick={() => deleteLead(lead.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button></td>
                  </tr>

                  {isExp && (
                    <tr className="bg-muted/30">
                      <td colSpan={15} className="px-10 py-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-xs">
                          <div><span className="text-muted-foreground">Telefone:</span> <EditCell lead={lead} col="telefone" /></div>
                          <div><span className="text-muted-foreground">Email:</span> <EditCell lead={lead} col="email" /></div>
                          <div><span className="text-muted-foreground">Instagram:</span> <EditCell lead={lead} col="instagram" /></div>
                          <div><span className="text-muted-foreground">Site:</span> <EditCell lead={lead} col="site" /></div>
                          <div><span className="text-muted-foreground">Area:</span> <EditCell lead={lead} col="area_atuacao" /></div>
                          <div><span className="text-muted-foreground">Faturamento:</span> <EditCell lead={lead} col="faturamento" type="number" /></div>
                          <div><span className="text-muted-foreground">Ad ID:</span> <span className="font-mono">{lead.ad_id || "—"}</span></div>
                          <div><span className="text-muted-foreground">Lead ID:</span> <span className="font-mono">{String(getField(lead, "lead_id") || "—")}</span></div>
                          <div><span className="text-muted-foreground">Link proposta:</span> <EditCell lead={lead} col="link_proposta" /></div>
                          <div><span className="text-muted-foreground">Qualidade:</span> <span>{String(getField(lead, "qualidade_lead") || "—")}</span></div>
                          <div><span className="text-muted-foreground">1o Follow up:</span> <EditCell lead={lead} col="follow_up_1" type="date" /></div>
                          <div><span className="text-muted-foreground">2o Follow up:</span> <EditCell lead={lead} col="follow_up_2" type="date" /></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {[
                            { key: "pontos_positivos", label: "PONTOS POSITIVOS", ph: "O que o lead gostou..." },
                            { key: "objecoes", label: "OBJEÇÕES", ph: "Preço, timing..." },
                            { key: "resumo_reuniao", label: "RESUMO GERAL", ph: "Como foi a reunião..." },
                            { key: "proximo_passo", label: "PRÓXIMO PASSO", ph: "O que foi combinado..." },
                          ].map((f) => (
                            <div key={f.key}>
                              <div className="text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">{f.label}</div>
                              <textarea defaultValue={String(getField(lead, f.key) || "")} onBlur={(e) => updateLead(lead.id, f.key, e.target.value || null)} placeholder={f.ph}
                                className="w-full min-h-[60px] resize-y border rounded-md p-2 text-[13px] bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                            </div>
                          ))}
                        </div>
                        {lead.etapa === "desistiu" && (
                          <div className="mt-3">
                            <div className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">MOTIVO DA DESISTENCIA</div>
                            <div className="flex flex-wrap gap-1.5">
                              {MOTIVOS.map((m) => (<button key={m} onClick={() => updateLead(lead.id, "motivo_desistencia", m)}
                                className={`px-3 py-1 rounded-full text-xs border transition-colors ${lead.motivo_desistencia === m ? "bg-red-500/10 border-red-500/30 text-red-500 font-medium" : "border-border text-muted-foreground hover:bg-muted"}`}>{m}</button>))}
                            </div>
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
                          <span>Criado em: <strong>{lead.preenchido_em ? new Date(lead.preenchido_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}</strong></span>
                          <span>GHL: {lead.ghl_contact_id || "—"}</span>
                          <span>Notion: {String(getField(lead, "notion_page_id") || "—")}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            <tr className="hover:bg-muted/30 cursor-pointer transition-colors" onClick={addNovoLead}>
              <td colSpan={15} className="px-3 py-2.5 text-muted-foreground text-[13px]"><span className="flex items-center gap-1.5"><Plus size={14} /> Novo lead</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex flex-wrap gap-4 p-3 bg-muted/50 rounded-lg text-sm">
        <div className="flex flex-col"><span className="text-[10px] text-muted-foreground uppercase">Leads</span><span className="font-bold">{filtered.length}</span></div>
        <div className="flex flex-col"><span className="text-[10px] text-muted-foreground uppercase">Soma Entrada</span><span className="font-bold text-green-500">{formatCurrency(filtered.reduce((s, l) => s + Number(l.valor_entrada || 0), 0))}</span></div>
        <div className="flex flex-col"><span className="text-[10px] text-muted-foreground uppercase">Media Mensalidade</span><span className="font-bold">{formatCurrency(filtered.length > 0 ? filtered.reduce((s, l) => s + Number(l.mensalidade || 0), 0) / filtered.length : 0)}</span></div>
        <div className="flex flex-col"><span className="text-[10px] text-muted-foreground uppercase">Soma Total Projetos</span><span className="font-bold text-green-500">{formatCurrency(filtered.reduce((s, l) => s + Number(l.valor_total_projeto || 0), 0))}</span></div>
      </div>
    </div>
  );
}
