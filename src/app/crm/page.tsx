"use client";

import { useState, useMemo, useEffect } from "react";
import { formatCurrency, getCurrentMonth } from "@/lib/format";
import { SyncButton } from "@/components/sync-button";
import { useCrmData } from "@/hooks/use-crm-data";
import { useDebounce } from "@/hooks/use-debounce";
import { CrmFilters } from "./components/crm-filters";
import { CrmTable, ALL_COLUMNS, CANAIS, leadScore } from "./components/crm-table";
import { NovoLeadDialog } from "@/components/novo-lead-dialog";

const ETAPAS = [
  { key: "oportunidade", label: "Oportunidade" },
  { key: "reuniao_agendada", label: "Reunião Agendada" },
  { key: "proposta_enviada", label: "Proposta Enviada" },
  { key: "follow_up", label: "Follow Up" },
  { key: "assinatura_contrato", label: "Assinatura" },
  { key: "comprou", label: "Comprou" },
  { key: "desistiu", label: "Desistiu" },
  { key: "frio", label: "Frio" },
] as const;

const DIAS_INATIVO_LIMITE = 30;
const ABAS = [{ label: "Todos", etapa: null }, ...ETAPAS.map(e => ({ label: e.label, etapa: e.key }))];

function tempoNaEtapa(lead: any): { label: string; days: number; color: string } {
  const ref = lead.updated_at || lead.created_at || lead.preenchido_em;
  if (!ref) return { label: "—", days: 0, color: "" };
  const days = Math.floor((Date.now() - new Date(ref).getTime()) / 86400000);
  if (days >= 30) return { label: `${Math.floor(days / 30)} mês${days >= 60 ? "es" : ""}`, days, color: "text-red-400" };
  if (days >= 14) return { label: `${Math.floor(days / 7)} sem.`, days, color: "text-red-400" };
  if (days >= 7) return { label: `${days} dias`, days, color: "text-yellow-400" };
  return { label: days === 0 ? "hoje" : `${days} dia${days > 1 ? "s" : ""}`, days, color: "text-muted-foreground" };
}

