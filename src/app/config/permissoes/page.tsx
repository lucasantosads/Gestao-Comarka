"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, Save, RotateCcw } from "lucide-react";

const AREAS = [
  // Dashboard / Visão geral
  { key: "dashboard", label: "Dashboard (Visão Geral, Hoje, Relatório)" },
  { key: "crm", label: "CRM Completo" },
  { key: "funil", label: "Funil de Vendas" },
  { key: "analise_dias", label: "Análise por Dias" },
  { key: "historico", label: "Histórico e Tendências" },
  { key: "canais", label: "Canais" },
  // Vendas
  { key: "churn", label: "Churn e Pipeline" },
  { key: "sdr", label: "SDR" },
  { key: "closers_admin", label: "Closers (visão admin)" },
  { key: "social_selling", label: "Social Selling" },
  // Tráfego
  { key: "trafego", label: "Tráfego Pago" },
  { key: "ad_intelligence", label: "Ad Intelligence" },
  { key: "meta_creatives", label: "Meta Creatives" },
  // Clientes
  { key: "clientes", label: "Clientes (página e perfis)" },
  { key: "clientes_crm", label: "Clientes → Aba CRM (GHL)" },
  { key: "clientes_teses", label: "Clientes → Teses" },
  { key: "onboarding", label: "Onboarding" },
  // Projeções / Metas
  { key: "projecoes", label: "Projeções" },
  { key: "metas", label: "Metas e Bônus" },
  // Financeiro
  { key: "entradas", label: "Entradas (Recebimentos)" },
  { key: "lancamento", label: "Lançamento Diário" },
  { key: "contratos", label: "Contratos" },
  { key: "dre", label: "DRE" },
  { key: "fluxo_caixa", label: "Fluxo de Caixa" },
  { key: "custos", label: "Custos da Agência" },
  { key: "folha", label: "Folha de Pagamento" },
  { key: "compensation", label: "Compensação / Comissões" },
  // Equipe / Admin
  { key: "equipe_gestao", label: "Gestão de Equipe (/equipe)" },
  { key: "equipe_geral", label: "Equipe Geral (/equipe-geral)" },
  { key: "tarefas", label: "Tarefas Internas" },
  { key: "relatorio_semanal", label: "Relatório Semanal" },
  { key: "config", label: "Configurações" },
  { key: "permissoes", label: "Permissões por Cargo" },
  { key: "integracoes", label: "Integrações externas" },
];

const CARGOS = ["admin", "diretor", "head", "trafego", "pleno", "junior", "desenvolvimento", "closer", "sdr"];

const DEFAULTS: Record<string, string[]> = {
  admin: AREAS.map((a) => a.key),
  diretor: AREAS.map((a) => a.key), // mesmo acesso do admin
  head: AREAS.filter((a) => !["config", "permissoes", "integracoes"].includes(a.key)).map((a) => a.key),
  trafego: ["dashboard", "crm", "funil", "trafego", "ad_intelligence", "meta_creatives", "clientes", "clientes_teses", "clientes_crm", "onboarding", "projecoes", "historico", "canais"],
  pleno: ["dashboard", "crm", "funil", "trafego", "ad_intelligence", "clientes", "clientes_teses", "clientes_crm", "onboarding", "projecoes"],
  junior: ["dashboard", "trafego", "ad_intelligence", "clientes", "clientes_teses", "onboarding"],
  desenvolvimento: ["dashboard", "integracoes", "config"],
  closer: ["lancamento", "closers_admin"],
  sdr: ["sdr", "lancamento"],
};

const CARGO_LABELS: Record<string, string> = {
  admin: "Admin",
  diretor: "Diretor",
  head: "Head",
  trafego: "Tráfego",
  pleno: "Pleno",
  junior: "Junior",
  desenvolvimento: "Desenvolvimento",
  closer: "Closer",
  sdr: "SDR",
};
const CARGO_COLORS: Record<string, string> = {
  admin: "bg-red-500/15 text-red-400",
  diretor: "bg-red-500/15 text-red-300",
  head: "bg-purple-500/15 text-purple-400",
  trafego: "bg-orange-500/15 text-orange-400",
  pleno: "bg-cyan-500/15 text-cyan-400",
  junior: "bg-teal-500/15 text-teal-400",
  desenvolvimento: "bg-indigo-500/15 text-indigo-400",
  closer: "bg-green-500/15 text-green-400",
  sdr: "bg-blue-500/15 text-blue-400",
};

