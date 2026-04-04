"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Recebimento } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonthSelector } from "@/components/month-selector";
import { KpiCard } from "@/components/kpi-card";
import { formatCurrency, getCurrentMonth } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Check } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function RecebimentosPage() {
  const [mes, setMes] = useState(getCurrentMonth);
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [receberModal, setReceberModal] = useState<string | null>(null);
  const [dataRecebida, setDataRecebida] = useState(() => new Date().toISOString().split("T")[0]);
  const [form, setForm] = useState({ cliente_nome: "", data_prevista: new Date().toISOString().split("T")[0], valor: 0, tipo: "entrada" as string, obs: "" });

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("recebimentos").select("*").eq("mes_referencia", mes).order("data_prevista");
    const hoje = new Date();
    const items = (data || []).map((r: Recebimento) => {
      if (r.status === "pendente" && !r.data_recebida) {
        const prev = new Date(r.data_prevista + "T12:00:00");
        const diff = Math.floor((hoje.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        if (diff > 3) return { ...r, status: "atrasado" as const };
      }
      return r;
    });
    setRecebimentos(items);
    setLoading(false);
  }, [mes]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalPrevisto = recebimentos.reduce((s, r) => s + Number(r.valor), 0);
  const totalRecebido = recebimentos.filter((r) => r.status === "recebido").reduce((s, r) => s + Number(r.valor), 0);
  const totalPendente = recebimentos.filter((r) => r.status === "pendente").reduce((s, r) => s + Number(r.valor), 0);
  const totalAtrasado = recebimentos.filter((r) => r.status === "atrasado").reduce((s, r) => s + Number(r.valor), 0);

  // Group by week
  const weeks: { label: string; start: number; end: number; items: Recebimento[]; total: number }[] = [];
  const [year, month] = mes.split("-").map(Number);
  for (let w = 0; w < 5; w++) {
    const start = w * 7 + 1;
    const end = Math.min((w + 1) * 7, new Date(year, month, 0).getDate());
    if (start > new Date(year, month, 0).getDate()) break;
    const items = recebimentos.filter((r) => {
      const day = new Date(r.data_prevista + "T12:00:00").getDate();
      return day >= start && day <= end;
    });
    weeks.push({
      label: `Semana ${w + 1} (${String(start).padStart(2, "0")}/${String(month).padStart(2, "0")} - ${String(end).padStart(2, "0")}/${String(month).padStart(2, "0")})`,
      start, end, items,
      total: items.reduce((s, r) => s + Number(r.valor), 0),
    });
  }

  const chartData = weeks.map((w) => ({
    semana: `S${weeks.indexOf(w) + 1}`,
    previsto: w.items.reduce((s, r) => s + Number(r.valor), 0),
    recebido: w.items.filter((r) => r.status === "recebido").reduce((s, r) => s + Number(r.valor), 0),
  }));

  async function marcarRecebido() {
    if (!receberModal) return;
    await supabase.from("recebimentos").update({ status: "recebido", data_recebida: dataRecebida }).eq("id", receberModal);
    toast.success("Recebimento confirmado!");
    setReceberModal(null);
    loadData();
  }

  async function salvarNovo() {
    if (!form.cliente_nome.trim() || form.valor <= 0) { toast.error("Preencha todos os campos"); return; }
    await supabase.from("recebimentos").insert({ ...form, mes_referencia: mes, status: "pendente", obs: form.obs || null });
    toast.success("Recebimento registrado!");
    setModalOpen(false);
    setForm({ cliente_nome: "", data_prevista: new Date().toISOString().split("T")[0], valor: 0, tipo: "entrada", obs: "" });
    loadData();
  }

  const statusBadge = (s: string) => {
    if (s === "recebido") return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Recebido</Badge>;
    if (s === "atrasado") return <Badge className="bg-red-500/20 text-red-500 border-red-500/30">Atrasado</Badge>;
    return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Pendente</Badge>;
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Recebimentos</h1>
        <div className="flex items-center gap-3">
          <MonthSelector value={mes} onChange={setMes} />
          <Button onClick={() => setModalOpen(true)}><Plus size={16} className="mr-1" />Registrar</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="Total Previsto" value={formatCurrency(totalPrevisto)} />
        <KpiCard title="Recebido" value={formatCurrency(totalRecebido)} />
        <KpiCard title="Pendente" value={formatCurrency(totalPendente)} />
        <KpiCard title="Atrasado" value={formatCurrency(totalAtrasado)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Previsto vs Recebido por Semana</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="semana" />
              <YAxis />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Legend />
              <Bar dataKey="previsto" fill="#f59e0b" name="Previsto" />
              <Bar dataKey="recebido" fill="#22c55e" name="Recebido" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {weeks.map((w) => (
        <Card key={w.label}>
          <CardHeader><CardTitle className="text-sm">{w.label} — {formatCurrency(w.total)}</CardTitle></CardHeader>
          {w.items.length > 0 && (
            <CardContent>
              <div className="space-y-2">
                {w.items.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">{new Date(r.data_prevista + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                      <span className="font-medium">{r.cliente_nome}</span>
                      <span className="font-bold">{formatCurrency(Number(r.valor))}</span>
                      {statusBadge(r.status)}
                    </div>
                    {r.status !== "recebido" && (
                      <Button size="sm" variant="outline" onClick={() => { setReceberModal(r.id); setDataRecebida(new Date().toISOString().split("T")[0]); }}>
                        <Check size={14} className="mr-1" />Recebido
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      ))}

      {/* Modal confirmar recebimento */}
      <Dialog open={!!receberModal} onOpenChange={() => setReceberModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Confirmar Recebimento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Data recebida</Label><Input type="date" value={dataRecebida} onChange={(e) => setDataRecebida(e.target.value)} /></div>
            <div className="flex gap-3"><Button onClick={marcarRecebido} className="flex-1">Confirmar</Button><Button variant="outline" onClick={() => setReceberModal(null)} className="flex-1">Cancelar</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal novo recebimento */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo Recebimento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Cliente</Label><Input value={form.cliente_nome} onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })} /></div>
            <div className="space-y-1"><Label>Data prevista</Label><Input type="date" value={form.data_prevista} onChange={(e) => setForm({ ...form, data_prevista: e.target.value })} /></div>
            <div className="space-y-1"><Label>Valor (R$)</Label><Input type="number" min={0} step={0.01} value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} /></div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="entrada">Entrada</SelectItem><SelectItem value="mensalidade">Mensalidade</SelectItem><SelectItem value="parcela">Parcela</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>OBS</Label><Input value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} /></div>
            <div className="flex gap-3"><Button onClick={salvarNovo} className="flex-1">Salvar</Button><Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1">Cancelar</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
