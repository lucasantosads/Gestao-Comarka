"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/currency-input";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";

const CATEGORIAS = [
  "Aluguel", "Energia", "Internet", "Telefone", "Limpeza",
  "Contador", "Ferramentas", "Ads Próprio", "Equipamento",
  "Audiovisual", "Comissões", "Folha Operacional",
  "Folha Comercial", "Folha MKT", "Prolabore",
  "Impostos", "Mentoria", "Terceirizado", "Outros",
];

export function LancarDespesaModal({ onSaved }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    data: new Date().toISOString().split("T")[0],
    descricao: "",
    categoria: CATEGORIAS[0],
    valor: 0,
    recorrente: false,
  });

  const salvar = async () => {
    if (form.valor <= 0) { toast.error("Informe o valor"); return; }
    setSaving(true);

    const mesRef = form.data.slice(0, 7) + "-01";
    const { error } = await supabase.from("custos_operacionais").insert({
      mes_referencia: mesRef,
      categoria: form.categoria,
      valor: form.valor,
      descricao: form.descricao || null,
      recorrente: form.recorrente,
    });

    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success("Despesa registrada");
      setForm({ data: new Date().toISOString().split("T")[0], descricao: "", categoria: CATEGORIAS[0], valor: 0, recorrente: false });
      setOpen(false);
      if (onSaved) onSaved();
    }
    setSaving(false);
  };

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus size={14} className="mr-1" /> Lancar Despesa
      </Button>
    );
  }

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Nova Despesa</p>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Data</Label>
          <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Categoria</Label>
          <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            className="w-full text-sm bg-transparent border rounded-lg px-3 py-2">
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Valor</Label>
          <CurrencyInput value={form.valor} onChange={(v) => setForm({ ...form, valor: v })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Descricao</Label>
          <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Opcional" />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={form.recorrente} onChange={(e) => setForm({ ...form, recorrente: e.target.checked })} className="rounded" />
          Recorrente (mensal)
        </label>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button size="sm" onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </div>
  );
}
