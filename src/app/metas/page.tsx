"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Closer, Sdr, MetaMensal, MetaCloser, MetaSdr } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MonthSelector } from "@/components/month-selector";
import { getCurrentMonth } from "@/lib/format";
import { toast } from "sonner";
import { Save } from "lucide-react";

export default function MetasPage() {
  const [mes, setMes] = useState(getCurrentMonth);
  const [meta, setMeta] = useState<MetaMensal | null>(null);
  const [closers, setClosers] = useState<Closer[]>([]);
  const [sdrs, setSdrs] = useState<Sdr[]>([]);
  const [metasClosers, setMetasClosers] = useState<Record<string, MetaCloser>>({});
  const [metasSdrs, setMetasSdrs] = useState<Record<string, MetaSdr>>({});
  const [saving, setSaving] = useState(false);
  const [savingCloser, setSavingCloser] = useState<string | null>(null);
  const [savingSdr, setSavingSdr] = useState<string | null>(null);

  const [f, setF] = useState({
    meta_entrada_valor: 0,
    meta_faturamento_total: 0,
    meta_contratos_fechados: 0,
    meta_reunioes_agendadas: 0,
    meta_reunioes_feitas: 0,
    meta_taxa_no_show: 0,
    leads_totais: 0,
    valor_investido_anuncios: 0,
    custo_por_reuniao: 0,
    meses_padrao_contrato: 6,
  });

  const loadData = useCallback(async () => {
    const [{ data: metaData }, { data: cl }, { data: mc }, { data: sdrsList }, { data: ms }] =
      await Promise.all([
        supabase.from("metas_mensais").select("*").eq("mes_referencia", mes).single(),
        supabase.from("closers").select("*").eq("ativo", true).order("nome"),
        supabase.from("metas_closers").select("*").eq("mes_referencia", mes),
        supabase.from("sdrs").select("*").eq("ativo", true).order("nome"),
        supabase.from("metas_sdr").select("*").eq("mes_referencia", mes),
      ]);

    if (metaData) {
      setMeta(metaData as MetaMensal);
      setF({
        meta_entrada_valor: Number(metaData.meta_entrada_valor),
        meta_faturamento_total: Number(metaData.meta_faturamento_total),
        meta_contratos_fechados: metaData.meta_contratos_fechados,
        meta_reunioes_agendadas: metaData.meta_reunioes_agendadas,
        meta_reunioes_feitas: metaData.meta_reunioes_feitas,
        meta_taxa_no_show: Number(metaData.meta_taxa_no_show),
        leads_totais: metaData.leads_totais,
        valor_investido_anuncios: Number(metaData.valor_investido_anuncios),
        custo_por_reuniao: Number(metaData.custo_por_reuniao),
        meses_padrao_contrato: metaData.meses_padrao_contrato,
      });
    } else {
      setMeta(null);
      setF({
        meta_entrada_valor: 0, meta_faturamento_total: 0, meta_contratos_fechados: 0,
        meta_reunioes_agendadas: 0, meta_reunioes_feitas: 0, meta_taxa_no_show: 0,
        leads_totais: 0, valor_investido_anuncios: 0, custo_por_reuniao: 0, meses_padrao_contrato: 6,
      });
    }

    setClosers((cl || []) as Closer[]);
    setSdrs((sdrsList || []) as Sdr[]);

    const mcMap: Record<string, MetaCloser> = {};
    for (const m of (mc || []) as MetaCloser[]) mcMap[m.closer_id] = m;
    setMetasClosers(mcMap);

    const msMap: Record<string, MetaSdr> = {};
    for (const m of (ms || []) as MetaSdr[]) msMap[m.sdr_id] = m;
    setMetasSdrs(msMap);
  }, [mes]);

  useEffect(() => { loadData(); }, [loadData]);

  async function saveGeneral() {
    setSaving(true);
    const payload = { mes_referencia: mes, ...f };
    if (meta) {
      const { error } = await supabase.from("metas_mensais").update(payload).eq("id", meta.id);
      if (error) toast.error("Erro: " + error.message);
      else toast.success("Metas atualizadas!");
    } else {
      const { error } = await supabase.from("metas_mensais").insert(payload);
      if (error) toast.error("Erro: " + error.message);
      else { toast.success("Metas criadas!"); loadData(); }
    }
    setSaving(false);
  }

  // ===== CLOSER METAS =====
  function getCloserMeta(closerId: string) {
    return metasClosers[closerId] || { meta_contratos: 0, meta_mrr: 0, meta_ltv: 0, meta_reunioes_feitas: 0, meta_taxa_no_show: 20 };
  }

  function updateCloserMeta(closerId: string, field: keyof MetaCloser, value: number) {
    setMetasClosers((prev) => ({
      ...prev,
      [closerId]: { ...getCloserMeta(closerId), closer_id: closerId, mes_referencia: mes, id: prev[closerId]?.id || "", [field]: value },
    }));
  }

  async function saveCloserMeta(closerId: string) {
    setSavingCloser(closerId);
    const m = getCloserMeta(closerId);
    const payload = { mes_referencia: mes, closer_id: closerId, meta_contratos: m.meta_contratos, meta_mrr: Number(m.meta_mrr), meta_ltv: Number(m.meta_ltv), meta_reunioes_feitas: m.meta_reunioes_feitas, meta_taxa_no_show: Number(m.meta_taxa_no_show) };
    const existing = metasClosers[closerId]?.id;
    if (existing) {
      const { error } = await supabase.from("metas_closers").update(payload).eq("id", existing);
      if (error) toast.error("Erro: " + error.message);
      else toast.success("Meta salva!");
    } else {
      const { data, error } = await supabase.from("metas_closers").insert(payload).select("id").single();
      if (error) toast.error("Erro: " + error.message);
      else { toast.success("Meta criada!"); if (data) setMetasClosers((prev) => ({ ...prev, [closerId]: { ...prev[closerId], id: data.id } })); }
    }
    setSavingCloser(null);
  }

  // ===== SDR METAS =====
  function getSdrMeta(sdrId: string) {
    return metasSdrs[sdrId] || { meta_contatos: 0, meta_reunioes_agendadas: 0, meta_reunioes_feitas: 0, meta_taxa_no_show: 20 };
  }

  function updateSdrMeta(sdrId: string, field: string, value: number) {
    setMetasSdrs((prev) => ({
      ...prev,
      [sdrId]: { ...getSdrMeta(sdrId), sdr_id: sdrId, mes_referencia: mes, id: prev[sdrId]?.id || "", [field]: value } as MetaSdr,
    }));
  }

  async function saveSdrMeta(sdrId: string) {
    setSavingSdr(sdrId);
    const m = getSdrMeta(sdrId);
    const payload = {
      mes_referencia: mes, sdr_id: sdrId,
      meta_contatos: m.meta_contatos, meta_reunioes_agendadas: m.meta_reunioes_agendadas,
      meta_reunioes_feitas: Number((m as unknown as Record<string, unknown>).meta_reunioes_feitas ?? 0),
      meta_taxa_no_show: Number(m.meta_taxa_no_show),
    };
    const existing = metasSdrs[sdrId]?.id;
    if (existing) {
      const { error } = await supabase.from("metas_sdr").update(payload).eq("id", existing);
      if (error) toast.error("Erro: " + error.message);
      else toast.success("Meta SDR salva!");
    } else {
      const { data, error } = await supabase.from("metas_sdr").insert(payload).select("id").single();
      if (error) toast.error("Erro: " + error.message);
      else { toast.success("Meta SDR criada!"); if (data) setMetasSdrs((prev) => ({ ...prev, [sdrId]: { ...prev[sdrId], id: data.id } })); }
    }
    setSavingSdr(null);
  }

  const fields: { label: string; key: keyof typeof f; step?: string }[] = [
    { label: "Meta de Entradas (R$)", key: "meta_entrada_valor", step: "0.01" },
    { label: "Meta Faturamento/MRR (R$)", key: "meta_faturamento_total", step: "0.01" },
    { label: "Meta Contratos Fechados", key: "meta_contratos_fechados" },
    { label: "Meta Reunioes Agendadas", key: "meta_reunioes_agendadas" },
    { label: "Meta Reunioes Feitas", key: "meta_reunioes_feitas" },
    { label: "Meta Taxa No Show (%)", key: "meta_taxa_no_show", step: "0.1" },
    { label: "Leads Totais do Mes", key: "leads_totais" },
    { label: "Investido em Anuncios (R$)", key: "valor_investido_anuncios", step: "0.01" },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Metas</h1>
        <MonthSelector value={mes} onChange={setMes} />
      </div>

      {/* Metas Gerais */}
      <Card>
        <CardHeader><CardTitle className="text-base">Metas Gerais do Mes</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label className="text-xs">{field.label}</Label>
                <Input type="number" min={0} step={field.step || "1"} value={f[field.key]} onChange={(e) => setF({ ...f, [field.key]: Number(e.target.value) })} />
              </div>
            ))}
          </div>
          <Button onClick={saveGeneral} disabled={saving} className="w-full">
            <Save size={16} className="mr-2" />
            {saving ? "Salvando..." : "Salvar Metas Gerais"}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Metas por Closer */}
      <Card>
        <CardHeader><CardTitle className="text-base">Metas por Closer</CardTitle></CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Closer</TableHead>
                  <TableHead className="text-right">Meta Contratos</TableHead>
                  <TableHead className="text-right">Meta MRR (R$)</TableHead>
                  <TableHead className="text-right">Meta LTV (R$)</TableHead>
                  <TableHead className="text-right">Meta Reunioes</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closers.map((c) => {
                  const m = getCloserMeta(c.id);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell className="text-right">
                        <Input type="number" min={0} className="w-20 ml-auto text-right" value={m.meta_contratos} onChange={(e) => updateCloserMeta(c.id, "meta_contratos", Number(e.target.value))} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input type="number" min={0} step={0.01} className="w-28 ml-auto text-right" value={m.meta_mrr} onChange={(e) => updateCloserMeta(c.id, "meta_mrr", Number(e.target.value))} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input type="number" min={0} step={0.01} className="w-28 ml-auto text-right" value={m.meta_ltv} onChange={(e) => updateCloserMeta(c.id, "meta_ltv", Number(e.target.value))} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input type="number" min={0} className="w-20 ml-auto text-right" value={m.meta_reunioes_feitas} onChange={(e) => updateCloserMeta(c.id, "meta_reunioes_feitas", Number(e.target.value))} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => saveCloserMeta(c.id)} disabled={savingCloser === c.id}>
                          <Save size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Metas por SDR */}
      <Card>
        <CardHeader><CardTitle className="text-base">Metas por SDR</CardTitle></CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SDR</TableHead>
                  <TableHead className="text-right">Meta Leads</TableHead>
                  <TableHead className="text-right">Meta Reuniões Agend.</TableHead>
                  <TableHead className="text-right">Meta Reuniões Feitas</TableHead>
                  <TableHead className="text-right">No Show máx %</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sdrs.map((s) => {
                  const m = getSdrMeta(s.id);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.nome}</TableCell>
                      <TableCell className="text-right">
                        <Input type="number" min={0} className="w-20 ml-auto text-right" value={m.meta_contatos} onChange={(e) => updateSdrMeta(s.id, "meta_contatos", Number(e.target.value))} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input type="number" min={0} className="w-20 ml-auto text-right" value={m.meta_reunioes_agendadas} onChange={(e) => updateSdrMeta(s.id, "meta_reunioes_agendadas", Number(e.target.value))} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input type="number" min={0} className="w-20 ml-auto text-right" value={(m as unknown as Record<string, number>).meta_reunioes_feitas || 0} onChange={(e) => updateSdrMeta(s.id, "meta_reunioes_feitas", Number(e.target.value))} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input type="number" min={0} step={0.1} className="w-20 ml-auto text-right" value={m.meta_taxa_no_show} onChange={(e) => updateSdrMeta(s.id, "meta_taxa_no_show", Number(e.target.value))} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => saveSdrMeta(s.id)} disabled={savingSdr === s.id}>
                          <Save size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