export default function PermissoesPage() {
  const [perms, setPerms] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase.from("system_config").select("value").eq("key", "visibility_config").single();
        if (data?.value) {
          setPerms(data.value as Record<string, string[]>);
          localStorage.setItem("visibility_config", JSON.stringify(data.value));
          return;
        }
      } catch { }
      // Fallback: localStorage ou DEFAULTS
      const saved = localStorage.getItem("visibility_config");
      if (saved) { try { setPerms(JSON.parse(saved)); return; } catch { } }
      setPerms({ ...DEFAULTS });
    }
    load();
  }, []);

  const toggle = (cargo: string, area: string) => {
    setPerms((prev) => {
      const current = prev[cargo] || [];
      const next = current.includes(area) ? current.filter((a) => a !== area) : [...current, area];
      return { ...prev, [cargo]: next };
    });
  };

  const toggleAll = (cargo: string, checked: boolean) => {
    setPerms((prev) => ({ ...prev, [cargo]: checked ? AREAS.map((a) => a.key) : [] }));
  };

  const resetDefaults = () => {
    setPerms({ ...DEFAULTS });
    toast.success("Restaurado para padrao");
  };

  const salvar = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("system_config").upsert(
        { key: "visibility_config", value: perms, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
      if (error) throw error;
      localStorage.setItem("visibility_config", JSON.stringify(perms));
      toast.success("Permissões sincronizadas com o servidor!");
    } catch (e: any) {
      // Fallback: salva local mesmo se Supabase falhar
      localStorage.setItem("visibility_config", JSON.stringify(perms));
      toast.warning("Salvo localmente (servidor indisponível)");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Shield size={20} /> Permissoes por Cargo</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={resetDefaults}><RotateCcw size={14} className="mr-1" />Padrao</Button>
          <Button size="sm" onClick={salvar} disabled={saving}><Save size={14} className="mr-1" />{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 min-w-[200px]">Area do Sistema</th>
                  {CARGOS.map((cargo) => (
                    <th key={cargo} className="text-center py-2 px-3 min-w-[100px]">
                      <Badge className={`text-[9px] ${CARGO_COLORS[cargo]}`}>{CARGO_LABELS[cargo]}</Badge>
                      <div className="mt-1">
                        <button onClick={() => toggleAll(cargo, (perms[cargo] || []).length < AREAS.length)}
                          className="text-[9px] text-muted-foreground hover:text-foreground">
                          {(perms[cargo] || []).length === AREAS.length ? "Desmarcar tudo" : "Marcar tudo"}
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {AREAS.map((area) => (
                  <tr key={area.key} className="border-b hover:bg-muted/20">
                    <td className="py-2 px-3 font-medium">{area.label}</td>
                    {CARGOS.map((cargo) => {
                      const checked = (perms[cargo] || []).includes(area.key);
                      const isLocked = cargo === "admin"; // admin sempre total
                      return (
                        <td key={cargo} className="text-center py-2 px-3">
                          <input type="checkbox" checked={isLocked ? true : checked} disabled={isLocked}
                            onChange={() => !isLocked && toggle(cargo, area.key)}
                            className="w-4 h-4 rounded" />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-[10px] text-muted-foreground">
        Admin sempre tem acesso total e não pode ser editado. Os demais cargos (Diretor, Head, Tráfego, Pleno, Junior, Desenvolvimento, Closer, SDR) são totalmente configuráveis.
        O mapeamento de cargo → chave usa o campo <code>employees.cargo</code>; cargos criados via /equipe com nomes diferentes caem no mais próximo (ex.: &quot;Gestor de Tráfego&quot; → trafego).
      </p>
    </div>
  );
}
