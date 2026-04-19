"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Users, Trophy, AlertTriangle, Play, ListChecks, TrendingUp, TrendingDown, Timer } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, ReferenceLine } from "recharts";

// === Types ===
interface StatusColab { id: string; nome: string; foto_url: string | null; cargo: string | null; ativo: boolean; tarefa_ativa: { id: string; titulo: string } | null }
interface RankingItem { id: string; nome: string; foto_url: string | null; segundos: number; concluidas: number; pct_meta: number; meta_horas_semanais: number }
interface AlertaInatividade { id: string; nome: string; horas_sem_sessao: number; threshold: number }
interface TipoOpcao { id: string; nome: string; cor: string }
interface TarefaRecente { id: string; titulo: string; tipo_tarefa: string | null; tempo_total: number; status: string; em_andamento: boolean }
interface IndividualData {
  employee: { nome: string; foto_url: string | null; meta_horas_semanais: number };
  porDia30: { data: string; segundos: number }[];
  porTipo: Record<string, number>;
  semanaAtual: number;
  semanaAnterior: number;
  tarefas: TarefaRecente[];
  timerAtivo: { id: string; titulo: string; ultimo_inicio: string } | null;
}
interface ProdData {
  statusRealTime: StatusColab[];
  kpis: { totalSegundos: number; mediaSegundos: number; totalConcluidas: number };
  porTipo: Record<string, number>;
  ranking: RankingItem[];
  alertasInatividade: AlertaInatividade[];
  tipos: TipoOpcao[];
  individual: IndividualData | null;
}

// === Helpers ===
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
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
}
function diaMes(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

const CORES_TIPO = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1", "#14b8a6"];
const PERIODOS = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
] as const;

const statusColor: Record<string, string> = {
  a_fazer: "bg-slate-500/15 text-slate-400",
  fazendo: "bg-blue-500/15 text-blue-400",
  concluido: "bg-green-500/15 text-green-400",
};

