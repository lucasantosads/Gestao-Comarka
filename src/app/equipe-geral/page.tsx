"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Briefcase, ShoppingBag, Heart, Megaphone, FileText, Crown, ExternalLink, Activity } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TeamMember } from "@/lib/data";

interface Setor { key: string; label: string; icon: React.ElementType; color: string; cargos: string[] }

const SETORES: Setor[] = [
  { key: "diretoria", label: "Diretoria", icon: Crown, color: "text-amber-400 border-amber-500/20 bg-amber-500/5", cargos: [] },
  { key: "comercial", label: "Comercial (Closer / SDR)", icon: Briefcase, color: "text-blue-400 border-blue-500/20 bg-blue-500/5", cargos: [] },
  { key: "marketing", label: "Marketing / Conteúdo", icon: Megaphone, color: "text-pink-400 border-pink-500/20 bg-pink-500/5", cargos: [] },
  { key: "operacional", label: "Operações (Tráfego / Dev)", icon: ShoppingBag, color: "text-indigo-400 border-indigo-500/20 bg-indigo-500/5", cargos: [] },
  { key: "sucesso", label: "Sucesso do Cliente (CS)", icon: Heart, color: "text-purple-400 border-purple-500/20 bg-purple-500/5", cargos: [] },
  { key: "administrativo", label: "Administrativo & Financeiro", icon: FileText, color: "text-slate-400 border-slate-500/20 bg-slate-500/5", cargos: [] },
];

const NIVEL_COLORS: Record<string, string> = {
  "Diretor": "bg-amber-500/10 text-amber-500 border border-amber-500/20",
  "Head": "bg-orange-500/10 text-orange-500 border border-orange-500/20",
  "Pleno": "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
  "Junior": "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
  "Closer": "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  "SDR": "bg-teal-500/10 text-teal-400 border border-teal-500/20",
};

function classifyMember(cargo: string): string | null {
  const c = (cargo || "").toLowerCase();
  if (c.includes("diretor") || c.includes("ceo")) return "diretoria";
  if (c.includes("closer") || c.includes("sdr") || c.includes("comercial") || c.includes("venda")) return "comercial";
  if (c.includes("sm") || c.includes("edicao") || c.includes("edição") || c.includes("mkt") || c.includes("marketing") || c.includes("social")) return "marketing";
  if (c.includes("head") || c.includes("pleno") || c.includes("junior") || c.includes("trafego") || c.includes("tráfego") || c.includes("desenvolv")) return "operacional";
  if (c.includes("sucesso") || c.includes("cs ")) return "sucesso";
  if (c.includes("adm") || c.includes("financeiro")) return "administrativo";
  return null;
}

function getNivel(cargo: string): string {
  const c = (cargo || "").toLowerCase();
  if (c.includes("diretor") || c.includes("ceo")) return "Diretor";
  if (c.includes("head")) return "Head";
  if (c.includes("pleno")) return "Pleno";
  if (c.includes("junior")) return "Junior";
  if (c.includes("closer")) return "Closer";
  if (c.includes("sdr")) return "SDR";
  return "—";
}

