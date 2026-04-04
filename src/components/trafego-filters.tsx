"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

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
}

const PERIODOS = [
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
    </div>
  );
}

export function useTrafegoFilters() {
  const hoje = new Date().toISOString().split("T")[0];
  const [periodo, setPeriodo] = useState("30");
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split("T")[0];
  });
  const [dataFim, setDataFim] = useState(hoje);
  const [statusFiltro, setStatusFiltro] = useState("ACTIVE");
  const [campanhaFiltro, setCampanhaFiltro] = useState("all");

  const handlePeriodoChange = (p: string) => {
    setPeriodo(p);
    if (p !== "custom") {
      if (p === "0") {
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
    periodo, dataInicio, dataFim, statusFiltro, campanhaFiltro,
    setPeriodo: handlePeriodoChange,
    setDataInicio, setDataFim, setStatusFiltro, setCampanhaFiltro,
  };
}
