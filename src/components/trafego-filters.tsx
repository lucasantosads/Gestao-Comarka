"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const PERIODO_STORAGE_KEY = "trafego_periodo_filtro";

interface TrafegoFiltersProps {
  periodo: string;
  onPeriodoChange: (p: string) => void;
  dataInicio: string;
  dataFim: string;
  onDataInicioChange: (d: string) => void;
  onDataFimChange: (d: string) => void;
  statusFiltro: string;
  onStatusChange: (s: string) => void;
  campanhas?: { id: string; name: string }[];
  campanhaFiltro?: string;
  onCampanhaChange?: (c: string) => void;
  somenteComDados?: boolean;
  onSomenteComDadosChange?: (v: boolean) => void;
}

const PERIODOS = [
  { value: "month", label: "Este mês" },
  { value: "7", label: "7d" },
  { value: "30", label: "30d" },
  { value: "90", label: "3 meses" },
  { value: "custom", label: "Personalizado" },
];

export function TrafegoFilters({
  periodo, onPeriodoChange,
  dataInicio, dataFim, onDataInicioChange, onDataFimChange,
  statusFiltro, onStatusChange,
  campanhas, campanhaFiltro, onCampanhaChange,
  somenteComDados, onSomenteComDadosChange,
}: TrafegoFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Período */}
      <div className="flex bg-muted rounded-lg p-0.5">
        {PERIODOS.map((p) => (
          <button
            key={p.value}
            onClick={() => onPeriodoChange(p.value)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              periodo === p.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Date pickers */}
      {periodo === "custom" && (
        <div className="flex items-center gap-1">
          <input type="date" value={dataInicio} onChange={(e) => onDataInicioChange(e.target.value)}
            className="text-xs bg-transparent border rounded px-2 py-1.5 w-[130px]" />
          <span className="text-xs text-muted-foreground">até</span>
          <input type="date" value={dataFim} onChange={(e) => onDataFimChange(e.target.value)}
            className="text-xs bg-transparent border rounded px-2 py-1.5 w-[130px]" />
        </div>
      )}

      {/* Status */}
      <select value={statusFiltro} onChange={(e) => onStatusChange(e.target.value)}
        className="text-xs bg-transparent border rounded-lg px-3 py-1.5">
        <option value="ACTIVE">Somente Ativos</option>
        <option value="all">Todos os Status</option>
        <option value="PAUSED">Pausados</option>
        <option value="CAMPAIGN_PAUSED">Campanha Pausada</option>
        <option value="ADSET_PAUSED">Conjunto Pausado</option>
      </select>

      {/* Campanha */}
      {campanhas && onCampanhaChange && (
        <select value={campanhaFiltro || "all"} onChange={(e) => onCampanhaChange(e.target.value)}
          className="text-xs bg-transparent border rounded-lg px-3 py-1.5 max-w-[200px] truncate">
          <option value="all">Todas as campanhas</option>
          {campanhas.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}

      {/* Toggle: Somente com dados */}
      {onSomenteComDadosChange && (
        <button
          onClick={() => onSomenteComDadosChange(!somenteComDados)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all",
            somenteComDados
              ? "gradient-primary text-white border-transparent"
              : "border-border dark:border-white/[0.08] text-muted-foreground hover:text-foreground"
          )}
        >
          <span className={cn("w-3 h-3 rounded-full border-2 transition-all", somenteComDados ? "bg-white border-white/50" : "border-muted-foreground/40")} />
          Somente com dados
        </button>
      )}
    </div>
  );
}

function getMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export function useTrafegoFilters() {
  const hoje = new Date().toISOString().split("T")[0];
  const [periodo, setPeriodo] = useState("month");
  const [dataInicio, setDataInicio] = useState(getMonthStart);
  const [dataFim, setDataFim] = useState(hoje);
  const [statusFiltro, setStatusFiltro] = useState("ACTIVE");
  const [campanhaFiltro, setCampanhaFiltro] = useState("all");
  const [somenteComDados, setSomenteComDados] = useState(true);

  // Hidrata o período a partir do localStorage e recalcula as datas.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(PERIODO_STORAGE_KEY);
    if (saved && saved !== "month") handlePeriodoChange(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePeriodoChange = (p: string) => {
    setPeriodo(p);
    if (typeof window !== "undefined") localStorage.setItem(PERIODO_STORAGE_KEY, p);
    if (p !== "custom") {
      if (p === "month") {
        setDataInicio(getMonthStart());
        setDataFim(hoje);
      } else if (p === "0") {
        setDataInicio(hoje);
        setDataFim(hoje);
      } else if (p === "1") {
        const ontem = new Date();
        ontem.setDate(ontem.getDate() - 1);
        const ontemStr = ontem.toISOString().split("T")[0];
        setDataInicio(ontemStr);
        setDataFim(ontemStr);
      } else {
        const d = new Date();
        d.setDate(d.getDate() - Number(p));
        setDataInicio(d.toISOString().split("T")[0]);
        setDataFim(hoje);
      }
    }
  };

  return {
    periodo, dataInicio, dataFim, statusFiltro, campanhaFiltro, somenteComDados,
    setPeriodo: handlePeriodoChange,
    setDataInicio, setDataFim, setStatusFiltro, setCampanhaFiltro, setSomenteComDados,
  };
}
