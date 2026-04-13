"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/format";
import { TrafegoFilters, useTrafegoFilters } from "@/components/trafego-filters";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { AlertsPanel } from "@/components/alerts-panel";
import { SyncButton } from "@/components/sync-button";
import { truncateAdName } from "@/lib/trafego-ui";
import { useTrafegoData } from "@/hooks/use-trafego-data";
import useSWR from "swr";
import Link from "next/link";
import { ArrowRight, BadgeDollarSign, TrendingUp, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

interface MetaSpendData {
  spend: number; leads: number; impressions: number; clicks: number;
  ctr: number; frequency: number; cplMeta: number; cplCalculado: number; cplPonderado: number; cplMedioCampanhas: number;
  campanhas: { name: string; spend: number; leads: number; cpl: number }[];
}

export default function TrafegoVisaoGeralPage() {
  const filters = useTrafegoFilters();
  const [mounted, setMounted] = useState(false);
  const [cplLimite, setCplLimite] = useState(100);

  // Solucao do Pilar 5: Fuga do localStorage cru no SSR pra evitar Hydration Errors
  useEffect(() => {
    setMounted(true);
    setCplLimite(Number(localStorage.getItem("trafego_cpl_limite") || "100"));
  }, []);

  const { data: tData, isLoading: tLoading, mutate: mutateTrafego } = useTrafegoData(filters.dataInicio, filters.dataFim, filters.statusFiltro);

  const metadata = tData?.metadata || [];
  const performance = tData?.performance || [];
  const leads = tData?.leads || [];
  const prevPerf = tData?.prevPerformance || [];
  const attrStart = tData?.attrStartIso || null;

  const { data: realTimeData } = useSWR(
    ["meta-real-time", filters.dataInicio, filters.dataFim, attrStart],
    async () => {
      const hoje = new Date().toISOString().split("T")[0];
      const mesAtual = hoje.slice(0, 7);
      const attrStartIso = attrStart || "2026-04-03T23:21:18.000Z";
      const mesStartIso = `${mesAtual}-01T00:00:00.000Z`;
      const crmStart = mesStartIso > attrStartIso ? mesStartIso : attrStartIso;
      const metaSince = crmStart.slice(0, 10);

      const [metaRealData, crmVsMetaResult] = await Promise.all([
        fetch(`/api/meta-spend?since=${filters.dataInicio}&until=${filters.dataFim}`).then((r) => r.json()).catch(() => null),
        Promise.all([
          supabase.from("leads_crm").select("id", { count: "exact", head: true }).gte("ghl_created_at", crmStart).lte("ghl_created_at", hoje + "T23:59:59"),
          fetch(`/api/meta-spend?since=${metaSince}&until=${hoje}`).then((r) => r.json()).catch(() => null),
        ]),
      ]);

      const [{ count: crmCount }, crmMetaData] = crmVsMetaResult;
      const crm = crmCount || 0;
      const metaLeadsCount = crmMetaData?.leads || 0;
      const crmVsMeta = { crmLeads: crm, metaLeads: metaLeadsCount, pct: metaLeadsCount > 0 ? (crm / metaLeadsCount) * 100 : 0 };

      return { metaReal: (metaRealData && !metaRealData.error ? metaRealData : null) as MetaSpendData | null, crmVsMeta };
    },
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const metaReal = realTimeData?.metaReal || null;
  const crmVsMeta = realTimeData?.crmVsMeta || null;

  const totalSpend = metaReal?.spend ?? performance.reduce((s, p) => s + Number(p.spend), 0);
  const totalImpressions = metaReal?.impressions ?? performance.reduce((s, p) => s + p.impressoes, 0);
  const totalClicks = metaReal?.clicks ?? performance.reduce((s, p) => s + p.cliques, 0);
  const totalLeads = metaReal?.leads ?? performance.reduce((s, p) => s + p.leads, 0);
  const totalLeadsCrm = leads.length;
  const totalFechados = leads.filter((l) => l.estagio_crm === "fechado" || l.estagio_crm === "comprou").length;
  const totalReceita = leads.reduce((s, l) => s + Number(l.receita_gerada), 0);

  const cplMedio = metaReal?.cplCalculado ?? (totalLeads > 0 ? totalSpend / totalLeads : 0);
  const cac = totalFechados > 0 ? totalSpend / totalFechados : 0;
  const roas = totalSpend > 0 ? totalReceita / totalSpend : 0;
  const ctr = metaReal?.ctr ?? (totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0);

  const adStats = useMemo(() => metadata.map((ad) => {
    const perfs = performance.filter((p) => p.ad_id === ad.ad_id);
    const lds = leads.filter((l) => l.ad_id === ad.ad_id);
    const spend = perfs.reduce((s, p) => s + Number(p.spend), 0);
    const leadsCount = perfs.reduce((s, p) => s + p.leads, 0);
    const impressoes = perfs.reduce((s, p) => s + p.impressoes, 0);
    const cliques = perfs.reduce((s, p) => s + p.cliques, 0);
    const crmLeads = lds.length;
    const qualificados = lds.filter((l) => !["novo", "oportunidade"].includes(l.estagio_crm)).length;
    const taxaQualif = crmLeads > 0 ? (qualificados / crmLeads) * 100 : 0;
    const cpl = leadsCount > 0 ? spend / leadsCount : 0;
    const adCtr = impressoes > 0 ? (cliques / impressoes) * 100 : 0;
    const roi = cpl > 0 ? 1 : 0;
    return { ...ad, spend, leadsCount, metaLeads: leadsCount, crmLeads, taxaQualif, cpl, impressoes, adCtr };
  }).filter((a) => a.spend > 0 || a.leadsCount > 0).sort((a, b) => b.spend - a.spend), [metadata, performance, leads]);

  if (tLoading || !mounted) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 animate-in fade-in zoom-in">
      <div className="w-8 h-8 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
      <p className="text-muted-foreground text-sm font-medium animate-pulse">Estabelecendo vínculo de satélite com Metadados...</p>
    </div>
  );

  const alertas = adStats.filter((a) => a.cpl > cplLimite && a.leadsCount >= 2).map((a) => ({
    ad: a.ad_name || a.ad_id,
    msg: `CPL Crítico: ${formatCurrency(a.cpl)} (Teto Parametrizado era de ${formatCurrency(cplLimite)})`,
  }));

  // Pilar 4: Transversalidade Deep Link para Lançamentos de Tráfego caso gasto estrapole.
  const dangerSpend = totalSpend > totalReceita && totalSpend > 2000;

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-700 fade-in">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row items-center justify-between bg-card/40 border border-border/50 p-6 rounded-2xl backdrop-blur-xl shadow-[0_4px_24px_-10px_rgba(0,0,0,0.1)]">
          <div className="flex flex-col">
            <h1 className="text-4xl font-black tracking-tighter flex items-center gap-2">Radar Tráfego Pago <TrendingUp size={28} className="text-primary opacity-50" /></h1>
            <p className="text-muted-foreground font-medium text-sm mt-1 max-w-[500px]">Visão global de performance orgânica e sincronia HSL com o Meta Ads.</p>
          </div>
          <motion.div whileHover={{ scale: 1.05 }} className="mt-4 md:mt-0">
            <SyncButton source="meta" onDone={mutateTrafego} />
          </motion.div>
        </div>
        <TrafegoFilters periodo={filters.periodo} onPeriodoChange={filters.setPeriodo} dataInicio={filters.dataInicio} dataFim={filters.dataFim} onDataInicioChange={filters.setDataInicio} onDataFimChange={filters.setDataFim} statusFiltro={filters.statusFiltro} onStatusChange={filters.setStatusFiltro} />
      </div>

      {attrStart && (
        <div className="flex items-center gap-3 text-xs bg-muted/20 border border-border/30 rounded-xl px-4 py-3 text-muted-foreground">
          <BadgeDollarSign size={16} className="text-primary/50" />
          <p>
            Vínculo CRM × Metadados cravado a partir de <strong className="text-foreground tracking-widest">{new Date(attrStart).toLocaleString("pt-BR")}</strong>
          </p>
        </div>
      )}

      {/* KPIs — Grupo Primário Bento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/60 backdrop-blur-md border hover:border-primary/50 transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 group-hover:opacity-10 transition-all"><BadgeDollarSign size={64} /></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground font-black">Firepower Investido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-black tracking-tight">{formatCurrency(totalSpend)}</p>
          </CardContent>
        </Card>

        <Card className="bg-card/60 backdrop-blur-md border hover:border-primary/50 transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 group-hover:opacity-10 transition-all"><TrendingUp size={64} /></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground font-black">Custo Por Lead Frio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-black tracking-tight">{totalLeads > 0 ? formatCurrency(cplMedio) : "—"}</p>
          </CardContent>
        </Card>

        <Card className="bg-card/60 backdrop-blur-md border hover:border-primary/50 transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 group-hover:opacity-10 transition-all"><ArrowRight size={64} /></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground font-black">Aterrissagem CRM</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <p className="text-4xl font-black tracking-tight">{formatNumber(totalLeadsCrm)}</p>
              <p className="text-muted-foreground text-sm pb-1 font-mono">Leads</p>
            </div>
          </CardContent>
        </Card>
      </div>

      { /* Transversality Warning */}
      {dangerSpend && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-gradient-to-r from-rose-500/20 to-transparent border border-rose-500/30 rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-500/20 rounded-full"><AlertTriangle size={24} className="text-rose-400" /></div>
            <div>
              <h4 className="text-rose-400 font-black tracking-tighter uppercase text-sm">Gasto Elevado sem Retorno Comprovado</h4>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">Sugerimos conciliar esse passivo no DRE e repassar limites.</p>
            </div>
          </div>
          <Link href="/lancamentos" className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(244,63,94,0.4)]">
            Auditar Custos em DRE
          </Link>
        </motion.div>
      )}

      {/* KPIs — Grupo Secundário HSL Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-muted/10 border border-border/30 p-4 rounded-xl flex flex-col justify-between">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Impressões Brutas</p>
          <p className="text-xl font-bold font-mono">{formatNumber(totalImpressions)}</p>
        </div>
        <div className="bg-muted/10 border border-border/30 p-4 rounded-xl flex flex-col justify-between">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Cliques Totais</p>
          <p className="text-xl font-bold font-mono">{formatNumber(totalClicks)}</p>
        </div>
        <div className="bg-muted/10 border border-border/30 p-4 rounded-xl flex flex-col justify-between border-b-2 border-b-cyan-500/50">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Taxa de Cliques (CTR)</p>
          <p className="text-xl font-bold font-mono">{formatPercent(ctr)}</p>
        </div>
        {totalFechados > 0 && (
          <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl flex flex-col justify-between">
            <p className="text-[10px] uppercase font-bold text-emerald-500 tracking-widest mb-1">Custo Aquis. Cliente (CAC)</p>
            <p className="text-xl font-black font-mono text-emerald-400">{formatCurrency(cac)}</p>
          </div>
        )}
      </div>

      {crmVsMeta && (
        <Card className="border-blue-500/20 bg-card/60 backdrop-blur-md overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-base font-black tracking-tight">Atravessamento Interplanetário: Meta ➝ CRM</p>
                <p className="text-[11px] font-mono text-muted-foreground uppercase opacity-80">Relação volumétrica computada entre Lead Generation x Lead Landing</p>
              </div>
              <span className={`text-3xl font-black ${crmVsMeta.pct < 40 ? "text-rose-400" : crmVsMeta.pct <= 70 ? "text-yellow-400" : "text-emerald-400"}`}>{crmVsMeta.pct.toFixed(1)}%</span>
            </div>
            <div className="h-4 w-full rounded-full bg-background shadow-inner overflow-hidden border border-border/50">
              <div className={`h-full transition-all duration-700 ease-out ${crmVsMeta.pct < 40 ? "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]" : crmVsMeta.pct <= 70 ? "bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.6)]" : "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]"}`} style={{ width: `${Math.min(crmVsMeta.pct, 100)}%` }} />
            </div>
            <div className="flex items-center justify-between mt-3 text-xs uppercase tracking-widest font-bold">
              <span className="">CRMs Fixados: {crmVsMeta.crmLeads}</span>
              <span className="text-blue-500">Adc. Meta: {crmVsMeta.metaLeads}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {alertas.length > 0 && <AlertsPanel alertas={alertas.map((a) => ({ msg: `${a.ad}: ${a.msg}`, tipo: "aviso" as const }))} />}

      <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
        <CardHeader className="bg-muted/10 border-b border-border/50 py-4"><CardTitle className="text-sm uppercase tracking-widest font-black">Top Performers / Absorvedores de Verba</CardTitle></CardHeader>
        <CardContent className="p-0">
          {adStats.length > 0 ? (
            <div className="divide-y divide-border/30">
              {adStats.slice(0, 10).map((ad, idx) => {
                const fullName = ad.ad_name || ad.ad_id;
                const shortName = truncateAdName(fullName);
                return (
                  <div key={ad.ad_id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-transparent hover:bg-muted/10 transition-colors">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-xs text-muted-foreground font-mono shrink-0 shadow-inner">0{idx + 1}</div>
                      <div className="min-w-0 truncate pr-4">
                        <p className="font-bold text-sm truncate uppercase tracking-tight text-foreground/90" title={fullName}>{shortName}</p>
                        <p className="text-[10px] font-mono text-muted-foreground truncate uppercase opacity-50">{ad.campaign_name || "Campanha Genérica"}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-6 shrink-0 mt-3 md:mt-0 px-2">
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground opacity-70">Despesa</span>
                        <span className="text-xs font-mono font-bold text-foreground">{formatCurrency(ad.spend)}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground opacity-70">Aquisições</span>
                        <span className="text-xs font-mono font-bold text-blue-400">{ad.metaLeads}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] uppercase font-bold text-orange-500/70">CPL Constante</span>
                        <span className={`text-xs font-mono font-bold ${ad.cpl > cplLimite ? "text-rose-400" : "text-foreground"}`}>{ad.cpl > 0 ? formatCurrency(ad.cpl) : "—"}</span>
                      </div>
                      <div className="w-16 flex justify-end">
                        <Badge className={`text-[9px] uppercase tracking-widest font-black ${ad.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-muted/50 text-muted-foreground"}`}>
                          {ad.status === "ACTIVE" ? "Actv" : (ad.status || "Off").slice(0, 4)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-center py-10 opacity-60">Matriz Vazia: Nenhum payload processado.</p>
          )}
        </CardContent>
      </Card>

      {(() => {
        const pSpend = prevPerf.reduce((s, p) => s + Number(p.spend), 0);
        const pLeads = prevPerf.reduce((s, p) => s + p.leads, 0);
        const pCpl = pLeads > 0 ? pSpend / pLeads : 0;
        const delta = (cur: number, prev: number, inv = false) => {
          if (prev === 0) return null;
          const pct = ((cur - prev) / prev) * 100;
          return { pct, pos: inv ? pct < 0 : pct > 0 };
        };
        const comp = [
          { label: "Investido Retroativo", atual: formatCurrency(totalSpend), anterior: formatCurrency(pSpend), d: delta(totalSpend, pSpend, true) },
          { label: "Leads Retroativos", atual: String(totalLeads), anterior: String(pLeads), d: delta(totalLeads, pLeads) },
          { label: "CPL Escalado", atual: totalLeads > 0 ? formatCurrency(cplMedio) : "—", anterior: pLeads > 0 ? formatCurrency(pCpl) : "—", d: delta(cplMedio, pCpl, true) },
        ];

        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {comp.map((m) => (
              <div key={m.label} className="flex flex-col justify-between py-5 px-6 bg-muted/10 border border-border/30 rounded-2xl relative overflow-hidden">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-2 z-10">{m.label}</p>
                <div className="flex items-end gap-3 z-10">
                  <p className="text-2xl font-black">{m.atual}</p>
                  {m.d && <span className={`text-[10px] uppercase font-bold tracking-widest mb-1.5 px-2 py-0.5 rounded-full ${m.d.pos ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>{m.d.pos ? "Cresceu" : "Recuou"} {Math.abs(m.d.pct).toFixed(0)}%</span>}
                </div>
                <p className="text-[10px] font-mono text-muted-foreground mt-1 opacity-50 z-10">Marco Anterior: {m.anterior}</p>
                {m.d && <div className={`absolute -right-4 -bottom-4 opacity-5 blur-sm scale-150 rotate-12 ${m.d.pos ? "text-emerald-500" : "text-rose-500"}`}>{m.d.pos ? <TrendingUp size={100} /> : <TrendingUp size={100} />}</div>}
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
