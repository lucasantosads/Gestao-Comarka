"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Closer, Sdr, Contrato } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MonthSelector } from "@/components/month-selector";
import { KpiCard } from "@/components/kpi-card";
import { formatCurrency, getCurrentMonth } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

const ORIGENS = [
  "Tráfego Pago",
  "Orgânico",
  "Social Selling",
  "Indicação",
  "Workshop",
];

interface ContratoForm {
  cliente_nome: string;
  origem_lead: string;
  sdr_id: string;
  closer_id: string;
  valor_entrada: number;
  mrr: number;
  meses_contrato: number;
  data_fechamento: string;
  obs: string;
}

const emptyForm: ContratoForm = {
  cliente_nome: "",
  origem_lead: "",
  sdr_id: "",
  closer_id: "",
  valor_entrada: 0,
  mrr: 0,
  meses_contrato: 6,
  data_fechamento: new Date().toISOString().split("T")[0],
  obs: "",
};

export default function ContratosPage() {
  const [mes, setMes] = useState(getCurrentMonth);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [closers, setClosers] = useState<Closer[]>([]);
  const [sdrs, setSdrs] = useState<Sdr[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ContratoForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filtroOrigem, setFiltroOrigem] = useState("all");
  const [filtroCloser, setFiltroCloser] = useState("all");
  const [filtroSdr, setFiltroSdr] = useState("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: c }, { data: cl }, { data: s }] = await Promise.all([
      supabase
        .from("contratos")
        .select("*")
        .eq("mes_referencia", mes)
        .order("data_fechamento", { ascending: false }),
      supabase.from("closers").select("*").eq("ativo", true).order("nome"),
      supabase.from("sdrs").select("*").eq("ativo", true).order("nome"),
    ]);
    setContratos((c || []) as Contrato[]);
    setClosers((cl || []) as Closer[]);
    setSdrs((s || []) as Sdr[]);
    setLoading(false);
  }, [mes]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = contratos.filter((c) => {
    if (filtroOrigem !== "all" && c.origem_lead !== filtroOrigem) return false;
    if (filtroCloser !== "all" && c.closer_id !== filtroCloser) return false;
    if (filtroSdr !== "all" && c.sdr_id !== filtroSdr) return false;
    return true;
  });

  // Summary
  const totalContratos = filtered.length;
  const somaEntradas = filtered.reduce((s, c) => s + Number(c.valor_entrada), 0);
  const somaMrr = filtered.reduce((s, c) => s + Number(c.mrr), 0);
  const somaTotal = filtered.reduce((s, c) => s + Number(c.valor_total_projeto), 0);
  const ticketMedio = totalContratos > 0 ? somaMrr / totalContratos : 0;

  function openNew() {
    setForm(emptyForm);
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(c: Contrato) {
    setForm({
      cliente_nome: c.cliente_nome,
      origem_lead: c.origem_lead,
      sdr_id: c.sdr_id,
      closer_id: c.closer_id,
      valor_entrada: Number(c.valor_entrada),
      mrr: Number(c.mrr),
      meses_contrato: c.meses_contrato,
      data_fechamento: c.data_fechamento,
      obs: c.obs || "",
    });
    setEditingId(c.id);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.cliente_nome.trim()) {
      toast.error("Preencha o nome do cliente");
      return;
    }
    if (!form.origem_lead) {
      toast.error("Selecione a origem do lead");
      return;
    }
    if (!form.closer_id) {
      toast.error("Selecione o closer");
      return;
    }

    setSaving(true);
    const payload = {
      mes_referencia: mes,
      cliente_nome: form.cliente_nome.trim(),
      origem_lead: form.origem_lead,
      sdr_id: form.sdr_id || null,
      closer_id: form.closer_id,
      valor_entrada: form.valor_entrada,
      mrr: form.mrr,
      meses_contrato: form.meses_contrato,
      data_fechamento: form.data_fechamento,
      obs: form.obs || null,
    };

    if (editingId) {
      const { error } = await supabase
        .from("contratos")
        .update(payload)
        .eq("id", editingId);
      if (error) toast.error("Erro: " + error.message);
      else toast.success("Contrato atualizado!");
    } else {
      const { error } = await supabase.from("contratos").insert(payload);
      if (error) toast.error("Erro: " + error.message);
      else toast.success("Contrato cadastrado!");
    }

    setSaving(false);
    setModalOpen(false);
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este contrato?")) return;
    const { error } = await supabase.from("contratos").delete().eq("id", id);
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success("Contrato excluido!");
      loadData();
    }
  }

  const closerName = (id: string) => closers.find((c) => c.id === id)?.nome || "-";
  const sdrName = (id: string) => sdrs.find((s) => s.id === id)?.nome || "-";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Contratos</h1>
        <div className="flex items-center gap-3">
          <MonthSelector value={mes} onChange={setMes} />
          <Button onClick={openNew}>
            <Plus size={16} className="mr-2" />
            Novo Contrato
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard title="Contratos no Mes" value={String(totalContratos)} />
        <KpiCard title="Entradas (R$)" value={formatCurrency(somaEntradas)} />
        <KpiCard title="MRR Total" value={formatCurrency(somaMrr)} />
        <KpiCard title="Valor Total Projetos" value={formatCurrency(somaTotal)} />
        <KpiCard title="Ticket Medio" value={formatCurrency(ticketMedio)} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas origens</SelectItem>
            {ORIGENS.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroCloser} onValueChange={setFiltroCloser}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Closer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos closers</SelectItem>
            {closers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroSdr} onValueChange={setFiltroSdr}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="SDR" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos SDRs</SelectItem>
            {sdrs.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>SDR</TableHead>
              <TableHead>Closer</TableHead>
              <TableHead className="text-right">Entrada</TableHead>
              <TableHead className="text-right">MRR</TableHead>
              <TableHead className="text-right">Meses</TableHead>
              <TableHead className="text-right">Valor Total</TableHead>
              <TableHead>OBS</TableHead>
              <TableHead className="text-right">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  {new Date(c.data_fechamento + "T12:00:00").toLocaleDateString(
                    "pt-BR",
                    { day: "2-digit", month: "2-digit" }
                  )}
                </TableCell>
                <TableCell className="font-medium">{c.cliente_nome}</TableCell>
                <TableCell>{c.origem_lead}</TableCell>
                <TableCell>{sdrName(c.sdr_id)}</TableCell>
                <TableCell>{closerName(c.closer_id)}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(Number(c.valor_entrada))}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(Number(c.mrr))}
                </TableCell>
                <TableCell className="text-right">{c.meses_contrato}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(Number(c.valor_total_projeto))}
                </TableCell>
                <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">
                  {c.obs || "-"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(c)}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(c.id)}
                      className="text-destructive"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={11}
                  className="text-center text-muted-foreground py-8"
                >
                  Nenhum contrato neste mes
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Contrato" : "Novo Contrato"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data de Fechamento</Label>
              <Input
                type="date"
                value={form.data_fechamento}
                onChange={(e) =>
                  setForm({ ...form, data_fechamento: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Nome do Cliente</Label>
              <Input
                value={form.cliente_nome}
                onChange={(e) =>
                  setForm({ ...form, cliente_nome: e.target.value })
                }
                placeholder="Nome do cliente"
              />
            </div>
            <div className="space-y-2">
              <Label>Origem do Lead</Label>
              <Select
                value={form.origem_lead}
                onValueChange={(v) => setForm({ ...form, origem_lead: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a origem" />
                </SelectTrigger>
                <SelectContent>
                  {ORIGENS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SDR</Label>
                <Select
                  value={form.sdr_id}
                  onValueChange={(v) => setForm({ ...form, sdr_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {sdrs.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Closer</Label>
                <Select
                  value={form.closer_id}
                  onValueChange={(v) => setForm({ ...form, closer_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {closers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor de Entrada (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.valor_entrada}
                  onChange={(e) =>
                    setForm({ ...form, valor_entrada: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>MRR (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.mrr}
                  onChange={(e) =>
                    setForm({ ...form, mrr: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Meses de Contrato</Label>
              <Input
                type="number"
                min={1}
                value={form.meses_contrato}
                onChange={(e) =>
                  setForm({ ...form, meses_contrato: Number(e.target.value) })
                }
              />
            </div>
            <div className="p-3 bg-muted rounded-lg flex justify-between">
              <span className="text-sm text-muted-foreground">
                Valor Total do Projeto
              </span>
              <span className="font-bold">
                {formatCurrency(form.mrr * form.meses_contrato)}
              </span>
            </div>
            <div className="space-y-2">
              <Label>OBS</Label>
              <Textarea
                value={form.obs}
                onChange={(e) => setForm({ ...form, obs: e.target.value })}
                placeholder="Observacoes..."
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1"
              >
                {saving ? "Salvando..." : "Salvar"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
