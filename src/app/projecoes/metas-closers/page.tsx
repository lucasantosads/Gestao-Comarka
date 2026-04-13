"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Closer, LancamentoDiario, MetaCloser } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, getCurrentMonth } from "@/lib/format";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Minus, Check, Edit2 } from "lucide-react";

interface CloserEvolution {
  id: string;
  nome: string;
  meses: { mes: string; contratos: number; mrr: number; metaContratos: number; bateuMeta: boolean }[];
  tendencia: "crescendo" | "estavel" | "caindo";
  metaAtual: number;
  metaSugerida: number;
  motivo: string;
  contratosAtual: number;
  mrrAtual: number;
}

function calcTendencia(meses: { contratos: number }[]): "crescendo" | "estavel" | "caindo" {
  if (meses.length < 2) return "estavel";
  const last3 = meses.slice(-3);
  if (last3.length < 2) return "estavel";
  const first = last3[0].contratos;
  const last = last3[last3.length - 1].contratos;
  if (last > first * 1.15) return "crescendo";
  if (last < first * 0.85) return "caindo";
  return "estavel";
}

function calcMetaSugerida(meses: { bateuMeta: boolean }[], metaAtual: number): { meta: number; motivo: string } {
  const last3 = meses.slice(-3);
  const batidas = last3.filter((m) => m.bateuMeta).length;

  if (batidas >= 3) return { meta: Math.round(metaAtual * 1.15), motivo: "Bateu meta 3x consecutivas. Sugerimos +15%." };
  if (batidas >= 2) return { meta: Math.round(metaAtual * 1.08), motivo: "Bateu 2 de 3 meses. Sugerimos +8%." };
  if (batidas === 1) return { meta: metaAtual, motivo: "Bateu 1 de 3 meses. Manter meta atual." };
  return { meta: Math.max(1, Math.round(metaAtual * 0.9)), motivo: "Nao bateu meta nos ultimos 3 meses. Sugerimos reduzir 10% com plano de melhoria." };
}

