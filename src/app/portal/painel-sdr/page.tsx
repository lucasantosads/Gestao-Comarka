"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumber, formatPercent } from "@/lib/format";
import { toast } from "sonner";
import { Save } from "lucide-react";

export default function PainelSdrPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState(() => new Date().toISOString().split("T")[0]);
  const [leadsRecebidos, setLeadsRecebidos] = useState(0);
  const [contatosRealizados, setContatosRealizados] = useState(0);
  const [conexoesCriadas, setConexoesCriadas] = useState(0);
  const [reunioesAgendadas, setReunioesAgendadas] = useState(0);
  const [followUps, setFollowUps] = useState(0);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [historico, setHistorico] = useState<Record<string, unknown>[]>([]);
  const [metas, setMetas] = useState<Record<string, number> | null>(null);
  const [totaisMes, setTotaisMes] = useState({ leads: 0, contatos: 0, conexoes: 0, reunioes: 0, followups: 0 });

  const sdrId = user?.entityId;
  const mes = data.slice(0, 7);

  useEffect(() => {
    if (!authLoading && !user) router.push("/portal");
  }, [authLoading, user, router]);

  const loadData = useCallback(async () => {
    if (!sdrId) return;

    // Lancamento do dia
    const { data: lanc } = await supabase.from("lancamentos_sdr").select("*")
      .eq("sdr_id", sdrId).eq("data", data).single();
    if (lanc) {
      setExistingId(lanc.id);
      setLeadsRecebidos(lanc.leads_recebidos || 0);
      setContatosRealizados(lanc.contatos_realizados || 0);
      setConexoesCriadas(lanc.conexoes_feitas || 0);
      setReunioesAgendadas(lanc.reunioes_agendadas || 0);
      setFollowUps(lanc.follow_ups_feitos || 0);
    } else {
      setExistingId(null);
      setLeadsRecebidos(0); setContatosRealizados(0); setConexoesCriadas(0); setReunioesAgendadas(0); setFollowUps(0);
    }

    // Historico do mes
    const { data: hist } = await supabase.from("lancamentos_sdr").select("*")
      .eq("sdr_id", sdrId).eq("mes_referencia", mes).order("data", { ascending: false });
    setHistorico(hist || []);

    // Totais do mes
    const lancs = hist || [];
    setTotaisMes({
      leads: lancs.reduce((s: number, l: Record<string, unknown>) => s + Number(l.leads_recebidos || 0), 0),
      contatos: lancs.reduce((s: number, l: Record<string, unknown>) => s + Number(l.contatos_realizados || 0), 0),
      conexoes: lancs.reduce((s: number, l: Record<string, unknown>) => s + Number(l.conexoes_feitas || 0), 0),
      reunioes: lancs.reduce((s: number, l: Record<string, unknown>) => s + Number(l.reunioes_agendadas || 0), 0),
      followups: lancs.reduce((s: number, l: Record<string, unknown>) => s + Number(l.follow_ups_feitos || 0), 0),
    });

    // Metas
    const { data: meta } = await supabase.from("metas_sdr").select("*")
      .eq("sdr_id", sdrId).eq("mes_referencia", mes).single();
    setMetas(meta);
  }, [sdrId, data, mes]);

  useEffect(() => { loadData(); }, [loadData]);

  const salvar = async () => {
    if (!sdrId) return;
    setSaving(true);
    const payload = {
      sdr_id: sdrId, data, mes_referencia: mes,
      leads_recebidos: leadsRecebidos, contatos_realizados: contatosRealizados,
      conexoes_feitas: conexoesCriadas, reunioes_agendadas: reunioesAgendadas,
      follow_ups_feitos: followUps,
    };
    const { error } = existingId
      ? await supabase.from("lancamentos_sdr").update(payload).eq("id", existingId)
      : await supabase.from("lancamentos_sdr").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Salvo!"); loadData(); }
    setSaving(false);
  };

  if (!user || authLoading) return <div className="h-64 flex items-center justify-center text-muted-foreground">Carregando...</div>;

  const taxaAgendamento = totaisMes.conexoes > 0 ? (totaisMes.reunioes / totaisMes.conexoes) * 100 : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Painel SDR</h1>

      {/* KPIs do mes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="pt-3 pb-2"><p className="text-[10px] text-muted-foreground">Leads Recebidos</p><p className="text-lg font-bold">{formatNumber(totaisMes.leads)}</p></CardContent></Card>
        <Card><CardContent className="pt-3 pb-2"><p className="text-[10px] text-muted-foreground">Contatos</p><p className="text-lg font-bold">{formatNumber(totaisMes.contatos)}</p></CardContent></Card>
        <Card><CardContent className="pt-3 pb-2"><p className="text-[10px] text-muted-foreground">Reunioes Agendadas</p><p className="text-lg font-bold text-green-400">{formatNumber(totaisMes.reunioes)}</p></CardContent></Card>
        <Card><CardContent className="pt-3 pb-2"><p className="text-[10px] text-muted-foreground">Taxa Agendamento</p><p className="text-lg font-bold">{formatPercent(taxaAgendamento)}</p></CardContent></Card>
      </div>

      {/* Metas */}
      {metas && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Meta Contatos", atual: totaisMes.contatos, meta: metas.meta_contatos },
            { label: "Meta Conexoes", atual: totaisMes.conexoes, meta: metas.meta_conexoes },
            { label: "Meta Reunioes", atual: totaisMes.reunioes, meta: metas.meta_reunioes_agendadas },
          ].map((m) => {
            const pct = m.meta ? (m.atual / m.meta) * 100 : 0;
            return (
              <Card key={m.label}>
                <CardContent className="pt-3 pb-2">
                  <p className="text-[10px] text-muted-foreground">{m.label}</p>
                  <p className="text-sm font-bold">{m.atual} / {m.meta || "—"}</p>
                  <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                    <div className={`h-1.5 rounded-full ${pct >= 100 ? "bg-green-400" : pct >= 70 ? "bg-yellow-400" : "bg-red-400"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{pct.toFixed(0)}%</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Lancamento diario */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Lançamento Diário</CardTitle>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-36 text-xs" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">Leads Recebidos</Label><Input type="number" min={0} value={leadsRecebidos} onChange={(e) => setLeadsRecebidos(Number(e.target.value))} /></div>
            <div className="space-y-1"><Label className="text-xs">Contatos</Label><Input type="number" min={0} value={contatosRealizados} onChange={(e) => setContatosRealizados(Number(e.target.value))} /></div>
            <div className="space-y-1"><Label className="text-xs">Conexoes</Label><Input type="number" min={0} value={conexoesCriadas} onChange={(e) => setConexoesCriadas(Number(e.target.value))} /></div>
            <div className="space-y-1"><Label className="text-xs">Reunioes Agendadas</Label><Input type="number" min={0} value={reunioesAgendadas} onChange={(e) => setReunioesAgendadas(Number(e.target.value))} /></div>
            <div className="space-y-1"><Label className="text-xs">Follow Ups</Label><Input type="number" min={0} value={followUps} onChange={(e) => setFollowUps(Number(e.target.value))} /></div>
          </div>
          <Button className="mt-3" size="sm" onClick={salvar} disabled={saving}>
            <Save size={14} className="mr-1" />{saving ? "Salvando..." : "Salvar"}
          </Button>
        </CardContent>
      </Card>

      {/* Historico */}
      {historico.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Histórico do Mês</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b">
                  <th className="text-left py-2 px-2">Data</th>
                  <th className="text-center py-2 px-2">Leads</th>
                  <th className="text-center py-2 px-2">Contatos</th>
                  <th className="text-center py-2 px-2">Conexoes</th>
                  <th className="text-center py-2 px-2">Reunioes</th>
                  <th className="text-center py-2 px-2">Follow Ups</th>
                </tr></thead>
                <tbody>
                  {historico.map((h) => (
                    <tr key={h.id as string} className="border-b">
                      <td className="py-1.5 px-2 font-mono">{(h.data as string)?.slice(8, 10)}/{(h.data as string)?.slice(5, 7)}</td>
                      <td className="text-center py-1.5 px-2">{h.leads_recebidos as number}</td>
                      <td className="text-center py-1.5 px-2">{h.contatos_realizados as number}</td>
                      <td className="text-center py-1.5 px-2">{h.conexoes_feitas as number}</td>
                      <td className="text-center py-1.5 px-2">{h.reunioes_agendadas as number}</td>
                      <td className="text-center py-1.5 px-2">{h.follow_ups_feitos as number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
