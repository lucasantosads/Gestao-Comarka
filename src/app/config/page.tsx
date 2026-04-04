"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { hashPassword } from "@/lib/auth";
import type { Closer, Sdr, ConfigMensal } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { MonthSelector } from "@/components/month-selector";
import { getCurrentMonth } from "@/lib/format";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { AI_CONFIG, AI_LABELS, AI_FUNCTION_LABELS, ALL_PROVIDERS, type AIFunction } from "@/lib/ai-config";
import type { AIProvider } from "@/lib/ai-client";
import { RefreshCw } from "lucide-react";

interface AIStatus { provider: string; status: "ok" | "sem_creditos" | "erro" | "sem_chave"; mensagem: string; latencia?: number }
import { Save, Plus, Trash2, Eye, EyeOff } from "lucide-react";

export default function ConfigPage() {
  const [mes, setMes] = useState(getCurrentMonth);
  const [config, setConfig] = useState<ConfigMensal | null>(null);
  const [leads, setLeads] = useState(0);
  const [investimento, setInvestimento] = useState(0);

  // AI Status
  const [aiStatus, setAiStatus] = useState<AIStatus[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  async function checkAI() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai-status");
      const data = await res.json();
      setAiStatus(data.providers || []);
    } catch { setAiStatus([]); }
    setAiLoading(false);
  }

  // Closers
  const [closers, setClosers] = useState<Closer[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [novoUsuario, setNovoUsuario] = useState("");
  const [novoSenha, setNovoSenha] = useState("");
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [editSenhas, setEditSenhas] = useState<Record<string, string>>({});

  // SDRs
  const [sdrs, setSdrs] = useState<Sdr[]>([]);
  const [novoSdrNome, setNovoSdrNome] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
    loadClosers();
    loadSdrs();
  }, [mes]);

  async function loadConfig() {
    const { data } = await supabase.from("config_mensal").select("*").eq("mes_referencia", mes).single();
    if (data) {
      setConfig(data);
      setLeads(data.leads_totais);
      setInvestimento(Number(data.investimento));
    } else {
      setConfig(null);
      setLeads(0);
      setInvestimento(0);
    }
  }

  async function loadClosers() {
    const { data } = await supabase.from("closers").select("*").order("created_at");
    if (data) setClosers(data);
  }

  async function loadSdrs() {
    const { data } = await supabase.from("sdrs").select("*").order("created_at");
    if (data) setSdrs(data);
  }

  async function saveConfig() {
    setSaving(true);
    const payload = { mes_referencia: mes, leads_totais: leads, investimento };
    if (config) {
      const { error } = await supabase.from("config_mensal").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", config.id);
      if (error) toast.error("Erro: " + error.message);
      else toast.success("Configuração atualizada!");
    } else {
      const { error } = await supabase.from("config_mensal").insert(payload);
      if (error) toast.error("Erro: " + error.message);
      else { toast.success("Configuração criada!"); loadConfig(); }
    }
    setSaving(false);
  }

  // ===== CLOSER CRUD =====
  async function addCloser() {
    if (!novoNome.trim() || !novoUsuario.trim() || !novoSenha.trim()) {
      toast.error("Preencha nome, usuario e senha");
      return;
    }
    const senha_hash = await hashPassword(novoSenha);
    const { error } = await supabase.from("closers").insert({
      nome: novoNome.trim(),
      usuario: novoUsuario.trim().toLowerCase(),
      senha_hash,
      ativo: true,
    });
    if (error) {
      if (error.message.includes("duplicate")) toast.error("Usuario ja existe");
      else toast.error("Erro: " + error.message);
    } else {
      toast.success("Closer adicionado!");
      setNovoNome(""); setNovoUsuario(""); setNovoSenha("");
      loadClosers();
    }
  }

  async function deleteCloser(id: string, nome: string) {
    if (!confirm(`Remover ${nome}? Todos os lançamentos serão excluídos.`)) return;
    const { error } = await supabase.from("closers").delete().eq("id", id);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Closer removido!"); loadClosers(); }
  }

  async function updateCloserName(id: string, nome: string) {
    await supabase.from("closers").update({ nome }).eq("id", id);
  }

  async function updateCloserUsuario(id: string, usuario: string) {
    const { error } = await supabase.from("closers").update({ usuario: usuario.trim().toLowerCase() }).eq("id", id);
    if (error) {
      if (error.message.includes("duplicate")) toast.error("Usuario ja existe");
      else toast.error("Erro: " + error.message);
    }
  }

  async function updateCloserSenha(id: string) {
    const novaSenha = editSenhas[id];
    if (!novaSenha?.trim()) return;
    const senha_hash = await hashPassword(novaSenha);
    const { error } = await supabase.from("closers").update({ senha_hash }).eq("id", id);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Senha atualizada!"); setEditSenhas((prev) => ({ ...prev, [id]: "" })); }
  }

  async function toggleCloser(id: string, ativo: boolean) {
    await supabase.from("closers").update({ ativo: !ativo }).eq("id", id);
    loadClosers();
  }

  // ===== SDR CRUD =====
  async function addSdr() {
    if (!novoSdrNome.trim()) { toast.error("Preencha o nome do SDR"); return; }
    const { error } = await supabase.from("sdrs").insert({ nome: novoSdrNome.trim(), ativo: true });
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("SDR adicionado!"); setNovoSdrNome(""); loadSdrs(); }
  }

  async function deleteSdr(id: string, nome: string) {
    if (!confirm(`Remover ${nome}? Todos os lançamentos do SDR serão excluídos.`)) return;
    const { error } = await supabase.from("sdrs").delete().eq("id", id);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("SDR removido!"); loadSdrs(); }
  }

  async function updateSdrName(id: string, nome: string) {
    await supabase.from("sdrs").update({ nome }).eq("id", id);
  }

  async function toggleSdr(id: string, ativo: boolean) {
    await supabase.from("sdrs").update({ ativo: !ativo }).eq("id", id);
    loadSdrs();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Configuracoes</h1>

      {/* Config Mensal */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Configuracao do Mes</CardTitle>
          <MonthSelector value={mes} onChange={setMes} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Leads Totais</Label>
              <Input type="number" min={0} value={leads} onChange={(e) => setLeads(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Investimento em Anuncios (R$)</Label>
              <Input type="number" min={0} step={0.01} value={investimento} onChange={(e) => setInvestimento(Number(e.target.value))} />
            </div>
          </div>
          <Button onClick={saveConfig} disabled={saving} className="w-full">
            <Save size={16} className="mr-2" />
            {saving ? "Salvando..." : "Salvar Configuração"}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Closers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Closers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {closers.map((c) => (
            <div key={c.id} className="space-y-2 p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Input defaultValue={c.nome} onBlur={(e) => updateCloserName(c.id, e.target.value)} className="flex-1" placeholder="Nome" />
                <Button variant={c.ativo ? "default" : "outline"} size="sm" onClick={() => toggleCloser(c.id, c.ativo)}>
                  {c.ativo ? "Ativo" : "Inativo"}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => deleteCloser(c.id, c.nome)}>
                  <Trash2 size={14} />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Input defaultValue={c.usuario || ""} onBlur={(e) => updateCloserUsuario(c.id, e.target.value)} className="flex-1" placeholder="Usuario (login)" />
                <div className="flex items-center gap-1 flex-1">
                  <Input
                    type={showPasswords[c.id] ? "text" : "password"}
                    placeholder="Nova senha"
                    value={editSenhas[c.id] || ""}
                    onChange={(e) => setEditSenhas((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && updateCloserSenha(c.id)}
                  />
                  <Button variant="ghost" size="sm" onClick={() => setShowPasswords((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}>
                    {showPasswords[c.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={() => updateCloserSenha(c.id)} disabled={!editSenhas[c.id]?.trim()}>
                  Salvar
                </Button>
              </div>
            </div>
          ))}

          <Separator />

          <div className="space-y-2 p-3 border border-dashed rounded-lg">
            <p className="text-sm font-medium text-muted-foreground">Novo Closer</p>
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Nome" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
              <Input placeholder="Usuario (login)" value={novoUsuario} onChange={(e) => setNovoUsuario(e.target.value)} />
              <Input type="password" placeholder="Senha" value={novoSenha} onChange={(e) => setNovoSenha(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCloser()} />
            </div>
            <Button onClick={addCloser} size="sm" className="w-full">
              <Plus size={16} className="mr-1" />
              Adicionar Closer
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* SDRs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">SDRs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sdrs.map((s) => (
            <div key={s.id} className="flex items-center gap-2 p-3 border rounded-lg">
              <Input defaultValue={s.nome} onBlur={(e) => updateSdrName(s.id, e.target.value)} className="flex-1" placeholder="Nome" />
              <Button variant={s.ativo ? "default" : "outline"} size="sm" onClick={() => toggleSdr(s.id, s.ativo)}>
                {s.ativo ? "Ativo" : "Inativo"}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => deleteSdr(s.id, s.nome)}>
                <Trash2 size={14} />
              </Button>
            </div>
          ))}

          <Separator />

          <div className="space-y-2 p-3 border border-dashed rounded-lg">
            <p className="text-sm font-medium text-muted-foreground">Novo SDR</p>
            <div className="flex items-center gap-2">
              <Input placeholder="Nome do SDR" value={novoSdrNome} onChange={(e) => setNovoSdrNome(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSdr()} className="flex-1" />
              <Button onClick={addSdr} size="sm">
                <Plus size={16} className="mr-1" />
                Adicionar SDR
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Seção de IA */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">🤖 Inteligência Artificial</CardTitle>
            <Button variant="outline" size="sm" onClick={checkAI} disabled={aiLoading}>
              <RefreshCw size={12} className={`mr-1 ${aiLoading ? "animate-spin" : ""}`} />
              {aiLoading ? "Verificando..." : "Verificar Status"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status das APIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { key: "anthropic", nome: "Anthropic (Claude)", link: "https://console.anthropic.com/settings/billing", modelos: "Haiku, Sonnet" },
              { key: "gemini", nome: "Google (Gemini)", link: "https://aistudio.google.com/apikey", modelos: "Flash (free tier)" },
              { key: "openai", nome: "OpenAI (GPT)", link: "https://platform.openai.com/settings/organization/billing/overview", modelos: "4o Mini, 4o" },
            ].map((p) => {
              const st = aiStatus.find((s) => s.provider === p.key);
              const statusColor = !st ? "bg-muted text-muted-foreground" : st.status === "ok" ? "bg-green-500/20 text-green-400" : st.status === "sem_creditos" ? "bg-red-500/20 text-red-400" : st.status === "sem_chave" ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400";
              const statusLabel = !st ? "Não verificado" : st.status === "ok" ? "Ativo" : st.status === "sem_creditos" ? "Sem créditos" : st.status === "sem_chave" ? "Sem chave" : "Erro";
              return (
                <div key={p.key} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{p.nome}</p>
                    <Badge className={`text-[10px] ${statusColor}`}>{statusLabel}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Modelos: {p.modelos}</p>
                  {st?.latencia && <p className="text-[10px] text-muted-foreground">Latência: {st.latencia}ms</p>}
                  {st?.status === "sem_creditos" && <p className="text-[10px] text-red-400">{st.mensagem}</p>}
                  <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline block">
                    Gerenciar billing →
                  </a>
                </div>
              );
            })}
          </div>

          {/* Custo estimado */}
          <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Custo estimado por análise:</p>
            {ALL_PROVIDERS.map((p) => (
              <p key={p}>{AI_LABELS[p].nome}: <strong>{AI_LABELS[p].custoEstimado}</strong></p>
            ))}
          </div>

          {(Object.keys(AI_CONFIG) as AIFunction[]).map((fn) => {
            const savedKey = `ai_provider_${fn}`;
            const currentProvider = (typeof window !== "undefined" ? localStorage.getItem(savedKey) : null) || AI_CONFIG[fn];
            return (
              <div key={fn} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">{AI_FUNCTION_LABELS[fn]}</p>
                  <p className="text-[10px] text-muted-foreground">Padrão: {AI_LABELS[AI_CONFIG[fn]].nome}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    defaultValue={currentProvider}
                    onChange={(e) => {
                      localStorage.setItem(savedKey, e.target.value);
                      toast.success(`${AI_FUNCTION_LABELS[fn]}: ${AI_LABELS[e.target.value as AIProvider].nome}`);
                    }}
                    className="text-xs bg-transparent border rounded-lg px-3 py-1.5"
                  >
                    {ALL_PROVIDERS.map((p) => (
                      <option key={p} value={p}>{AI_LABELS[p].nome} ({AI_LABELS[p].custo})</option>
                    ))}
                  </select>
                  <Badge variant="outline" className="text-[10px]">
                    {AI_LABELS[currentProvider as AIProvider]?.custo || "—"}
                  </Badge>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Seção de Alertas de Tráfego */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">⚠️ Thresholds de Alertas (Tráfego Pago)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: "trafego_cpl_limite", label: "CPL Máximo (R$)", defaultVal: "100", desc: "Alerta quando CPL ultrapassa este valor", step: "1" },
            { key: "trafego_ctr_minimo", label: "CTR Mínimo (%)", defaultVal: "0.8", desc: "Alerta quando CTR fica abaixo (últimos 3 dias)", step: "0.1" },
            { key: "trafego_freq_maxima", label: "Frequência Máxima (x)", defaultVal: "3", desc: "Alerta quando audiência saturada (últimos 7 dias)", step: "0.5" },
            { key: "trafego_zero_horas", label: "Zero Leads — Horas", defaultVal: "48", desc: "Período sem leads para disparar alerta", step: "12" },
            { key: "trafego_zero_gasto", label: "Zero Leads — Gasto mínimo (R$)", defaultVal: "50", desc: "Gasto mínimo para considerar alerta de zero leads", step: "10" },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
              <input
                type="number"
                step={item.step}
                defaultValue={typeof window !== "undefined" ? localStorage.getItem(item.key) || item.defaultVal : item.defaultVal}
                onChange={(e) => { localStorage.setItem(item.key, e.target.value); toast.success("Threshold atualizado"); }}
                className="w-20 text-sm bg-transparent border rounded px-2 py-1 text-right"
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
