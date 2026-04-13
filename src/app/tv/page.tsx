"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/format";
import { Trophy, Target, TrendingUp, Flame } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";

interface CloserRank {
  id: string; nome: string; contratos: number; mrr: number; entrada: number;
  reunioes_feitas: number; meta_contratos: number; meta_mrr: number;
  conversao: number; pct_meta: number;
}

// Gauge meia lua
function GaugeSemiCircle({ value, max, label, valueLabel, color }: { value: number; max: number; label: string; valueLabel: string; color: string }) {
  if (!max || max <= 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center">
        <p className="text-3xl font-black" style={{ color }}>{valueLabel}</p>
        <p className="text-xs text-zinc-400 mt-1">{label}</p>
        <p className="text-[10px] text-zinc-600">Meta não definida</p>
      </div>
    );
  }
  const pct = Math.min(value / max, 1);
  const data = [{ value: pct * 100 }, { value: (1 - pct) * 100 }];
  const colors = [color, "#27272a"];
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full" style={{ maxWidth: 220, aspectRatio: "2/1" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} startAngle={180} endAngle={0} cx="50%" cy="100%" innerRadius="70%" outerRadius="100%" paddingAngle={0} dataKey="value" stroke="none">
              {data.map((_, i) => <Cell key={i} fill={colors[i]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <p className="text-3xl font-black" style={{ color }}>{valueLabel}</p>
          <p className="text-[10px] text-zinc-500">{(pct * 100).toFixed(0)}% da meta</p>
        </div>
      </div>
      <p className="text-xs text-zinc-400 mt-1">{label}</p>
      <p className="text-[10px] text-zinc-600">Meta: {max > 1000 ? formatCurrency(max) : max}</p>
    </div>
  );
}

type View = "tudo" | "gauges" | "ranking";

export default function TVPage() {
  const [closers, setClosers] = useState<CloserRank[]>([]);
  const [totais, setTotais] = useState({ contratos: 0, mrr: 0, entrada: 0, meta_mrr: 0, meta_contratos: 0, reunioes: 0 });
  const [progressData, setProgressData] = useState<{ dia: string; mrr: number; contratos: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [hora, setHora] = useState(new Date());
  const [view, setView] = useState<View>("tudo");

  const mes = new Date().toISOString().slice(0, 7);

  const loadData = useCallback(async () => {
    const [{ data: cls }, { data: lancs }, { data: cts }, { data: metas }, { data: metaGeral }] = await Promise.all([
      supabase.from("closers").select("id, nome").eq("ativo", true),
      supabase.from("lancamentos_diarios").select("closer_id, reunioes_feitas, data").eq("mes_referencia", mes).order("data"),
      supabase.from("contratos").select("closer_id, mrr, valor_entrada, data_fechamento").eq("mes_referencia", mes).order("data_fechamento"),
      supabase.from("metas_closers").select("closer_id, meta_contratos, meta_mrr").eq("mes_referencia", mes),
      supabase.from("metas_mensais").select("meta_mrr, meta_contratos, meta_entrada").eq("mes_referencia", mes).single(),
    ]);

    const ranking: CloserRank[] = (cls || []).map((c) => {
      const myLancs = (lancs || []).filter((l) => l.closer_id === c.id);
      const myCts = (cts || []).filter((ct) => ct.closer_id === c.id);
      const myMeta = (metas || []).find((m) => m.closer_id === c.id);
      const reunioes_feitas = myLancs.reduce((s, l) => s + Number(l.reunioes_feitas || 0), 0);
      const contratos = myCts.length;
      const mrr = myCts.reduce((s, ct) => s + Number(ct.mrr || 0), 0);
      const entrada = myCts.reduce((s, ct) => s + Number(ct.valor_entrada || 0), 0);
      const meta_contratos = myMeta?.meta_contratos || 0;
      const meta_mrr = Number(myMeta?.meta_mrr || 0);
      const conversao = reunioes_feitas > 0 ? (contratos / reunioes_feitas) * 100 : 0;
      const pct_meta = meta_contratos > 0 ? (contratos / meta_contratos) * 100 : 0;
      return { id: c.id, nome: c.nome, contratos, mrr, entrada, reunioes_feitas, meta_contratos, meta_mrr, conversao, pct_meta };
    }).sort((a, b) => b.contratos - a.contratos || b.mrr - a.mrr);

    const totalContratos = ranking.reduce((s, c) => s + c.contratos, 0);
    const totalMrr = ranking.reduce((s, c) => s + c.mrr, 0);
    const totalEntrada = ranking.reduce((s, c) => s + c.entrada, 0);

    setClosers(ranking);
    setTotais({
      contratos: totalContratos, mrr: totalMrr, entrada: totalEntrada,
      meta_mrr: Number(metaGeral?.meta_mrr || ranking.reduce((s, c) => s + c.meta_mrr, 0)),
      meta_contratos: Number(metaGeral?.meta_contratos || ranking.reduce((s, c) => s + c.meta_contratos, 0)),
      reunioes: ranking.reduce((s, c) => s + c.reunioes_feitas, 0),
    });

    // Progresso acumulado dia a dia
    const allCts = (cts || []).sort((a, b) => (a.data_fechamento || "").localeCompare(b.data_fechamento || ""));
    let accMrr = 0, accContratos = 0;
    const prog: { dia: string; mrr: number; contratos: number }[] = [];
    for (const ct of allCts) {
      accMrr += Number(ct.mrr || 0);
      accContratos++;
      const dia = (ct.data_fechamento || "").slice(8, 10);
      prog.push({ dia, mrr: accMrr, contratos: accContratos });
    }
    setProgressData(prog);
    setLoading(false);
  }, [mes]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { const i = setInterval(loadData, 300000); return () => clearInterval(i); }, [loadData]);
  useEffect(() => { const i = setInterval(() => setHora(new Date()), 1000); return () => clearInterval(i); }, []);

  const MEDAL = ["🥇", "🥈", "🥉"];

  if (loading) return <div className="h-screen flex items-center justify-center bg-black text-white text-2xl">Carregando...</div>;

  return (
    <div className="min-h-screen bg-black text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">COMARKA ADS</h1>
          <p className="text-sm text-zinc-500">{new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).replace(/^\w/, (c) => c.toUpperCase())}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-zinc-900 rounded-lg p-0.5">
            {([["tudo", "Tudo"], ["gauges", "Metas"], ["ranking", "Ranking"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setView(k)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === k ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="text-right">
            <p className="text-3xl font-mono font-bold tabular-nums">{hora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
            <p className="text-[10px] text-zinc-500">{hora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" })}</p>
          </div>
        </div>
      </div>

      {/* VIEW: GAUGES (Metas) */}
      {(view === "tudo" || view === "gauges") && (
        <div className="space-y-6">
          {/* Gauges meia lua */}
          <div className="grid grid-cols-3 gap-6">
            <GaugeSemiCircle value={totais.entrada} max={totais.meta_mrr * 3} label="Entrada (Faturamento)" valueLabel={formatCurrency(totais.entrada)} color="#22c55e" />
            <GaugeSemiCircle value={totais.mrr} max={totais.meta_mrr} label="MRR" valueLabel={formatCurrency(totais.mrr)} color="#6366f1" />
            <GaugeSemiCircle value={totais.contratos} max={totais.meta_contratos} label="Contratos" valueLabel={String(totais.contratos)} color="#f59e0b" />
          </div>

          {/* Progresso acumulado */}
          {progressData.length > 0 && (
            <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Progresso Acumulado no Mes</p>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={progressData}>
                  <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "#71717a" }} />
                  <YAxis yAxisId="mrr" tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis yAxisId="ct" orientation="right" tick={{ fontSize: 10, fill: "#71717a" }} />
                  <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 11 }} />
                  <Line yAxisId="mrr" type="monotone" dataKey="mrr" name="MRR" stroke="#6366f1" strokeWidth={2} dot={false} />
                  <Line yAxisId="ct" type="stepAfter" dataKey="contratos" name="Contratos" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* VIEW: RANKING */}
      {(view === "tudo" || view === "ranking") && (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
            <span className="flex items-center gap-2"><Trophy size={16} className="text-yellow-400" /><span className="text-sm font-bold uppercase tracking-wider">Ranking de Closers</span></span>
            <div className="flex gap-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1"><Target size={12} /> {totais.contratos} contratos</span>
              <span className="flex items-center gap-1"><TrendingUp size={12} /> {formatCurrency(totais.mrr)} MRR</span>
              <span className="flex items-center gap-1"><Flame size={12} /> {totais.reunioes > 0 ? ((totais.contratos / totais.reunioes) * 100).toFixed(0) : 0}% conv.</span>
            </div>
          </div>
          <div className="divide-y divide-zinc-800">
            {closers.map((c, i) => (
              <div key={c.id} className={`flex items-center justify-between px-5 py-4 ${i === 0 ? "bg-yellow-500/5" : ""}`}>
                <div className="flex items-center gap-4">
                  <span className="text-2xl w-10 text-center">{MEDAL[i] || `${i + 1}º`}</span>
                  <div>
                    <p className="text-lg font-bold">{c.nome}</p>
                    <p className="text-xs text-zinc-500">{c.reunioes_feitas} reunioes • {c.conversao.toFixed(0)}% conv.</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-2xl font-black text-green-400">{c.contratos}</p>
                    <p className="text-[10px] text-zinc-500">contratos</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-indigo-400">{formatCurrency(c.mrr)}</p>
                    <p className="text-[10px] text-zinc-500">MRR</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-emerald-400">{formatCurrency(c.entrada)}</p>
                    <p className="text-[10px] text-zinc-500">entrada</p>
                  </div>
                  {c.meta_contratos > 0 && (
                    <div className="w-24">
                      <div className="flex justify-between text-[10px] text-zinc-500 mb-0.5">
                        <span>Meta</span>
                        <span>{c.pct_meta.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-2">
                        <div className={`h-2 rounded-full ${c.pct_meta >= 100 ? "bg-green-500" : c.pct_meta >= 70 ? "bg-yellow-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(c.pct_meta, 100)}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-[10px] text-zinc-700">Auto-refresh 5min • {hora.toLocaleTimeString("pt-BR")}</p>
    </div>
  );
}
