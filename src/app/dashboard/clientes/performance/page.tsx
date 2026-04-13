"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import {
  AlertTriangle,
  Users,
  TrendingUp,
  Activity,
  Target,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";

interface ClientePerf {
  entrada_id: string;
  notion_id: string | null;
  nome: string;
  nicho: string | null;
  status: string | null;
  analista: string | null;
  valor_mensal: number;
  meta_campaign_id: string | null;
  meta_leads_mes: number | null;
  meta_roas_minimo: number | null;
  tese_ativa: { id: string; nome_tese: string; tipo: string | null } | null;
  tese_ids: string[];
  score_saude: number | null;
  risco_churn: "baixo" | "medio" | "alto" | null;
  risco_churn_motivo: string | null;
  ultima_otimizacao: string | null;
  dias_sem_otimizacao: number | null;
  spend_periodo: number;
  total_leads: number;
  cpl: number;
  roas: number;
  taxa_qualificacao: number;
  pct_meta_leads: number | null;
  alerta_sem_leads: boolean;
}

interface Payload {
  periodo: string;
  total: number;
  filtrado_por_gestor: string | null;
  clientes: ClientePerf[];
}

interface Employee {
  id: string;
  nome: string;
}

const RISCO_COLORS: Record<string, string> = {
  baixo: "bg-green-500/15 text-green-400 border-green-500/30",
  medio: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  alto: "bg-red-500/15 text-red-400 border-red-500/30",
};

function ScoreBar({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>;
  const color = score >= 70 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs tabular-nums w-8 text-right">{score}</span>
    </div>
  );
}