const NIVEL_ORDER = ["Diretor", "Head", "Pleno", "Junior", "Closer", "SDR", "—"];

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function EquipeGeralPage() {
  const router = useRouter();
  const { data: teamRaw, isLoading: loading } = useSWR<TeamMember[]>("/api/notion/team", fetcher, { revalidateOnFocus: false, dedupingInterval: 60000 });
  const team = Array.isArray(teamRaw) ? teamRaw : [];

  const grupos = useMemo(() => {
    const maps: Record<string, Record<string, TeamMember[]>> = {};
    for (const setor of SETORES) maps[setor.key] = {};
    for (const m of team) {
      const setor = classifyMember(m.cargo);
      if (!setor) continue;
      const nivel = getNivel(m.cargo);
      if (!maps[setor][nivel]) maps[setor][nivel] = [];
      maps[setor][nivel].push(m);
    }
    return maps;
  }, [team]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
      <p className="text-muted-foreground animate-pulse text-sm">Validando organograma corporativo...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex items-center gap-3 border-b border-border/50 pb-4">
        <div className="w-1.5 h-7 bg-primary rounded-full"></div>
        <h1 className="text-3xl font-black tracking-tight" style={{ letterSpacing: "-0.04em" }}>Organograma da Agência</h1>
        <Badge className="ml-2 bg-primary/10 text-primary pointer-events-none">{team.length} Colaboradores</Badge>
      </div>

      <div className="space-y-12">
        {SETORES.map((setor) => {
          const niveisDoSetor = grupos[setor.key];
          const total = Object.values(niveisDoSetor).reduce((s, arr) => s + arr.length, 0);
          if (total === 0) return null;
          const Icon = setor.icon;

          return (
            <div key={setor.key} className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={`flex items-center justify-center w-12 h-12 rounded-2xl border ${setor.color} shadow-sm backdrop-blur`}>
                  <Icon size={20} className="opacity-90" />
                </div>
                <div className="flex flex-col">
                  <h2 className="text-lg font-bold tracking-tight uppercase" style={{ letterSpacing: "0.02em" }}>{setor.label}</h2>
                  <p className="text-xs text-muted-foreground font-medium">{total} membro{total !== 1 ? "s" : ""} alocado{total !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex-1 border-b border-border/30 ml-4 hidden md:block"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 xl:gap-6 pl-0 md:pl-16">
                {NIVEL_ORDER.filter((n) => niveisDoSetor[n] && niveisDoSetor[n].length > 0).map((nivel) => (
                  <div key={nivel} className="col-span-1 md:col-span-2 xl:col-span-3 space-y-3 mt-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 bg-muted/40 px-3 py-1 rounded-full">{nivel}</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {niveisDoSetor[nivel].map((m) => {
                        const isTraffic = m.cargo?.toLowerCase().includes("tráfego") || m.cargo?.toLowerCase().includes("trafego");
                        const isCommercial = m.cargo?.toLowerCase().includes("closer") || m.cargo?.toLowerCase().includes("sdr");

                        return (
                          <Link key={m.notion_id} href={`/dashboard/team/${m.notion_id}`} className="group block focus:outline-none focus:ring-2 focus:ring-primary/50 focus:rounded-2xl">
                            <Card className="h-full border-border/40 bg-card/40 backdrop-blur hover:bg-muted/10 hover:border-primary/30 transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer overflow-hidden rounded-2xl">
                              <CardContent className="p-4 flex flex-col gap-4 relative h-full">
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                                <div className="flex items-center gap-3 z-10 w-full">
                                  <div className="w-12 h-12 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300 bg-black/40">
                                    <Users size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-bold truncate group-hover:text-primary transition-colors duration-200">{m.nome}</h3>
                                    <div className="flex flex-wrap items-center mt-1 gap-1">
                                      <Badge className={`text-[9px] px-1.5 py-0 font-medium ${NIVEL_COLORS[nivel] || "bg-muted text-muted-foreground border-transparent"}`}>{m.cargo || "Não definido"}</Badge>
                                    </div>
                                  </div>
                                </div>

                                {(isTraffic || isCommercial) && (
                                  <div className="mt-auto pt-3 border-t border-border/30 flex items-center justify-between text-[10px] z-10">
                                    <span className="text-muted-foreground flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                      <Activity size={10} /> Analytics
                                    </span>
                                    <div className="flex gap-2">
                                      {isTraffic && (
                                        <span className="flex items-center gap-1 text-indigo-400 font-medium bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 group-hover:bg-indigo-500/20 transition-colors cursor-pointer" onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push("/trafego/visao-geral"); }}>
                                          Ver Ads <ExternalLink size={10} />
                                        </span>
                                      )}
                                      {isCommercial && (
                                        <span className="flex items-center gap-1 text-blue-400 font-medium bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors cursor-pointer" onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push("/crm"); }}>
                                          Ver Pipe <ExternalLink size={10} />
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
