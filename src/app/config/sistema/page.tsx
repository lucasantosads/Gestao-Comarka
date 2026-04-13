"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  RefreshCw, Activity, Shield, Database, AlertTriangle,
  CheckCircle, XCircle, Clock, Download, Play,
  Eye, EyeOff, Filter, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ============================================
// Types
// ============================================

interface IntegracaoStatus {
  id: string;
  nome: string;
  status: "online" | "degradado" | "offline" | "desconhecido";
  ultimo_ping_em: string | null;
  ultimo_ping_sucesso_em: string | null;
  latencia_ms: number | null;
  latencia_media_ms: number | null;
  mensagem_erro: string | null;
  atualizado_em: string;
}

interface FilaErro {
  id: string;
  origem: string;
  tipo_erro: string;
  mensagem: string;
  tentativas: number;
  max_tentativas: number;
  status: string;
  criado_em: string;
}

interface BackupRecord {
  id: string;
  status: string;
  tabelas_incluidas: string[];
  tamanho_bytes: number | null;
  google_drive_url: string | null;
  mensagem_erro: string | null;
  iniciado_em: string;
  concluido_em: string | null;
}

interface RateLimitLog {
  id: string;
  servico: string;
  chamadas_hora: number;
  limite_hora: number | null;
  pct_utilizado: number;
  data_hora: string;
}

interface AuditoriaLog {
  id: string;
  user_id: string | null;
  user_nome: string | null;
  acao: string;
  modulo: string;
  objeto_tipo: string | null;
  objeto_id: string | null;
  valor_anterior: Record<string, unknown> | null;
  valor_novo: Record<string, unknown> | null;
  criado_em: string;
}

// ============================================
// Helpers
// ============================================

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const mins = (Date.now() - new Date(iso).getTime()) / 60000;
  if (mins < 1) return "agora";
  if (mins < 60) return `${Math.round(mins)}min`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusColor(s: string) {
  if (s === "online" || s === "concluido" || s === "resolvido") return "bg-green-500/20 text-green-400";
  if (s === "degradado" || s === "processando") return "bg-yellow-500/20 text-yellow-400";
  if (s === "offline" || s === "falhou") return "bg-red-500/20 text-red-400";
  if (s === "pendente") return "bg-orange-500/20 text-orange-400";
  if (s === "ignorado") return "bg-muted text-muted-foreground";
  return "bg-muted text-muted-foreground";
}

function statusIcon(s: string) {
  if (s === "online" || s === "concluido" || s === "resolvido") return <CheckCircle size={14} className="text-green-400" />;
  if (s === "degradado" || s === "processando") return <Clock size={14} className="text-yellow-400" />;
  if (s === "offline" || s === "falhou") return <XCircle size={14} className="text-red-400" />;
  return <AlertTriangle size={14} className="text-muted-foreground" />;
}

// ============================================
// Tabs
// ============================================

type Tab = "saude" | "rate-limits" | "fila-erros" | "backups" | "auditoria";

