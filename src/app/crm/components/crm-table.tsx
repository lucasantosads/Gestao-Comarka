"use client";

import { Fragment, useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, ArrowUpDown } from "lucide-react";
import type { LeadCrm, Closer, Sdr } from "@/types/database";
import { formatCurrency } from "@/lib/format";
import Link from "next/link";
import { mutate } from "swr";

const ETAPAS = [
    { key: "oportunidade", label: "Oportunidade", colorClass: "text-muted-foreground bg-muted/50", dot: "bg-muted-foreground" },
    { key: "reuniao_agendada", label: "Reunião Agendada", colorClass: "text-blue-400 bg-blue-500/10", dot: "bg-blue-400" },
    { key: "proposta_enviada", label: "Proposta Enviada", colorClass: "text-primary bg-primary/10", dot: "bg-primary" },
    { key: "follow_up", label: "Follow Up", colorClass: "text-orange-400 bg-orange-500/10", dot: "bg-orange-400" },
    { key: "assinatura_contrato", label: "Assinatura", colorClass: "text-amber-400 bg-amber-500/10", dot: "bg-amber-400" },
    { key: "comprou", label: "Comprou", colorClass: "text-emerald-400 bg-emerald-500/10", dot: "bg-emerald-400" },
    { key: "desistiu", label: "Desistiu", colorClass: "text-muted-foreground bg-background border border-border", dot: "bg-muted-foreground" },
    { key: "frio", label: "Frio", colorClass: "text-slate-400 bg-slate-500/10", dot: "bg-slate-400" },
];

export const ALL_COLUMNS: { key: string; label: string; w: string; title?: string }[] = [
    { key: "nome", label: "Nome", w: "min-w-[160px]" },
    { key: "etapa", label: "Etapa", w: "min-w-[130px]" },
    { key: "_tempo", label: "Na etapa há", w: "min-w-[80px]" },
    { key: "_score", label: "Score", w: "min-w-[50px]" },
    { key: "closer_id", label: "Closer", w: "min-w-[100px]" },
    { key: "sdr_id", label: "SDR", w: "min-w-[100px]" },
    { key: "funil", label: "Funil", w: "min-w-[120px]" },
    { key: "origem_utm", label: "Origem", w: "min-w-[100px]" },
    { key: "canal_aquisicao", label: "Canal", w: "min-w-[110px]" },
    { key: "valor_entrada", label: "Entrada", w: "min-w-[90px]" },
    { key: "mensalidade", label: "Mensal.", w: "min-w-[90px]" },
    { key: "fidelidade_meses", label: "Fidel.", w: "min-w-[60px]" },
    { key: "valor_total_projeto", label: "Total", w: "min-w-[100px]" },
    { key: "data_venda", label: "Dt Venda", w: "min-w-[90px]" },
    { key: "preenchido_em", label: "Criado em", w: "min-w-[90px]" },
];

const FUNIL_OPTIONS = ["Sessao Estrategica", "Social Selling", "Webinar", "Aplicacao", "Evento", "Indicacao", "Isca", "Formulario", "Trafego pago"];
const ORIGEM_OPTIONS = ["facebookads", "instagram", "googleads", "whatsapp", "email", "organic", "Lista", "Prospec. Ativa"];
const MOTIVOS = ["Clausulas do contrato", "Segmento que nao atendemos", "Nao temos o servico", "Tirar duvidas apenas", "Falta de retorno do lead", "Ira reavaliar em outra oportunidade", "Optou por concorrente", "Mudou o projeto", "Outro"];
export const CANAIS = ["Trafego Pago", "Organico", "Social Selling", "Indicacao", "Workshop"];

function tempoNaEtapa(lead: LeadCrm): { label: string; days: number; color: string } {
    const ref = lead.updated_at || lead.created_at || lead.preenchido_em;
    if (!ref) return { label: "—", days: 0, color: "" };
    const days = Math.floor((Date.now() - new Date(ref).getTime()) / 86400000);
    if (days >= 30) return { label: `${Math.floor(days / 30)} mês${days >= 60 ? "es" : ""}`, days, color: "text-red-400" };
    if (days >= 14) return { label: `${Math.floor(days / 7)} sem.`, days, color: "text-red-400" };
    if (days >= 7) return { label: `${days} dias`, days, color: "text-yellow-400" };
    return { label: days === 0 ? "hoje" : `${days} dia${days > 1 ? "s" : ""}`, days, color: "text-muted-foreground" };
}

