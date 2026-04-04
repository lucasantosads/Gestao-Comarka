"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AdsMetadata, AdsPerformance, LeadAdsAttribution } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { AlertTriangle, CheckCircle, Clock, Brain } from "lucide-react";
import { toast } from "sonner";
import { AlertaDiagnosticoModal, type AlertaDiagnosticoData } from "@/components/alerta-diagnostico-modal";

interface Snooze { ad_id: string; tipo: string; snooze_ate: string }

export default function TrafegoAlertasPage() {
  const [metadata, setMetadata] = useState<AdsMetadata[]>([]);
  const [performance, setPerformance] = useState<AdsPerformance[]>([]);
  const [leads, setLeads] = useState<LeadAdsAttribution[]>([]);
  const [snoozes, setSnoozes] = useState<Snooze[]>([]);
  const [loading, setLoading] = useState(true);

  const [cplLimite, setCplLimite] = useState(100);
  const [ctrMinimo, setCtrMinimo] = useState(0.8);
  const [freqMaxima, setFreqMaxima] = useState(3);
  const [zeroLeadsHoras, setZeroLeadsHoras] = useState(48);
  const [zeroLeadsGasto, setZeroLeadsGasto] = useState(50);
  const [ctrImpMin, setCtrImpMin] = useState(500);
  const [cplAtivo, setCplAtivo] = useState(true);
  const [ctrAtivo, setCtrAtivo] = useState(true);
  const [freqAtivo, setFreqAtivo] = useState(true);
  const [zeroAtivo, setZeroAtivo] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [alertaSelecionado, setAlertaSelecionado] = useState<AlertaDiagnosticoData | null>(null);

  useEffect(() => {
    const s1 = localStorage.getItem("trafego_cpl_limite"); if (s1) setCplLimite(Number(s1));
    const s2 = localStorage.getItem("trafego_ctr_minimo"); if (s2) setCtrMinimo(Number(s2));
    const s3 = localStorage.getItem("trafego_freq_maxima"); if (s3) setFreqMaxima(Number(s3));
    const s4 = localStorage.getItem("trafego_zero_horas"); if (s4) setZeroLeadsHoras(Number(s4));
    const s5 = localStorage.getItem("trafego_zero_gasto"); if (s5) setZeroLeadsGasto(Number(s5));
    const s6 = localStorage.getItem("trafego_ctr_imp_min"); if (s6) setCtrImpMin(Number(s6));
    const s7 = localStorage.getItem("trafego_cpl_ativo"); if (s7) setCplAtivo(s7 === "true");
    const s8 = localStorage.getItem("trafego_ctr_ativo"); if (s8) setCtrAtivo(s8 === "true");
    const s9 = localStorage.getItem("trafego_freq_ativo"); if (s9) setFreqAtivo(s9 === "true");
    const s10 = localStorage.getItem("trafego_zero_ativo"); if (s10) setZeroAtivo(s10 === "true");
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const d30 = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const [{ data: m }, { data: p }, { data: l }, { data: sn }] = await Promise.all([
      supabase.from("ads_metadata").select("*").eq("status", "ACTIVE"),
      supabase.from("ads_performance").select("*").gte("data_ref", d30).order("data_ref", { ascending: false }),
      supabase.from("leads_ads_attribution").select("*").gte("created_at", d30 + "T00:00:00"),
      supabase.from("alertas_snooze").select("*").gte("snooze_ate", new Date().toISOString()),
    ]);
    setMetadata((m || []) as AdsMetadata[]);
    setPerformance((p || []) as AdsPerformance[]);
    setLeads((l || []) as LeadAdsAttribution[]);
    setSnoozes((sn || []) as Snooze[]);
    setLoading(false);
  }

  void 0; // saveSetting movido para /config

  const isSnoozed = (adId: string, tipo: string) => snoozes.some((s) => s.ad_id === adId && s.tipo === tipo);

  const snoozeAlerta = async (adId: string, tipo: string) => {
    const snoozeAte = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("alertas_snooze").insert({ ad_id: adId, tipo, snooze_ate: snoozeAte });
    setSnoozes((prev) => [...prev, { ad_id: adId, tipo, snooze_ate: snoozeAte }]);
    toast.success("Alerta silenciado por 24h");
  };

  function abrirDiagnostico(ad: typeof alertas[0], prob: (typeof alertas[0])["problemas"][0]) {
    const perfs = performance.filter((p) => p.ad_id === ad.ad_id).sort((a, b) => b.data_ref.localeCompare(a.data_ref));
    const d2str = new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0];
    const d7str = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    const perfs7d = perfs.filter((p) => p.data_ref >= d7str && p.frequencia > 0);
    const perfs2d = perfs.filter((p) => p.data_ref >= d2str);
    const d3str = new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0];
    const perfs3d = perfs.filter((p) => p.data_ref >= d3str);
    const imp3d = perfs3d.reduce((s, p) => s + p.impressoes, 0);
    const clk3d = perfs3d.reduce((s, p) => s + p.cliques, 0);

    setAlertaSelecionado({
      tipo: prob.tipo,
      severidade: prob.severidade,
      adNome: ad.ad_name || ad.ad_id,
      campanhaNome: ad.campaign_name || "—",
      valorAtual: prob.valor,
      threshold: prob.threshold,
      spend30d: ad.spend,
      leads30d: ad.totalLeads,
      cpl30d: ad.cpl,
      ctr3d: imp3d > 0 ? (clk3d / imp3d) * 100 : 0,
      freqMedia7d: perfs7d.length > 0 ? perfs7d.reduce((s, p) => s + p.frequencia, 0) / perfs7d.length : 0,
      spend2d: perfs2d.reduce((s, p) => s + Number(p.spend), 0),
      leads2d: perfs2d.reduce((s, p) => s + p.leads, 0),
      perfDiario: perfs.slice(0, 14).map((p) => ({
        data_ref: p.data_ref,
        spend: Number(p.spend),
        leads: p.leads,
        impressoes: p.impressoes,
        cliques: p.cliques,
        ctr: p.ctr,
        cpl: p.cpl,
        frequencia: p.frequencia,
      })),
    });
    setModalAberto(true);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  const d3 = new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0];
  const d2 = new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0];
  const d7 = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  type AlertaItem = {
    tipo: "cpl_max" | "ctr_min" | "frequencia_max" | "zero_leads";
    severidade: "danger" | "warning";
    msg: string;
    sugestao?: string;
    valor: string;
    threshold: string;
  };

  const alertas = metadata.map((ad) => {
    const perfs = performance.filter((p) => p.ad_id === ad.ad_id);
    const metaLeads = perfs.reduce((s, p) => s + p.leads, 0);
    const crmLeads = leads.filter((l) => l.ad_id === ad.ad_id).length;
    const totalLeads = crmLeads > 0 ? crmLeads : metaLeads;
    const spend = perfs.reduce((s, p) => s + Number(p.spend), 0);
    const cpl = totalLeads > 0 ? spend / totalLeads : 0;

    // CTR últimos 3 dias
    const perfs3d = perfs.filter((p) => p.data_ref >= d3);
    const imp3d = perfs3d.reduce((s, p) => s + p.impressoes, 0);
    const clk3d = perfs3d.reduce((s, p) => s + p.cliques, 0);
    const ctr3d = imp3d > 0 ? (clk3d / imp3d) * 100 : 0;

    // Frequência últimos 7 dias
    const perfs7d = perfs.filter((p) => p.data_ref >= d7 && p.frequencia > 0);
    const freqMedia = perfs7d.length > 0 ? perfs7d.reduce((s, p) => s + p.frequencia, 0) / perfs7d.length : 0;

    // Gasto últimos 2 dias sem leads
    const perfs2d = perfs.filter((p) => p.data_ref >= d2);
    const spend2d = perfs2d.reduce((s, p) => s + Number(p.spend), 0);
    const leads2d = perfs2d.reduce((s, p) => s + p.leads, 0);

    const problemas: AlertaItem[] = [];

    if (cplAtivo && cpl > cplLimite && totalLeads > 0 && !isSnoozed(ad.ad_id, "cpl_max")) {
      problemas.push({ tipo: "cpl_max", severidade: "danger", msg: `CPL de ${formatCurrency(cpl)} — acima de ${formatCurrency(cplLimite)}`, valor: formatCurrency(cpl), threshold: formatCurrency(cplLimite) });
    }
    if (ctrAtivo && ctr3d < ctrMinimo && imp3d > ctrImpMin && !isSnoozed(ad.ad_id, "ctr_min")) {
      problemas.push({ tipo: "ctr_min", severidade: "warning", msg: `CTR de ${ctr3d.toFixed(2)}% nos últimos 3 dias — abaixo de ${ctrMinimo}%`, sugestao: "Revisar criativo, headline ou CTA. Testar novo formato (Reels vs Feed).", valor: ctr3d.toFixed(2) + "%", threshold: ctrMinimo + "%" });
    }
    if (freqAtivo && freqMedia > freqMaxima && !isSnoozed(ad.ad_id, "frequencia_max")) {
      problemas.push({ tipo: "frequencia_max", severidade: "warning", msg: `Frequência de ${freqMedia.toFixed(1)}x nos últimos 7 dias — audiência saturada`, sugestao: "Considere rotacionar o criativo ou expandir audiência.", valor: freqMedia.toFixed(1) + "x", threshold: freqMaxima + "x" });
    }
    if (zeroAtivo && spend2d > zeroLeadsGasto && leads2d === 0 && !isSnoozed(ad.ad_id, "zero_leads")) {
      problemas.push({ tipo: "zero_leads", severidade: "danger", msg: `Zero leads em ${zeroLeadsHoras}h com R$ ${spend2d.toFixed(2)} gastos`, sugestao: "Verificar formulário, landing page ou segmentação. Possível problema técnico.", valor: `R$ ${spend2d.toFixed(2)} sem leads`, threshold: `0 leads / ${zeroLeadsHoras}h` });
    }

    return { ...ad, spend, totalLeads, cpl, ctr3d, freqMedia, problemas };
  }).filter((a) => a.problemas.length > 0);

  const totalAlertas = alertas.reduce((s, a) => s + a.problemas.length, 0);
  const criticos = alertas.reduce((s, a) => s + a.problemas.filter((p) => p.severidade === "danger").length, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Alertas de Tráfego</h1>

      {/* Link para config */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
        <span>Thresholds configuráveis em</span>
        <a href="/config" className="text-primary hover:underline">Configurações</a>
        <span>· CPL: {formatCurrency(cplLimite)} · CTR: {ctrMinimo}% · Freq: {freqMaxima}x</span>
      </div>

      {/* Config removida — agora em /config */}

      {/* Resumo */}
      <div className="flex gap-3">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${criticos > 0 ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}`}>
          {criticos > 0 ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
          {criticos > 0 ? `${criticos} alerta${criticos > 1 ? "s" : ""} crítico${criticos > 1 ? "s" : ""}` : "Nenhum alerta crítico"}
        </div>
        {totalAlertas - criticos > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-yellow-500/10 text-yellow-400">
            <AlertTriangle size={16} /> {totalAlertas - criticos} aviso{totalAlertas - criticos > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Lista de alertas */}
      {alertas.length === 0 ? (
        <Card>
          <CardContent className="py-8 flex flex-col items-center gap-2">
            <CheckCircle size={32} className="text-green-500" />
            <p className="text-sm font-medium">Tudo certo!</p>
            <p className="text-xs text-muted-foreground">Nenhum anúncio ativo com problemas detectados</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium text-xs">Tipo</th>
                    <th className="px-4 py-2 text-left font-medium text-xs">Anúncio</th>
                    <th className="px-4 py-2 text-left font-medium text-xs">Campanha</th>
                    <th className="px-4 py-2 text-right font-medium text-xs">Valor Atual</th>
                    <th className="px-4 py-2 text-right font-medium text-xs">Threshold</th>
                    <th className="px-4 py-2 text-left font-medium text-xs">Sugestão</th>
                    <th className="px-4 py-2 text-right font-medium text-xs">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {alertas.flatMap((ad) =>
                    ad.problemas.map((p, i) => (
                      <tr key={`${ad.ad_id}-${i}`} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-2">
                          <Badge className={`text-[10px] ${p.severidade === "danger" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                            {p.tipo === "cpl_max" ? "CPL" : p.tipo === "ctr_min" ? "CTR" : p.tipo === "frequencia_max" ? "Frequência" : "Zero Leads"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-xs font-medium max-w-[160px] truncate">{ad.ad_name || ad.ad_id}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground max-w-[120px] truncate">{ad.campaign_name || "—"}</td>
                        <td className="px-4 py-2 text-xs text-right font-bold">{p.valor}</td>
                        <td className="px-4 py-2 text-xs text-right text-muted-foreground">{p.threshold}</td>
                        <td className="px-4 py-2 text-[10px] text-muted-foreground max-w-[200px]">{p.sugestao || "—"}</td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] text-purple-400" onClick={() => abrirDiagnostico(ad, p)}>
                              <Brain size={10} className="mr-1" />IA
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground" onClick={() => snoozeAlerta(ad.ad_id, p.tipo)}>
                              <Clock size={10} className="mr-1" />24h
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertaDiagnosticoModal open={modalAberto} onClose={() => setModalAberto(false)} alerta={alertaSelecionado} />
    </div>
  );
}
