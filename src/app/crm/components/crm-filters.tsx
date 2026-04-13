"use client";

import { Search, Columns, Filter } from "lucide-react";
import type { Closer } from "@/types/database";

interface CrmFiltersProps {
    closers: Closer[];
    closerFiltro: string;
    setCloserFiltro: (v: string) => void;
    busca: string;
    setBusca: (v: string) => void;
    showColDropdown: boolean;
    setShowColDropdown: (v: boolean) => void;
    showAdvFilters: boolean;
    setShowAdvFilters: (v: boolean) => void;
    visibleCols: Set<string>;
    toggleCol: (k: string) => void;
    ALL_COLUMNS: { key: string; label: string }[];
    filtroCanal: string;
    setFiltroCanal: (v: string) => void;
    canaisPossiveis: string[];
    filtroScoreRange: string | null;
    setFiltroScoreRange: (v: string | null) => void;
}

export function CrmFilters({
    closers, closerFiltro, setCloserFiltro, busca, setBusca,
    showColDropdown, setShowColDropdown, showAdvFilters, setShowAdvFilters,
    visibleCols, toggleCol, ALL_COLUMNS,
    filtroCanal, setFiltroCanal, canaisPossiveis,
    filtroScoreRange, setFiltroScoreRange
}: CrmFiltersProps) {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex gap-2 flex-wrap">
                <select value={closerFiltro} onChange={(e) => { setCloserFiltro(e.target.value); sessionStorage.setItem("crm_closer_filter", e.target.value); }} className="text-xs bg-transparent border rounded-lg px-3 py-2 shrink-0">
                    <option value="todos">Todos os Closers</option>
                    <option value="sem">Sem closer</option>
                    {closers.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome ou telefone (debounce aplicado)..." className="w-full pl-9 pr-4 py-2 text-sm bg-transparent border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div className="relative">
                    <button onClick={() => setShowColDropdown(!showColDropdown)} className="flex items-center gap-1.5 px-3 py-2 text-xs border rounded-lg hover:bg-muted transition-colors">
                        <Columns size={14} /> Colunas
                    </button>
                    {showColDropdown && (
                        <div className="absolute right-0 top-full mt-1 z-50 bg-card border rounded-lg p-2 min-w-[180px] shadow-lg max-h-[300px] overflow-y-auto">
                            {ALL_COLUMNS.map((col) => (
                                <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-muted/50 rounded">
                                    <input type="checkbox" checked={visibleCols.has(col.key)} onChange={() => toggleCol(col.key)} className="rounded" />
                                    {col.label}
                                </label>
                            ))}
                        </div>
                    )}
                </div>
                <button onClick={() => setShowAdvFilters(!showAdvFilters)} className={`flex items-center gap-1.5 px-3 py-2 text-xs border rounded-lg hover:bg-muted transition-colors ${showAdvFilters ? "bg-muted" : ""}`}>
                    <Filter size={14} /> Filtros
                </button>
            </div>

            {showAdvFilters && (
                <div className="flex flex-wrap gap-3 p-3 border rounded-lg bg-muted/30">
                    <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase">Canal</p>
                        <select value={filtroCanal} onChange={(e) => setFiltroCanal(e.target.value)} className="text-xs bg-transparent border rounded-lg px-3 py-1.5">
                            <option value="todos">Todos</option>
                            {canaisPossiveis.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase">Score</p>
                        <div className="flex gap-1">
                            {["0-25", "26-50", "51-75", "76-100"].map((r) => (
                                <button key={r} onClick={() => setFiltroScoreRange(filtroScoreRange === r ? null : r)}
                                    className={`px-2 py-1 text-[10px] rounded border transition-colors ${filtroScoreRange === r ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