function MetaBar({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-muted-foreground">—</span>;
  const capped = Math.min(100, pct);
  const color = pct >= 100 ? "bg-green-500" : pct >= 70 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${capped}%` }} />
      </div>
      <span className="text-xs tabular-nums w-10 text-right">{pct}%</span>
    </div>
  );
}

export default function PerformanceClientesPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [filtroNicho, setFiltroNicho] = useState("todos");
  const [filtroTese, setFiltroTese] = useState("todos");
  const [filtroRisco, setFiltroRisco] = useState("todos");
  const [filtroGestor, setFiltroGestor] = useState("todos");
  const [periodo, setPeriodo] = useState<"mes_atual" | "3m" | "6m" | "12m">("mes_atual");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/team/employees");
        if (r.ok) {
          const j = await r.json();
          setEmployees(j.employees || j || []);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ periodo });
        if (filtroNicho !== "todos") params.set("nicho", filtroNicho);
        if (filtroTese !== "todos") params.set("tese_id", filtroTese);
        if (filtroRisco !== "todos") params.set("risco", filtroRisco);
        if (filtroGestor !== "todos") params.set("gestor_id", filtroGestor);
        const res = await fetch(`/api/clientes/performance?${params.toString()}`);
        const json: Payload = await res.json();
        setData(json);
      } finally {
        setLoading(false);
      }
    })();
  }, [periodo, filtroNicho, filtroTese, filtroRisco, filtroGestor]);

  const clientes = data?.clientes || [];

  const nichos = useMemo(
    () => Array.from(new Set(clientes.map((c) => c.nicho).filter(Boolean))) as string[],
    [clientes]
  );
  const teses = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clientes) if (c.tese_ativa) m.set(c.tese_ativa.id, c.tese_ativa.nome_tese);
    return Array.from(m.entries());
  }, [clientes]);

  const kpis = useMemo(() => {
    let totalSpend = 0;
    let totalLeads = 0;
    let totalLtv = 0;
    let somaScore = 0;
    let countScore = 0;
    let emRisco = 0;
    let semMeta = 0;
    for (const c of clientes) {
      totalSpend += c.spend_periodo;
      totalLeads += c.total_leads;
      totalLtv += c.valor_mensal * 12;
      if (typeof c.score_saude === "number") {
        somaScore += c.score_saude;
        countScore++;
      }
      if (c.risco_churn === "alto") emRisco++;
      if (c.meta_leads_mes == null) semMeta++;
    }
    return {
      cplMedio: totalLeads > 0 ? totalSpend / totalLeads : 0,
      roasMedio: totalSpend > 0 ? totalLtv / totalSpend : 0,
      emRisco,
      scoreMedio: countScore > 0 ? Math.round(somaScore / countScore) : null,
      semMeta,
    };
  }, [clientes]);

  const benchmarkNicho = useMemo(() => {
    const map = new Map<
      string,
      { cpls: number[]; roass: number[]; best?: ClientePerf; worst?: ClientePerf }
    >();
    for (const c of clientes) {
      if (!c.nicho) continue;
      const b = map.get(c.nicho) || { cpls: [], roass: [] };
      if (c.cpl > 0) b.cpls.push(c.cpl);
      if (c.roas > 0) b.roass.push(c.roas);
      if (!b.best || c.roas > (b.best?.roas || 0)) b.best = c;
      if (!b.worst || (c.cpl > 0 && (b.worst.cpl === 0 || c.cpl > b.worst.cpl))) b.worst = c;
      map.set(c.nicho, b);
    }
    return Array.from(map.entries()).map(([nicho, b]) => ({
      nicho,
      cpl_medio: b.cpls.length ? b.cpls.reduce((a, c) => a + c, 0) / b.cpls.length : 0,
      roas_medio: b.roass.length ? b.roass.reduce((a, c) => a + c, 0) / b.roass.length : 0,
      best: b.best?.nome || "—",
      best_roas: b.best?.roas || 0,
      worst: b.worst?.nome || "—",
      worst_cpl: b.worst?.cpl || 0,
    }));
  }, [clientes]);

  const benchmarkTese = useMemo(() => {
    const map = new Map<string, { cpls: number[]; roass: number[]; count: number }>();
    for (const c of clientes) {
      if (!c.tese_ativa) continue;
      const nome = c.tese_ativa.nome_tese;
      const b = map.get(nome) || { cpls: [], roass: [], count: 0 };
      if (c.cpl > 0) b.cpls.push(c.cpl);
      if (c.roas > 0) b.roass.push(c.roas);
      b.count += 1;
      map.set(nome, b);
    }
    return Array.from(map.entries()).map(([tese, b]) => ({
      tese,
      cpl_medio: b.cpls.length ? b.cpls.reduce((a, c) => a + c, 0) / b.cpls.length : 0,
      roas_medio: b.roass.length ? b.roass.reduce((a, c) => a + c, 0) / b.roass.length : 0,
      count: b.count,
    }));
  }, [clientes]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Performance de Clientes</h1>
        <p className="text-sm text-muted-foreground">
          CPL, ROAS, saúde e risco de churn por cliente ativo.
          {data?.filtrado_por_gestor && (
            <span className="ml-2 text-xs px-2 py-0.5 rounded bg-blue-500/15 text-blue-400">
              Filtro por gestor: {data.filtrado_por_gestor}
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase">
              <TrendingUp className="h-3 w-3" /> CPL Médio
            </div>
            <div className="text-2xl font-bold mt-1 tabular-nums">
              {kpis.cplMedio > 0 ? formatCurrency(kpis.cplMedio) : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase">
              <Activity className="h-3 w-3" /> ROAS Médio
            </div>
            <div className="text-2xl font-bold mt-1 tabular-nums">
              {kpis.roasMedio > 0 ? `${kpis.roasMedio.toFixed(2)}x` : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase">
              <AlertTriangle className="h-3 w-3" /> Em Risco
            </div>
            <div className="text-2xl font-bold mt-1 text-red-400">{kpis.emRisco}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase">
              <Users className="h-3 w-3" /> Score Médio
            </div>
            <div className="text-2xl font-bold mt-1 tabular-nums">{kpis.scoreMedio ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase">
              <Target className="h-3 w-3" /> Sem Meta
            </div>
            <div className="text-2xl font-bold mt-1 text-yellow-400">{kpis.semMeta}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          className="bg-background border border-border rounded px-3 py-1.5 text-sm"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value as typeof periodo)}
        >
          <option value="mes_atual">Mês atual</option>
          <option value="3m">Últimos 3 meses</option>
          <option value="6m">Últimos 6 meses</option>
          <option value="12m">Últimos 12 meses</option>
        </select>
        <select
          className="bg-background border border-border rounded px-3 py-1.5 text-sm"
          value={filtroNicho}
          onChange={(e) => setFiltroNicho(e.target.value)}
        >
          <option value="todos">Todos os nichos</option>
          {nichos.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select
          className="bg-background border border-border rounded px-3 py-1.5 text-sm"
          value={filtroTese}
          onChange={(e) => setFiltroTese(e.target.value)}
        >
          <option value="todos">Todas as teses</option>
          {teses.map(([id, nome]) => (
            <option key={id} value={id}>
              {nome}
            </option>
          ))}
        </select>
        <select
          className="bg-background border border-border rounded px-3 py-1.5 text-sm"
          value={filtroRisco}
          onChange={(e) => setFiltroRisco(e.target.value)}
        >
          <option value="todos">Todos os riscos</option>
          <option value="baixo">Baixo</option>
          <option value="medio">Médio</option>
          <option value="alto">Alto</option>
        </select>
        {employees.length > 0 && (
          <select
            className="bg-background border border-border rounded px-3 py-1.5 text-sm"
            value={filtroGestor}
            onChange={(e) => setFiltroGestor(e.target.value)}
          >
            <option value="todos">Todos os gestores</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-3">Cliente</th>
                  <th className="text-left px-3 py-3">Nicho / Tese</th>
                  <th className="text-right px-3 py-3">CPL</th>
                  <th className="text-right px-3 py-3">ROAS</th>
                  <th className="text-left px-3 py-3">Leads / Meta</th>
                  <th className="text-left px-3 py-3">Saúde</th>
                  <th className="text-left px-3 py-3">Risco</th>
                  <th className="text-right px-3 py-3">Últ. otim.</th>
                  <th className="text-center px-3 py-3">!</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={10} className="text-center py-10 text-muted-foreground">
                      Carregando…
                    </td>
                  </tr>
                )}
                {!loading && clientes.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center py-10 text-muted-foreground">
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                )}
                {!loading &&
                  clientes.map((c) => {
                    const semCampanha = !c.meta_campaign_id;
                    const roasAbaixoMin =
                      c.meta_roas_minimo != null && c.roas > 0 && c.roas < c.meta_roas_minimo;
                    return (
                      <tr key={c.entrada_id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-3 py-3 font-medium">
                          <div>{c.nome}</div>
                          {c.analista && (
                            <div className="text-[10px] text-muted-foreground">{c.analista}</div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-muted-foreground">{c.nicho || "—"}</span>
                            {c.tese_ativa && (
                              <span className="inline-block text-xs px-1.5 py-0.5 bg-blue-500/15 text-blue-400 rounded w-fit">
                                {c.tese_ativa.nome_tese}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {semCampanha ? (
                            <span className="text-xs text-yellow-500">—</span>
                          ) : c.cpl > 0 ? (
                            formatCurrency(c.cpl)
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {c.roas > 0 ? (
                            <span className={roasAbaixoMin ? "text-red-400 font-semibold" : ""}>
                              {c.roas.toFixed(2)}x
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-xs tabular-nums">{c.total_leads}</div>
                          <MetaBar pct={c.pct_meta_leads} />
                        </td>
                        <td className="px-3 py-3">
                          <ScoreBar score={c.score_saude} />
                        </td>
                        <td className="px-3 py-3">
                          {c.risco_churn ? (
                            <span
                              className={`text-xs px-2 py-0.5 rounded border ${RISCO_COLORS[c.risco_churn]}`}
                              title={c.risco_churn_motivo || undefined}
                            >
                              {c.risco_churn}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {c.dias_sem_otimizacao != null ? (
                            <span
                              className={
                                c.dias_sem_otimizacao <= 7
                                  ? "text-green-400"
                                  : c.dias_sem_otimizacao <= 14
                                  ? "text-yellow-400"
                                  : "text-red-400"
                              }
                            >
                              {c.dias_sem_otimizacao}d
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {c.alerta_sem_leads && (
                            <span title="Spend > 0 mas sem leads no período">
                              <AlertTriangle className="h-4 w-4 text-red-400 inline" />
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            href={`/dashboard/clientes/${c.entrada_id}/performance`}
                            className="text-xs text-blue-400 hover:underline"
                          >
                            Ver detalhes
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {benchmarkNicho.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Benchmark por nicho</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {benchmarkNicho.map((b) => (
              <Card key={b.nicho}>
                <CardContent className="p-4 space-y-2">
                  <div className="font-semibold">{b.nicho}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">CPL médio</div>
                      <div className="tabular-nums font-medium">
                        {b.cpl_medio > 0 ? formatCurrency(b.cpl_medio) : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">ROAS médio</div>
                      <div className="tabular-nums font-medium">
                        {b.roas_medio > 0 ? `${b.roas_medio.toFixed(2)}x` : "—"}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs space-y-0.5 border-t border-border pt-2">
                    <div className="flex items-center gap-1 text-green-400">
                      <ArrowUpRight className="h-3 w-3" /> Melhor: {b.best}
                      {b.best_roas > 0 && (
                        <span className="text-muted-foreground">({b.best_roas.toFixed(1)}x)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-red-400">
                      <ArrowDownRight className="h-3 w-3" /> Pior CPL: {b.worst}
                      {b.worst_cpl > 0 && (
                        <span className="text-muted-foreground">
                          ({formatCurrency(b.worst_cpl)})
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {benchmarkTese.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Benchmark por tese</h2>
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2">Tese</th>
                    <th className="text-right px-4 py-2">CPL médio</th>
                    <th className="text-right px-4 py-2">ROAS médio</th>
                    <th className="text-right px-4 py-2">Clientes</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarkTese.map((b) => (
                    <tr key={b.tese} className="border-t border-border">
                      <td className="px-4 py-2">{b.tese}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {b.cpl_medio > 0 ? formatCurrency(b.cpl_medio) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {b.roas_medio > 0 ? `${b.roas_medio.toFixed(2)}x` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{b.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
