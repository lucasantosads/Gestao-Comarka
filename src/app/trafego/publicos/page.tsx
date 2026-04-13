"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import type { AdsMetadata } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent } from "@/lib/format";
import { TrafegoFilters, useTrafegoFilters } from "@/components/trafego-filters";
import { cn } from "@/lib/utils";
import { useTrafegoData } from "@/hooks/use-trafego-data";
import { Loader2, Users, Target, Sparkles, Globe, UserCheck, TrendingUp, DollarSign, ArrowUpDown, Smartphone, Monitor, Tablet, MapPin, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudiencesEngine } from "@/hooks/use-audiences-engine";

/* ========== TYPES ========== */
interface DemographicRow { label: string; sublabel?: string; spend: number; impressions: number; clicks: number; leads: number; cpl: number; ctr: number; cpc: number; }

/* ========== CONFIG ========== */
const TIPO_CONFIG: Record<string, { label: string; icon: typeof Users; color: string; bg: string }> = {
    interest: { label: "Interesse", icon: Sparkles, color: "text-violet-400", bg: "bg-violet-500/10" },
    behavior: { label: "Comportamento", icon: TrendingUp, color: "text-sky-400", bg: "bg-sky-500/10" },
    custom_audience: { label: "Público Personalizado", icon: UserCheck, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    lookalike: { label: "Lookalike", icon: Users, color: "text-amber-400", bg: "bg-amber-500/10" },
};

const SUB_TABS = [
    { id: "audiences", label: "Públicos", icon: Users },
    { id: "age_gender", label: "Idade & Gênero", icon: Calendar },
    { id: "region", label: "Localização", icon: MapPin },
    { id: "device", label: "Dispositivo", icon: Smartphone },
    { id: "platform", label: "Plataforma", icon: Globe },
] as const;
type SubTab = typeof SUB_TABS[number]["id"];

/* ========== HELPER: Horizontal Bar ========== */
function BarRow({ label, sublabel, value, max, color, extra }: { label: string; sublabel?: string; value: number; max: number; color: string; extra?: React.ReactNode }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
        <div className="flex items-center gap-3 py-2 group hover:bg-muted/10 dark:hover:bg-white/[0.02] px-3 rounded-lg transition-colors">
            <div className="w-[140px] shrink-0">
                <p className="text-xs font-medium truncate" title={label}>{label}</p>
                {sublabel && <p className="text-[10px] text-muted-foreground truncate">{sublabel}</p>}
            </div>
            <div className="flex-1 h-7 bg-muted/20 dark:bg-white/[0.03] rounded-md overflow-hidden relative">
                <div className={cn("h-full rounded-md transition-all duration-500 flex items-center px-2", color)} style={{ width: `${Math.max(pct, 2)}%` }}>
                    {pct > 15 && <span className="text-[10px] text-white font-bold">{pct.toFixed(1)}%</span>}
                </div>
            </div>
            <div className="w-[200px] shrink-0 flex gap-3 justify-end">
                {extra}
            </div>
        </div>
    );
}

function MetricCell({ label, value }: { label: string; value: string }) {
    return (
        <div className="text-right">
            <p className="text-[9px] text-muted-foreground uppercase">{label}</p>
            <p className="text-xs font-semibold">{value}</p>
        </div>
    );
}

