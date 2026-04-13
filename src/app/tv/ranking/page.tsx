"use client";

import { useEffect, useState } from "react";

type Linha = {
  posicao: number;
  colaborador_id: string;
  nome: string;
  foto_url: string | null;
  pontos_finais: number;
  meses_sequencia: number;
  multiplicador_ativo: number;
};

export default function TvRankingPage() {
  const [ranking, setRanking] = useState<Linha[]>([]);
  const [atualizado, setAtualizado] = useState<string>("");

  async function load() {
    const r = await fetch("/api/comarka-pro/ranking?periodo=mensal&publico=true");
    const d = await r.json();
    setRanking((d.ranking || []).slice(0, 5));
    setAtualizado(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  const maxPts = Math.max(1, ...ranking.map((l) => l.pontos_finais));
  const mesAtual = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-neutral-950 to-black text-white p-12 flex flex-col">
      <header className="flex items-center justify-between mb-10">
        <div className="text-3xl font-bold tracking-tight">COMARKA ADS</div>
        <div className="text-xl text-neutral-400">Atualizado às {atualizado}</div>
      </header>

      <h1 className="text-6xl font-black mb-2">Ranking Comarka Pro</h1>
      <div className="text-2xl text-neutral-400 mb-10 capitalize">{mesAtual}</div>

      <div className="flex-1 space-y-6">
        {ranking.map((l, i) => (
          <div
            key={l.colaborador_id}
            className="flex items-center gap-6 p-6 bg-neutral-900/50 border border-neutral-800 rounded-2xl transition-all duration-500 hover:scale-[1.01]"
            style={{ animation: `fadeIn 0.6s ease-out ${i * 0.1}s both` }}
          >
            <div className="text-6xl font-black w-20 text-center">{i + 1}</div>
            {l.foto_url ? (
              <img src={l.foto_url} className="w-24 h-24 rounded-full object-cover" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-neutral-800" />
            )}
            <div className="flex-1">
              <div className="text-4xl font-bold">{l.nome}</div>
              <div className="flex items-center gap-3 mt-2 text-lg">
                {l.multiplicador_ativo > 1 && (
                  <span className="px-3 py-1 bg-yellow-600/20 text-yellow-300 rounded-full">
                    {l.multiplicador_ativo}x
                  </span>
                )}
                {l.meses_sequencia > 0 && (
                  <span className="text-neutral-400">{l.meses_sequencia} mês(es) seguidos</span>
                )}
              </div>
              <div className="mt-3 h-3 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-1000"
                  style={{ width: `${(l.pontos_finais / maxPts) * 100}%` }}
                />
              </div>
            </div>
            <div className="text-5xl font-black text-green-400 w-40 text-right">{l.pontos_finais}</div>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