export default function CrmPage() {
  const [mes, setMes] = useState(getCurrentMonth());
  const { leads, closers, sdrs, contratosMap, loading, mutate, updateLead, mudarEtapa, addNovoLead, deleteLead, loadMore, hasMore, totalCount, loadingMore } = useCrmData();

  const [abaAtiva, setAbaAtiva] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const debouncedBusca = useDebounce(busca, 600); // 600ms debounce map on CPU

  const [closerFiltro, setCloserFiltro] = useState<string>(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("crm_closer_filter") || "todos";
    return "todos";
  });
  const [sortCol, setSortCol] = useState("_tempo");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [showNovoLeadDialog, setShowNovoLeadDialog] = useState(false);
  const [showColDropdown, setShowColDropdown] = useState(false);
  const [showAdvFilters, setShowAdvFilters] = useState(false);
  const [filtroCanal, setFiltroCanal] = useState("todos");
  const [filtroScoreRange, setFiltroScoreRange] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("crm_visible_cols");
        if (saved) return new Set(JSON.parse(saved));
      } catch { }
    }
    return new Set(ALL_COLUMNS.map((c: any) => c.key));
  });

  useEffect(() => {
    if (leads.length === 0) return;
    if (typeof window !== "undefined" && localStorage.getItem("crm_visible_cols")) return;
    const threshold = 0.7;
    const sparseKeys = ["funil", "origem_utm", "canal_aquisicao", "valor_entrada", "mensalidade", "fidelidade_meses", "valor_total_projeto", "data_venda", "sdr_id"];
    const toHide = sparseKeys.filter((key) => {
      const emptyCount = leads.filter((l: any) => {
        const v = l[key];
        return !v || v === "—" || v === "" || v === 0 || v === "0" || v === null;
      }).length;
      return emptyCount / leads.length > threshold;
    });
    if (toHide.length > 0) {
      setVisibleCols((prev) => {
        const next = new Set(prev);
        toHide.forEach((k) => next.delete(k));
        localStorage.setItem("crm_visible_cols", JSON.stringify(Array.from(next)));
        return next;
      });
    }
  }, [leads]);

  const toggleCol = (key: string) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      localStorage.setItem("crm_visible_cols", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const toggleSort = (col: string) => { if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc")); else { setSortCol(col); setSortDir("asc"); } };

  // Advanced algorithmic optimizations through Heavy Memoization
  const { filtered, kpiLeadsAtivos, kpiTaxaConversao, kpiTicketMedio, kpiTempoMedioFunil, leadsInativos, counts, kpiTotalMrr, kpiTotalLtv, kpiTicketMedioContrato } = useMemo(() => {
    let f = leads;
    if (abaAtiva) f = f.filter((l) => l.etapa === abaAtiva);
    if (closerFiltro !== "todos") f = f.filter((l) => closerFiltro === "sem" ? !l.closer_id : l.closer_id === closerFiltro);
    if (abaAtiva === "comprou" && mes !== "all") {
      f = f.filter((l) => { const dv = l.data_venda || l.mes_referencia; return dv?.startsWith(mes); });
    }
    if (debouncedBusca) {
      const q = debouncedBusca.toLowerCase();
      f = f.filter((l) => l.nome?.toLowerCase().includes(q) || l.telefone?.includes(q) || l.email?.toLowerCase().includes(q));
    }
    if (filtroCanal !== "todos") f = f.filter((l) => l.canal_aquisicao === filtroCanal);
    if (filtroScoreRange) {
      const [min, max] = filtroScoreRange.split("-").map(Number);
      f = f.filter((l) => { const s = leadScore(l as any).score; return s >= min && s <= max; });
    }

    const countAtivos = leads.filter((l) => l.etapa !== "desistiu" && l.etapa !== "frio").length;
    const listComprou = leads.filter((l) => l.etapa === "comprou");
    const convTotalOps = leads.length;
    const taxaConversaoCalculada = convTotalOps > 0 ? (listComprou.length / convTotalOps) * 100 : 0;
    const kpiTicketMedioCalc = listComprou.length > 0 ? listComprou.reduce((s, l) => s + Number(l.mensalidade || 0), 0) / listComprou.length : 0;

    let tempoMedioCalc = 0;
    const funilAtivos = leads.filter((l) => l.etapa !== "desistiu" && l.etapa !== "frio" && l.etapa !== "comprou" && l.created_at);
    if (funilAtivos.length > 0) {
      const now = Date.now();
      const totalDays = funilAtivos.reduce((s, l) => s + Math.floor((now - new Date(l.created_at!).getTime()) / 86400000), 0);
      tempoMedioCalc = Math.round(totalDays / funilAtivos.length);
    }
    const listInativos = leads.filter((l) => l.etapa === "oportunidade" && tempoNaEtapa(l).days > DIAS_INATIVO_LIMITE);

    const fSorted = [...f].sort((a, b) => {
      if (sortCol === "_tempo") return sortDir === "desc" ? tempoNaEtapa(b).days - tempoNaEtapa(a).days : tempoNaEtapa(a).days - tempoNaEtapa(b).days;
      if (sortCol === "_score") return sortDir === "desc" ? leadScore(b as any).score - leadScore(a as any).score : leadScore(a as any).score - leadScore(b as any).score;
      const va = (a as any)[sortCol] ?? "";
      const vb = (b as any)[sortCol] ?? "";
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    const objCounts = ETAPAS.reduce<Record<string, number>>((acc, e) => { acc[e.key] = leads.filter((l) => l.etapa === e.key).length; return acc; }, {});

    // Contrato KPIs based on filtered visible leads
    let totalMrr = 0, totalLtv = 0, contratosCount = 0;
    for (const l of fSorted) {
      if (l.contrato_id && contratosMap[l.contrato_id]) {
        const c = contratosMap[l.contrato_id];
        totalMrr += Number(c.mrr) || 0;
        totalLtv += Number(c.valor_total_projeto) || 0;
        contratosCount++;
      }
    }

    return {
      filtered: fSorted, kpiLeadsAtivos: countAtivos, kpiTaxaConversao: taxaConversaoCalculada,
      kpiTicketMedio: kpiTicketMedioCalc, kpiTempoMedioFunil: tempoMedioCalc,
      leadsInativos: listInativos, counts: objCounts,
      kpiTotalMrr: totalMrr, kpiTotalLtv: totalLtv,
      kpiTicketMedioContrato: contratosCount > 0 ? totalLtv / contratosCount : 0,
    };
  }, [leads, abaAtiva, closerFiltro, mes, debouncedBusca, filtroCanal, filtroScoreRange, sortCol, sortDir, contratosMap]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
      <div className="w-10 h-10 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
      <p className="text-muted-foreground animate-pulse text-sm">Carregando dados unificados do CRM...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-primary rounded-full"></div>
          <h1 className="text-2xl font-bold tracking-tight">CRM de Leads</h1>
          <div className="flex flex-col items-start ml-2">
            <SyncButton source="ghl" onDone={() => { mutate(); setLastSync(new Date()); }} />
            {lastSync && <span className="text-[10px] text-muted-foreground mt-0.5 font-medium ml-1">Atualizado {lastSync.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>}
          </div>
        </div>
        {abaAtiva === "comprou" && (
          <select value={mes} onChange={(e) => setMes(e.target.value)} className="text-sm border rounded-lg px-3 py-2 bg-card font-medium shadow-sm outline-none focus:ring-1 focus:ring-primary">
            <option value="all">Todos os meses</option>
            {["2026-04", "2026-03", "2026-02", "2026-01", "2025-12", "2025-11", "2025-10", "2025-09"].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
      </div>

      {(() => {
        const semCanal = leads.filter((l) => !l.canal_aquisicao && !["comprou", "desistiu", "frio"].includes(l.etapa as string)).length;
        const semCloser = leads.filter((l) => !l.closer_id && !["comprou", "desistiu", "frio"].includes(l.etapa as string)).length;
        const ativos = leads.filter((l) => !["comprou", "desistiu", "frio"].includes(l.etapa as string)).length;
        const pctSemCanal = ativos > 0 ? (semCanal / ativos) * 100 : 0;
        const pctSemCloser = ativos > 0 ? (semCloser / ativos) * 100 : 0;
        const alertas: string[] = [];
        if (pctSemCanal > 50) alertas.push(`${pctSemCanal.toFixed(0)}% s/ canal`);
        if (pctSemCloser > 50) alertas.push(`${pctSemCloser.toFixed(0)}% s/ closer`);
        if (alertas.length === 0) return null;
        return (
          <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-sm font-medium text-orange-500 flex items-center justify-between gap-3 flex-wrap shadow-sm">
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" /> Dados ausentes espaciais: {alertas.join(" · ")}</div>
            <button onClick={() => { setAbaAtiva(null); setCloserFiltro("sem"); setFiltroCanal("todos"); setFiltroScoreRange("0-25"); setBusca(""); }}
              className="text-xs px-3 py-1.5 bg-orange-500/20 text-orange-600 dark:text-orange-400 font-bold rounded-md hover:bg-orange-500/30 transition-all active:scale-95">
              Filtrar
            </button>
          </div>
        );
      })()}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {[
          { label: "Leads Ativos", val: kpiLeadsAtivos },
          { label: "Taxa Conversão", val: `${kpiTaxaConversao.toFixed(1)}%`, color: "text-emerald-500" },
          { label: "Ticket Médio", val: formatCurrency(kpiTicketMedio) },
          { label: "Tempo Funil", val: `${kpiTempoMedioFunil} d.` },
          { label: "MRR Contratos", val: formatCurrency(kpiTotalMrr), color: "text-cyan-400" },
          { label: "LTV Contratos", val: formatCurrency(kpiTotalLtv), color: "text-emerald-500" },
          { label: "Ticket Médio LTV", val: formatCurrency(kpiTicketMedioContrato), color: "text-violet-400" },
        ].map((k) => (
          <div key={k.label} className="p-4 rounded-xl border border-border/60 bg-card shadow-sm flex flex-col gap-1">
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{k.label}</p>
            <p className={`text-2xl font-black tracking-tight ${k.color || ""}`}>{k.val}</p>
          </div>
        ))}
      </div>

      {leadsInativos.length > 0 && (!abaAtiva || abaAtiva === "oportunidade") && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 shadow-sm animate-in fade-in slide-in-from-top-1">
          <span className="text-sm font-medium text-orange-600 dark:text-orange-400">{leadsInativos.length} leads em "Oportunidade" há mais de {DIAS_INATIVO_LIMITE} dias.</span>
          <button onClick={async () => {
            await Promise.all(leadsInativos.map(l => mudarEtapa(l.id, "frio")));
          }} className="text-xs px-4 py-2 bg-orange-500/20 text-orange-600 dark:text-orange-400 font-bold rounded-lg hover:bg-orange-500/30 transition-colors shadow-sm active:scale-95">
            Mover para Frio
          </button>
        </div>
      )}

      {(() => {
        const taxaDesistencia = leads.length > 0 ? ((counts["desistiu"] || 0) / leads.length) * 100 : 0;
        if (taxaDesistencia <= 40) return null;
        return (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-sm text-rose-500 font-medium rounded-xl">
            <button onClick={() => { setAbaAtiva("desistiu"); }} className="hover:underline flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> Taxa de desistencia incomum: {taxaDesistencia.toFixed(1)}%
            </button>
          </div>
        );
      })()}

      <div className="flex flex-wrap gap-2 pt-2 scrollbar-hide pb-2">
        {ABAS.map((aba) => {
          const isActive = abaAtiva === aba.etapa;
          const count = aba.etapa ? counts[aba.etapa] || 0 : leads.length;
          if (aba.etapa && count === 0) return null;
          return (<button key={aba.label} onClick={() => { setAbaAtiva(aba.etapa); }} className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-3 transition-all ${isActive ? "bg-primary text-primary-foreground shadow-md ring-1 ring-primary/20 scale-100" : "bg-card text-muted-foreground hover:bg-muted border border-border scale-[0.98]"}`}>
            {aba.label} <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-primary-foreground/20" : "bg-muted-foreground/10"}`}>{count}</span>
          </button>);
        })}
      </div>

      <CrmFilters
        closers={closers} closerFiltro={closerFiltro} setCloserFiltro={setCloserFiltro}
        busca={busca} setBusca={setBusca}
        showColDropdown={showColDropdown} setShowColDropdown={setShowColDropdown}
        showAdvFilters={showAdvFilters} setShowAdvFilters={setShowAdvFilters}
        visibleCols={visibleCols} toggleCol={toggleCol} ALL_COLUMNS={ALL_COLUMNS as any}
        filtroCanal={filtroCanal} setFiltroCanal={setFiltroCanal} canaisPossiveis={CANAIS}
        filtroScoreRange={filtroScoreRange} setFiltroScoreRange={setFiltroScoreRange}
      />

      <CrmTable
        filtered={filtered} visibleCount={filtered.length} visibleCols={visibleCols}
        sortCol={sortCol} toggleSort={toggleSort}
        updateLead={updateLead as any} mudarEtapa={mudarEtapa} deleteLead={deleteLead}
        addNovoLead={() => setShowNovoLeadDialog(true)}
        closers={closers} sdrs={sdrs} contratosMap={contratosMap}
      />

      <NovoLeadDialog
        open={showNovoLeadDialog}
        onClose={() => setShowNovoLeadDialog(false)}
        onCreateGhl={(contact) => {
          const mesRef = mes === "all" ? getCurrentMonth() : mes;
          addNovoLead(abaAtiva || "oportunidade", mesRef, {
            nome: contact.name,
            telefone: contact.phone,
            email: contact.email,
            ghl_contact_id: contact.id,
            lead_avulso: false,
          });
        }}
        onCreateAvulso={(data) => {
          const mesRef = mes === "all" ? getCurrentMonth() : mes;
          addNovoLead(abaAtiva || "oportunidade", mesRef, {
            nome: data.nome,
            telefone: data.telefone,
            email: data.email,
            lead_avulso: true,
            fonte_avulso: data.fonte,
          });
        }}
      />

      <div className="flex flex-col items-center gap-2 py-3">
        <span className="text-[11px] font-medium text-muted-foreground">
          Mostrando {leads.length} de {totalCount} leads
        </span>
        {hasMore && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            {loadingMore
              ? "Carregando..."
              : `Carregar mais 50 de ${Math.max(0, totalCount - leads.length)} restantes`}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-4 p-5 bg-card/60 backdrop-blur border border-border/50 rounded-2xl text-sm shadow-sm mt-4">
        <div className="flex flex-col gap-1"><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Leads em tela</span><span className="font-mono text-xl font-medium">{filtered.length}</span></div>
        <div className="w-px bg-border/50 hidden md:block"></div>
        <div className="flex flex-col gap-1"><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Entrada Cash</span><span className="font-mono text-xl font-medium text-emerald-500">{formatCurrency(filtered.reduce((s, l) => s + Number(l.valor_entrada || 0), 0))}</span></div>
        <div className="w-px bg-border/50 hidden md:block"></div>
        <div className="flex flex-col gap-1"><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Mensal (Avg)</span><span className="font-mono text-xl font-medium">{formatCurrency(filtered.length > 0 ? filtered.reduce((s, l) => s + Number(l.mensalidade || 0), 0) / filtered.length : 0)}</span></div>
        <div className="w-px bg-border/50 hidden md:block"></div>
        <div className="flex flex-col gap-1"><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Lifetime Value Projeto</span><span className="font-mono text-xl font-medium text-emerald-500">{formatCurrency(filtered.reduce((s, l) => s + Number(l.valor_total_projeto || 0), 0))}</span></div>
      </div>
    </div>
  );
}
