"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, TrendingDown, Users, Megaphone, DollarSign, AlertTriangle, CheckCircle, RefreshCw, Trash2 } from "lucide-react";

interface AlertConfig {
  key: string;
  label: string;
  description: string;
  defaultValue: string;
  step: string;
  unit: string;
}

interface AlertArea {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  alerts: AlertConfig[];
}

const AREAS: AlertArea[] = [
  {
    id: "comercial",
    label: "Comercial",
    icon: DollarSign,
    color: "text-green-400",
    alerts: [
      { key: "alerta_noshow_limite", label: "No-Show Limite (%)", description: "Alerta quando no-show ultrapassa este valor", defaultValue: "30", step: "5", unit: "%" },
      { key: "alerta_roas_minimo", label: "ROAS Minimo", description: "Alerta quando ROAS fica abaixo deste valor", defaultValue: "2", step: "0.5", unit: "x" },
      { key: "alerta_resultado_minimo", label: "Resultado do Time Minimo (R$)", description: "Alerta quando resultado fica abaixo", defaultValue: "2000", step: "500", unit: "R$" },
    ],
  },
  {
    id: "trafego",
    label: "Trafego Pago",
    icon: Megaphone,
    color: "text-purple-400",
    alerts: [
      { key: "trafego_cpl_limite", label: "CPL Maximo (R$)", description: "Alerta quando CPL ultrapassa este valor", defaultValue: "100", step: "1", unit: "R$" },
      { key: "trafego_ctr_minimo", label: "CTR Minimo (%)", description: "Alerta quando CTR fica abaixo (ultimos 3 dias)", defaultValue: "0.8", step: "0.1", unit: "%" },
      { key: "trafego_freq_maxima", label: "Frequencia Maxima (x)", description: "Alerta quando audiencia saturada", defaultValue: "3", step: "0.5", unit: "x" },
      { key: "trafego_zero_horas", label: "Zero Leads — Horas", description: "Periodo sem leads para disparar alerta", defaultValue: "48", step: "12", unit: "h" },
      { key: "trafego_zero_gasto", label: "Zero Leads — Gasto minimo (R$)", description: "Gasto minimo para considerar alerta de zero leads", defaultValue: "50", step: "10", unit: "R$" },
    ],
  },
  {
    id: "sdr",
    label: "SDR",
    icon: Users,
    color: "text-blue-400",
    alerts: [
      { key: "alerta_sdr_qualificacao", label: "Qualificacao Minima (%)", description: "Alerta quando taxa de qualificacao fica abaixo", defaultValue: "5", step: "1", unit: "%" },
      { key: "alerta_sdr_desqualificacao", label: "Desqualificacao Maxima (%)", description: "Alerta quando taxa de desqualificacao ultrapassa", defaultValue: "50", step: "5", unit: "%" },
      { key: "alerta_sdr_parados_dias", label: "Leads Parados — Dias", description: "Alerta quando leads ficam parados em acolhimento", defaultValue: "2", step: "1", unit: "dias" },
    ],
  },
  {
    id: "funil",
    label: "Funil / CRM",
    icon: TrendingDown,
    color: "text-yellow-400",
    alerts: [
      { key: "alerta_lead_inativo_dias", label: "Lead Inativo — Dias", description: "Dias para considerar lead inativo em oportunidade", defaultValue: "30", step: "5", unit: "dias" },
      { key: "alerta_ciclo_maximo", label: "Ciclo Maximo (dias)", description: "Alerta quando ciclo de fechamento ultrapassa", defaultValue: "30", step: "5", unit: "dias" },
    ],
  },
];

