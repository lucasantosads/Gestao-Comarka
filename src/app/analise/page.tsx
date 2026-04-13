"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// Lazy imports das páginas existentes
import dynamic from "next/dynamic";

const FunilTempo = dynamic(() => import("@/app/funil-tempo/page"), { loading: () => <Loading /> });
const AnaliseDias = dynamic(() => import("@/app/analise-dias/page"), { loading: () => <Loading /> });
const Historico = dynamic(() => import("@/app/historico/page"), { loading: () => <Loading /> });
const Canais = dynamic(() => import("@/app/canais/page"), { loading: () => <Loading /> });

function Loading() {
  return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;
}

const TABS = [
  { key: "funil", label: "Funil" },
  { key: "dias", label: "Por Dia" },
  { key: "historico", label: "Histórico" },
  { key: "canais", label: "Canais" },
];

function AnaliseContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "funil";
  const [tab, setTab] = useState(initialTab);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Análise</h1>
        <div className="flex bg-muted rounded-lg p-0.5">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === t.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "funil" && <FunilTempo />}
      {tab === "dias" && <AnaliseDias />}
      {tab === "historico" && <Historico />}
      {tab === "canais" && <Canais />}
    </div>
  );
}

export default function AnalisePage() {
  return (
    <Suspense fallback={<Loading />}>
      <AnaliseContent />
    </Suspense>
  );
}