export default function MetasClosersEvolutionPage() {
  const [closers, setClosers] = useState<CloserEvolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMeta, setEditingMeta] = useState<Record<string, number>>({});
  const mesAtual = getCurrentMonth();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: cls }, { data: lancs }, { data: metas }] = await Promise.all([
      supabase.from("closers").select("*").eq("ativo", true).order("nome"),
      supabase.from("lancamentos_diarios").select("closer_id,mes_referencia,ganhos,mrr_dia"),
      supabase.from("metas_closers").select("*"),
    ]);

    const closersList = (cls || []) as Closer[];
    const lancAll = (lancs || []) as LancamentoDiario[];
    const metasAll = (metas || []) as MetaCloser[];

    // Últimos 6 meses
    const now = new Date();
    const meses: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    const result: CloserEvolution[] = closersList.map((c) => {
      const mesesData = meses.map((mes) => {
        const myLanc = lancAll.filter((l) => l.closer_id === c.id && l.mes_referencia === mes);
        const contratos = myLanc.reduce((s, l) => s + l.ganhos, 0);
        const mrr = myLanc.reduce((s, l) => s + Number(l.mrr_dia), 0);
        const mc = metasAll.find((m) => m.closer_id === c.id && m.mes_referencia === mes);
        const metaContratos = mc?.meta_contratos ?? 0;
        return { mes, contratos, mrr, metaContratos, bateuMeta: metaContratos > 0 && contratos >= metaContratos };
      });

      const mcAtual = metasAll.find((m) => m.closer_id === c.id && m.mes_referencia === mesAtual);
      const metaAtual = mcAtual?.meta_contratos ?? 0;
      const { meta: metaSugerida, motivo } = calcMetaSugerida(mesesData, metaAtual);
      const tendencia = calcTendencia(mesesData);

      const lancAtual = lancAll.filter((l) => l.closer_id === c.id && l.mes_referencia === mesAtual);
      const contratosAtual = lancAtual.reduce((s, l) => s + l.ganhos, 0);
      const mrrAtual = lancAtual.reduce((s, l) => s + Number(l.mrr_dia), 0);

      return { id: c.id, nome: c.nome, meses: mesesData, tendencia, metaAtual, metaSugerida, motivo, contratosAtual, mrrAtual };
    });

    setClosers(result);
    setLoading(false);
  }

  async function aprovarMeta(closerId: string, meta: number) {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const mesProximo = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;

    const { error } = await supabase.from("metas_closers").upsert({
      closer_id: closerId,
      mes_referencia: mesProximo,
      meta_contratos: meta,
    }, { onConflict: "closer_id,mes_referencia" });

    if (error) toast.error("Erro: " + error.message);
    else toast.success(`Meta de ${meta} contratos aprovada para ${mesProximo}`);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  // Painel gestor
  const totalMetaSugerida = closers.reduce((s, c) => s + c.metaSugerida, 0);
  const totalMetaAtual = closers.reduce((s, c) => s + c.metaAtual, 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Evolução de Metas por Closer</h1>
          <p className="text-sm text-muted-foreground">Sugestoes baseadas no desempenho dos ultimos 3 meses</p>
        </div>
        <Button onClick={() => {
          closers.forEach((c) => aprovarMeta(c.id, editingMeta[c.id] ?? c.metaSugerida));
        }}>
          <Check size={14} className="mr-1" /> Aprovar todas
        </Button>
      </div>

      {/* Painel gestor consolidado */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-6 text-sm">
              <div><span className="text-muted-foreground">Meta atual total:</span> <strong>{totalMetaAtual} contratos</strong></div>
              <div><span className="text-muted-foreground">Meta sugerida total:</span> <strong className={totalMetaSugerida > totalMetaAtual ? "text-green-400" : totalMetaSugerida < totalMetaAtual ? "text-red-400" : ""}>{totalMetaSugerida} contratos</strong></div>
              <div><span className="text-muted-foreground">Variacao:</span> <strong className={totalMetaSugerida > totalMetaAtual ? "text-green-400" : "text-red-400"}>{totalMetaSugerida > totalMetaAtual ? "+" : ""}{totalMetaSugerida - totalMetaAtual}</strong></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards por closer */}
      {closers.map((c) => {
        const TrendIcon = c.tendencia === "crescendo" ? TrendingUp : c.tendencia === "caindo" ? TrendingDown : Minus;
        const trendColor = c.tendencia === "crescendo" ? "text-green-400" : c.tendencia === "caindo" ? "text-red-400" : "text-muted-foreground";
        const customMeta = editingMeta[c.id];
        const metaFinal = customMeta ?? c.metaSugerida;

        const chartData = c.meses.map((m) => ({
          mes: m.mes.split("-")[1],
          contratos: m.contratos,
          meta: m.metaContratos,
        }));

        return (
          <Card key={c.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  {c.nome}
                  <TrendIcon size={14} className={trendColor} />
                  <Badge variant="outline" className={`text-[9px] ${trendColor}`}>
                    {c.tendencia === "crescendo" ? "Crescendo" : c.tendencia === "caindo" ? "Caindo" : "Estavel"}
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{c.contratosAtual} contratos este mes</span>
                  <span>{formatCurrency(c.mrrAtual)} MRR</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Mini chart */}
                <div>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={chartData}>
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Bar dataKey="contratos" fill="#22c55e" radius={[3, 3, 0, 0]} name="Contratos" />
                      {c.metaAtual > 0 && <ReferenceLine y={c.metaAtual} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "Meta", fontSize: 9, fill: "#f59e0b" }} />}
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex gap-1 mt-1">
                    {c.meses.slice(-3).map((m) => (
                      <Badge key={m.mes} className={`text-[8px] ${m.bateuMeta ? "bg-green-500/15 text-green-400" : m.metaContratos > 0 ? "bg-red-500/15 text-red-400" : "bg-muted text-muted-foreground"}`}>
                        {m.mes.split("-")[1]}: {m.contratos}/{m.metaContratos || "—"}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Meta sugerida */}
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Meta atual</span>
                      <span className="font-mono">{c.metaAtual || "—"} contratos</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Meta sugerida</span>
                      <span className={`font-mono font-bold ${c.metaSugerida > c.metaAtual ? "text-green-400" : c.metaSugerida < c.metaAtual ? "text-red-400" : ""}`}>
                        {c.metaSugerida} contratos
                        {c.metaSugerida !== c.metaAtual && ` (${c.metaSugerida > c.metaAtual ? "+" : ""}${c.metaSugerida - c.metaAtual})`}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{c.motivo}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button size="sm" className="flex-1 text-xs" onClick={() => aprovarMeta(c.id, metaFinal)}>
                      <Check size={12} className="mr-1" />Aprovar {metaFinal}
                    </Button>
                    <div className="flex items-center gap-1">
                      <Edit2 size={12} className="text-muted-foreground" />
                      <input
                        type="number"
                        min={0}
                        value={customMeta ?? ""}
                        placeholder={String(c.metaSugerida)}
                        onChange={(e) => setEditingMeta({ ...editingMeta, [c.id]: Number(e.target.value) || 0 })}
                        className="w-16 text-xs bg-transparent border rounded px-2 py-1 text-center"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
