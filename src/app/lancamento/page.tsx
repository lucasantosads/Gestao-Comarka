"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Closer, Sdr, Contrato } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { Save, Pencil, Plus, Trash2, RotateCcw, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { CurrencyInput } from "@/components/currency-input";

const ORIGENS = ["Tráfego Pago", "Orgânico", "Social Selling", "Indicação", "Workshop"];

interface ContratoForm {
  cliente_nome: string;
  origem_lead: string;
  sdr_id: string;
  valor_entrada: number;
  mrr: number;
  meses_contrato: number;
  entrada_e_primeiro_mes: boolean;
  valor_variavel: boolean;
  valores_mensais: number[];
  obs: string;
}

const emptyContrato: ContratoForm = {
  cliente_nome: "",
  origem_lead: "",
  sdr_id: "",
  valor_entrada: 0,
  mrr: 0,
  meses_contrato: 6,
  entrada_e_primeiro_mes: true,
  valor_variavel: false,
  valores_mensais: [],
  obs: "",
};

export default function LancamentoPage() {
  const [closers, setClosers] = useState<Closer[]>([]);
  const [sdrs, setSdrs] = useState<Sdr[]>([]);
  const [closerId, setCloserId] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().split("T")[0]);
  const [reunioesAgendadas, setReunioesAgendadas] = useState(0);
  const [reunioesFeitas, setReunioesFeitas] = useState(0);
  const [contratos, setContratos] = useState<ContratoForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [existingLancId, setExistingLancId] = useState<string | null>(null);
  const [existingContratoIds, setExistingContratoIds] = useState<string[]>([]);

  // Histórico de lançamentos (painel recolhível no fim da página)
  interface HistRow {
    id: string;
    data: string;
    closer_id: string;
    reunioes_marcadas: number;
    reunioes_feitas: number;
    ganhos: number;
    mrr_dia: number;
    ltv: number;
  }
  const [histOpen, setHistOpen] = useState(false);
  const [histRows, setHistRows] = useState<HistRow[]>([]);
  const [histVisibleCount, setHistVisibleCount] = useState(5);
  const [histCloserFilter, setHistCloserFilter] = useState<string>("all");
  const [histPeriodo, setHistPeriodo] = useState<"dia" | "semana" | "mes" | "tudo">("tudo");
  const [histDate, setHistDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [histLoading, setHistLoading] = useState(false);

  async function loadHistorico() {
    setHistLoading(true);
    let q = supabase.from("lancamentos_diarios")
      .select("id,data,closer_id,reunioes_marcadas,reunioes_feitas,ganhos,mrr_dia,ltv")
      .order("data", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);

    if (histCloserFilter !== "all") q = q.eq("closer_id", histCloserFilter);

    if (histPeriodo === "dia") {
      q = q.eq("data", histDate);
    } else if (histPeriodo === "semana") {
      const d = new Date(histDate + "T00:00:00");
      const dow = d.getDay();
      const start = new Date(d); start.setDate(d.getDate() - dow);
      const end = new Date(start); end.setDate(start.getDate() + 6);
      q = q.gte("data", start.toISOString().split("T")[0]).lte("data", end.toISOString().split("T")[0]);
    } else if (histPeriodo === "mes") {
      const mes = histDate.slice(0, 7);
      const start = `${mes}-01`;
      const endDate = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0);
      const end = endDate.toISOString().split("T")[0];
      q = q.gte("data", start).lte("data", end);
    }

    const { data: rows } = await q;
    setHistRows((rows || []) as HistRow[]);
    setHistVisibleCount(5);
    setHistLoading(false);
  }

  useEffect(() => {
    if (histOpen) loadHistorico();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [histOpen, histCloserFilter, histPeriodo, histDate]);

  const noShow = Math.max(0, reunioesAgendadas - reunioesFeitas);

  function getContratoMrr(c: ContratoForm) {
    if (c.valor_variavel && c.valores_mensais.length > 0) {
      return c.valores_mensais.reduce((s, v) => s + v, 0) / c.valores_mensais.length;
    }
    return c.mrr;
  }
  /**
   * Valor total do projeto (LTV) respeitando entrada_e_primeiro_mes:
   *  - true  → entrada + mrr × (meses - 1)  (entrada já é o 1º mês)
   *  - false → entrada + mrr × meses        (entrada separada do recorrente)
   *
   * Quando valor_variavel=true, valores_mensais já reflete cada mês, então
   * a entrada é sempre somada por fora (quando não for o primeiro mês).
   */
  function getContratoLtv(c: ContratoForm) {
    if (c.valor_variavel && c.valores_mensais.length > 0) {
      const somaMensal = c.valores_mensais.reduce((s, v) => s + v, 0);
      // Se entrada == 1º mês, assume que valores_mensais[0] já é a entrada.
      // Caso contrário, adiciona a entrada por fora.
      return c.entrada_e_primeiro_mes ? somaMensal : somaMensal + c.valor_entrada;
    }
    if (c.entrada_e_primeiro_mes) {
      return c.valor_entrada + c.mrr * Math.max(0, c.meses_contrato - 1);
    }
    return c.valor_entrada + c.mrr * c.meses_contrato;
  }

  const totalMrr = contratos.reduce((s, c) => s + getContratoMrr(c), 0);
  const totalEntrada = contratos.reduce((s, c) => s + c.valor_entrada, 0);
  const totalLtv = contratos.reduce((s, c) => s + getContratoLtv(c), 0);

  useEffect(() => {
    Promise.all([
      supabase.from("closers").select("*").eq("ativo", true).order("nome"),
      supabase.from("sdrs").select("*").eq("ativo", true).order("nome"),
    ]).then(([{ data: cl }, { data: sd }]) => {
      setClosers((cl || []) as Closer[]);
      setSdrs((sd || []) as Sdr[]);
    });
  }, []);

  useEffect(() => {
    if (closerId && data) loadExisting();
  }, [closerId, data]);

  async function loadExisting() {
    // Load lancamento
    const { data: lanc } = await supabase
      .from("lancamentos_diarios")
      .select("*")
      .eq("closer_id", closerId)
      .eq("data", data)
      .single();

    if (lanc) {
      setExistingLancId(lanc.id);
      setReunioesAgendadas(lanc.reunioes_marcadas);
      setReunioesFeitas(lanc.reunioes_feitas);

      // Load contratos do dia
      const mesRef = data.slice(0, 7);
      const { data: cts } = await supabase
        .from("contratos")
        .select("*")
        .eq("closer_id", closerId)
        .eq("data_fechamento", data)
        .eq("mes_referencia", mesRef)
        .order("created_at");

      if (cts && cts.length > 0) {
        setExistingContratoIds(cts.map((c: Contrato) => c.id));
        setContratos(
          cts.map((c: Contrato) => ({
            cliente_nome: c.cliente_nome,
            origem_lead: c.origem_lead,
            sdr_id: c.sdr_id || "",
            valor_entrada: Number(c.valor_entrada),
            mrr: Number(c.mrr),
            meses_contrato: c.meses_contrato,
            entrada_e_primeiro_mes: c.entrada_e_primeiro_mes ?? true,
            valor_variavel: false,
            valores_mensais: [],
            obs: c.obs || "",
          }))
        );
      } else {
        setExistingContratoIds([]);
        setContratos([]);
      }
      toast.info("Lançamento existente carregado para edição");
    } else {
      setExistingLancId(null);
      setExistingContratoIds([]);
      setReunioesAgendadas(0);
      setReunioesFeitas(0);
      setContratos([]);
    }
  }

  function addContrato() {
    setContratos([...contratos, { ...emptyContrato }]);
  }

  function removeContrato(index: number) {
    setContratos(contratos.filter((_, i) => i !== index));
  }

  function updateContrato(index: number, field: keyof ContratoForm, value: string | number | boolean | number[]) {
    const updated = [...contratos];
    updated[index] = { ...updated[index], [field]: value };
    // Ao ativar valor variavel, inicializa array com MRR atual
    if (field === "valor_variavel" && value === true) {
      const meses = updated[index].meses_contrato;
      const mrr = updated[index].mrr;
      updated[index].valores_mensais = Array(meses).fill(mrr);
    }
    // Ao mudar meses, ajusta tamanho do array
    if (field === "meses_contrato" && updated[index].valor_variavel) {
      const newLen = Number(value);
      const old = updated[index].valores_mensais;
      updated[index].valores_mensais = Array(newLen).fill(0).map((_, i) => old[i] ?? old[old.length - 1] ?? 0);
    }
    setContratos(updated);
  }

  function updateValorMensal(contratoIndex: number, mesIndex: number, valor: number) {
    const updated = [...contratos];
    const vals = [...updated[contratoIndex].valores_mensais];
    vals[mesIndex] = valor;
    updated[contratoIndex] = { ...updated[contratoIndex], valores_mensais: vals };
    setContratos(updated);
  }

  async function handleSave() {
    if (!closerId) { toast.error("Selecione o closer"); return; }
    if (reunioesFeitas > reunioesAgendadas) { toast.error("Reuniões feitas não pode ser maior que agendadas"); return; }

    for (const c of contratos) {
      if (!c.cliente_nome.trim()) { toast.error("Preencha o nome de todos os clientes"); return; }
      if (!c.origem_lead) { toast.error("Selecione a origem de todos os contratos"); return; }
    }

    setSaving(true);
    const mesRef = data.slice(0, 7);

    // 1. Salvar lancamento diario
    // mes_referencia é GENERATED — Postgres calcula a partir de `data`, não enviar.
    const lancPayload = {
      closer_id: closerId,
      data,
      reunioes_marcadas: reunioesAgendadas,
      reunioes_feitas: reunioesFeitas,
      ganhos: contratos.length,
      mrr_dia: totalMrr,
      ltv: totalLtv,
      obs: contratos.length > 0 ? contratos.map((c) => c.cliente_nome).join(", ") : null,
    };

    let lancId = existingLancId;

    if (lancId) {
      const { error } = await supabase.from("lancamentos_diarios").update(lancPayload).eq("id", lancId);
      if (error) { toast.error("Erro lancamento: " + error.message); setSaving(false); return; }
    } else {
      const { data: newLanc, error } = await supabase.from("lancamentos_diarios").insert(lancPayload).select("id").single();
      if (error || !newLanc) { toast.error("Erro lancamento: " + (error?.message || "erro")); setSaving(false); return; }
      lancId = newLanc.id;
    }

    // 2. Deletar contratos antigos do dia e reinserir
    if (existingContratoIds.length > 0) {
      await supabase.from("contratos").delete().in("id", existingContratoIds);
    }

    if (contratos.length > 0) {
      const contratosPayload = contratos.map((c) => ({
        mes_referencia: mesRef,
        closer_id: closerId,
        sdr_id: c.sdr_id || null,
        cliente_nome: c.cliente_nome.trim(),
        origem_lead: c.origem_lead,
        valor_entrada: c.valor_entrada,
        mrr: getContratoMrr(c),
        meses_contrato: c.meses_contrato,
        // valor_total_projeto é sempre calculado no frontend (TAREFA 3) —
        // respeita o flag entrada_e_primeiro_mes. Backend nunca recalcula.
        valor_total_projeto: getContratoLtv(c),
        entrada_e_primeiro_mes: c.entrada_e_primeiro_mes,
        data_fechamento: data,
        obs: [c.obs, c.valor_variavel ? "Valores: " + c.valores_mensais.map((v) => "R$" + v.toFixed(0)).join(", ") : ""].filter(Boolean).join(" | ") || null,
      }));
      const { error } = await supabase.from("contratos").insert(contratosPayload);
      if (error) { toast.error("Erro contratos: " + error.message); setSaving(false); return; }
    }

    toast.success(existingLancId ? "Lançamento atualizado!" : "Lançamento salvo!");
    setExistingLancId(lancId);

    // Reload to get new contrato IDs
    const { data: cts } = await supabase
      .from("contratos")
      .select("id")
      .eq("closer_id", closerId)
      .eq("data_fechamento", data)
      .eq("mes_referencia", mesRef);
    setExistingContratoIds((cts || []).map((c: { id: string }) => c.id));

    setSaving(false);
  }

  async function handleUndo() {
    if (!existingLancId) return;
    if (!confirm("Desfazer este lançamento? Isso vai apagar as reuniões e contratos desta data/closer. Não pode ser revertido.")) return;
    setSaving(true);

    // 1. Apaga contratos associados
    if (existingContratoIds.length > 0) {
      const { error: cErr } = await supabase.from("contratos").delete().in("id", existingContratoIds);
      if (cErr) { toast.error("Erro ao apagar contratos: " + cErr.message); setSaving(false); return; }
    }

    // 2. Apaga o lançamento diário
    const { error: lErr } = await supabase.from("lancamentos_diarios").delete().eq("id", existingLancId);
    if (lErr) { toast.error("Erro ao apagar lançamento: " + lErr.message); setSaving(false); return; }

    // 3. Reseta o formulário
    setReunioesAgendadas(0);
    setReunioesFeitas(0);
    setContratos([]);
    setExistingLancId(null);
    setExistingContratoIds([]);
    toast.success("Lançamento desfeito");
    setSaving(false);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Lançamento Diário</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Closer e Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Closer</Label>
              <Select value={closerId} onValueChange={setCloserId}>
                <SelectTrigger><SelectValue placeholder="Selecione o closer" /></SelectTrigger>
                <SelectContent>
                  {closers.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={data} max={new Date().toISOString().split("T")[0]} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>

          {existingLancId && (
            <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm">
              <Pencil size={16} />
              Editando lancamento existente
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reunioes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reunioes do Dia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Reunioes Agendadas</Label>
              <Input type="number" min={0} value={reunioesAgendadas} onChange={(e) => setReunioesAgendadas(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Reunioes Feitas</Label>
              <Input type="number" min={0} max={reunioesAgendadas} value={reunioesFeitas} onChange={(e) => setReunioesFeitas(Math.min(Number(e.target.value), reunioesAgendadas))} />
            </div>
          </div>
          <div className="p-3 bg-muted rounded-lg flex justify-between items-center">
            <span className="text-sm text-muted-foreground">No Show</span>
            <span className="font-bold text-lg">{noShow}</span>
          </div>
        </CardContent>
      </Card>

      {/* Contratos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Novos Contratos</CardTitle>
          <Button variant="outline" size="sm" onClick={addContrato}>
            <Plus size={14} className="mr-1" />
            Novo Contrato
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {contratos.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum contrato hoje. Clique em &quot;Novo Contrato&quot; para adicionar.
            </p>
          )}

          {contratos.map((c, i) => (
            <div key={i} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Contrato {i + 1}</span>
                <Button variant="ghost" size="sm" onClick={() => removeContrato(i)} className="text-destructive h-7 w-7 p-0">
                  <Trash2 size={14} />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Nome do Cliente</Label>
                  <Input value={c.cliente_nome} onChange={(e) => updateContrato(i, "cliente_nome", e.target.value)} placeholder="Nome do cliente" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Origem do Lead</Label>
                  <Select value={c.origem_lead} onValueChange={(v) => updateContrato(i, "origem_lead", v)}>
                    <SelectTrigger><SelectValue placeholder="Origem" /></SelectTrigger>
                    <SelectContent>
                      {ORIGENS.map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">SDR</Label>
                  <Select value={c.sdr_id} onValueChange={(v) => updateContrato(i, "sdr_id", v)}>
                    <SelectTrigger><SelectValue placeholder="SDR (opcional)" /></SelectTrigger>
                    <SelectContent>
                      {sdrs.map((s) => (<SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor Entrada</Label>
                  <CurrencyInput value={c.valor_entrada} onChange={(v) => updateContrato(i, "valor_entrada", v)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Meses Contrato</Label>
                  <Input type="number" min={1} value={c.meses_contrato} onChange={(e) => updateContrato(i, "meses_contrato", Number(e.target.value))} />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      id={`ent-1m-${i}`}
                      checked={c.entrada_e_primeiro_mes}
                      onChange={(e) => updateContrato(i, "entrada_e_primeiro_mes", e.target.checked)}
                      className="rounded border-muted-foreground accent-primary"
                    />
                    <span className="text-xs font-medium">Entrada é o primeiro mês do MRR</span>
                  </label>
                  <p className="text-[10px] text-muted-foreground pl-6">
                    {c.entrada_e_primeiro_mes
                      ? "Entrada = 1° mês do contrato. Valor Total = Entrada + MRR × (Meses − 1)"
                      : "Entrada separada do MRR. Valor Total = Entrada + MRR × Meses"}
                  </p>
                </div>
              </div>

              {/* Toggle valor variavel */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`variavel-${i}`}
                  checked={c.valor_variavel}
                  onChange={(e) => updateContrato(i, "valor_variavel", e.target.checked)}
                  className="rounded border-muted-foreground"
                />
                <Label htmlFor={`variavel-${i}`} className="text-xs cursor-pointer">
                  Valor diferente por mes
                </Label>
              </div>

              {!c.valor_variavel ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">MRR Mensal</Label>
                    <CurrencyInput value={c.mrr} onChange={(v) => updateContrato(i, "mrr", v)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Valor Total</Label>
                    <div className="h-9 px-3 flex items-center bg-muted rounded-md text-sm font-medium">
                      {formatCurrency(getContratoLtv(c))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs">Valor por mes</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {c.valores_mensais.map((v, mi) => (
                      <div key={mi} className="space-y-0.5">
                        <span className="text-[10px] text-muted-foreground">Mes {mi + 1}</span>
                        <CurrencyInput
                          value={v}
                          onChange={(val) => updateValorMensal(i, mi, val)}
                          className="h-8 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">MRR Medio</Label>
                      <div className="h-9 px-3 flex items-center bg-muted rounded-md text-sm font-medium">
                        {formatCurrency(getContratoMrr(c))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Valor Total</Label>
                      <div className="h-9 px-3 flex items-center bg-muted rounded-md text-sm font-medium">
                        {formatCurrency(getContratoLtv(c))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Observacoes</Label>
                <Input value={c.obs} onChange={(e) => updateContrato(i, "obs", e.target.value)} placeholder="Data pagamento, detalhes, etc." />
              </div>
            </div>
          ))}

          {/* Resumo */}
          {contratos.length > 0 && (
            <div className="p-3 bg-muted rounded-lg space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total contratos</span>
                <span className="font-bold">{contratos.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total entradas</span>
                <span className="font-bold">{formatCurrency(totalEntrada)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">MRR total</span>
                <span className="font-bold">{formatCurrency(totalMrr)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">LTV total</span>
                <span className="font-bold">{formatCurrency(totalLtv)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Comissao (10%)</span>
                <span className="font-bold">{formatCurrency(totalMrr * 0.1)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Salvar + Desfazer */}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving || !closerId} className="flex-1" size="lg">
          <Save size={18} className="mr-2" />
          {saving ? "Salvando..." : existingLancId ? "Atualizar Lançamento" : "Salvar Lançamento"}
        </Button>
        {existingLancId && (
          <Button
            onClick={handleUndo}
            disabled={saving}
            variant="outline"
            size="lg"
            className="text-destructive border-destructive/40 hover:bg-destructive/10"
          >
            <RotateCcw size={18} className="mr-2" />
            Desfazer
          </Button>
        )}
      </div>

      {/* Histórico de lançamentos — painel recolhível */}
      <Card>
        <button
          type="button"
          onClick={() => setHistOpen((v) => !v)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted-foreground" />
            <span className="text-sm font-semibold">Últimos lançamentos</span>
            {histRows.length > 0 && (
              <span className="text-[11px] text-muted-foreground">
                ({Math.min(histVisibleCount, histRows.length)} de {histRows.length})
              </span>
            )}
          </div>
          {histOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {histOpen && (
          <CardContent className="pt-0 space-y-4">
            {/* Filtros */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Closer</Label>
                <Select value={histCloserFilter} onValueChange={setHistCloserFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {closers.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Período</Label>
                <Select value={histPeriodo} onValueChange={(v) => setHistPeriodo(v as typeof histPeriodo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tudo">Tudo</SelectItem>
                    <SelectItem value="dia">Dia</SelectItem>
                    <SelectItem value="semana">Semana</SelectItem>
                    <SelectItem value="mes">Mês</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {histPeriodo !== "tudo" && (
                <div className="space-y-1">
                  <Label className="text-xs">
                    {histPeriodo === "dia" ? "Data" : histPeriodo === "semana" ? "Semana (qualquer dia)" : "Mês (qualquer dia)"}
                  </Label>
                  <Input type="date" value={histDate} onChange={(e) => setHistDate(e.target.value)} />
                </div>
              )}
            </div>

            {/* Tabela */}
            {histLoading ? (
              <p className="text-xs text-muted-foreground text-center py-6">Carregando...</p>
            ) : histRows.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Nenhum lançamento no período</p>
            ) : (
              <>
                <div className="overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="px-2 py-2 text-left font-medium">Data</th>
                        <th className="px-2 py-2 text-left font-medium">Closer</th>
                        <th className="px-2 py-2 text-right font-medium">Agend.</th>
                        <th className="px-2 py-2 text-right font-medium">Feitas</th>
                        <th className="px-2 py-2 text-right font-medium">Contratos</th>
                        <th className="px-2 py-2 text-right font-medium">MRR</th>
                        <th className="px-2 py-2 text-right font-medium">LTV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {histRows.slice(0, histVisibleCount).map((r) => {
                        const closer = closers.find((c) => c.id === r.closer_id);
                        return (
                          <tr key={r.id} className="border-b hover:bg-muted/30">
                            <td className="px-2 py-2">{new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                            <td className="px-2 py-2">{closer?.nome || "—"}</td>
                            <td className="px-2 py-2 text-right">{r.reunioes_marcadas}</td>
                            <td className="px-2 py-2 text-right">{r.reunioes_feitas}</td>
                            <td className="px-2 py-2 text-right font-medium">{r.ganhos}</td>
                            <td className="px-2 py-2 text-right">{formatCurrency(Number(r.mrr_dia))}</td>
                            <td className="px-2 py-2 text-right">{formatCurrency(Number(r.ltv))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {histVisibleCount < histRows.length && (
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistVisibleCount((c) => c + 5)}
                    >
                      Carregar mais 5
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