export default function SistemaPage() {
  const [tab, setTab] = useState<Tab>("saude");
  const [errosPendentes, setErrosPendentes] = useState(0);

  // Polling para contagem de erros
  useEffect(() => {
    async function fetchCount() {
      const { count } = await supabase
        .from("sistema_fila_erros")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendente");
      setErrosPendentes(count || 0);
    }
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  const tabs: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "saude", label: "Integrações", icon: <Activity size={14} /> },
    { key: "rate-limits", label: "Rate Limits", icon: <Shield size={14} /> },
    { key: "fila-erros", label: "Fila de Erros", icon: <AlertTriangle size={14} />, badge: errosPendentes },
    { key: "backups", label: "Backups", icon: <Database size={14} /> },
    { key: "auditoria", label: "Auditoria", icon: <Eye size={14} /> },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold">Sistema</h1>

      {/* Tab nav */}
      <div className="flex bg-muted rounded-lg p-0.5 w-fit flex-wrap gap-0.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === t.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon} {t.label}
            {t.badge && t.badge > 0 ? (
              <span className="ml-1 bg-red-500 text-white text-[9px] rounded-full px-1.5 py-0.5 leading-none">{t.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "saude" && <PainelSaude />}
      {tab === "rate-limits" && <PainelRateLimits />}
      {tab === "fila-erros" && <PainelFilaErros onCountChange={setErrosPendentes} />}
      {tab === "backups" && <PainelBackups />}
      {tab === "auditoria" && <PainelAuditoria />}
    </div>
  );
}

// ============================================
// 9a. Painel de Saúde das Integrações
// ============================================

function PainelSaude() {
  const [integracoes, setIntegracoes] = useState<IntegracaoStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("sistema_integracao_status")
      .select("*")
      .order("nome");
    setIntegracoes((data || []) as IntegracaoStatus[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000); // refresh a cada 60s
    return () => clearInterval(interval);
  }, [load]);

  async function testIntegracao(nome: string) {
    setTesting(nome);
    try {
      const res = await fetch("/api/sistema/health-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servico: nome }),
      });
      if (res.ok) {
        toast.success(`${nome}: teste concluído`);
        await load();
      } else {
        toast.error(`Erro ao testar ${nome}`);
      }
    } catch {
      toast.error("Falha na requisição");
    }
    setTesting(null);
  }

  if (loading && integracoes.length === 0) {
    return <div className="h-40 bg-muted animate-pulse rounded-lg" />;
  }

  const ICON_MAP: Record<string, string> = {
    ghl: "📞", meta_ads: "📢", n8n: "⚡", asaas: "💰",
    evolution_api: "💬", supabase: "🗄️", tldv: "🎥",
    fathom: "🎙️", notion: "📝", google_drive: "📁",
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {integracoes.map((i) => (
        <Card key={i.id}>
          <CardContent className="pt-4 pb-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{ICON_MAP[i.nome] || "🔌"}</span>
                <span className="text-sm font-medium">{i.nome}</span>
              </div>
              <Badge className={`text-[10px] ${statusColor(i.status)}`}>
                {i.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
              <div>
                <p>Último ping</p>
                <p className="text-xs text-foreground">{formatDate(i.ultimo_ping_em)}</p>
              </div>
              <div>
                <p>Último sucesso</p>
                <p className="text-xs text-foreground">{formatDate(i.ultimo_ping_sucesso_em)}</p>
              </div>
              <div>
                <p>Latência</p>
                <p className="text-xs text-foreground">{i.latencia_ms !== null ? `${i.latencia_ms}ms` : "—"}</p>
              </div>
              <div>
                <p>Média</p>
                <p className="text-xs text-foreground">{i.latencia_media_ms !== null ? `${i.latencia_media_ms}ms` : "—"}</p>
              </div>
            </div>

            {i.mensagem_erro && (
              <p className="text-[10px] text-red-400 truncate" title={i.mensagem_erro}>
                {i.mensagem_erro}
              </p>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs h-7"
              onClick={() => testIntegracao(i.nome)}
              disabled={testing === i.nome}
            >
              {testing === i.nome ? (
                <RefreshCw size={12} className="mr-1 animate-spin" />
              ) : (
                <Play size={12} className="mr-1" />
              )}
              Testar agora
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================
// 9b. Painel de Rate Limits
// ============================================

function PainelRateLimits() {
  const [current, setCurrent] = useState<RateLimitLog | null>(null);
  const [history, setHistory] = useState<{ hora: string; chamadas: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Registro mais recente
      const { data: latest } = await supabase
        .from("sistema_rate_limit_log")
        .select("*")
        .eq("servico", "meta_ads")
        .order("data_hora", { ascending: false })
        .limit(1)
        .single();
      setCurrent(latest as RateLimitLog | null);

      // Histórico das últimas 24h
      const since = new Date(Date.now() - 24 * 3600000).toISOString();
      const { data: logs } = await supabase
        .from("sistema_rate_limit_log")
        .select("chamadas_hora, data_hora")
        .eq("servico", "meta_ads")
        .gte("data_hora", since)
        .order("data_hora", { ascending: true });

      setHistory(
        (logs || []).map((l) => ({
          hora: new Date(l.data_hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          chamadas: l.chamadas_hora || 0,
        }))
      );
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="h-40 bg-muted animate-pulse rounded-lg" />;

  const pct = current?.pct_utilizado || 0;
  const barColor = pct < 60 ? "bg-green-500" : pct < 80 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="space-y-4">
      {/* Card atual */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Meta Ads API — Hora Atual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>{current?.chamadas_hora || 0} / {current?.limite_hora || 200} chamadas</span>
            <span className={`font-mono ${pct >= 80 ? "text-red-400" : pct >= 60 ? "text-yellow-400" : "text-green-400"}`}>
              {pct.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
        </CardContent>
      </Card>

      {/* Gráfico 24h */}
      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Chamadas por hora — últimas 24h</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="hora" tick={{ fontSize: 10 }} stroke="#666" />
                <YAxis tick={{ fontSize: 10 }} stroke="#666" />
                <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333", fontSize: 12 }} />
                <Line type="monotone" dataKey="chamadas" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================
// 9c. Fila de Erros
// ============================================

function PainelFilaErros({ onCountChange }: { onCountChange: (n: number) => void }) {
  const [erros, setErros] = useState<FilaErro[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroOrigem, setFiltroOrigem] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("sistema_fila_erros")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(100);
    if (filtroOrigem) query = query.eq("origem", filtroOrigem);
    if (filtroStatus) query = query.eq("status", filtroStatus);
    const { data } = await query;
    const list = (data || []) as FilaErro[];
    setErros(list);
    onCountChange(list.filter((e) => e.status === "pendente").length);
    setLoading(false);
  }, [filtroOrigem, filtroStatus, onCountChange]);

  useEffect(() => { load(); }, [load]);

  async function reprocessar(id: string) {
    await supabase.from("sistema_fila_erros").update({ status: "pendente" }).eq("id", id);
    toast.success("Marcado para reprocessamento");
    load();
  }

  async function ignorar(id: string) {
    if (!confirm("Ignorar este erro?")) return;
    await supabase.from("sistema_fila_erros").update({ status: "ignorado" }).eq("id", id);
    toast.success("Erro ignorado");
    load();
  }

  async function reprocessarTodos() {
    if (!confirm("Reprocessar todos os erros pendentes?")) return;
    try {
      const res = await fetch("/api/sistema/reprocessar-fila", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Reprocessados: ${data.resolvidos} resolvidos, ${data.falhos} falharam`);
        load();
      }
    } catch {
      toast.error("Falha ao reprocessar");
    }
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-muted-foreground" />
        <select
          value={filtroOrigem}
          onChange={(e) => setFiltroOrigem(e.target.value)}
          className="text-xs bg-transparent border rounded px-2 py-1"
        >
          <option value="">Todas origens</option>
          {["webhook_ghl", "webhook_tldv", "webhook_fathom", "webhook_asaas", "n8n_sync", "meta_api", "evolution_api", "notion", "google_drive"].map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="text-xs bg-transparent border rounded px-2 py-1"
        >
          <option value="">Todos status</option>
          {["pendente", "processando", "resolvido", "ignorado", "falhou"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={load} className="text-xs h-7">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </Button>
        <Button variant="outline" size="sm" onClick={reprocessarTodos} className="text-xs h-7 ml-auto">
          <Play size={12} className="mr-1" /> Reprocessar todos
        </Button>
      </div>

      {loading && erros.length === 0 ? (
        <div className="h-40 bg-muted animate-pulse rounded-lg" />
      ) : erros.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <CheckCircle size={40} className="text-green-500" />
            <p className="text-sm text-muted-foreground">Nenhum erro encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {erros.map((e) => (
            <Card key={e.id}>
              <CardContent className="py-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {statusIcon(e.status)}
                      <Badge variant="outline" className="text-[9px]">{e.origem}</Badge>
                      <Badge className={`text-[9px] ${statusColor(e.status)}`}>{e.status}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {e.tentativas}/{e.max_tentativas} tentativas
                      </span>
                    </div>
                    <p className="text-xs text-red-400 break-all">{e.mensagem}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {e.tipo_erro} — {formatDate(e.criado_em)} ({timeAgo(e.criado_em)})
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {e.status !== "resolvido" && e.status !== "ignorado" && (
                      <>
                        <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={() => reprocessar(e.id)}>
                          Reprocessar
                        </Button>
                        <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2 text-muted-foreground" onClick={() => ignorar(e.id)}>
                          Ignorar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// 9d. Backups
// ============================================

function PainelBackups() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("sistema_backups")
        .select("*")
        .order("iniciado_em", { ascending: false })
        .limit(30);
      setBackups((data || []) as BackupRecord[]);
      setLoading(false);
    }
    load();
  }, []);

  async function fazerBackup() {
    setRunning(true);
    try {
      const res = await fetch("/api/sistema/backup", { method: "POST" });
      if (res.ok) {
        toast.success("Backup iniciado!");
        // Reload after a moment
        setTimeout(async () => {
          const { data } = await supabase
            .from("sistema_backups")
            .select("*")
            .order("iniciado_em", { ascending: false })
            .limit(30);
          setBackups((data || []) as BackupRecord[]);
        }, 3000);
      } else {
        toast.error("Erro ao iniciar backup");
      }
    } catch {
      toast.error("Falha na requisição");
    }
    setRunning(false);
  }

  const ultimo = backups[0];
  const ultimoHoras = ultimo ? (Date.now() - new Date(ultimo.iniciado_em).getTime()) / 3600000 : 999;
  const alertaBackup = ultimoHoras > 25;

  if (loading) return <div className="h-40 bg-muted animate-pulse rounded-lg" />;

  return (
    <div className="space-y-4">
      {/* Status do último backup */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {ultimo ? (
            <Badge className={alertaBackup ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}>
              {alertaBackup ? "Backup atrasado!" : `Último backup: ${formatDate(ultimo.iniciado_em)}`}
            </Badge>
          ) : (
            <Badge className="bg-muted text-muted-foreground">Nenhum backup</Badge>
          )}
        </div>
        <Button size="sm" onClick={fazerBackup} disabled={running} className="text-xs">
          {running ? <RefreshCw size={12} className="mr-1 animate-spin" /> : <Database size={12} className="mr-1" />}
          Fazer backup agora
        </Button>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {backups.map((b) => (
          <Card key={b.id}>
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {statusIcon(b.status)}
                  <div>
                    <p className="text-xs font-medium">{formatDate(b.iniciado_em)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {b.tabelas_incluidas?.length || 0} tabelas — {formatBytes(b.tamanho_bytes)}
                      {b.concluido_em && b.iniciado_em && (
                        <> — {Math.round((new Date(b.concluido_em).getTime() - new Date(b.iniciado_em).getTime()) / 1000)}s</>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`text-[9px] ${statusColor(b.status)}`}>{b.status}</Badge>
                  {b.google_drive_url && (
                    <a href={b.google_drive_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="h-6 px-2">
                        <Download size={12} />
                      </Button>
                    </a>
                  )}
                </div>
              </div>
              {b.mensagem_erro && (
                <p className="text-[10px] text-red-400 mt-1">{b.mensagem_erro}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================
// 9e. Log de Auditoria
// ============================================

function PainelAuditoria() {
  const [logs, setLogs] = useState<AuditoriaLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroModulo, setFiltroModulo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let query = supabase
        .from("sistema_auditoria")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(100);
      if (filtroModulo) query = query.eq("modulo", filtroModulo);
      const { data } = await query;
      setLogs((data || []) as AuditoriaLog[]);
      setLoading(false);
    }
    load();
  }, [filtroModulo]);

  function exportCSV() {
    const header = "usuario,acao,modulo,objeto_tipo,objeto_id,criado_em\n";
    const rows = logs.map((l) =>
      `"${l.user_nome || ""}","${l.acao}","${l.modulo}","${l.objeto_tipo || ""}","${l.objeto_id || ""}","${l.criado_em}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="h-40 bg-muted animate-pulse rounded-lg" />;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-muted-foreground" />
        <select
          value={filtroModulo}
          onChange={(e) => setFiltroModulo(e.target.value)}
          className="text-xs bg-transparent border rounded px-2 py-1"
        >
          <option value="">Todos módulos</option>
          {["trafego", "financeiro", "crm", "closers", "clientes", "projecoes", "comarka_pro", "config", "portal"].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={exportCSV} className="text-xs h-7 ml-auto">
          <Download size={12} className="mr-1" /> Exportar CSV
        </Button>
      </div>

      {/* Lista */}
      {logs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Eye size={40} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum registro de auditoria</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {logs.map((l) => (
            <Card key={l.id}>
              <CardContent className="py-2.5">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedId(expandedId === l.id ? null : l.id)}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Badge variant="outline" className="text-[9px] shrink-0">{l.acao}</Badge>
                    <Badge className={`text-[9px] shrink-0 ${statusColor(l.modulo === "config" ? "degradado" : "online")}`}>
                      {l.modulo}
                    </Badge>
                    <span className="text-xs truncate">
                      {l.user_nome || "sistema"} — {l.objeto_tipo || ""} {l.objeto_id ? `#${l.objeto_id.slice(0, 8)}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground">{formatDate(l.criado_em)}</span>
                    {(l.valor_anterior || l.valor_novo) ? (
                      expandedId === l.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    ) : null}
                  </div>
                </div>

                {expandedId === l.id && (l.valor_anterior || l.valor_novo) && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-red-500/5 border border-red-500/10 rounded p-2 overflow-auto max-h-40">
                      <p className="font-medium text-red-400 mb-1">Anterior</p>
                      <pre className="whitespace-pre-wrap text-muted-foreground">
                        {JSON.stringify(l.valor_anterior, null, 2) || "null"}
                      </pre>
                    </div>
                    <div className="bg-green-500/5 border border-green-500/10 rounded p-2 overflow-auto max-h-40">
                      <p className="font-medium text-green-400 mb-1">Novo</p>
                      <pre className="whitespace-pre-wrap text-muted-foreground">
                        {JSON.stringify(l.valor_novo, null, 2) || "null"}
                      </pre>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
