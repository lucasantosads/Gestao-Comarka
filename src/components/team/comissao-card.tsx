"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { DollarSign, TrendingUp, Pencil, Save, X } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface ComissaoData {
  member: { notion_id: string; nome: string; cargo: "closer" | "sdr" | "social_seller" };
  mes: string;
  resultado: {
    cargo: string;
    meta: number;
    realizado: number;
    pctAtingido: number;
    comissao: number;
    faixaAtualLabel: string;
    proximaFaixa: { label: string; min: number; faltaParaAtingir: number } | null;
    detalhe: string;
  } | null;
  config: {
    meta_reunioes_mes: number | null;
    meta_vendas_mes: number | null;
    ote_base: number | null;
    mes_referencia: string;
  } | null;
  historico: Array<{ mes: string; comissao: number; meta: number; realizado: number; pctAtingido: number }>;
  permissions: { canView: boolean; canEditConfig: boolean };
}

function corPct(p: number): string {
  if (p >= 80) return "text-green-400";
  if (p >= 50) return "text-yellow-400";
  return "text-red-400";
}
function bgPct(p: number): string {
  if (p >= 80) return "bg-green-500";
  if (p >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function mesAtualISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function labelMes(m: string): string {
  const [a, mm] = m.split("-");
  return `${mm}/${a.slice(2)}`;
}

export function ComissaoCard({ notionId }: { notionId: string }) {
  const [mes, setMes] = useState(mesAtualISO());
  const [data, setData] = useState<ComissaoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ meta_reunioes: string; meta_vendas: string; ote_base: string }>({
    meta_reunioes: "",
    meta_vendas: "",
    ote_base: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/team/comissao?notion_id=${encodeURIComponent(notionId)}&mes=${mes}`);
    const d = await res.json();
    if (d.error) { setData(null); setLoading(false); return; }
    setData(d);
    setDraft({
      meta_reunioes: d.config?.meta_reunioes_mes ? String(d.config.meta_reunioes_mes) : "",
      meta_vendas: d.config?.meta_vendas_mes ? String(d.config.meta_vendas_mes) : "",
      ote_base: d.config?.ote_base ? String(d.config.ote_base) : "",
    });
    setLoading(false);
  }, [notionId, mes]);

  useEffect(() => { load(); }, [load]);

  const salvarConfig = async () => {
    if (!data) return;
    setSaving(true);
    const res = await fetch("/api/team/comissao", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notion_id: notionId,
        mes,
        cargo: data.member.cargo,
        meta_reunioes_mes: draft.meta_reunioes ? Number(draft.meta_reunioes) : null,
        meta_vendas_mes: draft.meta_vendas ? Number(draft.meta_vendas) : null,
        ote_base: draft.ote_base ? Number(draft.ote_base) : null,
      }),
    });
    const j = await res.json();
    setSaving(false);
    if (j.success) { toast.success("Meta atualizada"); setEditing(false); load(); }
    else toast.error(j.error || "Erro ao salvar");
  };

  if (loading) {
    return (
      <Card><CardContent className="py-6 text-center text-xs text-muted-foreground">Carregando comissão…</CardContent></Card>
    );
  }
  if (!data || !data.permissions.canView) return null;
  if (!data.resultado) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign size={14} /> Comissão do Mês</CardTitle></CardHeader>
        <CardContent className="text-xs text-muted-foreground">Cargo sem regra de comissão configurada (closer/sdr/social_seller).</CardContent>
      </Card>
    );
  }

  const r = data.resultado;
  const pctClamp = Math.min(r.pctAtingido, 100);
  const isCloser = data.member.cargo === "closer";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign size={14} className="text-green-400" /> Comissão do Mês
            <span className="text-[10px] text-muted-foreground font-normal">— {data.member.cargo === "closer" ? "Closer" : data.member.cargo === "sdr" ? "SDR" : "Social Seller"}</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="text-xs h-7 w-[130px]" />
            {data.permissions.canEditConfig && !editing && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil size={11} className="mr-1" />Configurar</Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Form admin */}
        {editing && data.permissions.canEditConfig && (
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 space-y-2">
            <p className="text-[10px] uppercase text-blue-300">Configuração de meta — {labelMes(mes)}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {(data.member.cargo === "sdr" || data.member.cargo === "social_seller") && (
                <div>
                  <label className="text-[10px] text-muted-foreground">Meta de reuniões/mês</label>
                  <Input type="number" value={draft.meta_reunioes} onChange={(e) => setDraft({ ...draft, meta_reunioes: e.target.value })} className="text-xs h-8 mt-0.5 font-mono" />
                </div>
              )}
              {isCloser && (
                <div>
                  <label className="text-[10px] text-muted-foreground">Meta de vendas (R$)</label>
                  <Input type="number" value={draft.meta_vendas} onChange={(e) => setDraft({ ...draft, meta_vendas: e.target.value })} className="text-xs h-8 mt-0.5 font-mono" />
                </div>
              )}
              <div>
                <label className="text-[10px] text-muted-foreground">OTE base</label>
                <Input type="number" value={draft.ote_base} onChange={(e) => setDraft({ ...draft, ote_base: e.target.value })} className="text-xs h-8 mt-0.5 font-mono" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X size={11} className="mr-1" />Cancelar</Button>
              <Button size="sm" onClick={salvarConfig} disabled={saving}><Save size={11} className="mr-1" />{saving ? "..." : "Salvar"}</Button>
            </div>
          </div>
        )}

        {/* KPI principal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 rounded-lg border p-3 space-y-2">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Meta vs Realizado</p>
                <p className="text-sm mt-0.5">
                  <span className="font-mono font-bold">{isCloser ? formatCurrency(r.realizado) : r.realizado}</span>
                  <span className="text-muted-foreground"> / {isCloser ? formatCurrency(r.meta) : r.meta}</span>
                </p>
              </div>
              <p className={`text-2xl font-bold tabular-nums ${corPct(r.pctAtingido)}`}>{r.pctAtingido.toFixed(0)}%</p>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className={`h-full ${bgPct(r.pctAtingido)} transition-all`} style={{ width: `${pctClamp}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Faixa atual: <strong className={corPct(r.pctAtingido)}>{r.faixaAtualLabel}</strong></span>
              {r.proximaFaixa && (
                <span>
                  Próxima: <strong>{r.proximaFaixa.label}</strong>
                  {" — "}
                  faltam{" "}
                  <strong className="text-foreground">
                    {isCloser ? formatCurrency(r.proximaFaixa.faltaParaAtingir) : `${r.proximaFaixa.faltaParaAtingir} reuniões`}
                  </strong>
                </span>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 flex flex-col justify-center">
            <p className="text-[10px] uppercase text-green-300">Comissão calculada</p>
            <p className="text-3xl font-bold text-green-400 font-mono tabular-nums mt-1">{formatCurrency(r.comissao)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{r.detalhe}</p>
            {data.config?.ote_base != null && (
              <p className="text-[10px] text-muted-foreground mt-1">OTE base: {formatCurrency(Number(data.config.ote_base))}</p>
            )}
          </div>
        </div>

        {/* Histórico 6 meses */}
        <div>
          <p className="text-[10px] uppercase text-muted-foreground mb-1.5 flex items-center gap-1"><TrendingUp size={11} /> Histórico (6 meses)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b text-[10px] uppercase text-muted-foreground">
                  <th className="text-left py-1.5 px-2">Mês</th>
                  <th className="text-right py-1.5 px-2">Realizado</th>
                  <th className="text-right py-1.5 px-2">Meta</th>
                  <th className="text-right py-1.5 px-2">% Atingido</th>
                  <th className="text-right py-1.5 px-2">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {data.historico.map((h) => (
                  <tr key={h.mes} className="border-b border-border/30">
                    <td className="py-1.5 px-2 font-mono">{labelMes(h.mes)}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{isCloser ? formatCurrency(h.realizado) : h.realizado}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-muted-foreground">{isCloser ? formatCurrency(h.meta) : h.meta}</td>
                    <td className={`py-1.5 px-2 text-right font-mono ${corPct(h.pctAtingido)}`}>{h.pctAtingido.toFixed(0)}%</td>
                    <td className="py-1.5 px-2 text-right font-mono text-green-400">{formatCurrency(h.comissao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