/* ========== MAIN PAGE ========== */
export default function TrafegoPublicosPage() {
    const filters = useTrafegoFilters();
    const { data: tData, isLoading: loading } = useTrafegoData(filters.dataInicio, filters.dataFim, filters.statusFiltro);

    const metadata = tData?.metadata || [];
    const performance = tData?.performance || [];

    const [demoData, setDemoData] = useState<Record<string, DemographicRow[]>>({});
    const [demoLoading, setDemoLoading] = useState<Record<string, boolean>>({});
    const [activeTab, setActiveTab] = useState<SubTab>("audiences");
    const [sortCol, setSortCol] = useState("spend");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [tipoFiltro, setTipoFiltro] = useState("all");

    // Usa o novo sistema central de audiências (Data Engine)
    const { audienceRows, bucketBroad, stats, loadingAudiences } = useAudiencesEngine({
        performance: tData?.performance || [],
        metadata: tData?.metadata || [],
        statusFiltro: filters.statusFiltro,
        somenteComDados: filters.somenteComDados,
        tipoFiltro,
    });

    const fetchDemographic = useCallback(async (breakdown: string) => {
        if (demoData[breakdown]) return; // already fetched
        setDemoLoading((prev) => ({ ...prev, [breakdown]: true }));
        try {
            const res = await fetch(`/api/meta-demographics?since=${filters.dataInicio}&until=${filters.dataFim}&breakdown=${breakdown}`);
            const json = await res.json();
            setDemoData((prev) => ({ ...prev, [breakdown]: json.data || [] }));
        } catch {
            setDemoData((prev) => ({ ...prev, [breakdown]: [] }));
        }
        setDemoLoading((prev) => ({ ...prev, [breakdown]: false }));
    }, [filters.dataInicio, filters.dataFim, demoData]);

    useEffect(() => {
        if (activeTab !== "audiences" && !demoData[activeTab]) {
            fetchDemographic(activeTab);
        }
    }, [activeTab, fetchDemographic, demoData]);

    const toggleSort = (col: string) => { if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortCol(col); setSortDir("desc"); } };
    const sorted = useMemo(() => [...audienceRows].sort((a, b) => { const va = (a as unknown as Record<string, number>)[sortCol] ?? 0; const vb = (b as unknown as Record<string, number>)[sortCol] ?? 0; return sortDir === "asc" ? va - vb : vb - va; }), [audienceRows, sortCol, sortDir]);

    // Combinar linhas normais com o Bucket "Broad" no final, somente se ele tiver spend > 0 e for a aba geral ou tipo selecionado for 'all'
    const finalRows = useMemo(() => {
        const rows = [...sorted];
        if (bucketBroad.spend > 0 && tipoFiltro === "all") {
            rows.push(bucketBroad);
        }
        return rows;
    }, [sorted, bucketBroad, tipoFiltro]);

    const globalCpl = stats.avgCpl;

    if (loading || loadingAudiences) return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm flex items-center gap-2">Sincronizando Metadados com Engine de Públicos<span className="dot-blink1">.</span><span className="dot-blink2">.</span><span className="dot-blink3">.</span></p>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <h1 className="text-3xl font-bold tracking-tight">Públicos & Interesses</h1>
                <TrafegoFilters
                    periodo={filters.periodo} onPeriodoChange={filters.setPeriodo}
                    dataInicio={filters.dataInicio} dataFim={filters.dataFim}
                    onDataInicioChange={filters.setDataInicio} onDataFimChange={filters.setDataFim}
                    statusFiltro={filters.statusFiltro} onStatusChange={filters.setStatusFiltro}
                    somenteComDados={filters.somenteComDados} onSomenteComDadosChange={filters.setSomenteComDados}
                />
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-1 bg-muted/30 dark:bg-white/[0.03] rounded-xl p-1">
                {SUB_TABS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-colors flex-1 justify-center relative",
                                activeTab === tab.id ? "text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                            )}
                        >
                            {activeTab === tab.id && (
                                <motion.div
                                    layoutId="publicos-tab-indicator"
                                    className="absolute inset-0 gradient-primary rounded-lg shadow-sm"
                                    style={{ zIndex: 0 }}
                                />
                            )}
                            <span className="relative z-10 flex items-center gap-1.5">
                                <Icon size={13} />
                                {tab.label}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* ========== AUDIENCES TAB ========== */}
            {activeTab === "audiences" && (
                <>
                    {/* Tipo filter pills */}
                    <div className="flex flex-wrap gap-2">
                        {[
                            { value: "all", label: "Todos" }, { value: "interest", label: "Interesses" },
                            { value: "behavior", label: "Comportamentos" }, { value: "custom_audience", label: "Personalizados" },
                            { value: "lookalike", label: "Lookalikes" },
                        ].map((opt) => (
                            <button key={opt.value} onClick={() => setTipoFiltro(opt.value)}
                                className={cn("px-3 py-1.5 text-xs rounded-lg border transition-all",
                                    tipoFiltro === opt.value ? "gradient-primary text-white border-transparent" : "border-border dark:border-white/[0.08] text-muted-foreground hover:text-foreground"
                                )}>{opt.label}</button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><DollarSign size={14} className="text-muted-foreground/50" /><span className="text-xs text-muted-foreground">Total Investido</span></div><p className="text-xl font-bold">{formatCurrency(stats.totalSpend)}</p></CardContent></Card>
                        <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Users size={14} className="text-muted-foreground/50" /><span className="text-xs text-muted-foreground">Total Leads</span></div><p className="text-xl font-bold">{stats.totalLeads}</p></CardContent></Card>
                        <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Target size={14} className="text-muted-foreground/50" /><span className="text-xs text-muted-foreground">CPL Médio</span></div><p className="text-xl font-bold">{stats.avgCpl > 0 ? formatCurrency(stats.avgCpl) : "—"}</p></CardContent></Card>
                        <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Globe size={14} className="text-muted-foreground/50" /><span className="text-xs text-muted-foreground">Públicos Ativos</span></div><p className="text-xl font-bold">{stats.total}</p></CardContent></Card>
                    </div>

                    {sorted.length === 0 ? (
                        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum público encontrado para o período.</CardContent></Card>
                    ) : (
                        <Card><CardContent className="p-0"><div className="overflow-auto">
                            <table className="w-full text-sm">
                                <thead><tr className="border-b border-border dark:border-white/[0.06] text-muted-foreground">
                                    <th className="px-3 py-2.5 text-left font-medium text-xs">Público / Interesse</th>
                                    <th className="px-3 py-2.5 text-left font-medium text-xs">Tipo</th>
                                    <th className="px-3 py-2.5 text-left font-medium text-xs">Campanhas</th>
                                    <th onClick={() => toggleSort("spend")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap">Investido {sortCol === "spend" && <ArrowUpDown size={10} className="inline" />}</th>
                                    <th onClick={() => toggleSort("leads")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap">Leads {sortCol === "leads" && <ArrowUpDown size={10} className="inline" />}</th>
                                    <th onClick={() => toggleSort("cpl")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap">CPL {sortCol === "cpl" && <ArrowUpDown size={10} className="inline" />}</th>
                                    <th onClick={() => toggleSort("impressoes")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap">Impressões {sortCol === "impressoes" && <ArrowUpDown size={10} className="inline" />}</th>
                                    <th onClick={() => toggleSort("ctr")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap">CTR {sortCol === "ctr" && <ArrowUpDown size={10} className="inline" />}</th>
                                    <th className="px-3 py-2.5 text-center font-medium text-xs">Conjuntos</th>
                                </tr></thead>
                                <tbody>
                                    <AnimatePresence>
                                        {finalRows.map((aud, i) => {
                                            const cfg = aud.tipo === "broad" ? { label: "Amplo", icon: Sparkles, color: "text-zinc-400", bg: "bg-zinc-500/10" } : TIPO_CONFIG[aud.tipo] || TIPO_CONFIG.interest;
                                            const Icon = cfg.icon;
                                            return (
                                                <motion.tr
                                                    key={`${aud.id}-${i}`}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: i * 0.05 }}
                                                    className={cn(
                                                        "border-b border-border dark:border-white/[0.06] hover:bg-muted/30 dark:hover:bg-white/[0.02] transition-colors",
                                                        aud.tipo === "broad" && "bg-muted/10 dark:bg-white/[0.01]"
                                                    )}
                                                >
                                                    <td className="px-3 py-2.5"><div className="flex items-center gap-2.5">
                                                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", cfg.bg)}><Icon size={14} className={cfg.color} /></div>
                                                        <span className="text-xs font-medium truncate max-w-[200px]" title={aud.name}>{aud.name}</span>
                                                    </div></td>
                                                    <td className="px-3 py-2.5"><Badge className={cn("text-[9px]", cfg.bg, cfg.color)}>{cfg.label}</Badge></td>
                                                    <td className="px-3 py-2.5"><div className="flex flex-wrap gap-1 max-w-[180px]">
                                                        {aud.campaignNames.slice(0, 2).map((c, ci) => <span key={ci} className="text-[10px] text-muted-foreground bg-muted/50 dark:bg-white/[0.04] rounded px-1.5 py-0.5 truncate max-w-[80px]" title={c}>{c.length > 15 ? c.slice(0, 14) + "…" : c}</span>)}
                                                        {aud.campaignNames.length > 2 && <span className="text-[10px] text-muted-foreground">+{aud.campaignNames.length - 2}</span>}
                                                    </div></td>
                                                    <td className="px-3 py-2.5 text-right text-xs font-medium">{formatCurrency(aud.spend)}</td>
                                                    <td className="px-3 py-2.5 text-right text-xs font-bold">{aud.leads}</td>
                                                    <td className={cn("px-3 py-2.5 text-right text-xs font-medium", aud.cpl > 0 && aud.cpl < globalCpl * 0.8 ? "text-emerald-400" : aud.cpl > globalCpl * 1.3 ? "text-red-400" : "")}>
                                                        {aud.leads > 0 ? formatCurrency(aud.cpl) : "—"}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right text-xs">{aud.impressoes.toLocaleString("pt-BR")}</td>
                                                    <td className={cn("px-3 py-2.5 text-right text-xs font-medium", aud.ctr >= 1.5 ? "text-emerald-400" : aud.ctr > 0 && aud.ctr < 0.8 ? "text-red-400" : "")}>{formatPercent(aud.ctr)}</td>
                                                    <td className="px-3 py-2.5 text-center"><Badge className="text-[10px] bg-muted text-muted-foreground">{aud.adsets.length}</Badge></td>
                                                </motion.tr>
                                            );
                                        })}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div></CardContent></Card>
                    )}
                </>
            )}

            {/* ========== DEMOGRAPHIC TABS ========== */}
            {activeTab !== "audiences" && (
                <DemographicPanel
                    rows={demoData[activeTab] || []}
                    loading={!!demoLoading[activeTab]}
                    breakdown={activeTab}
                    somenteComDados={filters.somenteComDados}
                />
            )}
        </div>
    );
}

/* ========== DEMOGRAPHIC PANEL ========== */
function DemographicPanel({ rows, loading, breakdown, somenteComDados }: { rows: DemographicRow[]; loading: boolean; breakdown: string; somenteComDados: boolean }) {
    const [sortCol, setSortCol] = useState("spend");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    // Aggregate/group data — MUST be before any conditional return (React hooks rule)
    const grouped = useMemo(() => {
        if (loading || rows.length === 0) return [];
        const map = new Map<string, DemographicRow & { count: number }>();
        for (const row of rows) {
            const key = breakdown === "age_gender" ? `${row.label}|${row.sublabel || ""}` : row.label;
            if (map.has(key)) {
                const g = map.get(key)!;
                g.spend += row.spend; g.impressions += row.impressions; g.clicks += row.clicks; g.leads += row.leads; g.count++;
            } else {
                map.set(key, { ...row, count: 1 });
            }
        }
        return Array.from(map.values()).map((g) => ({
            ...g, cpl: g.leads > 0 ? g.spend / g.leads : 0, ctr: g.impressions > 0 ? (g.clicks / g.impressions) * 100 : 0, cpc: g.clicks > 0 ? g.spend / g.clicks : 0,
        }));
    }, [rows, breakdown, loading]);

    if (loading) return <div className="flex items-center justify-center h-32"><p className="text-muted-foreground text-sm">Carregando dados demográficos...</p></div>;

    const filtered = somenteComDados ? grouped.filter((r) => r.spend > 0) : grouped;
    const sorted = [...filtered].sort((a, b) => {
        const va = (a as unknown as Record<string, number>)[sortCol] ?? 0;
        const vb = (b as unknown as Record<string, number>)[sortCol] ?? 0;
        return sortDir === "asc" ? va - vb : vb - va;
    });

    const totalSpend = filtered.reduce((s, r) => s + r.spend, 0);
    const totalLeads = filtered.reduce((s, r) => s + r.leads, 0);
    const totalImpressions = filtered.reduce((s, r) => s + r.impressions, 0);
    const maxSpend = Math.max(...filtered.map((r) => r.spend), 1);

    const toggleSort = (col: string) => { if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortCol(col); setSortDir("desc"); } };

    if (filtered.length === 0) return <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum dado demográfico encontrado para o período.</CardContent></Card>;

    // Color per breakdown
    const barColor = breakdown === "age_gender" ? "bg-gradient-to-r from-violet-500 to-indigo-500" :
        breakdown === "region" ? "bg-gradient-to-r from-emerald-500 to-teal-500" :
            breakdown === "device" ? "bg-gradient-to-r from-sky-500 to-blue-500" :
                "bg-gradient-to-r from-amber-500 to-orange-500";

    const deviceIcon = (label: string) => {
        if (label.toLowerCase().includes("mobile")) return <Smartphone size={14} />;
        if (label.toLowerCase().includes("desktop")) return <Monitor size={14} />;
        if (label.toLowerCase().includes("tablet")) return <Tablet size={14} />;
        return <Smartphone size={14} />;
    };

    const GENDER_NAMES: Record<string, string> = { Masculino: "♂ Masculino", Feminino: "♀ Feminino", unknown: "Não informado" };

    return (
        <>
            {/* KPI Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card><CardContent className="p-4"><span className="text-xs text-muted-foreground">Total Investido</span><p className="text-xl font-bold mt-1">{formatCurrency(totalSpend)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><span className="text-xs text-muted-foreground">Total Leads</span><p className="text-xl font-bold mt-1">{totalLeads}</p></CardContent></Card>
                <Card><CardContent className="p-4"><span className="text-xs text-muted-foreground">CPL Médio</span><p className="text-xl font-bold mt-1">{totalLeads > 0 ? formatCurrency(totalSpend / totalLeads) : "—"}</p></CardContent></Card>
                <Card><CardContent className="p-4"><span className="text-xs text-muted-foreground">Segmentos</span><p className="text-xl font-bold mt-1">{filtered.length}</p></CardContent></Card>
            </div>

            {/* Visual Bar Chart */}
            <Card>
                <CardContent className="p-4 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                        Distribuição por {breakdown === "age_gender" ? "Idade & Gênero" : breakdown === "region" ? "Localização" : breakdown === "device" ? "Dispositivo" : "Plataforma"}
                    </p>
                    {sorted.slice(0, 15).map((row, i) => {
                        const displayLabel = breakdown === "device"
                            ? row.label
                            : breakdown === "age_gender"
                                ? `${row.label} · ${GENDER_NAMES[row.sublabel || ""] || row.sublabel || ""}`
                                : row.sublabel ? `${row.label} · ${row.sublabel}` : row.label;

                        return (
                            <BarRow
                                key={`${row.label}-${row.sublabel}-${i}`}
                                label={displayLabel}
                                value={row.spend}
                                max={maxSpend}
                                color={barColor}
                                extra={
                                    <>
                                        <MetricCell label="Invest." value={formatCurrency(row.spend)} />
                                        <MetricCell label="Leads" value={String(row.leads)} />
                                        <MetricCell label="CPL" value={row.leads > 0 ? formatCurrency(row.cpl) : "—"} />
                                    </>
                                }
                            />
                        );
                    })}
                </CardContent>
            </Card>

            {/* Detailed Table */}
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border dark:border-white/[0.06] text-muted-foreground">
                                    <th className="px-3 py-2.5 text-left font-medium text-xs">
                                        {breakdown === "age_gender" ? "Faixa Etária" : breakdown === "region" ? "Região" : breakdown === "device" ? "Dispositivo" : "Plataforma"}
                                    </th>
                                    {breakdown === "age_gender" && <th className="px-3 py-2.5 text-left font-medium text-xs">Gênero</th>}
                                    {breakdown === "region" && <th className="px-3 py-2.5 text-left font-medium text-xs">País</th>}
                                    {breakdown === "platform" && <th className="px-3 py-2.5 text-left font-medium text-xs">Posição</th>}
                                    <th onClick={() => toggleSort("spend")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap">
                                        Investido {sortCol === "spend" && <ArrowUpDown size={10} className="inline" />}
                                    </th>
                                    <th className="px-3 py-2.5 text-right font-medium text-xs">% Budget</th>
                                    <th onClick={() => toggleSort("leads")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap">
                                        Leads {sortCol === "leads" && <ArrowUpDown size={10} className="inline" />}
                                    </th>
                                    <th onClick={() => toggleSort("cpl")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap">
                                        CPL {sortCol === "cpl" && <ArrowUpDown size={10} className="inline" />}
                                    </th>
                                    <th onClick={() => toggleSort("impressions")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap">
                                        Impressões {sortCol === "impressions" && <ArrowUpDown size={10} className="inline" />}
                                    </th>
                                    <th onClick={() => toggleSort("ctr")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap">
                                        CTR {sortCol === "ctr" && <ArrowUpDown size={10} className="inline" />}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((row, i) => {
                                    const budgetPct = totalSpend > 0 ? (row.spend / totalSpend) * 100 : 0;
                                    const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
                                    return (
                                        <tr key={`${row.label}-${row.sublabel}-${i}`} className="border-b border-border dark:border-white/[0.06] hover:bg-muted/30 dark:hover:bg-white/[0.02] transition-colors">
                                            <td className="px-3 py-2.5 text-xs font-medium">
                                                <div className="flex items-center gap-2">
                                                    {breakdown === "device" && <span className="text-muted-foreground">{deviceIcon(row.label)}</span>}
                                                    {row.label}
                                                </div>
                                            </td>
                                            {breakdown === "age_gender" && <td className="px-3 py-2.5 text-xs">
                                                <Badge className={cn("text-[9px]", row.sublabel === "Masculino" ? "bg-sky-500/10 text-sky-400" : row.sublabel === "Feminino" ? "bg-pink-500/10 text-pink-400" : "bg-muted text-muted-foreground")}>
                                                    {GENDER_NAMES[row.sublabel || ""] || row.sublabel}
                                                </Badge>
                                            </td>}
                                            {breakdown === "region" && <td className="px-3 py-2.5 text-xs text-muted-foreground">{row.sublabel || "—"}</td>}
                                            {breakdown === "platform" && <td className="px-3 py-2.5 text-xs text-muted-foreground capitalize">{row.sublabel || "—"}</td>}
                                            <td className="px-3 py-2.5 text-right text-xs font-medium">{formatCurrency(row.spend)}</td>
                                            <td className="px-3 py-2.5 text-right text-xs">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <div className="w-12 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                                                        <div className={cn("h-full rounded-full", barColor)} style={{ width: `${budgetPct}%` }} />
                                                    </div>
                                                    <span className="text-muted-foreground">{budgetPct.toFixed(1)}%</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5 text-right text-xs font-bold">{row.leads}</td>
                                            <td className={cn("px-3 py-2.5 text-right text-xs font-medium",
                                                row.cpl > 0 && row.cpl < avgCpl * 0.8 ? "text-emerald-400" :
                                                    row.cpl > avgCpl * 1.3 ? "text-red-400" : ""
                                            )}>
                                                {row.leads > 0 ? formatCurrency(row.cpl) : "—"}
                                            </td>
                                            <td className="px-3 py-2.5 text-right text-xs">{row.impressions.toLocaleString("pt-BR")}</td>
                                            <td className={cn("px-3 py-2.5 text-right text-xs font-medium", row.ctr >= 1.5 ? "text-emerald-400" : row.ctr < 0.8 && row.ctr > 0 ? "text-red-400" : "")}>
                                                {formatPercent(row.ctr)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </>
    );
}

