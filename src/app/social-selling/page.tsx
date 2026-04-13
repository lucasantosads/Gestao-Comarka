"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Closer } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MonthSelector } from "@/components/month-selector";
import { KpiCard } from "@/components/kpi-card";
import { formatPercent, formatCurrency, formatNumber, getCurrentMonth } from "@/lib/format";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { CurrencyInput } from "@/components/currency-input";

interface SSLanc { id: string; social_seller_id: string; data: string; mes_referencia: string; perfis_prospectados: number; conexoes_enviadas: number; conexoes_aceitas: number; conversas_iniciadas: number; reunioes_agendadas: number; vendas: number; mrr_dia: number; obs: string | null; }
interface SSMeta { id: string; social_seller_id: string; mes_referencia: string; meta_reunioes_agendadas: number; meta_vendas: number; meta_conexoes: number; }

export default function SocialSellingPage() {
  const [mes, setMes] = useState(getCurrentMonth);
  const [closers, setClosers] = useState<Closer[]>([]);
  const [sellerId, setSellerId] = useState("");
  const [lancamentos, setLancamentos] = useState<SSLanc[]>([]);
  const [meta, setMeta] = useState<SSMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ data: new Date().toISOString().split("T")[0], perfis_prospectados: 0, conexoes_enviadas: 0, conexoes_aceitas: 0, conversas_iniciadas: 0, reunioes_agendadas: 0, vendas: 0, mrr_dia: 0, obs: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("closers").select("*").eq("ativo", true).order("nome").then(({ data }) => {
      const list = (data || []) as Closer[];
      setClosers(list);
      if (list.length > 0 && !sellerId) setSellerId(list[0].id);
    });
  }, []);

  const loadData = useCallback(async () => {
    if (!sellerId) return;
    setLoading(true);
    const [{ data: l }, { data: m }] = await Promise.all([
      supabase.from("lancamentos_social_selling").select("*").eq("social_seller_id", sellerId).eq("mes_referencia", mes).order("data", { ascending: false }),
      supabase.from("metas_social_selling").select("*").eq("social_seller_id", sellerId).eq("mes_referencia", mes).single(),
    ]);
    setLancamentos((l || []) as SSLanc[]);
    setMeta((m as SSMeta) || null);
    setLoading(false);
  }, [sellerId, mes]);

  useEffect(() => { loadData(); }, [loadData]);

  const t = lancamentos.reduce((a, l) => ({
    perfis: a.perfis + l.perfis_prospectados, enviadas: a.enviadas + l.conexoes_enviadas,
    aceitas: a.aceitas + l.conexoes_aceitas, conversas: a.conversas + l.conversas_iniciadas,
    reunioes: a.reunioes + l.reunioes_agendadas, vendas: a.vendas + l.vendas, mrr: a.mrr + Number(l.mrr_dia),
  }), { perfis: 0, enviadas: 0, aceitas: 0, conversas: 0, reunioes: 0, vendas: 0, mrr: 0 });

  const safe = (n: number, d: number) => d > 0 ? n / d : 0;
  const taxaAceite = safe(t.aceitas, t.enviadas) * 100;

  const funnelData = [
    { etapa: "Perfis", valor: t.perfis }, { etapa: "Enviadas", valor: t.enviadas },
    { etapa: "Aceitas", valor: t.aceitas }, { etapa: "Conversas", valor: t.conversas },
    { etapa: "Reuniões", valor: t.reunioes }, { etapa: "Vendas", valor: t.vendas },
  ];

  async function salvarLanc() {
    setSaving(true);
    const { error } = await supabase.from("lancamentos_social_selling").insert({ ...form, social_seller_id: sellerId, mes_referencia: mes, obs: form.obs || null });
    if (error) { if (error.message.includes("duplicate")) toast.error("Ja existe lancamento para esta data"); else toast.error("Erro: " + error.message); }
    else { toast.success("Lançamento salvo!"); setModalOpen(false); loadData(); }
    setSaving(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Social Selling</h1>
        <div className="flex items-center gap-3">
          <Select value={sellerId} onValueChange={setSellerId}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent>{closers.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select>
          <MonthSelector value={mes} onChange={setMes} />
          <Button onClick={() => setModalOpen(true)}><Plus size={16} className="mr-1" />Lancar dia</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard title="Perfis" value={formatNumber(t.perfis)} />
        <KpiCard title="Enviadas" value={formatNumber(t.enviadas)} />
        <KpiCard title="Taxa Aceite" value={formatPercent(taxaAceite)} />
        <KpiCard title="Conversas" value={formatNumber(t.conversas)} />
        <KpiCard title="Reuniões" value={formatNumber(t.reunioes)} />
        <KpiCard title="Vendas" value={formatNumber(t.vendas)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel */}
        <Card>
          <CardHeader><CardTitle className="text-base">Funil Social Selling</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {funnelData.map((s, i) => {
                const w = funnelData[0].valor > 0 ? Math.max(8, (s.valor / funnelData[0].valor) * 100) : 8;
                const prev = i > 0 ? funnelData[i - 1].valor : 0;
                const pct = prev > 0 ? (s.valor / prev) * 100 : 0;
                return (<div key={s.etapa} className="flex items-center gap-3">
                  <span className="text-xs w-20 text-right text-muted-foreground">{s.etapa}</span>
                  <div className="flex-1"><div className="h-7 rounded flex items-center px-2 text-white text-xs font-medium" style={{ width: `${w}%`, backgroundColor: ["#6366f1", "#8b5cf6", "#a78bfa", "#f59e0b", "#22c55e", "#14b8a6"][i] }}>{s.valor}</div></div>
                  <span className="text-xs text-muted-foreground w-12">{i > 0 ? `${pct.toFixed(0)}%` : ""}</span>
                </div>);
              })}
            </div>
          </CardContent>
        </Card>

        {/* Metas */}
        <Card>
          <CardHeader><CardTitle className="text-base">Meta vs Realizado</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {meta ? (<>
              {[
                { label: "Reuniões SS", atual: t.reunioes, meta: meta.meta_reunioes_agendadas },
                { label: "Vendas SS", atual: t.vendas, meta: meta.meta_vendas },
                { label: "Conexoes", atual: t.aceitas, meta: meta.meta_conexoes },
              ].map((m) => (<div key={m.label} className="space-y-1">
                <div className="flex justify-between text-sm"><span>{m.label}</span><span>{m.atual} / {m.meta}</span></div>
                <div className="h-2 bg-muted rounded-full"><div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(safe(m.atual, m.meta) * 100, 100)}%` }} /></div>
              </div>))}
            </>) : <p className="text-sm text-muted-foreground">Configure metas em /metas</p>}
            <div className="p-3 bg-muted rounded-lg"><p className="text-sm">MRR gerado: <strong className="text-green-500">{formatCurrency(t.mrr)}</strong></p></div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Histórico Diário</CardTitle></CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead className="text-right">Perfis</TableHead><TableHead className="text-right">Enviadas</TableHead><TableHead className="text-right">Aceitas</TableHead><TableHead className="text-right">Conversas</TableHead><TableHead className="text-right">Reunioes</TableHead><TableHead className="text-right">Vendas</TableHead><TableHead className="text-right">MRR</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {lancamentos.map((l) => (<TableRow key={l.id}>
                  <TableCell>{new Date(l.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</TableCell>
                  <TableCell className="text-right">{l.perfis_prospectados}</TableCell><TableCell className="text-right">{l.conexoes_enviadas}</TableCell>
                  <TableCell className="text-right">{l.conexoes_aceitas}</TableCell><TableCell className="text-right">{l.conversas_iniciadas}</TableCell>
                  <TableCell className="text-right">{l.reunioes_agendadas}</TableCell><TableCell className="text-right">{l.vendas}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(l.mrr_dia))}</TableCell>
                </TableRow>))}
                {lancamentos.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum lancamento</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Lancar Dia SS</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Data</Label><Input type="date" value={form.data} max={new Date().toISOString().split("T")[0]} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
            {[
              { k: "perfis_prospectados", l: "Perfis prospectados" }, { k: "conexoes_enviadas", l: "Conexoes enviadas" },
              { k: "conexoes_aceitas", l: "Conexoes aceitas" }, { k: "conversas_iniciadas", l: "Conversas iniciadas" },
              { k: "reunioes_agendadas", l: "Reuniões agendadas" }, { k: "vendas", l: "Vendas" },
            ].map((f) => (<div key={f.k} className="space-y-1"><Label>{f.l}</Label><Input type="number" min={0} value={(form as Record<string, number | string>)[f.k]} onChange={(e) => setForm({ ...form, [f.k]: Number(e.target.value) })} /></div>))}
            <div className="space-y-1"><Label>MRR</Label><CurrencyInput value={form.mrr_dia} onChange={(v) => setForm({ ...form, mrr_dia: v })} /></div>
            {form.conexoes_enviadas > 0 && <div className="p-2 bg-muted rounded text-xs">Taxa aceite: <strong>{formatPercent(safe(form.conexoes_aceitas, form.conexoes_enviadas) * 100)}</strong></div>}
            <div className="flex gap-3"><Button onClick={salvarLanc} disabled={saving} className="flex-1">{saving ? "Salvando..." : "Salvar"}</Button><Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1">Cancelar</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
