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
import { Save, ChevronDown, ChevronRight, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/format";

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
  const [mesDesempenho, setMesDesempenho] = useState(() => new Date().toISOString().slice(0, 7));
  const [desempenho, setDesempenho] = useState({
    entradaTotal: 0, mrrFechado: 0, ltvFechado: 0, ticketMedio: 0, qtdContratos: 0,
    reunioesMarcadas: 0, reunioesFeitas: 0, noShow: 0, taxaNoShow: 0,
    ganhos: 0, comissaoTotal: 0,
  });

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

  // Carregar dados de desempenho por mês selecionado
  useEffect(() => {
    if (!session?.closerId) return;
    (async () => {
      const [{ data: cts }, { data: lancs }] = await Promise.all([
        supabase.from("contratos").select("valor_entrada, mrr, valor_total_projeto")
          .eq("closer_id", session.closerId).eq("mes_referencia", mesDesempenho),
        supabase.from("lancamentos_diarios").select("reunioes_marcadas, reunioes_feitas, no_show, ganhos, comissao_dia")
          .eq("closer_id", session.closerId).eq("mes_referencia", mesDesempenho),
      ]);
      const contratosArr = cts || [];
      const lancArr = lancs || [];
      const entradaTotal = contratosArr.reduce((s, c) => s + Number(c.valor_entrada || 0), 0);
      const mrrFechado = contratosArr.reduce((s, c) => s + Number(c.mrr || 0), 0);
      const ltvFechado = contratosArr.reduce((s, c) => s + Number(c.valor_total_projeto || 0), 0);
      const qtdContratos = contratosArr.length;
      const ticketMedio = qtdContratos > 0 ? ltvFechado / qtdContratos : 0;
      const reunioesMarcadas = lancArr.reduce((s, l) => s + Number(l.reunioes_marcadas || 0), 0);
      const reunioesFeitas = lancArr.reduce((s, l) => s + Number(l.reunioes_feitas || 0), 0);
      const noShowTotal = lancArr.reduce((s, l) => s + Number(l.no_show || 0), 0);
      const taxaNoShow = reunioesMarcadas > 0 ? (noShowTotal / reunioesMarcadas) * 100 : 0;
      const ganhos = lancArr.reduce((s, l) => s + Number(l.ganhos || 0), 0);
      const comissaoTotal = lancArr.reduce((s, l) => s + Number(l.comissao_dia || 0), 0);
      setDesempenho({ entradaTotal, mrrFechado, ltvFechado, ticketMedio, qtdContratos, reunioesMarcadas, reunioesFeitas, noShow: noShowTotal, taxaNoShow, ganhos, comissaoTotal });
    })();
  }, [session?.closerId, mesDesempenho]);

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

      {/* Desempenho */}
      <DesempenhoSection desempenho={desempenho} mes={mesDesempenho} onMesChange={setMesDesempenho} />

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

      {historico.length > 0 && <HistoricoColapsavel historico={historico} data={data} onSelectData={setData} />}
    </div>
  );
}

