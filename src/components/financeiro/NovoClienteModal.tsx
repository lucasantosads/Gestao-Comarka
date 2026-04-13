"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/currency-input";
import { toast } from "sonner";
import { X } from "lucide-react";

const PLATAFORMAS = ["META", "GOOGLE", "META_GOOGLE"];
const CLOSERS = ["Lucas", "Mariana", "Rogério"];
const TIPOS = ["mensal", "1M", "3M", "6M", "12M"];

type ValorMes = { mes: string; valor: number };

function gerarMesesSequencia(inicioISO: string, qtd: number): string[] {
  const out: string[] = [];
  const d = new Date(inicioISO);
  for (let i = 0; i < qtd; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() + i, 1);
    out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function NovoClienteModal({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const hoje = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ nome: "", plataforma: "META", valor_mensal: 0, closer: CLOSERS[0], tipo_contrato: "mensal", dia_pagamento: 10, obs: "", fidelidade_meses: 0, fidelidade_inicio: hoje });
  const [valoresCustom, setValoresCustom] = useState(false);
  const [qtdMeses, setQtdMeses] = useState(6);
  const [valoresPorMes, setValoresPorMes] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  // Meses a exibir quando "valores diferentes" estiver ligado
  const meses = useMemo(() => {
    const qtd = form.fidelidade_meses > 0 ? form.fidelidade_meses : qtdMeses;
    return gerarMesesSequencia(form.fidelidade_inicio || hoje, qtd);
  }, [form.fidelidade_meses, form.fidelidade_inicio, qtdMeses, hoje]);

  const salvar = async () => {
    if (!form.nome) { toast.error("Nome obrigatório"); return; }
    if (form.valor_mensal <= 0) { toast.error("Valor mensal obrigatório"); return; }
    if (valoresCustom) {
      const faltando = meses.filter((m) => !valoresPorMes[m] || valoresPorMes[m] <= 0);
      if (faltando.length > 0) {
        toast.error(`Informe os valores de todos os meses (${faltando.length} faltando)`);
        return;
      }
    }
    setSaving(true);
    const body: Record<string, unknown> = { ...form };
    if (valoresCustom) {
      body.valores_por_mes = meses.map<ValorMes>((m) => ({ mes: m, valor: valoresPorMes[m] }));
    }
    const res = await fetch("/api/financeiro/entradas/cliente", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.error) toast.error(data.error);
    else { toast.success(`${form.nome} cadastrado`); onSaved(); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card border rounded-xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Novo Cliente</h3>
          <button onClick={onClose}><X size={16} className="text-muted-foreground" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1"><Label className="text-xs">Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">Plataforma</Label><select value={form.plataforma} onChange={(e) => setForm({ ...form, plataforma: e.target.value })} className="w-full text-sm bg-transparent border rounded-lg px-3 py-2">{PLATAFORMAS.map((p) => <option key={p}>{p}</option>)}</select></div>
          <div className="space-y-1"><Label className="text-xs">Valor Mensal {valoresCustom && <span className="text-muted-foreground">(padrão)</span>}</Label><CurrencyInput value={form.valor_mensal} onChange={(v) => setForm({ ...form, valor_mensal: v })} /></div>
          <div className="space-y-1"><Label className="text-xs">Closer</Label><select value={form.closer} onChange={(e) => setForm({ ...form, closer: e.target.value })} className="w-full text-sm bg-transparent border rounded-lg px-3 py-2">{CLOSERS.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="space-y-1"><Label className="text-xs">Contrato</Label><select value={form.tipo_contrato} onChange={(e) => setForm({ ...form, tipo_contrato: e.target.value })} className="w-full text-sm bg-transparent border rounded-lg px-3 py-2">{TIPOS.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div className="space-y-1"><Label className="text-xs">Dia Pagamento</Label><Input type="number" min={1} max={30} value={form.dia_pagamento} onChange={(e) => setForm({ ...form, dia_pagamento: Number(e.target.value) })} /></div>
          <div className="space-y-1"><Label className="text-xs">Fidelidade (meses)</Label><Input type="number" min={0} value={form.fidelidade_meses} onChange={(e) => setForm({ ...form, fidelidade_meses: Number(e.target.value) })} placeholder="0 = sem fidelidade" /></div>
          {form.fidelidade_meses > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">Inicio da fidelidade</Label>
              <Input type="date" value={form.fidelidade_inicio} onChange={(e) => setForm({ ...form, fidelidade_inicio: e.target.value })} />
            </div>
          )}
          <div className="col-span-2 space-y-1"><Label className="text-xs">Obs</Label><Input value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} placeholder="Opcional" /></div>
        </div>

        {/* Valores diferentes por mês */}
        <div className="border-t pt-3 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={valoresCustom}
              onChange={(e) => setValoresCustom(e.target.checked)}
              className="accent-primary"
            />
            <span className="text-xs font-medium">Valores diferentes por mês</span>
            <span className="text-[10px] text-muted-foreground">(ex: desconto no 1° mês, escalada, etc)</span>
          </label>

          {valoresCustom && (
            <div className="space-y-2">
              {form.fidelidade_meses === 0 && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Quantidade de meses</Label>
                  <Input
                    type="number"
                    min={1}
                    max={36}
                    value={qtdMeses}
                    onChange={(e) => setQtdMeses(Math.max(1, Math.min(36, Number(e.target.value))))}
                    className="w-20"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {meses.map((m) => (
                  <div key={m} className="space-y-1">
                    <Label className="text-[10px] uppercase">{m}</Label>
                    <CurrencyInput
                      value={valoresPorMes[m] ?? form.valor_mensal}
                      onChange={(v) => setValoresPorMes((prev) => ({ ...prev, [m]: v }))}
                    />
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Cada valor vira um registro em <code>pagamentos_mensais</code> com status pendente. Meses fora da lista usarão o valor mensal padrão.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Cadastrar"}</Button>
        </div>
      </div>
    </div>
  );
}
