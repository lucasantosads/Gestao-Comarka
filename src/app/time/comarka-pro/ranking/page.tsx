"use client";

import { useEffect, useState } from "react";

type Periodo = "mensal" | "trimestral" | "semestral" | "anual";
type Nivel = "todos" | "jr" | "pleno" | "sr";

type Linha = {
  posicao: number;
  variacao_posicao: number;
  colaborador_id: string;
  nome: string;
  foto_url: string | null;
  cargo_atual: string | null;
  cargo_nivel: string | null;
  pontos_finais: number;
  meses_sequencia: number;
  multiplicador_ativo: number;
  top_categorias: { categoria: string; pontos: number }[];
};

export default function RankingPage() {
  const [periodo, setPeriodo] = useState<Periodo>("mensal");
  const [nivel, setNivel] = useState<Nivel>("todos");
  const [ranking, setRanking] = useState<Linha[]>([]);
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/comarka-pro/ranking?periodo=${periodo}&nivel=${nivel}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setRanking(d.ranking || []));
  }, [periodo, nivel]);

  useEffect(() => {
    fetch("/api/comarka-pro/config", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then(setConfig);
  }, []);

  const top3 = ranking.slice(0, 3);
  const resto = ranking.slice(3);
  const premios = config ? [config[`premio_${periodo}_1`], config[`premio_${periodo}_2`], config[`premio_${periodo}_3`]] : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Ranking Comarka Pro</h1>
        <a
          href="/tv/ranking"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium"
        >
          Abrir modo TV ↗
        </a>
      </div>

      <div className="flex flex-wrap gap-3">
        <Toggle label="Período" value={periodo} onChange={(v) => setPeriodo(v as Periodo)}
          options={["mensal", "trimestral", "semestral", "anual"]} />
        <Toggle label="Nível" value={nivel} onChange={(v) => setNivel(v as Nivel)}
          options={["todos", "jr", "pleno", "sr"]} />
      </div>

      {/* Top 3 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {top3.map((l, i) => (
          <div key={l.colaborador_id} className="bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-xl p-6 text-center">
            <div className="text-4xl mb-2">{["🥇", "🥈", "🥉"][i]}</div>
            {l.foto_url ? <img src={l.foto_url} className="w-20 h-20 rounded-full mx-auto mb-3 object-cover" /> : <div className="w-20 h-20 rounded-full bg-neutral-800 mx-auto mb-3" />}
            <div className="font-bold text-lg">{l.nome}</div>
            <div className="text-sm text-neutral-400">{l.cargo_atual || "—"}</div>
            <div className="text-3xl font-bold mt-2">{l.pontos_finais}</div>
            <div className="text-xs text-neutral-500 mt-1">
              {l.multiplicador_ativo > 1 && <span className="text-yellow-400">{l.multiplicador_ativo}x · </span>}
              {l.meses_sequencia} mês(es) seguidos
            </div>
            {premios[i] && <div className="text-sm text-green-400 mt-2">Prêmio: R$ {premios[i]}</div>}
          </div>
        ))}
      </div>

      {/* Restante */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs uppercase text-neutral-500 border-b border-neutral-800">
              <th className="py-2">#</th>
              <th>Nome</th>
              <th>Cargo</th>
              <th className="text-right">Pontos</th>
              <th className="text-right">Mult</th>
              <th className="text-right">Var</th>
            </tr>
          </thead>
          <tbody>
            {resto.map((l) => (
              <tr key={l.colaborador_id} className="border-b border-neutral-800/50">
                <td className="py-3">{l.posicao}º</td>
                <td>{l.nome}</td>
                <td className="text-neutral-400">{l.cargo_atual || "—"}</td>
                <td className="text-right font-semibold">{l.pontos_finais}</td>
                <td className="text-right text-yellow-400">{l.multiplicador_ativo > 1 ? `${l.multiplicador_ativo}x` : "—"}</td>
                <td className={`text-right ${l.variacao_posicao > 0 ? "text-green-400" : l.variacao_posicao < 0 ? "text-red-400" : "text-neutral-500"}`}>
                  {l.variacao_posicao > 0 ? `↑${l.variacao_posicao}` : l.variacao_posicao < 0 ? `↓${-l.variacao_posicao}` : "="}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Toggle({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <div className="text-xs uppercase text-neutral-500 mb-1">{label}</div>
      <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-lg p-1">
        {options.map((o) => (
          <button key={o} onClick={() => onChange(o)}
            className={`px-3 py-1.5 rounded text-sm capitalize ${value === o ? "bg-green-600 text-white" : "text-neutral-400 hover:text-white"}`}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