function HistoricoColapsavel({ historico, data, onSelectData }: { historico: { data: string; agendadas: number; feitas: number }[]; data: string; onSelectData: (d: string) => void }) {
  const [aberto, setAberto] = useState(false);

  return (
    <Card>
      <button onClick={() => setAberto(!aberto)} className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-accent/5 transition-colors">
        <span className="text-base font-semibold">Histórico do Mês</span>
        {aberto ? <ChevronDown size={18} className="text-muted-foreground" /> : <ChevronRight size={18} className="text-muted-foreground" />}
      </button>
      {aberto && (
        <CardContent className="pt-0">
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
                  <TableRow key={h.data} className={h.data === data ? "bg-primary/5" : ""} onClick={() => onSelectData(h.data)} style={{ cursor: "pointer" }}>
                    <TableCell>{new Date(h.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</TableCell>
                    <TableCell className="text-right">{h.agendadas}</TableCell>
                    <TableCell className="text-right">{h.feitas}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function DesempenhoSection({ desempenho, mes, onMesChange }: {
  desempenho: {
    entradaTotal: number; mrrFechado: number; ltvFechado: number; ticketMedio: number; qtdContratos: number;
    reunioesMarcadas: number; reunioesFeitas: number; noShow: number; taxaNoShow: number;
    ganhos: number; comissaoTotal: number;
  };
  mes: string;
  onMesChange: (m: string) => void;
}) {
  const d = desempenho;
  const ano = parseInt(mes.slice(0, 4));
  const mesIdx = parseInt(mes.slice(5)) - 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Calendar size={16} />Desempenho</CardTitle>
          <div className="flex items-center gap-1">
            <select value={ano} onChange={(e) => onMesChange(`${e.target.value}-${String(mesIdx + 1).padStart(2, "0")}`)}
              className="text-xs bg-transparent border rounded-md px-2 py-1">
              {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <div className="flex bg-muted rounded-md p-0.5">
              {MESES.map((label, i) => {
                const m = `${ano}-${String(i + 1).padStart(2, "0")}`;
                return (
                  <button key={m} onClick={() => onMesChange(m)}
                    className={`px-1.5 py-0.5 text-[9px] font-medium rounded ${mes === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Reuniões */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Reuniões</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-card/30 border border-border/50 rounded-lg p-2.5">
              <p className="text-[9px] text-muted-foreground">Marcadas</p>
              <p className="text-lg font-bold">{d.reunioesMarcadas}</p>
            </div>
            <div className="bg-card/30 border border-border/50 rounded-lg p-2.5">
              <p className="text-[9px] text-muted-foreground">Feitas</p>
              <p className="text-lg font-bold text-blue-400">{d.reunioesFeitas}</p>
            </div>
            <div className="bg-card/30 border border-border/50 rounded-lg p-2.5">
              <p className="text-[9px] text-muted-foreground">No-Show</p>
              <p className="text-lg font-bold text-orange-400">{d.noShow}</p>
            </div>
            <div className="bg-card/30 border border-border/50 rounded-lg p-2.5">
              <p className="text-[9px] text-muted-foreground">Taxa No-Show</p>
              <p className={`text-lg font-bold ${d.taxaNoShow > 20 ? "text-red-400" : d.taxaNoShow > 10 ? "text-orange-400" : "text-emerald-400"}`}>{d.taxaNoShow.toFixed(0)}%</p>
            </div>
          </div>
        </div>

        {/* Financeiro */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Financeiro</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="bg-card/30 border border-border/50 rounded-lg p-2.5">
              <p className="text-[9px] text-muted-foreground">Entrada</p>
              <p className="text-lg font-bold text-emerald-400">{formatCurrency(d.entradaTotal)}</p>
            </div>
            <div className="bg-card/30 border border-border/50 rounded-lg p-2.5">
              <p className="text-[9px] text-muted-foreground">MRR Fechado</p>
              <p className="text-lg font-bold">{formatCurrency(d.mrrFechado)}</p>
            </div>
            <div className="bg-card/30 border border-border/50 rounded-lg p-2.5">
              <p className="text-[9px] text-muted-foreground">LTV Fechado</p>
              <p className="text-lg font-bold">{formatCurrency(d.ltvFechado)}</p>
            </div>
            <div className="bg-card/30 border border-border/50 rounded-lg p-2.5">
              <p className="text-[9px] text-muted-foreground">Ticket Médio</p>
              <p className="text-lg font-bold">{formatCurrency(d.ticketMedio)}</p>
            </div>
            <div className="bg-card/30 border border-border/50 rounded-lg p-2.5">
              <p className="text-[9px] text-muted-foreground">Ganhos (Vendas)</p>
              <p className="text-lg font-bold text-green-400">{formatCurrency(d.ganhos)}</p>
            </div>
            <div className="bg-card/30 border border-border/50 rounded-lg p-2.5">
              <p className="text-[9px] text-muted-foreground">Comissão</p>
              <p className="text-lg font-bold text-purple-400">{formatCurrency(d.comissaoTotal)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
