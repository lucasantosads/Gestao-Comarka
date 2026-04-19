"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Play, Timer, ListChecks } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, PieChart, Pie, Cell, Legend } from "recharts";

interface TipoOpcao { id: string; nome: string; cor: string }
interface TarefaRecente { id: string; titulo: string; tipo_tarefa: string | null; tempo_total: number; status: string; em_andamento: boolean }
interface TimerAtivo { id: string; titulo: string; ultimo_inicio: string }

interface MeuTempoData {
  hoje: { segundos: number; timerExtra: number; timerAtivo: TimerAtivo | null; metaDiariaSegundos: number };
  porDia: { data: string; segundos: number }[];
  porTipo: Record<string, number>;
  tarefas: TarefaRecente[];
  tipos: TipoOpcao[];
  employee: { nome: string; foto_url: string | null; meta_horas_semanais: number };
}

function fmtHoras(segs: number): string {
  const h = Math.floor(segs / 3600);
  const m = Math.floor((segs % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function fmtTimer(segs: number): string {
  const h = Math.floor(segs / 3600);
  const m = Math.floor((segs % 3600) / 60);
  const s = segs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function diaSemana(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
}

const CORES_TIPO = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1", "#14b8a6"];

export default function MeuTempoPage() {
  const { user } = useAuth();
  const [data, setData] = useState<MeuTempoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timerSegs, setTimerSegs] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const load = useCallback(async () => {
    if (!user?.employeeId) return;
    const res = await fetch(`/api/meu-tempo?colaborador_id=${user.employeeId}`);
    const json = await res.json();
    if (!json.error) setData(json);
    setLoading(false);
  }, [user?.employeeId]);

  useEffect(() => { load(); }, [load]);

  // Timer em tempo real
  useEffect(() => {
    if (!data?.hoje.timerAtivo) {
      setTimerSegs(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    const inicio = new Date(data.hoje.timerAtivo.ultimo_inicio).getTime();
    const tick = () => setTimerSegs(Math.floor((Date.now() - inicio) / 1000));
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [data?.hoje.timerAtivo]);

  // Polling 30s
  useEffect(() => {
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  if (!user) return null;
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-muted-foreground animate-pulse text-sm">Carregando tempo...</p>
    </div>
  );
  if (!data) return <p className="text-muted-foreground text-sm">Erro ao carregar dados.</p>;

  const { hoje, porDia, porTipo, tarefas, tipos } = data;
  const totalHoje = hoje.segundos + (hoje.timerAtivo ? timerSegs : 0);
  const metaPct = hoje.metaDiariaSegundos > 0 ? (totalHoje / hoje.metaDiariaSegundos) * 100 : 0;
  const metaPctCapped = Math.min(metaPct, 100);

  // Cores por tipo
  const tipoCorMap = new Map<string, string>();
  tipos.forEach((t, i) => tipoCorMap.set(t.nome, t.cor || CORES_TIPO[i % CORES_TIPO.length]));

  // Chart 7 dias
  const chart7d = porDia.map((d) => ({
    dia: diaSemana(d.data),
    data: d.data,
    horas: Number((d.segundos / 3600).toFixed(2)),
  }));
  const metaDiariaH = hoje.metaDiariaSegundos / 3600;

  // Donut 30 dias
  const totalTipo = Object.values(porTipo).reduce((s, v) => s + v, 0);
  const donutData = Object.entries(porTipo)
    .sort((a, b) => b[1] - a[1])
    .map(([nome, segs]) => ({
      nome,
      horas: Number((segs / 3600).toFixed(1)),
      pct: totalTipo > 0 ? Number(((segs / totalTipo) * 100).toFixed(1)) : 0,
      cor: tipoCorMap.get(nome) || "#6366f1",
    }));

  const statusColor: Record<string, string> = {
    a_fazer: "bg-slate-500/15 text-slate-400",
    fazendo: "bg-blue-500/15 text-blue-400",
    concluido: "bg-green-500/15 text-green-400",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Timer size={20} className="text-primary" />
        <h2 className="text-xl font-bold tracking-tight">Meu Tempo</h2>
      </div>

      {/* BLOCO HOJE */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Clock size={14} /> Hoje</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-black tracking-tight font-mono">{fmtHoras(totalHoje)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Meta: {fmtHoras(hoje.metaDiariaSegundos)}</p>
            </div>
            {hoje.timerAtivo && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <Play size={12} className="text-green-400 animate-pulse" />
                <div>
                  <p className="text-xs font-mono font-bold text-green-400">{fmtTimer(timerSegs)}</p>
                  <p className="text-[9px] text-muted-foreground truncate max-w-[150px]">{hoje.timerAtivo.titulo}</p>
                </div>
              </div>
            )}
          </div>

          {/* Barra progresso */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{metaPct.toFixed(0)}% da meta</span>
              <span>{fmtHoras(hoje.metaDiariaSegundos)}</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${metaPctCapped >= 100 ? "bg-green-500" : metaPctCapped >= 60 ? "bg-primary" : "bg-orange-500"}`}
                style={{ width: `${metaPctCapped}%` }}
                title={`${metaPct.toFixed(1)}% real`}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BLOCO 7 DIAS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Últimos 7 dias</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chart7d}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "#888" }} />
              <YAxis tick={{ fontSize: 11, fill: "#888" }} unit="h" />
              <Tooltip
                contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                formatter={(v) => [`${v}h`, "Horas"]}
                labelFormatter={(l, payload) => payload?.[0]?.payload?.data || l}
              />
              <ReferenceLine y={metaDiariaH} stroke="#6366f1" strokeDasharray="5 5" label={{ value: "Meta", fill: "#6366f1", fontSize: 10, position: "right" }} />
              <Bar dataKey="horas" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* BLOCO POR TIPO */}
      {donutData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Por tipo de tarefa (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={donutData} dataKey="horas" nameKey="nome" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {donutData.map((d, i) => <Cell key={i} fill={d.cor} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                    formatter={(v, name) => [`${v}h`, name]}
                  />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <table className="text-xs w-full">
                <thead><tr className="border-b text-muted-foreground">
                  <th className="text-left py-1.5 px-1">Tipo</th>
                  <th className="text-right py-1.5 px-1">Horas</th>
                  <th className="text-right py-1.5 px-1">%</th>
                </tr></thead>
                <tbody>
                  {donutData.map((d) => (
                    <tr key={d.nome} className="border-b border-border/30">
                      <td className="py-1.5 px-1 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.cor }} />
                        {d.nome}
                      </td>
                      <td className="text-right py-1.5 px-1 font-mono">{d.horas}h</td>
                      <td className="text-right py-1.5 px-1 font-mono text-muted-foreground">{d.pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAREFAS RECENTES */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><ListChecks size={14} /> Tarefas recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {tarefas.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma tarefa com tempo registrado.</p>
          ) : (
            <div className="space-y-2">
              {tarefas.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-2.5 border rounded-lg bg-background/50 hover:bg-muted/10 transition-colors">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {t.em_andamento && <Play size={10} className="text-green-400 animate-pulse flex-shrink-0" />}
                    <span className="text-xs font-medium truncate">{t.titulo}</span>
                    {t.tipo_tarefa && (
                      <Badge className="text-[8px] flex-shrink-0" style={{ background: `${tipoCorMap.get(t.tipo_tarefa) || "#6366f1"}20`, color: tipoCorMap.get(t.tipo_tarefa) || "#6366f1" }}>
                        {t.tipo_tarefa}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-mono text-muted-foreground">{fmtHoras(t.tempo_total)}</span>
                    <Badge className={`text-[8px] ${statusColor[t.status] || "bg-muted text-muted-foreground"}`}>
                      {t.status === "a_fazer" ? "A fazer" : t.status === "fazendo" ? "Fazendo" : "Concluído"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