// ===================== VISAO GERAL =====================
function VisaoGeral({ data, periodo, setPeriodo }: { data: ProdData; periodo: string; setPeriodo: (p: string) => void }) {
  const { statusRealTime, kpis, porTipo, ranking, alertasInatividade, tipos } = data;
  const alertaIds = new Set(alertasInatividade.map((a) => a.id));

  const tipoCorMap = new Map<string, string>();
  tipos.forEach((t, i) => tipoCorMap.set(t.nome, t.cor || CORES_TIPO[i % CORES_TIPO.length]));

  const totalTipo = Object.values(porTipo).reduce((s, v) => s + v, 0);
  const donutData = Object.entries(porTipo)
    .sort((a, b) => b[1] - a[1])
    .map(([nome, segs]) => ({
      nome, horas: Number((segs / 3600).toFixed(1)),
      pct: totalTipo > 0 ? Number(((segs / totalTipo) * 100).toFixed(1)) : 0,
      cor: tipoCorMap.get(nome) || "#6366f1",
    }));

  return (
    <div className="space-y-6">
      {/* Status em tempo real */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Users size={14} /> Status em tempo real</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {statusRealTime.map((c) => (
              <div key={c.id} className={`relative p-3 rounded-lg border text-center transition-colors ${c.ativo ? "border-green-500/30 bg-green-500/5" : "border-border bg-muted/5"}`}>
                {alertaIds.has(c.id) && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center" title="Inativo">
                    <AlertTriangle size={8} className="text-white" />
                  </span>
                )}
                <div className="w-10 h-10 rounded-full mx-auto mb-2 bg-muted/30 flex items-center justify-center text-sm font-bold overflow-hidden">
                  {c.foto_url
                    ? <img src={c.foto_url} alt={c.nome} className="w-full h-full object-cover" />
                    : c.nome.charAt(0).toUpperCase()}
                </div>
                <p className="text-[11px] font-medium truncate">{c.nome}</p>
                <div className={`mt-1 h-1.5 w-6 rounded-full mx-auto ${c.ativo ? "bg-green-400" : "bg-muted-foreground/20"}`} />
                {c.tarefa_ativa && (
                  <p className="text-[9px] text-green-400 mt-1 truncate" title={c.tarefa_ativa.titulo}>{c.tarefa_ativa.titulo}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filtro período + KPIs */}
      <div className="flex items-center gap-2 flex-wrap">
        {PERIODOS.map((p) => (
          <Button key={p.key} size="sm" variant={periodo === p.key ? "default" : "outline"} onClick={() => setPeriodo(p.key)} className="text-xs h-7">
            {p.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 pb-3 text-center">
          <p className="text-xs text-muted-foreground">Horas do Time</p>
          <p className="text-xl font-bold font-mono">{fmtHoras(kpis.totalSegundos)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center">
          <p className="text-xs text-muted-foreground">Média / Colab</p>
          <p className="text-xl font-bold font-mono">{fmtHoras(kpis.mediaSegundos)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center">
          <p className="text-xs text-muted-foreground">Tarefas Concluídas</p>
          <p className="text-xl font-bold">{kpis.totalConcluidas}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center">
          <p className="text-xs text-muted-foreground">Tipos de Tarefa</p>
          <p className="text-xl font-bold">{Object.keys(porTipo).length}</p>
        </CardContent></Card>
      </div>

      {/* Distribuição por tipo (donut) + Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {donutData.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Distribuição por tipo</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={donutData} dataKey="horas" nameKey="nome" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {donutData.map((d, i) => <Cell key={i} fill={d.cor} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} formatter={(v, name) => [`${v}h`, name]} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Ranking */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Trophy size={14} /> Ranking de produtividade</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b text-[10px] text-muted-foreground uppercase">
                  <th className="py-2 px-1 text-left">#</th>
                  <th className="py-2 px-2 text-left">Colaborador</th>
                  <th className="py-2 px-2 text-right">Horas</th>
                  <th className="py-2 px-2 text-right">Tarefas</th>
                  <th className="py-2 px-2 text-right">% Meta</th>
                </tr></thead>
                <tbody>
                  {ranking.map((r, i) => {
                    const pctCapped = Math.min(r.pct_meta, 100);
                    return (
                      <tr key={r.id} className="border-b border-border/30 hover:bg-muted/20">
                        <td className="py-2 px-1 font-bold text-muted-foreground">{i + 1}</td>
                        <td className="py-2 px-2 font-medium">{r.nome}</td>
                        <td className="py-2 px-2 text-right font-mono">{fmtHoras(r.segundos)}</td>
                        <td className="py-2 px-2 text-right">{r.concluidas}</td>
                        <td className="py-2 px-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${pctCapped >= 80 ? "bg-green-500" : pctCapped >= 50 ? "bg-blue-500" : "bg-orange-500"}`} style={{ width: `${pctCapped}%` }} />
                            </div>
                            <span className="font-mono w-12 text-right" title={`${r.pct_meta.toFixed(1)}% real`}>
                              {pctCapped.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {ranking.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Sem dados no período</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas de inatividade */}
      {alertasInatividade.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-orange-400"><AlertTriangle size={14} /> Alertas de inatividade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alertasInatividade.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-2.5 rounded-lg border border-orange-500/20 bg-orange-500/5 text-xs">
                  <span className="font-medium">{a.nome}</span>
                  <span className="text-orange-400 font-mono">
                    {a.horas_sem_sessao >= 999 ? "Sem registros" : `${a.horas_sem_sessao}h sem atividade`}
                    <span className="text-muted-foreground ml-2">(threshold: {a.threshold}h)</span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ===================== VISAO INDIVIDUAL =====================
function VisaoIndividual({ data, colaboradorId, setColaboradorId }: {
  data: ProdData; colaboradorId: string; setColaboradorId: (id: string) => void;
}) {
  const { statusRealTime, tipos, individual } = data;
  const [timerSegs, setTimerSegs] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!individual?.timerAtivo) { setTimerSegs(0); if (intervalRef.current) clearInterval(intervalRef.current); return; }
    const inicio = new Date(individual.timerAtivo.ultimo_inicio).getTime();
    const tick = () => setTimerSegs(Math.floor((Date.now() - inicio) / 1000));
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [individual?.timerAtivo]);

  const tipoCorMap = new Map<string, string>();
  tipos.forEach((t, i) => tipoCorMap.set(t.nome, t.cor || CORES_TIPO[i % CORES_TIPO.length]));

  return (
    <div className="space-y-6">
      <select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)}
        className="text-sm bg-transparent border rounded-lg px-3 py-2 w-full max-w-xs">
        <option value="">Selecionar colaborador...</option>
        {statusRealTime.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>

      {!colaboradorId && <p className="text-sm text-muted-foreground">Selecione um colaborador para ver os detalhes.</p>}

      {individual && (
        <>
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center text-lg font-bold overflow-hidden">
              {individual.employee.foto_url
                ? <img src={individual.employee.foto_url} alt={individual.employee.nome} className="w-full h-full object-cover" />
                : individual.employee.nome.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-lg font-bold">{individual.employee.nome}</h3>
              <p className="text-xs text-muted-foreground">Meta: {individual.employee.meta_horas_semanais}h/semana</p>
            </div>
            {individual.timerAtivo && (
              <div className="ml-auto flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <Play size={12} className="text-green-400 animate-pulse" />
                <div>
                  <p className="text-xs font-mono font-bold text-green-400">{fmtTimer(timerSegs)}</p>
                  <p className="text-[9px] text-muted-foreground truncate max-w-[150px]">{individual.timerAtivo.titulo}</p>
                </div>
              </div>
            )}
          </div>

          {/* Comparativo semanal */}
          <div className="grid grid-cols-2 gap-3">
            <Card><CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground">Esta semana</p>
              <p className="text-xl font-bold font-mono">{fmtHoras(individual.semanaAtual)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground">Semana anterior</p>
              <p className="text-xl font-bold font-mono">{fmtHoras(individual.semanaAnterior)}</p>
              {individual.semanaAnterior > 0 && (
                <div className="flex items-center justify-center gap-1 mt-1">
                  {individual.semanaAtual >= individual.semanaAnterior
                    ? <TrendingUp size={10} className="text-green-400" />
                    : <TrendingDown size={10} className="text-red-400" />
                  }
                  <span className={`text-[10px] font-mono ${individual.semanaAtual >= individual.semanaAnterior ? "text-green-400" : "text-red-400"}`}>
                    {((individual.semanaAtual - individual.semanaAnterior) / individual.semanaAnterior * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </CardContent></Card>
          </div>

          {/* Gráfico 30 dias */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Últimos 30 dias</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={individual.porDia30.map((d) => ({ dia: diaMes(d.data), horas: Number((d.segundos / 3600).toFixed(2)) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="dia" tick={{ fontSize: 9, fill: "#888" }} interval={4} />
                  <YAxis tick={{ fontSize: 11, fill: "#888" }} unit="h" />
                  <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} formatter={(v) => [`${v}h`, "Horas"]} />
                  <ReferenceLine y={(individual.employee.meta_horas_semanais / 5)} stroke="#6366f1" strokeDasharray="5 5" label={{ value: "Meta/dia", fill: "#6366f1", fontSize: 10, position: "right" }} />
                  <Line type="monotone" dataKey="horas" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Por tipo */}
          {Object.keys(individual.porTipo).length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Por tipo de tarefa (30 dias)</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={Object.entries(individual.porTipo).sort((a, b) => b[1] - a[1]).map(([nome, segs]) => ({ nome, horas: Number((segs / 3600).toFixed(1)), cor: tipoCorMap.get(nome) || "#6366f1" }))}
                        dataKey="horas" nameKey="nome" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                        {Object.entries(individual.porTipo).sort((a, b) => b[1] - a[1]).map(([nome], i) => <Cell key={i} fill={tipoCorMap.get(nome) || CORES_TIPO[i % CORES_TIPO.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} formatter={(v, name) => [`${v}h`, name]} />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <table className="text-xs w-full">
                    <thead><tr className="border-b text-muted-foreground"><th className="text-left py-1.5">Tipo</th><th className="text-right py-1.5">Horas</th></tr></thead>
                    <tbody>
                      {Object.entries(individual.porTipo).sort((a, b) => b[1] - a[1]).map(([nome, segs]) => (
                        <tr key={nome} className="border-b border-border/30">
                          <td className="py-1.5 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tipoCorMap.get(nome) || "#6366f1" }} />
                            {nome}
                          </td>
                          <td className="text-right font-mono">{(segs / 3600).toFixed(1)}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tarefas recentes */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><ListChecks size={14} /> Tarefas recentes</CardTitle></CardHeader>
            <CardContent>
              {individual.tarefas.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma tarefa com tempo registrado.</p>
              ) : (
                <div className="space-y-2">
                  {individual.tarefas.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-2.5 border rounded-lg bg-background/50">
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
                        <Badge className={`text-[8px] ${statusColor[t.status] || "bg-muted"}`}>
                          {t.status === "a_fazer" ? "A fazer" : t.status === "fazendo" ? "Fazendo" : "Concluído"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ===================== PAGE PRINCIPAL =====================
export default function ProdutividadePage() {
  const [tab, setTab] = useState<"geral" | "individual">("geral");
  const [periodo, setPeriodo] = useState("hoje");
  const [colaboradorId, setColaboradorId] = useState("");
  const [data, setData] = useState<ProdData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ periodo });
    if (tab === "individual" && colaboradorId) params.set("colaborador_id", colaboradorId);
    const res = await fetch(`/api/produtividade?${params}`);
    const json = await res.json();
    if (!json.error) setData(json);
    setLoading(false);
  }, [periodo, tab, colaboradorId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Polling 30s
  useEffect(() => {
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Timer size={20} className="text-primary" />
          <h1 className="text-2xl font-bold">Produtividade</h1>
        </div>
        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-0.5">
          <button onClick={() => setTab("geral")} className={`text-xs px-4 py-1.5 rounded-md transition-colors ${tab === "geral" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            Geral
          </button>
          <button onClick={() => setTab("individual")} className={`text-xs px-4 py-1.5 rounded-md transition-colors ${tab === "individual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            Individual
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground animate-pulse text-sm">Carregando...</p>
        </div>
      )}

      {data && tab === "geral" && <VisaoGeral data={data} periodo={periodo} setPeriodo={setPeriodo} />}
      {data && tab === "individual" && <VisaoIndividual data={data} colaboradorId={colaboradorId} setColaboradorId={setColaboradorId} />}
    </div>
  );
}
