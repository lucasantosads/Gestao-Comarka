"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle, TrendingUp, Star } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";

interface NpsClienteRow {
  cliente_notion_id: string;
  cliente: string;
  gestor: string;
  ultimo_score: number;
  ultimo_mes: string;
  ultimo_comentario: string | null;
  variacao: number | null;
  anterior_score: number | null;
}
interface NpsGestorRow { gestor: string; media: number; total: number }
interface VisaoGeral {
  total: number;
  mediaGeral: number;
  npsClassico: number;
  promotores: number;
  neutros: number;
  detratores: number;
  distribuicao: Array<{ label: string; valor: number; cor: string }>;
  evolucao: Array<{ mes: string; media: number | null; n: number }>;
}
interface AlertaQueda { cliente: string; gestor: string; anterior: number; atual: number; queda: number }
interface NpsGlobal {
  npsPorCliente: NpsClienteRow[];
  npsPorGestor: NpsGestorRow[];
  visaoGeral: VisaoGeral;
  alertas: AlertaQueda[];
}

function corScore(s: number): string {
  if (s >= 9) return "text-green-400";
  if (s >= 7) return "text-yellow-400";
  return "text-red-400";
}
function corVariacao(v: number | null): string {
  if (v == null) return "text-muted-foreground";
  if (v > 0) return "text-green-400";
  if (v < 0) return "text-red-400";
  return "text-muted-foreground";
}

