"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { MetaCloser, Contrato } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GaugeChart } from "@/components/gauge-chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Save } from "lucide-react";

export default function PortalPainelPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const session = user ? { closerId: user.entityId || "", closerNome: user.nome } : null;
  const [data, setData] = useState(() => new Date().toISOString().split("T")[0]);
  const [reunioesAgendadas, setReunioesAgendadas] = useState(0);
  const [reunioesFeitas, setReunioesFeitas] = useState(0);
  const [saving, setSaving] = useState(false);
  const [existingLancId, setExistingLancId] = useState<string | null>(null);
  const [historico, setHistorico] = useState<
    { data: string; agendadas: number; feitas: number }[]
  >([]);
  const [metaCloser, setMetaCloser] = useState<MetaCloser | null>(null);
  const [mrrTotal, setMrrTotal] = useState(0);
  const [ltvTotal, setLtvTotal] = useState(0);
  const [contratos, setContratos] = useState(0);
  const [reunioesTotalMes, setReunioesTotalMes] = useState({ agendadas: 0, feitas: 0 });

  useEffect(() => {
    if (!authLoading && !user) router.push("/portal");
  }, [authLoading, user, router]);

  const loadDay = useCallback(async () => {
    if (!session) return;
    const { data: lanc } = await supabase
      .from("lancamentos_diarios")
      .select("*")
      .eq("closer_id", session.closerId)
      .eq("data", data)
      .single();

    if (lanc) {
      setExistingLancId(lanc.id);
      setReunioesAgendadas(lanc.reunioes_marcadas);
      setReunioesFeitas(lanc.reunioes_feitas);
    } else {
      setExistingLancId(null);
      setReunioesAgendadas(0);
      setReunioesFeitas(0);
    }
  }, [session, data]);

  const loadHistorico = useCallback(async () => {
    if (!session) return;
    const mesRef = data.slice(0, 7);
    const [{ data: lances }, { data: metaData }, { data: contratosData }] = await Promise.all([
      supabase
        .from("lancamentos_diarios")
        .select("*")
        .eq("closer_id", session.closerId)
        .eq("mes_referencia", mesRef)
        .order("data", { ascending: false }),
      supabase
        .from("metas_closers")
        .select("*")
        .eq("closer_id", session.closerId)
        .eq("mes_referencia", mesRef)
        .single(),
      supabase
        .from("contratos")
        .select("mrr,valor_total_projeto")
        .eq("closer_id", session.closerId)
        .eq("mes_referencia", mesRef),
    ]);

    if (lances) {
      setHistorico(
        lances.map((l) => ({
          data: l.data,
          agendadas: l.reunioes_marcadas,
          feitas: l.reunioes_feitas,
        }))
      );
    }
    setMetaCloser((metaData as MetaCloser) || null);
    const cts = (contratosData || []) as Contrato[];
    setMrrTotal(cts.reduce((s, c) => s + Number(c.mrr), 0));
    setLtvTotal(cts.reduce((s, c) => s + Number(c.valor_total_projeto), 0));
    setContratos(cts.length);
    if (lances) {
      const totalAg = lances.reduce((s: number, l: { reunioes_marcadas: number }) => s + l.reunioes_marcadas, 0);
      const totalFt = lances.reduce((s: number, l: { reunioes_feitas: number }) => s + l.reunioes_feitas, 0);
      setReunioesTotalMes({ agendadas: totalAg, feitas: totalFt });
    }
  }, [session, data]);

  useEffect(() => {
    loadDay();
    loadHistorico();
  }, [loadDay, loadHistorico]);

  async function handleSave() {
    if (!session) return;
    setSaving(true);

    const payload = {
      closer_id: session.closerId,
      data,
      reunioes_marcadas: reunioesAgendadas,
      reunioes_feitas: reunioesFeitas,
      ganhos: 0,
      mrr_dia: 0,
      ltv: 0,
      obs: null,
    };

    if (existingLancId) {
      const { error } = await supabase
        .from("lancamentos_diarios")
        .update(payload)
        .eq("id", existingLancId);
      if (error) { toast.error("Erro: " + error.message); setSaving(false); return; }
    } else {
      const { data: newLanc, error } = await supabase
        .from("lancamentos_diarios")
        .insert(payload)
        .select("id")
        .single();
      if (error || !newLanc) { toast.error("Erro: " + (error?.message || "erro")); setSaving(false); return; }
      setExistingLancId(newLanc.id);
    }

    toast.success("Lançamento salvo!");
    setSaving(false);
    loadHistorico();
  }

  if (!session || authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const noShow = Math.max(0, reunioesAgendadas - reunioesFeitas);

  return (
    <div className="w-full max-w-3xl space-y-6">
      <h1 className="text-xl font-bold">Ola, {session.closerNome}</h1>

      {/* KPIs do mes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="pt-3 pb-2"><p className="text-[10px] text-muted-foreground">Contratos</p><p className="text-lg font-bold text-green-400">{contratos}</p></CardContent></Card>
        <Card><CardContent className="pt-3 pb-2"><p className="text-[10px] text-muted-foreground">MRR</p><p className="text-lg font-bold">{new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(mrrTotal)}</p></CardContent></Card>
        <Card><CardContent className="pt-3 pb-2"><p className="text-[10px] text-muted-foreground">Reunioes Feitas</p><p className="text-lg font-bold">{reunioesTotalMes.feitas}</p></CardContent></Card>
        <Card><CardContent className="pt-3 pb-2"><p className="text-[10px] text-muted-foreground">Conversao</p><p className="text-lg font-bold">{reunioesTotalMes.feitas > 0 ? ((contratos / reunioesTotalMes.feitas) * 100).toFixed(0) : 0}%</p></CardContent></Card>
      </div>

      {/* Gauges de Metas */}
      {metaCloser && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GaugeChart
            label="Entradas (MRR)"
            current={mrrTotal}
            target={Number(metaCloser.meta_mrr)}
          />
          <GaugeChart
            label="Faturamento / LTV"
            current={ltvTotal}
            target={Number(metaCloser.meta_ltv)}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lançamento Diário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Data</Label>
            <Input
              type="date"
              value={data}
              max={new Date().toISOString().split("T")[0]}
              onChange={(e) => setData(e.target.value)}
            />
          </div>

          {existingLancId && (
            <div className="text-sm text-blue-400 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              Editando lancamento existente
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Reunioes Agendadas</Label>
              <Input type="number" min={0} value={reunioesAgendadas} onChange={(e) => setReunioesAgendadas(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Reunioes Feitas</Label>
              <Input type="number" min={0} max={reunioesAgendadas} value={reunioesFeitas} onChange={(e) => setReunioesFeitas(Math.min(Number(e.target.value), reunioesAgendadas))} />
            </div>
          </div>

          <div className="p-3 bg-muted rounded-lg flex justify-between items-center">
            <span className="text-sm text-muted-foreground">No Show</span>
            <span className="font-bold text-lg">{noShow}</span>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
            <Save size={18} className="mr-2" />
            {saving ? "Salvando..." : existingLancId ? "Atualizar" : "Salvar"}
          </Button>
        </CardContent>
      </Card>

      {historico.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico do Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Agendadas</TableHead>
                    <TableHead className="text-right">Feitas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.map((h) => (
                    <TableRow key={h.data} className={h.data === data ? "bg-primary/5" : ""} onClick={() => setData(h.data)} style={{ cursor: "pointer" }}>
                      <TableCell>
                        {new Date(h.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      </TableCell>
                      <TableCell className="text-right">{h.agendadas}</TableCell>
                      <TableCell className="text-right">{h.feitas}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
