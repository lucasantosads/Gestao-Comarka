"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle, RefreshCw, Trash2 } from "lucide-react";

interface ErrorLog {
  id: string;
  workflow_name: string;
  workflow_id: string | null;
  error_message: string;
  node_name: string | null;
  execution_id: string | null;
  resolved: boolean;
  created_at: string;
}

export default function ErrosPage() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"todos" | "pendentes" | "resolvidos">("pendentes");

  useEffect(() => { loadErrors(); }, []);

  async function loadErrors() {
    setLoading(true);
    const { data } = await supabase
      .from("n8n_error_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setErrors((data || []) as ErrorLog[]);
    setLoading(false);
  }

  async function markResolved(id: string) {
    await supabase.from("n8n_error_log").update({ resolved: true }).eq("id", id);
    setErrors((prev) => prev.map((e) => e.id === id ? { ...e, resolved: true } : e));
    toast.success("Marcado como resolvido");
  }

  async function markAllResolved() {
    const pending = filtered.filter((e) => !e.resolved).map((e) => e.id);
    if (pending.length === 0) return;
    for (const id of pending) {
      await supabase.from("n8n_error_log").update({ resolved: true }).eq("id", id);
    }
    setErrors((prev) => prev.map((e) => pending.includes(e.id) ? { ...e, resolved: true } : e));
    toast.success(`${pending.length} erros marcados como resolvidos`);
  }

  async function deleteResolved() {
    const resolved = errors.filter((e) => e.resolved).map((e) => e.id);
    if (resolved.length === 0) return;
    for (const id of resolved) {
      await supabase.from("n8n_error_log").delete().eq("id", id);
    }
    setErrors((prev) => prev.filter((e) => !e.resolved));
    toast.success(`${resolved.length} erros removidos`);
  }

  const filtered = filter === "todos" ? errors
    : filter === "pendentes" ? errors.filter((e) => !e.resolved)
    : errors.filter((e) => e.resolved);

  const pendingCount = errors.filter((e) => !e.resolved).length;

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function timeAgo(iso: string) {
    const mins = (Date.now() - new Date(iso).getTime()) / 60000;
    if (mins < 60) return `${Math.round(mins)}min atrás`;
    if (mins < 1440) return `${Math.round(mins / 60)}h atrás`;
    return `${Math.round(mins / 1440)}d atrás`;
  }

  // Group by workflow
  const grouped = new Map<string, ErrorLog[]>();
  filtered.forEach((e) => {
    const arr = grouped.get(e.workflow_name) || [];
    arr.push(e);
    grouped.set(e.workflow_name, arr);
  });

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Erros n8n</h1>
          <p className="text-sm text-muted-foreground">
            {pendingCount > 0 ? `${pendingCount} erro${pendingCount > 1 ? "s" : ""} pendente${pendingCount > 1 ? "s" : ""}` : "Nenhum erro pendente"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadErrors}><RefreshCw size={14} /></Button>
          {pendingCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllResolved} className="text-xs">
              <CheckCircle size={14} className="mr-1" /> Resolver todos
            </Button>
          )}
          {errors.some((e) => e.resolved) && (
            <Button variant="ghost" size="sm" onClick={deleteResolved} className="text-xs text-red-400">
              <Trash2 size={14} className="mr-1" /> Limpar resolvidos
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex bg-muted rounded-lg p-0.5 w-fit">
        {(["pendentes", "todos", "resolvidos"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {f === "pendentes" ? `Pendentes (${pendingCount})` : f === "todos" ? `Todos (${errors.length})` : `Resolvidos (${errors.filter((e) => e.resolved).length})`}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <CheckCircle size={40} className="text-green-500" />
            <p className="text-sm text-muted-foreground">
              {filter === "pendentes" ? "Nenhum erro pendente" : "Nenhum erro encontrado"}
            </p>
          </CardContent>
        </Card>
      ) : (
        Array.from(grouped.entries()).map(([workflow, errs]) => (
          <Card key={workflow}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle size={14} className={errs.some((e) => !e.resolved) ? "text-red-400" : "text-muted-foreground"} />
                  {workflow}
                </CardTitle>
                <Badge variant="outline" className="text-[9px]">
                  {errs.length} erro{errs.length > 1 ? "s" : ""}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {errs.map((e) => (
                <div key={e.id} className={`p-3 rounded-lg border text-sm ${e.resolved ? "opacity-50 bg-muted/20" : "bg-red-500/5 border-red-500/20"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-red-400 break-all">{e.error_message}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                        {e.node_name && <span>Node: <strong>{e.node_name}</strong></span>}
                        <span>{formatDate(e.created_at)}</span>
                        <span>{timeAgo(e.created_at)}</span>
                        {e.execution_id && <span className="font-mono">{e.execution_id.slice(0, 8)}</span>}
                      </div>
                    </div>
                    {!e.resolved && (
                      <Button variant="ghost" size="sm" onClick={() => markResolved(e.id)} className="shrink-0 text-xs h-7 px-2">
                        <CheckCircle size={12} className="mr-1" /> Resolver
                      </Button>
                    )}
                    {e.resolved && <Badge className="bg-green-500/10 text-green-400 text-[9px]">Resolvido</Badge>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