export default function NpsPerformancePage() {
  const [data, setData] = useState<NpsGlobal | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtroGestor, setFiltroGestor] = useState("todos");
  const [sortKey, setSortKey] = useState<"score" | "variacao" | "cliente">("score");

  useEffect(() => {
    fetch("/api/team/nps?global=1")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando NPS…</p></div>;
  if (!data) return <div className="text-center py-12 text-muted-foreground">Sem dados de NPS.</div>;

  const gestores = Array.from(new Set(data.npsPorCliente.map((r) => r.gestor))).sort();
  let filtered = data.npsPorCliente;
  if (filtroGestor !== "todos") filtered = filtered.filter((r) => r.gestor === filtroGestor);
  filtered = [...filtered].sort((a, b) => {
    if (sortKey === "score") return b.ultimo_score - a.ultimo_score;
    if (sortKey === "variacao") return (b.variacao ?? 0) - (a.variacao ?? 0);
    return a.cliente.localeCompare(b.cliente);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/clientes"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Star size={20} className="text-yellow-400" /> NPS & Performance</h1>
      </div>

      {/* ===== Visão Geral ===== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Visão Geral</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-[10px] uppercase text-muted-foreground">NPS médio</p>
                <p className={`text-3xl font-bold ${corScore(data.visaoGeral.mediaGeral)}`}>{data.visaoGeral.mediaGeral.toFixed(1)}</p>
                <p className="text-[10px] text-muted-foreground">de {data.visaoGeral.total} respostas</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-[10px] uppercase text-muted-foreground">NPS clássico</p>
                <p className="text-3xl font-bold tabular-nums">{Math.round(data.visaoGeral.npsClassico)}</p>
                <p className="text-[10px] text-muted-foreground">% prom − % det</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-[10px] uppercase text-green-300">Promotores</p>
                <p className="text-2xl font-bold text-green-400">{data.visaoGeral.promotores}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-[10px] uppercase text-red-300">Detratores</p>
                <p className="text-2xl font-bold text-red-400">{data.visaoGeral.detratores}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={data.visaoGeral.distribuicao} dataKey="valor" nameKey="label" innerRadius={40} outerRadius={70}>
                  {data.visaoGeral.distribuicao.map((d, i) => (
                    <Cell key={i} fill={d.cor} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Evolução */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp size={14} /> Evolução (6 meses)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.visaoGeral.evolucao}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
              <XAxis dataKey="mes" stroke="#9ca3af" fontSize={11} />
              <YAxis domain={[0, 10]} stroke="#9ca3af" fontSize={11} />
              <RechartsTooltip />
              <Legend />
              <Line type="monotone" dataKey="media" stroke="#22c55e" strokeWidth={2} name="NPS médio" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Alertas */}
      {data.alertas.length > 0 && (
        <Card className="border-red-500/40">
          <CardHeader className="bg-red-500/10">
            <CardTitle className="text-base flex items-center gap-2 text-red-300">
              <AlertTriangle size={14} /> Quedas relevantes ({data.alertas.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {data.alertas.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/20">
                <span className="font-medium">{a.cliente}</span>
                <span className="text-[10px] text-muted-foreground">{a.gestor}</span>
                <span className="font-mono">
                  <span className="text-muted-foreground">{a.anterior}</span>
                  <span className="mx-1">→</span>
                  <span className="text-red-300 font-bold">{a.atual}</span>
                  <span className="ml-2 text-[10px] text-red-400">−{a.queda}</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* NPS por Gestor */}
      <Card>
        <CardHeader><CardTitle className="text-base">NPS por Gestor — Ranking</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-[10px] uppercase text-muted-foreground">
                <th className="text-left py-2 px-2">#</th>
                <th className="text-left py-2 px-2">Gestor</th>
                <th className="text-right py-2 px-2">NPS médio</th>
                <th className="text-right py-2 px-2">Respostas</th>
              </tr>
            </thead>
            <tbody>
              {data.npsPorGestor.map((g, i) => (
                <tr key={g.gestor} className="border-b border-border/30">
                  <td className="py-1.5 px-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-1.5 px-2 font-medium">{g.gestor}</td>
                  <td className={`py-1.5 px-2 text-right font-mono font-bold ${corScore(g.media)}`}>{g.media.toFixed(2)}</td>
                  <td className="py-1.5 px-2 text-right text-muted-foreground">{g.total}</td>
                </tr>
              ))}
              {data.npsPorGestor.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Sem registros.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* NPS por Cliente */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">NPS por Cliente</CardTitle>
            <div className="flex items-center gap-2">
              <select value={filtroGestor} onChange={(e) => setFiltroGestor(e.target.value)}
                className="text-xs bg-transparent border rounded-lg px-3 py-1.5">
                <option value="todos">Todos os gestores</option>
                {gestores.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <select value={sortKey} onChange={(e) => setSortKey(e.target.value as "score" | "variacao" | "cliente")}
                className="text-xs bg-transparent border rounded-lg px-3 py-1.5">
                <option value="score">Ordenar por score</option>
                <option value="variacao">Ordenar por variação</option>
                <option value="cliente">Ordenar por nome</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-[10px] uppercase text-muted-foreground">
                <th className="text-left py-2 px-2">Cliente</th>
                <th className="text-left py-2 px-2">Gestor</th>
                <th className="text-right py-2 px-2">Último NPS</th>
                <th className="text-right py-2 px-2">Variação</th>
                <th className="text-left py-2 px-2">Comentário</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.cliente_notion_id} className="border-b border-border/30 hover:bg-muted/20">
                  <td className="py-1.5 px-2 font-medium">{r.cliente}</td>
                  <td className="py-1.5 px-2 text-muted-foreground">{r.gestor}</td>
                  <td className={`py-1.5 px-2 text-right font-mono font-bold ${corScore(r.ultimo_score)}`}>{r.ultimo_score}</td>
                  <td className={`py-1.5 px-2 text-right font-mono ${corVariacao(r.variacao)}`}>
                    {r.variacao == null ? "—" : (r.variacao > 0 ? `+${r.variacao}` : r.variacao)}
                  </td>
                  <td className="py-1.5 px-2 text-muted-foreground truncate max-w-[280px]" title={r.ultimo_comentario || ""}>
                    {r.ultimo_comentario || "—"}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Nenhum cliente.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
