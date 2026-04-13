"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, Bell } from "lucide-react";

interface Alert {
  msg: string;
  tipo: "erro" | "aviso";
  area?: string;
}

interface AlertsPanelProps {
  alertas: Alert[];
  defaultExpanded?: boolean;
}

export function AlertsPanel({ alertas, defaultExpanded }: AlertsPanelProps) {
  const erros = alertas.filter((a) => a.tipo === "erro").length;
  const avisos = alertas.filter((a) => a.tipo === "aviso").length;
  const [expanded, setExpanded] = useState(defaultExpanded ?? erros > 0);

  if (alertas.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-card/80 backdrop-blur-xl overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm transition-all duration-200 hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg ${erros > 0 ? "bg-red-500/10" : "bg-yellow-500/10"}`}>
            <Bell size={14} className={erros > 0 ? "text-red-400" : "text-yellow-400"} />
          </div>
          <span className="text-foreground font-medium">
            {alertas.length} alerta{alertas.length > 1 ? "s" : ""}
          </span>
          {erros > 0 && <span className="text-[10px] bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full font-medium">{erros} critico{erros > 1 ? "s" : ""}</span>}
          {avisos > 0 && <span className="text-[10px] bg-yellow-500/15 text-yellow-400 px-2 py-0.5 rounded-full font-medium">{avisos} aviso{avisos > 1 ? "s" : ""}</span>}
        </div>
        {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </button>

      {/* List */}
      {expanded && (
        <div className="border-t border-white/[0.06] space-y-1 p-3">
          {alertas.map((a, i) => (
            <div key={i} className={`flex items-start gap-2.5 text-xs rounded-lg px-3 py-2.5 transition-colors ${a.tipo === "erro" ? "bg-red-500/5 text-red-400 border-l-2 border-l-red-500/40" : "bg-yellow-500/5 text-yellow-400 border-l-2 border-l-yellow-500/40"}`}>
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <span>{a.msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