export function leadScore(lead: LeadCrm): { score: number; badge: string } {
    let score = 0;
    if (lead.area_atuacao) score += 20;
    if (lead.telefone) score += 15;
    if (lead.email) score += 10;
    if (lead.faturamento && Number(lead.faturamento) > 0) score += 15;
    if (lead.mensalidade && Number(lead.mensalidade) > 0) score += 15;
    if (lead.canal_aquisicao) score += 5;
    if (lead.funil) score += 5;
    if (lead.ad_id) score += 5;
    if (lead.closer_id) score += 5;
    if (lead.site || lead.instagram) score += 5;
    return { score: Math.min(score, 100), badge: score >= 70 ? "🔥" : score >= 40 ? "⚡" : "" };
}

interface CrmTableProps {
    filtered: LeadCrm[];
    visibleCount: number;
    visibleCols: Set<string>;
    sortCol: string;
    toggleSort: (col: string) => void;
    updateLead: (id: string, campo: keyof LeadCrm, valor: any) => Promise<void>;
    mudarEtapa: (id: string, novaEtapa: string) => Promise<void>;
    deleteLead: (id: string) => Promise<void>;
    addNovoLead: () => void;
    closers: Closer[];
    sdrs: Sdr[];
}

export function CrmTable({
    filtered, visibleCount, visibleCols, sortCol, toggleSort,
    updateLead, mudarEtapa, deleteLead, addNovoLead, closers, sdrs
}: CrmTableProps) {
    const [editingCell, setEditingCell] = useState<{ rowId: string; col: string } | null>(null);
    const [tempValue, setTempValue] = useState("");
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [openDropdown, setOpenDropdown] = useState<{ rowId: string; col: string } | null>(null);

    useEffect(() => {
        const h = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest("[data-dropdown-menu]") || target.closest("[data-dropdown-trigger]")) return;
            setOpenDropdown(null);
        };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const getField = (lead: LeadCrm, f: string) => (lead as unknown as Record<string, unknown>)[f];

    const handleSave = async () => {
        if (!editingCell) return;
        const numCols = ["valor_entrada", "mensalidade", "fidelidade_meses", "valor_total_projeto", "faturamento"];
        const val = numCols.includes(editingCell.col) ? Number(tempValue) || 0 : tempValue || null;
        await updateLead(editingCell.rowId, editingCell.col as keyof LeadCrm, val);
        setEditingCell(null);
    };

    const EditCell = ({ lead, col, type = "text" }: { lead: LeadCrm; col: string; type?: string }) => {
        const isEditing = editingCell?.rowId === lead.id && editingCell.col === col;
        const val = String(getField(lead, col) ?? "");
        if (isEditing) return (<input autoFocus type={type} value={tempValue} onChange={(e) => setTempValue(e.target.value)} onBlur={handleSave} onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditingCell(null); }} className="w-full bg-transparent border-none outline-none text-[13px] ring-1 ring-primary/50 px-1 rounded" />);
        return (<span onClick={() => { setEditingCell({ rowId: lead.id, col }); setTempValue(val === "0" && type === "number" ? "" : val); }} className="cursor-text group-hover:bg-muted/50 px-1 -mx-1 py-0.5 rounded truncate block transition-colors">
            {["valor_entrada", "mensalidade", "valor_total_projeto", "faturamento"].includes(col) ? (Number(val) > 0 ? formatCurrency(Number(val)) : "—") : val || "—"}
        </span>);
    };

    const DropCell = ({ lead, col, options, display }: { lead: LeadCrm; col: string; options: { value: string; label: string; color?: string }[]; display: string }) => {
        const isOpen = openDropdown?.rowId === lead.id && openDropdown.col === col;
        return (<div className="relative">
            <button data-dropdown-trigger onClick={(e) => { e.stopPropagation(); setOpenDropdown(isOpen ? null : { rowId: lead.id, col }); }} className="text-xs group-hover:bg-muted/50 px-2 -mx-2 py-0.5 rounded cursor-pointer truncate transition-colors flex items-center justify-between gap-1 w-full text-left">
                {display} <ChevronDown size={10} className="opacity-0 group-hover:opacity-50" />
            </button>
            {isOpen && (<div data-dropdown-menu onClick={(e) => e.stopPropagation()} className="absolute top-full left-0 z-50 mt-1 bg-card border rounded-lg p-1 min-w-[160px] shadow-xl max-h-[220px] overflow-y-auto animate-in fade-in slide-in-from-top-2">
                {options.map((o) => (<button key={o.value} onClick={() => { updateLead(lead.id, col as keyof LeadCrm, o.value); setOpenDropdown(null); }} className="w-full text-left px-3 py-2 rounded text-xs flex items-center gap-2 hover:bg-muted font-medium transition-colors">
                    {o.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: o.color }} />}{o.label}
                </button>))}
            </div>)}
        </div>);
    };

    const closerName = (id: string | null) => closers.find((c) => c.id === id)?.nome || "—";
    const sdrName = (id: string | null) => sdrs.find((s) => s.id === id)?.nome || "—";

    return (
        <div className="border rounded-xl bg-card overflow-x-auto shadow-sm">
            <table className="w-full text-[13px] border-collapse">
                <thead>
                    <tr className="border-b bg-muted/20">
                        <th className="w-8 px-3 py-3" />
                        {ALL_COLUMNS.filter((col) => visibleCols.has(col.key)).map((col) => (
                            <th key={col.key} onClick={() => toggleSort(col.key)} title={col.title} className={`${col.w} px-3 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer select-none hover:text-foreground hover:bg-muted/50 transition-colors whitespace-nowrap group`}>
                                <span className="flex items-center gap-1">{col.label} <ArrowUpDown size={10} className={`opacity-0 group-hover:opacity-100 transition-opacity ${sortCol === col.key ? 'opacity-100 text-primary' : ''}`} /></span>
                            </th>
                        ))}
                        <th className="w-8 px-2 py-3" />
                    </tr>
                </thead>
                <tbody>
                    {filtered.slice(0, visibleCount).map((lead) => {
                        const isExp = expandedRow === lead.id;
                        const cfg = ETAPAS.find(e => e.key === lead.etapa) || ETAPAS[0];
                        return (
                            <Fragment key={lead.id}>
                                <tr className={`border-b border-border/40 hover:bg-muted/20 transition-all group ${isExp ? 'bg-muted/10' : ''}`}>
                                    <td className="px-3 py-2.5">
                                        <button onClick={() => setExpandedRow(isExp ? null : lead.id)} className={`w-6 h-6 rounded flex items-center justify-center text-muted-foreground/50 hover:bg-background hover:text-foreground hover:shadow-sm border border-transparent hover:border-border transition-all ${isExp ? "rotate-90 bg-background shadow-sm border-border text-foreground" : ""}`}>
                                            <ChevronRight size={14} />
                                        </button>
                                    </td>
                                    {visibleCols.has("nome") && <td className="px-3 py-2.5 font-medium"><EditCell lead={lead} col="nome" /></td>}
                                    {visibleCols.has("etapa") && <td className="px-3 py-2.5 relative">
                                        <button
                                            data-dropdown-trigger
                                            onClick={() => { const isOpen = openDropdown?.rowId === lead.id && openDropdown.col === "etapa"; setOpenDropdown(isOpen ? null : { rowId: lead.id, col: "etapa" }); }}
                                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap cursor-pointer hover:opacity-80 transition-all border border-transparent hover:border-border/50 ${cfg.colorClass}`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
                                        </button>
                                        {openDropdown?.rowId === lead.id && openDropdown.col === "etapa" && (
                                            <div data-dropdown-menu className="absolute top-1/2 left-2 z-[60] mt-2 bg-card/95 backdrop-blur border border-border rounded-lg p-1.5 min-w-[180px] shadow-2xl animate-in fade-in zoom-in-95">
                                                <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Mover para</div>
                                                {ETAPAS.map((e) => (<button key={e.key} onClick={() => { mudarEtapa(lead.id, e.key); setOpenDropdown(null); }} className={`w-full text-left px-3 py-2 rounded-md text-xs flex items-center gap-2 hover:bg-muted/80 font-medium transition-colors ${e.key === lead.etapa ? "bg-muted pointer-events-none" : ""}`}>
                                                    <span className={`w-2 h-2 rounded-full ${e.dot}`} />{e.label}
                                                </button>))}
                                            </div>
                                        )}
                                    </td>}
                                    {visibleCols.has("_tempo") && <td className="px-3 py-2.5 text-xs">
                                        {(() => { const t = tempoNaEtapa(lead); return <span className={`font-medium ${t.color}`}>{t.label}</span>; })()}
                                    </td>}
                                    {visibleCols.has("_score") && <td className="px-3 py-2.5 text-xs">
                                        {(() => { const s = leadScore(lead); return <span className="font-mono bg-muted/50 px-1.5 py-0.5 rounded tracking-tighter text-[11px]">{s.badge && <span className="mr-0.5">{s.badge}</span>}{s.score}</span>; })()}
                                    </td>}
                                    {visibleCols.has("closer_id") && <td className="px-3 py-2.5">
                                        {/* Deep-link Closer! */}
                                        <div className="flex items-center justify-between">
                                            <DropCell lead={lead} col="closer_id" options={closers.map((c) => ({ value: c.id, label: c.nome }))} display={closerName(lead.closer_id)} />
                                            {lead.closer_id && <Link href={`/dashboard/closers/${lead.closer_id}`} className="opacity-0 group-hover:opacity-100 text-primary hover:underline text-[9px] ml-1 transition-opacity">TV</Link>}
                                        </div>
                                    </td>}
                                    {visibleCols.has("sdr_id") && <td className="px-3 py-2.5"><DropCell lead={lead} col="sdr_id" options={sdrs.map((s) => ({ value: s.id, label: s.nome }))} display={sdrName(lead.sdr_id)} /></td>}
                                    {visibleCols.has("funil") && <td className="px-3 py-2.5"><DropCell lead={lead} col="funil" options={FUNIL_OPTIONS.map((f) => ({ value: f, label: f }))} display={String(getField(lead, "funil") || "—")} /></td>}
                                    {visibleCols.has("origem_utm") && <td className="px-3 py-2.5"><DropCell lead={lead} col="origem_utm" options={ORIGEM_OPTIONS.map((o) => ({ value: o, label: o }))} display={String(getField(lead, "origem_utm") || "—")} /></td>}
                                    {visibleCols.has("canal_aquisicao") && <td className="px-3 py-2.5"><DropCell lead={lead} col="canal_aquisicao" options={CANAIS.map((c) => ({ value: c, label: c }))} display={lead.canal_aquisicao || "—"} /></td>}
                                    {visibleCols.has("valor_entrada") && <td className="px-3 py-2.5 text-xs font-mono"><EditCell lead={lead} col="valor_entrada" type="number" /></td>}
                                    {visibleCols.has("mensalidade") && <td className="px-3 py-2.5 text-xs font-mono"><EditCell lead={lead} col="mensalidade" type="number" /></td>}
                                    {visibleCols.has("fidelidade_meses") && <td className="px-3 py-2.5 text-xs font-mono"><EditCell lead={lead} col="fidelidade_meses" type="number" /></td>}
                                    {visibleCols.has("valor_total_projeto") && <td className="px-3 py-2.5 text-xs font-mono"><EditCell lead={lead} col="valor_total_projeto" type="number" /></td>}
                                    {visibleCols.has("data_venda") && <td className="px-3 py-2.5 text-xs"><EditCell lead={lead} col="data_venda" type="date" /></td>}
                                    {visibleCols.has("preenchido_em") && <td className="px-3 py-2.5 text-xs text-muted-foreground">
                                        {lead.preenchido_em ? new Date(lead.preenchido_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—"}
                                    </td>}
                                    <td className="px-2 py-2.5">
                                        <button onClick={() => deleteLead(lead.id)} className="w-6 h-6 flex items-center justify-center text-muted-foreground/30 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors opacity-0 group-hover:opacity-100">
                                            <Trash2 size={12} />
                                        </button>
                                    </td>
                                </tr>

                                {isExp && (
                                    <tr className="bg-muted/10 border-b border-border/40 shadow-inner">
                                        <td colSpan={visibleCols.size + 2} className="px-10 py-5">
                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 mb-5 text-[13px] bg-background/50 p-4 rounded-lg border border-border/50">
                                                <div className="flex flex-col gap-0.5"><span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Telefone</span> <EditCell lead={lead} col="telefone" /></div>
                                                <div className="flex flex-col gap-0.5"><span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Email</span> <EditCell lead={lead} col="email" /></div>
                                                <div className="flex flex-col gap-0.5"><span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Instagram</span> <EditCell lead={lead} col="instagram" /></div>
                                                <div className="flex flex-col gap-0.5"><span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Site</span> <EditCell lead={lead} col="site" /></div>
                                                <div className="flex flex-col gap-0.5"><span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Area</span> <EditCell lead={lead} col="area_atuacao" /></div>
                                                <div className="flex flex-col gap-0.5"><span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Faturamento</span> <EditCell lead={lead} col="faturamento" type="number" /></div>

                                                {/* Deep-linking Tráfego Ads */}
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ad ID Base</span>
                                                    {lead.ad_id ? (
                                                        <Link href={`/trafego/campanhas`} className="font-mono text-primary hover:underline hover:text-primary transition-colors flex items-center gap-1">{lead.ad_id}</Link>
                                                    ) : <span className="font-mono text-muted-foreground/50">—</span>}
                                                </div>

                                                <div className="flex flex-col gap-0.5"><span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Link proposta</span> <EditCell lead={lead} col="link_proposta" /></div>
                                                <div className="flex flex-col gap-0.5"><span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Qualidade</span> <span>{String(getField(lead, "qualidade_lead") || "—")}</span></div>
                                                <div className="flex flex-col gap-0.5"><span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">1o Follow up</span> <EditCell lead={lead} col="follow_up_1" type="date" /></div>
                                                <div className="flex flex-col gap-0.5"><span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">2o Follow up</span> <EditCell lead={lead} col="follow_up_2" type="date" /></div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {[
                                                    { key: "pontos_positivos", label: "PONTOS POSITIVOS", ph: "O que o lead gostou..." },
                                                    { key: "objecoes", label: "OBJEÇÕES", ph: "Preço, timing..." },
                                                    { key: "resumo_reuniao", label: "RESUMO GERAL", ph: "Como foi a reunião..." },
                                                    { key: "proximo_passo", label: "PRÓXIMO PASSO", ph: "O que foi combinado..." },
                                                ].map((f) => (
                                                    <div key={f.key} className="flex flex-col gap-1.5">
                                                        <div className="text-[10px] font-bold text-muted-foreground flex items-center gap-2 uppercase tracking-widest"><span className="w-1.5 h-1.5 rounded-full bg-border" />{f.label}</div>
                                                        <textarea defaultValue={String(getField(lead, f.key) || "")} onBlur={(e) => updateLead(lead.id, f.key as keyof LeadCrm, e.target.value || null)} placeholder={f.ph}
                                                            className="w-full min-h-[60px] resize-y border border-border/50 rounded-lg p-3 text-[13px] bg-background shadow-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all hover:bg-card" />
                                                    </div>
                                                ))}
                                            </div>
                                            {lead.etapa === "desistiu" && (
                                                <div className="mt-5 p-4 rounded-lg bg-muted/20 border border-border/40">
                                                    <div className="text-[10px] font-bold text-muted-foreground mb-3 uppercase tracking-widest flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-border" />MOTIVO DA DESISTÊNCIA</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {MOTIVOS.map((m) => (<button key={m} onClick={() => updateLead(lead.id, "motivo_desistencia", m)}
                                                            className={`px-3 py-1.5 rounded-full text-[11px] border transition-all font-medium ${lead.motivo_desistencia === m ? "bg-primary border-primary text-primary-foreground shadow-sm shadow-primary/20" : "border-border text-muted-foreground hover:bg-background hover:text-foreground hover:border-muted-foreground/30"}`}>{m}</button>))}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-muted-foreground/60 border-t border-border/40 pt-4">
                                                <span>Criado em: <strong className="text-muted-foreground">{lead.preenchido_em ? new Date(lead.preenchido_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</strong></span>
                                                <div className="w-px h-3 bg-border/50" />
                                                <span>GHL Sync_ID: <span className="font-mono text-muted-foreground">{lead.ghl_contact_id || "—"}</span></span>
                                                <div className="w-px h-3 bg-border/50" />
                                                <span>Notion_ID: <span className="font-mono text-muted-foreground">{String(getField(lead, "notion_page_id") || "—")}</span></span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        );
                    })}

                    <tr className="hover:bg-muted/30 cursor-pointer transition-colors border-t border-border/50" onClick={addNovoLead}>
                        <td colSpan={visibleCols.size + 2} className="px-4 py-3 min-h-[44px]">
                            <div className="flex items-center gap-2 text-primary font-medium text-[13px] opacity-80 hover:opacity-100">
                                <div className="w-5 h-5 rounded flex items-center justify-center bg-primary/10"><Plus size={12} /></div>
                                Adicionar Lead à tabela (Manual)
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
