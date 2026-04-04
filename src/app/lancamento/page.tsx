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
import { Save, Pencil, Plus, Trash2 } from "lucide-react";

const ORIGENS = ["Tráfego Pago", "Orgânico", "Social Selling", "Indicação", "Workshop"];

interface ContratoForm {
  cliente_nome: string;
  origem_lead: string;
  sdr_id: string;
  valor_entrada: number;
  mrr: number;
  meses_contrato: number;
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

  const noShow = Math.max(0, reunioesAgendadas - reunioesFeitas);

  function getContratoMrr(c: ContratoForm) {
    if (c.valor_variavel && c.valores_mensais.length > 0) {
      return c.valores_mensais.reduce((s, v) => s + v, 0) / c.valores_mensais.length;
    }
    return c.mrr;
  }
  function getContratoLtv(c: ContratoForm) {
    if (c.valor_variavel && c.valores_mensais.length > 0) {
      return c.valores_mensais.reduce((s, v) => s + v, 0);
    }
    return c.mrr * c.meses_contrato;
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
                  <Label className="text-xs">Valor Entrada (R$)</Label>
                  <Input type="number" min={0} step={0.01} value={c.valor_entrada} onChange={(e) => updateContrato(i, "valor_entrada", Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Meses Contrato</Label>
                  <Input type="number" min={1} value={c.meses_contrato} onChange={(e) => updateContrato(i, "meses_contrato", Number(e.target.value))} />
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
                    <Label className="text-xs">MRR Mensal (R$)</Label>
                    <Input type="number" min={0} step={0.01} value={c.mrr} onChange={(e) => updateContrato(i, "mrr", Number(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Valor Total</Label>
                    <div className="h-9 px-3 flex items-center bg-muted rounded-md text-sm font-medium">
                      {formatCurrency(c.mrr * c.meses_contrato)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs">Valor por mes (R$)</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {c.valores_mensais.map((v, mi) => (
                      <div key={mi} className="space-y-0.5">
                        <span className="text-[10px] text-muted-foreground">Mes {mi + 1}</span>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={v}
                          onChange={(e) => updateValorMensal(i, mi, Number(e.target.value))}
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

      {/* Salvar */}
      <Button onClick={handleSave} disabled={saving || !closerId} className="w-full" size="lg">
        <Save size={18} className="mr-2" />
        {saving ? "Salvando..." : existingLancId ? "Atualizar Lançamento" : "Salvar Lançamento"}
      </Button>
    </div>
  );
}
