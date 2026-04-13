"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { Users, Target, TrendingUp, Award } from "lucide-react";

export default function EquipePortalPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalReunioes: 0, metaReunioes: 0, totalContratos: 0, metaContratos: 0,
    taxaConversao: 0, meuRanking: 0, totalClosers: 0,
  });
  const [evolucao, setEvolucao] = useState<{ semana: string; reunioes: number; contratos: number }[]>([]);

  useEffect(() => {
    if (!user?.entityId) return;
    const mes = new Date().toISOString().slice(0, 7);

    Promise.all([
      // Lançamentos de TODOS os closers do mês
      supabase.from("lancamentos_diarios").select("closer_id, reunioes_feitas, ganhos, data")
        .eq("mes_referencia", mes),
      // Contratos de TODOS do mês
      supabase.from("contratos").select("closer_id, mrr").eq("mes_referencia", mes),
      // Metas
      supabase.from("metas_closers").select("closer_id, meta_contratos, meta_reunioes_feitas").eq("mes_referencia", mes),
      // Closers ativos
      supabase.from("closers").select("id").eq("ativo", true),
    ]).then(([{ data: lancs }, { data: cts }, { data: metas }, { data: closers }]) => {
      const allLancs = lancs || [];
      const allCts = cts || [];
      const allMetas = metas || [];
      const totalClosers = (closers || []).length;

      // Totais equipe
      const totalReunioes = allLancs.reduce((s, l) => s + Number(l.reunioes_feitas || 0), 0);
      const totalContratos = allCts.length;
      const metaReunioes = allMetas.reduce((s, m) => s + Number(m.meta_reunioes_feitas || 0), 0);
      const metaContratos = allMetas.reduce((s, m) => s + Number(m.meta_contratos || 0), 0);
      const taxaConversao = totalReunioes > 0 ? (totalContratos / totalReunioes) * 100 : 0;

      // Ranking por contratos (sem expor nomes/valores)
      const contsPorCloser: Record<string, number> = {};
      for (const c of allCts) {
        contsPorCloser[c.closer_id] = (contsPorCloser[c.closer_id] || 0) + 1;
      }
      const ranking = Object.entries(contsPorCloser).sort((a, b) => b[1] - a[1]);
      const meuRanking = ranking.findIndex(([id]) => id === user.entityId) + 1;

      setStats({ totalReunioes, metaReunioes, totalContratos, metaContratos, taxaConversao, meuRanking: meuRanking || totalClosers, totalClosers });

      // Evolução semanal (agregar por semana)
      const porSemana: Record<string, { reunioes: number; contratos: number }> = {};
      for (const l of allLancs) {
        const d = new Date(l.data);
        const weekStart = new Date(d); weekStart.setDate(d.getDate() - d.getDay());
        const key = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`;
        if (!porSemana[key]) porSemana[key] = { reunioes: 0, contratos: 0 };
        porSemana[key].reunioes += Number(l.reunioes_feitas || 0);
      }
      for (let ci = 0; ci < allCts.length; ci++) {
        const keys = Object.keys(porSemana);
        if (keys.length > 0) porSemana[keys[keys.length - 1]].contratos++;
      }
      setEvolucao(Object.entries(porSemana).map(([semana, v]) => ({ semana, ...v })));
      setLoading(false);
    });
  }, [user]);

  if (loading) return <div className="h-64 flex items-center justify-center text-muted-foreground">Carregando...</div>;

  const pctReunioes = stats.metaReunioes > 0 ? (stats.totalReunioes / stats.metaReunioes) * 100 : 0;
  const pctContratos = stats.metaContratos > 0 ? (stats.totalContratos / stats.metaContratos) * 100 : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Desempenho da Equipe</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-3 pb-2">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Users size={10} /> Reunioes Feitas</p>
            <p className="text-lg font-bold">{stats.totalReunioes}</p>
            {stats.metaReunioes > 0 && (
              <>
                <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                  <div className={`h-1.5 rounded-full ${pctReunioes >= 100 ? "bg-green-400" : pctReunioes >= 70 ? "bg-yellow-400" : "bg-red-400"}`} style={{ width: `${Math.min(pctReunioes, 100)}%` }} />
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5">{pctReunioes.toFixed(0)}% da meta ({stats.metaReunioes})</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Target size={10} /> Contratos</p>
            <p className="text-lg font-bold text-green-400">{stats.totalContratos}</p>
            {stats.metaContratos > 0 && (
              <>
                <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                  <div className={`h-1.5 rounded-full ${pctContratos >= 100 ? "bg-green-400" : pctContratos >= 70 ? "bg-yellow-400" : "bg-red-400"}`} style={{ width: `${Math.min(pctContratos, 100)}%` }} />
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5">{pctContratos.toFixed(0)}% da meta ({stats.metaContratos})</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1"><TrendingUp size={10} /> Conversao Equipe</p>
            <p className="text-lg font-bold">{formatPercent(stats.taxaConversao)}</p>
          </CardContent>
        </Card>
        <Card className={stats.meuRanking <= 1 ? "border-yellow-500/30" : ""}>
          <CardContent className="pt-3 pb-2">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Award size={10} /> Seu Ranking</p>
            <p className="text-lg font-bold">{stats.meuRanking > 0 ? `${stats.meuRanking}º` : "—"} <span className="text-xs text-muted-foreground font-normal">de {stats.totalClosers}</span></p>
            {stats.meuRanking === 1 && <p className="text-[9px] text-yellow-400">Lider do mes!</p>}
          </CardContent>
        </Card>
      </div>

      {/* Gráfico evolução semanal */}
      {evolucao.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Evolução Semanal da Equipe</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={evolucao}>
                <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="reunioes" name="Reunioes" stroke="#6366f1" strokeWidth={2} />
                <Line type="monotone" dataKey="contratos" name="Contratos" stroke="#22c55e" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <p className="text-[10px] text-muted-foreground text-center">Dados agregados da equipe — sem exposicao de metricas individuais de outros colaboradores.</p>
    </div>
  );
}