export default function AlertasConfigPage() {
  const [expandedArea, setExpandedArea] = useState<string | null>("comercial");
  const [values, setValues] = useState<Record<string, string>>({});

  // N8n errors
  const [n8nErrors, setN8nErrors] = useState<{ id: string; workflow_name: string; error_message: string; node_name: string | null; resolved: boolean; created_at: string }[]>([]);
  const [n8nExpanded, setN8nExpanded] = useState(false);

  useEffect(() => {
    supabase.from("n8n_error_log").select("*").order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setN8nErrors((data || []) as typeof n8nErrors));
  }, []);

  useEffect(() => {
    const loaded: Record<string, string> = {};
    AREAS.forEach((area) => {
      area.alerts.forEach((a) => {
        loaded[a.key] = localStorage.getItem(a.key) || a.defaultValue;
      });
    });
    setValues(loaded);
  }, []);

  const updateValue = (key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    localStorage.setItem(key, val);
    toast.success("Threshold atualizado");
  };

  // Contar alertas ativos por área (simplificado)
  const getActiveCount = (areaId: string): number => {
    // Contagem real viria dos dados — aqui mostra se tem configuração customizada
    const area = AREAS.find((a) => a.id === areaId);
    if (!area) return 0;
    return area.alerts.filter((a) => {
      const val = values[a.key];
      return val && val !== a.defaultValue;
    }).length;
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Configuracao de Alertas</h1>
        <p className="text-sm text-muted-foreground">Defina os thresholds para cada tipo de alerta por area</p>
      </div>

      {AREAS.map((area) => {
        const isExpanded = expandedArea === area.id;
        const Icon = area.icon;
        const customCount = getActiveCount(area.id);

        return (
          <Card key={area.id}>
            <button
              onClick={() => setExpandedArea(isExpanded ? null : area.id)}
              className="w-full text-left"
            >
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Icon size={16} className={area.color} />
                  {area.label}
                  <Badge variant="outline" className="text-[9px]">{area.alerts.length} alertas</Badge>
                  {customCount > 0 && <Badge className="text-[9px] bg-primary/10 text-primary">{customCount} customizado{customCount > 1 ? "s" : ""}</Badge>}
                </CardTitle>
                {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
              </CardHeader>
            </button>

            {isExpanded && (
              <CardContent className="pt-0 space-y-3">
                {area.alerts.map((alert) => (
                  <div key={alert.key} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{alert.label}</p>
                      <p className="text-[10px] text-muted-foreground">{alert.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step={alert.step}
                        value={values[alert.key] || alert.defaultValue}
                        onChange={(e) => updateValue(alert.key, e.target.value)}
                        className="w-20 text-sm bg-transparent border rounded px-2 py-1 text-right"
                      />
                      <span className="text-xs text-muted-foreground w-8">{alert.unit}</span>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => {
                    area.alerts.forEach((a) => updateValue(a.key, a.defaultValue));
                    toast.success(`${area.label}: thresholds resetados`);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Resetar para padrao
                </button>
              </CardContent>
            )}
          </Card>
        );
      })}
      {/* Erros n8n */}
      <Card>
        <button onClick={() => setN8nExpanded(!n8nExpanded)} className="w-full text-left">
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-400" />
              Erros n8n
              {n8nErrors.filter((e) => !e.resolved).length > 0 && (
                <Badge className="text-[9px] bg-red-500/15 text-red-400">{n8nErrors.filter((e) => !e.resolved).length} pendente{n8nErrors.filter((e) => !e.resolved).length > 1 ? "s" : ""}</Badge>
              )}
              {n8nErrors.filter((e) => !e.resolved).length === 0 && (
                <Badge className="text-[9px] bg-green-500/15 text-green-400">Sem erros</Badge>
              )}
            </CardTitle>
            {n8nExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
          </CardHeader>
        </button>
        {n8nExpanded && (
          <CardContent className="pt-0 space-y-2">
            <div className="flex justify-end gap-2 mb-2">
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => {
                supabase.from("n8n_error_log").select("*").order("created_at", { ascending: false }).limit(50)
                  .then(({ data }) => setN8nErrors((data || []) as typeof n8nErrors));
              }}><RefreshCw size={12} /></Button>
              {n8nErrors.some((e) => !e.resolved) && (
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={async () => {
                  const pending = n8nErrors.filter((e) => !e.resolved);
                  for (const e of pending) await supabase.from("n8n_error_log").update({ resolved: true }).eq("id", e.id);
                  setN8nErrors((prev) => prev.map((e) => ({ ...e, resolved: true })));
                  toast.success(`${pending.length} erros resolvidos`);
                }}><CheckCircle size={12} className="mr-1" />Resolver todos</Button>
              )}
              {n8nErrors.some((e) => e.resolved) && (
                <Button variant="ghost" size="sm" className="text-xs h-7 text-red-400" onClick={async () => {
                  const resolved = n8nErrors.filter((e) => e.resolved);
                  for (const e of resolved) await supabase.from("n8n_error_log").delete().eq("id", e.id);
                  setN8nErrors((prev) => prev.filter((e) => !e.resolved));
                  toast.success("Resolvidos limpos");
                }}><Trash2 size={12} className="mr-1" />Limpar</Button>
              )}
            </div>
            {n8nErrors.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground"><CheckCircle size={20} className="mx-auto mb-1 text-green-500" />Nenhum erro</div>
            ) : (
              n8nErrors.map((e) => (
                <div key={e.id} className={`p-3 rounded-lg border text-xs ${e.resolved ? "opacity-40 bg-muted/20" : "bg-red-500/5 border-red-500/20"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-red-400 break-all">{e.error_message}</p>
                      <div className="flex gap-3 mt-1 text-muted-foreground">
                        <span>{e.workflow_name}</span>
                        {e.node_name && <span>Node: {e.node_name}</span>}
                        <span>{new Date(e.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </div>
                    {!e.resolved && (
                      <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={async () => {
                        await supabase.from("n8n_error_log").update({ resolved: true }).eq("id", e.id);
                        setN8nErrors((prev) => prev.map((x) => x.id === e.id ? { ...x, resolved: true } : x));
                      }}><CheckCircle size={10} /></Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
