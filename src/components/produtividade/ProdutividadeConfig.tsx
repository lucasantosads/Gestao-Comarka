"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Clock, Plus, Trash2, Save } from "lucide-react";

interface Employee { id: string; nome: string; meta_horas_semanais: number; alerta_inatividade_horas: number; ativo: boolean }
interface TipoTarefa { id: string; nome: string; cor: string; deleted_at: string | null; created_at: string }

export function ProdutividadeConfig() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tipos, setTipos] = useState<TipoTarefa[]>([]);
  const [metaPadrao, setMetaPadrao] = useState(40);
  const [thresholdPadrao, setThresholdPadrao] = useState(2);
  const [novoTipo, setNovoTipo] = useState("");
  const [novoTipoCor, setNovoTipoCor] = useState("#6366f1");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/produtividade/config");
    const data = await res.json();
    if (data.employees) setEmployees(data.employees);
    if (data.tipos) setTipos(data.tipos);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const api = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/produtividade/config", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const updateMeta = async (empId: string, field: string, value: number) => {
    setEmployees((prev) => prev.map((e) => e.id === empId ? { ...e, [field]: value } : e));
    const data = await api({ action: "update_meta", employee_id: empId, [field]: value });
    if (data.error) toast.error(data.error);
  };

  const aplicarMetaTodos = async () => {
    const data = await api({ action: "apply_all", meta_horas_semanais: metaPadrao });
    if (data.error) toast.error(data.error);
    else { toast.success(`Meta ${metaPadrao}h/semana aplicada a todos`); load(); }
  };

  const aplicarThresholdTodos = async () => {
    const data = await api({ action: "apply_threshold_all", alerta_inatividade_horas: thresholdPadrao });
    if (data.error) toast.error(data.error);
    else { toast.success(`Threshold ${thresholdPadrao}h aplicado a todos`); load(); }
  };

  const addTipo = async () => {
    if (!novoTipo.trim()) { toast.error("Nome obrigatório"); return; }
    const data = await api({ action: "add_tipo", nome: novoTipo.trim(), cor: novoTipoCor });
    if (data.error) toast.error(data.error);
    else { toast.success("Tipo adicionado"); setNovoTipo(""); load(); }
  };

  const editTipoCor = async (id: string, cor: string) => {
    setTipos((prev) => prev.map((t) => t.id === id ? { ...t, cor } : t));
    const data = await api({ action: "edit_tipo", id, cor });
    if (data.error) toast.error(data.error);
  };

  const deleteTipo = async (id: string) => {
    if (!confirm("Remover este tipo?")) return;
    const data = await api({ action: "delete_tipo", id });
    if (data.error) toast.error(data.error);
    else { toast.success("Tipo removido"); load(); }
  };

  if (loading) return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Carregando...</CardContent></Card>;

  return (
    <Card className="shadow-sm border border-border/40">
      <CardHeader className="bg-muted/10 border-b border-border/30 pb-4">
        <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
          <Clock size={14} /> Produtividade
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-6 pt-4">
        {/* Meta padrão */}
        <div className="space-y-3">
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Meta de horas semanal</p>
          <div className="flex items-center gap-2">
            <Input type="number" min={1} max={80} value={metaPadrao} onChange={(e) => setMetaPadrao(Number(e.target.value))} className="w-20 text-sm" />
            <span className="text-xs text-muted-foreground">h/semana</span>
            <Button size="sm" variant="outline" onClick={aplicarMetaTodos} className="text-[10px] h-7 ml-auto">
              <Save size={10} className="mr-1" />Aplicar a todos
            </Button>
          </div>
        </div>

        {/* Threshold inatividade */}
        <div className="space-y-3">
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Threshold de inatividade</p>
          <div className="flex items-center gap-2">
            <Input type="number" min={1} max={24} value={thresholdPadrao} onChange={(e) => setThresholdPadrao(Number(e.target.value))} className="w-20 text-sm" />
            <span className="text-xs text-muted-foreground">horas</span>
            <Button size="sm" variant="outline" onClick={aplicarThresholdTodos} className="text-[10px] h-7 ml-auto">
              <Save size={10} className="mr-1" />Aplicar a todos
            </Button>
          </div>
        </div>

        {/* Metas individuais */}
        <div className="space-y-3">
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Metas individuais</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {employees.map((emp) => (
              <div key={emp.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background/50 border border-border/30 text-xs">
                <span className="font-medium truncate flex-1">{emp.nome}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input type="number" min={1} max={80} value={emp.meta_horas_semanais}
                    onChange={(e) => updateMeta(emp.id, "meta_horas_semanais", Number(e.target.value))}
                    className="w-14 text-xs bg-transparent border rounded px-1.5 py-0.5 text-right font-mono" />
                  <span className="text-[9px] text-muted-foreground">h/sem</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tipos de tarefa */}
        <div className="space-y-3">
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Tipos de tarefa</p>
          <div className="space-y-1.5">
            {tipos.map((t) => (
              <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-background/50 border border-border/30 text-xs">
                <input type="color" value={t.cor} onChange={(e) => editTipoCor(t.id, e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer border-0 p-0" />
                <span className="font-medium flex-1">{t.nome}</span>
                <button onClick={() => deleteTipo(t.id)} className="text-muted-foreground hover:text-red-400">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="color" value={novoTipoCor} onChange={(e) => setNovoTipoCor(e.target.value)}
              className="w-6 h-6 rounded cursor-pointer border-0 p-0" />
            <Input value={novoTipo} onChange={(e) => setNovoTipo(e.target.value)} placeholder="Novo tipo..."
              className="text-xs flex-1" onKeyDown={(e) => e.key === "Enter" && addTipo()} />
            <Button size="sm" variant="outline" onClick={addTipo} className="h-7">
              <Plus size={12} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
