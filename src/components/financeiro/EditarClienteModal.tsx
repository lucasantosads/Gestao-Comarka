"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/currency-input";
import { toast } from "sonner";
import { X } from "lucide-react";

const PLATAFORMAS = ["META", "GOOGLE", "META_GOOGLE"];
const CLOSERS = ["Lucas", "Mariana", "Rogério"];
const TIPOS = ["mensal", "1M", "3M", "6M", "12M"];
const STATUS = ["ativo", "pausado", "churned"];

interface Cliente {
  id: string; nome: string; plataforma: string; valor_mensal: number;
  closer: string; tipo_contrato: string; dia_pagamento: number | null;
  status: string; status_financeiro?: string; obs: string | null;
  valor_integral?: number; forma_pagamento?: string; parcelas_integral?: number;
  fidelidade_meses?: number | null; fidelidade_inicio?: string | null; fidelidade_fim?: string | null;
}

export function EditarClienteModal({ cliente, onSaved, onClose }: { cliente: Cliente; onSaved: () => void; onClose: () => void }) {
  const sf = cliente.status_financeiro || (cliente.status === "churned" ? "churned" : "ativo");
  const [form, setForm] = useState({
    plataforma: cliente.plataforma, valor_mensal: cliente.valor_mensal,
    closer: cliente.closer, tipo_contrato: cliente.tipo_contrato,
    dia_pagamento: cliente.dia_pagamento || 10, status: cliente.status,
    obs: cliente.obs || "",
    valor_integral: cliente.valor_integral || 0,
    forma_pagamento: cliente.forma_pagamento || "",
    parcelas_integral: cliente.parcelas_integral || 0,
    fidelidade_meses: cliente.fidelidade_meses || 0,
    fidelidade_inicio: cliente.fidelidade_inicio || "",
  });
  const [saving, setSaving] = useState(false);

  const salvar = async () => {
    setSaving(true);
    // Normaliza payload: empty string em datas vira null; status sempre
    // espelhado em status_financeiro (fonte canônica do resto do app).
    const payload: Record<string, unknown> = {
      ...form,
      fidelidade_inicio: form.fidelidade_inicio || null,
      fidelidade_meses: Number(form.fidelidade_meses) || 0,
      status_financeiro: form.status,
    };
    const res = await fetch(`/api/financeiro/entradas/cliente/${cliente.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.error) toast.error(data.error);
    else { toast.success(`${cliente.nome} atualizado`); onSaved(); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border rounded-xl shadow-2xl p-6 w-full max-w-lg space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Editar — {cliente.nome}</h3>
          <button onClick={onClose}><X size={16} className="text-muted-foreground" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label className="text-xs">Plataforma</Label><select value={form.plataforma} onChange={(e) => setForm({ ...form, plataforma: e.target.value })} className="w-full text-sm bg-transparent border rounded-lg px-3 py-2">{PLATAFORMAS.map((p) => <option key={p}>{p}</option>)}</select></div>
          <div className="space-y-1"><Label className="text-xs">Valor Mensal</Label><CurrencyInput value={form.valor_mensal} onChange={(v) => setForm({ ...form, valor_mensal: v })} /></div>
          <div className="space-y-1"><Label className="text-xs">Closer</Label><select value={form.closer} onChange={(e) => setForm({ ...form, closer: e.target.value })} className="w-full text-sm bg-transparent border rounded-lg px-3 py-2">{CLOSERS.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="space-y-1"><Label className="text-xs">Contrato</Label><select value={form.tipo_contrato} onChange={(e) => setForm({ ...form, tipo_contrato: e.target.value })} className="w-full text-sm bg-transparent border rounded-lg px-3 py-2">{TIPOS.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div className="space-y-1"><Label className="text-xs">Dia Pagamento</Label><Input type="number" min={1} max={30} value={form.dia_pagamento} onChange={(e) => setForm({ ...form, dia_pagamento: Number(e.target.value) })} /></div>
          <div className="space-y-1"><Label className="text-xs">Status</Label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full text-sm bg-transparent border rounded-lg px-3 py-2">{STATUS.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div className="col-span-2 space-y-1"><Label className="text-xs">Obs</Label><Input value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} /></div>
        </div>

        {/* Fidelidade */}
        <div className="border-t pt-3">
          <p className="text-xs font-medium mb-2">Fidelidade</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">Meses</Label><Input type="number" min={0} value={form.fidelidade_meses} onChange={(e) => setForm({ ...form, fidelidade_meses: Number(e.target.value) })} placeholder="0 = sem" /></div>
            <div className="space-y-1"><Label className="text-xs">Inicio</Label><Input type="date" value={form.fidelidade_inicio} onChange={(e) => setForm({ ...form, fidelidade_inicio: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Fim (auto)</Label>
              <p className="text-sm font-mono px-3 py-2 border rounded-lg bg-muted/50">
                {form.fidelidade_meses > 0 && form.fidelidade_inicio
                  ? (() => { const d = new Date(form.fidelidade_inicio); d.setMonth(d.getMonth() + form.fidelidade_meses); return d.toLocaleDateString("pt-BR"); })()
                  : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Campos de pagamento integral */}
        {sf === "pagou_integral" && (
          <div className="border-t pt-3">
            <p className="text-xs font-medium mb-2 text-blue-400">Pagamento Integral</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="text-xs">Valor Total</Label><CurrencyInput value={form.valor_integral} onChange={(v) => setForm({ ...form, valor_integral: v })} /></div>
              <div className="space-y-1"><Label className="text-xs">Forma</Label>
                <select value={form.forma_pagamento} onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })} className="w-full text-sm bg-transparent border rounded-lg px-3 py-2">
                  <option value="">Selecione</option><option value="PIX">PIX</option><option value="Cartão">Cartão</option><option value="Boleto">Boleto</option><option value="Transferência">Transferência</option>
                </select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Parcelas</Label><Input type="number" min={0} value={form.parcelas_integral} onChange={(e) => setForm({ ...form, parcelas_integral: Number(e.target.value) })} placeholder="0 = à vista" /></div>
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </div>
  );
}
