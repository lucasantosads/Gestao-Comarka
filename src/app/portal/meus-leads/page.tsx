"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { Search, ChevronDown, ChevronRight, Phone, Mail } from "lucide-react";

interface Lead {
  id: string; nome: string; etapa: string; telefone: string; email: string;
  valor_mensal: number; valor_total_projeto: number; canal_aquisicao: string;
  created_at: string; data_reuniao: string | null; area_atuacao: string;
}

const ETAPA_COLORS: Record<string, string> = {
  oportunidade: "bg-blue-500/15 text-blue-400",
  reuniao_agendada: "bg-yellow-500/15 text-yellow-400",
  reuniao_feita: "bg-orange-500/15 text-orange-400",
  proposta_enviada: "bg-purple-500/15 text-purple-400",
  follow_up: "bg-cyan-500/15 text-cyan-400",
  assinatura: "bg-emerald-500/15 text-emerald-400",
  comprou: "bg-green-500/15 text-green-400",
  desistiu: "bg-red-500/15 text-red-400",
};

const ETAPA_LABELS: Record<string, string> = {
  oportunidade: "Oportunidade", reuniao_agendada: "Reuniao Agendada", reuniao_feita: "Reuniao Feita",
  proposta_enviada: "Proposta", follow_up: "Follow Up", assinatura: "Assinatura",
  comprou: "Comprou", desistiu: "Desistiu",
};

export default function MeusLeadsPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroEtapa, setFiltroEtapa] = useState("todos");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.entityId) return;
    supabase.from("leads_crm")
      .select("id,nome,etapa,telefone,email,valor_mensal,valor_total_projeto,canal_aquisicao,created_at,data_reuniao,area_atuacao")
      .eq("closer_id", user.entityId)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setLeads((data || []) as Lead[]); setLoading(false); });
  }, [user]);

  if (loading) return <div className="h-64 flex items-center justify-center text-muted-foreground">Carregando...</div>;

  let filtered = leads;
  if (filtroEtapa !== "todos") filtered = filtered.filter((l) => l.etapa === filtroEtapa);
  if (busca) { const q = busca.toLowerCase(); filtered = filtered.filter((l) => l.nome?.toLowerCase().includes(q)); }

  const etapas = Array.from(new Set(leads.map((l) => l.etapa))).sort();
  const totalMrr = filtered.filter((l) => l.etapa === "comprou").reduce((s, l) => s + Number(l.valor_mensal || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Meus Leads</h1>
        <span className="text-xs text-muted-foreground">{filtered.length} leads</span>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="flex bg-muted rounded-lg p-0.5">
          <button onClick={() => setFiltroEtapa("todos")}
            className={`px-2.5 py-1 text-[10px] font-medium rounded-md ${filtroEtapa === "todos" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
            Todos ({leads.length})
          </button>
          {etapas.map((e) => (
            <button key={e} onClick={() => setFiltroEtapa(e)}
              className={`px-2.5 py-1 text-[10px] font-medium rounded-md ${filtroEtapa === e ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
              {ETAPA_LABELS[e] || e} ({leads.filter((l) => l.etapa === e).length})
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[120px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..."
            className="w-full pl-7 pr-3 py-1.5 text-xs bg-transparent border rounded-lg" />
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-3 pb-2 text-center"><p className="text-[10px] text-muted-foreground">Ativos</p><p className="text-lg font-bold">{leads.filter((l) => !["comprou","desistiu"].includes(l.etapa)).length}</p></CardContent></Card>
        <Card><CardContent className="pt-3 pb-2 text-center"><p className="text-[10px] text-muted-foreground">Fechados</p><p className="text-lg font-bold text-green-400">{leads.filter((l) => l.etapa === "comprou").length}</p></CardContent></Card>
        <Card><CardContent className="pt-3 pb-2 text-center"><p className="text-[10px] text-muted-foreground">MRR Fechado</p><p className="text-lg font-bold text-green-400">{formatCurrency(totalMrr)}</p></CardContent></Card>
      </div>

      {/* Lista */}
      <div className="space-y-1">
        {filtered.map((l) => {
          const isExp = expandedId === l.id;
          return (
            <div key={l.id} className="border rounded-lg">
              <button onClick={() => setExpandedId(isExp ? null : l.id)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  {isExp ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <span className="text-sm font-medium truncate">{l.nome || "Sem nome"}</span>
                  <Badge className={`text-[8px] ${ETAPA_COLORS[l.etapa] || "bg-muted"}`}>{ETAPA_LABELS[l.etapa] || l.etapa}</Badge>
                </div>
                <span className="text-xs text-muted-foreground font-mono shrink-0 ml-2">
                  {l.valor_mensal ? formatCurrency(l.valor_mensal) : "—"}
                </span>
              </button>
              {isExp && (
                <div className="px-4 pb-3 space-y-2 border-t bg-muted/5">
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                    {l.telefone && <span className="flex items-center gap-1"><Phone size={10} /> {l.telefone}</span>}
                    {l.email && <span className="flex items-center gap-1"><Mail size={10} /> {l.email}</span>}
                    {l.canal_aquisicao && <span>Canal: <strong>{l.canal_aquisicao}</strong></span>}
                    {l.area_atuacao && <span>Area: <strong>{l.area_atuacao}</strong></span>}
                    {l.data_reuniao && <span>Reuniao: <strong>{new Date(l.data_reuniao).toLocaleDateString("pt-BR")}</strong></span>}
                    {l.valor_total_projeto > 0 && <span>LTV: <strong>{formatCurrency(l.valor_total_projeto)}</strong></span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nenhum lead encontrado</p>}
      </div>
    </div>
  );
}
