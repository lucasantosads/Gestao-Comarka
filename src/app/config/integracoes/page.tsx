"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Eye, EyeOff, CheckCircle, XCircle, Copy } from "lucide-react";

interface ConfigField {
  key: string;
  label: string;
  placeholder: string;
  description: string;
  secret?: boolean;
}

interface ConfigGroup {
  title: string;
  description: string;
  icon: string;
  fields: ConfigField[];
}

const CONFIG_GROUPS: ConfigGroup[] = [
  {
    title: "Supabase",
    description: "Banco de dados e autenticação",
    icon: "🗄️",
    fields: [
      { key: "NEXT_PUBLIC_SUPABASE_URL", label: "Supabase URL", placeholder: "https://xxxxx.supabase.co", description: "URL do projeto Supabase" },
      { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", label: "Anon Key", placeholder: "eyJhbG...", description: "Chave pública (anon) do Supabase", secret: true },
      { key: "SUPABASE_SERVICE_ROLE_KEY", label: "Service Role Key", placeholder: "eyJhbG...", description: "Chave privada (service_role) — NÃO expor no frontend", secret: true },
    ],
  },
  {
    title: "GoHighLevel (GHL)",
    description: "CRM e pipelines dos closers",
    icon: "📞",
    fields: [
      { key: "GHL_API_KEY", label: "API Key", placeholder: "pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", description: "Private Integration Token do GHL", secret: true },
      { key: "GHL_LOCATION_ID", label: "Location ID (Subconta)", placeholder: "DlN4Ua95aZZCaR8qA5Nh", description: "ID da subconta do GHL" },
      { key: "GHL_PIPELINE_LUCAS", label: "Pipeline ID — Lucas", placeholder: "ZjrMXF5XMBSCZOorLeu8", description: "ID do pipeline Closer - Lucas" },
      { key: "GHL_PIPELINE_MARIANA", label: "Pipeline ID — Mariana", placeholder: "ENg4tFVzJsUh8rHRntAX", description: "ID do pipeline Closer - Mariana" },
      { key: "GHL_PIPELINE_ROGERIO", label: "Pipeline ID — Rogério", placeholder: "8B7pjhZ4jv0e4u3JjtsR", description: "ID do pipeline Closer - Rogério" },
    ],
  },
  {
    title: "n8n",
    description: "Automação de workflows",
    icon: "⚡",
    fields: [
      { key: "N8N_BASE_URL", label: "URL da instância n8n", placeholder: "https://comarka.app.n8n.cloud", description: "URL base do n8n" },
      { key: "N8N_WEBHOOK_URL", label: "Webhook URL (GHL → CRM)", placeholder: "https://comarka.app.n8n.cloud/webhook/ghl-crm-webhook", description: "URL do webhook que recebe dados do GHL" },
      { key: "N8N_WORKFLOW_ID", label: "Workflow ID (GHL → CRM)", placeholder: "oCXivVCoIkTIrZT1", description: "ID do workflow principal" },
    ],
  },
  {
    title: "Notion",
    description: "Migração de dados do CRM Notion",
    icon: "📝",
    fields: [
      { key: "NOTION_API_KEY", label: "Notion API Key", placeholder: "ntn_xxxxx...", description: "Internal Integration Token do Notion", secret: true },
      { key: "NOTION_DATABASE_ID", label: "Database ID (CRM GERAL)", placeholder: "135b5b1a-3b98-8080-ae82-fe4635169a02", description: "ID do database CRM GERAL no Notion" },
    ],
  },
  {
    title: "Meta Ads",
    description: "API do Meta/Facebook para dados de anúncios",
    icon: "📢",
    fields: [
      { key: "META_ADS_ACCESS_TOKEN", label: "Access Token", placeholder: "EAAbqDI...", description: "Token de longa duração da Meta Ads API", secret: true },
      { key: "META_ADS_ACCOUNT_ID", label: "Account ID", placeholder: "act_2851365261838044", description: "ID da conta de anúncios (formato: act_XXXXXXX)" },
      { key: "META_APP_ID", label: "App ID (opcional)", placeholder: "123456789", description: "ID do App no Facebook Developers" },
      { key: "META_APP_SECRET", label: "App Secret (opcional)", placeholder: "xxxxxxxx", description: "Secret do App — necessário para renovar token", secret: true },
    ],
  },
  {
    title: "Instagram Intelligence",
    description: "Dados de performance do Instagram da marca",
    icon: "📸",
    fields: [
      { key: "IG_ACCOUNT_ID", label: "Instagram Account ID", placeholder: "17841446462623647", description: "ID da conta profissional do Instagram" },
      { key: "IG_ACCESS_TOKEN", label: "Access Token", placeholder: "EAAbqDI...", description: "Token de acesso para Instagram Graph API (pode ser o mesmo do Meta Ads)", secret: true },
    ],
  },
  {
    title: "Asaas",
    description: "Gateway de pagamentos — cobranças, boletos, PIX e cartão",
    icon: "💳",
    fields: [
      { key: "ASAAS_API_KEY", label: "API Key", placeholder: "$aact_xxxxxxxx...", description: "Chave de acesso à API Asaas (Minha Conta → Integrações → API)", secret: true },
      { key: "ASAAS_ENVIRONMENT", label: "Ambiente", placeholder: "production", description: "production ou sandbox — usar sandbox para testes" },
      { key: "ASAAS_WEBHOOK_TOKEN", label: "Webhook Token (opcional)", placeholder: "whk_xxxxxxxx", description: "Token para validar webhooks recebidos do Asaas", secret: true },
      { key: "ADMIN_WHATSAPP", label: "WhatsApp Admin (alertas)", placeholder: "5511999998888", description: "Número do admin para receber alertas de cobranças (código país + DDD + número)" },
    ],
  },
  {
    title: "WhatsApp / Evolution API",
    description: "Envio de mensagens automáticas via WhatsApp",
    icon: "💬",
    fields: [
      { key: "EVOLUTION_API_URL", label: "URL da Evolution API", placeholder: "https://api.evolution.comarka.ads", description: "URL base da instância Evolution API" },
      { key: "EVOLUTION_API_KEY", label: "API Key", placeholder: "xxxxxxxx", description: "Chave de autenticação da Evolution API", secret: true },
      { key: "EVOLUTION_INSTANCE", label: "Nome da Instância", placeholder: "comarka-main", description: "Nome da instância WhatsApp conectada" },
    ],
  },
  {
    title: "Supabase Management API",
    description: "Para administrar o projeto Supabase remotamente",
    icon: "🔧",
    fields: [
      { key: "SUPABASE_ACCESS_TOKEN", label: "Access Token", placeholder: "sbp_xxxxx...", description: "Token de acesso da conta Supabase (Settings → Access Tokens)", secret: true },
      { key: "SUPABASE_PROJECT_REF", label: "Project Ref", placeholder: "ogfnojbbvumujzfklkhh", description: "Referência do projeto Supabase" },
    ],
  },
  {
    title: "Inteligência Artificial",
    description: "APIs de IA para diagnósticos e análises automáticas",
    icon: "🤖",
    fields: [
      { key: "ANTHROPIC_API_KEY", label: "Anthropic (Claude)", placeholder: "sk-ant-api03-xxxxx...", description: "Chave da API Anthropic — usada para análise de closers e diagnóstico de alertas", secret: true },
      { key: "GEMINI_API_KEY", label: "Google Gemini", placeholder: "AIzaSyxxxxx...", description: "Chave da API Google Gemini (alternativa mais rápida e econômica)", secret: true },
      { key: "OPENAI_API_KEY", label: "OpenAI (GPT-4o)", placeholder: "sk-proj-xxxxx...", description: "Chave da API OpenAI — modelo GPT-4o", secret: true },
    ],
  },
  {
    title: "Vercel",
    description: "Deploy e hosting da dashboard",
    icon: "▲",
    fields: [
      { key: "VERCEL_PROJECT_URL", label: "URL do Projeto", placeholder: "https://dashboard-comercial-one.vercel.app", description: "URL de produção na Vercel" },
      { key: "VERCEL_PROJECT_NAME", label: "Nome do Projeto", placeholder: "dashboard-comercial", description: "Nome do projeto na Vercel" },
    ],
  },
  {
    title: "Closers — IDs Supabase",
    description: "UUIDs dos closers no banco (para mapear pipelines)",
    icon: "👤",
    fields: [
      { key: "CLOSER_ID_LUCAS", label: "UUID — Lucas", placeholder: "a987d655-88d0-490b-ad73-efe04843a2ec", description: "ID do closer Lucas no Supabase" },
      { key: "CLOSER_ID_MARIANA", label: "UUID — Mariana", placeholder: "9b3edc8c-e5ce-450a-95b9-742f3c5c23b1", description: "ID da closer Mariana no Supabase" },
      { key: "CLOSER_ID_ROGERIO", label: "UUID — Rogério", placeholder: "c8a5b749-b313-432e-ab4e-55bce924ec88", description: "ID do closer Rogério no Supabase" },
    ],
  },
];

export default function IntegracoesPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [, setSaved] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("dashboard_integracoes");
    if (saved) {
      setValues(JSON.parse(saved));
    } else {
      // Preencher com valores padrão conhecidos
      setValues({
        NEXT_PUBLIC_SUPABASE_URL: "https://ogfnojbbvumujzfklkhh.supabase.co",
        SUPABASE_PROJECT_REF: "ogfnojbbvumujzfklkhh",
        GHL_LOCATION_ID: "DlN4Ua95aZZCaR8qA5Nh",
        GHL_PIPELINE_LUCAS: "ZjrMXF5XMBSCZOorLeu8",
        GHL_PIPELINE_MARIANA: "ENg4tFVzJsUh8rHRntAX",
        GHL_PIPELINE_ROGERIO: "8B7pjhZ4jv0e4u3JjtsR",
        N8N_BASE_URL: "https://comarka.app.n8n.cloud",
        N8N_WEBHOOK_URL: "https://comarka.app.n8n.cloud/webhook/ghl-crm-webhook",
        N8N_WORKFLOW_ID: "oCXivVCoIkTIrZT1",
        META_ADS_ACCOUNT_ID: "act_2851365261838044",
        IG_ACCOUNT_ID: "17841446462623647",
        CLOSER_ID_LUCAS: "a987d655-88d0-490b-ad73-efe04843a2ec",
        CLOSER_ID_MARIANA: "9b3edc8c-e5ce-450a-95b9-742f3c5c23b1",
        CLOSER_ID_ROGERIO: "c8a5b749-b313-432e-ab4e-55bce924ec88",
        VERCEL_PROJECT_URL: "https://dashboard-comercial-one.vercel.app",
        VERCEL_PROJECT_NAME: "dashboard-comercial",
      });
    }
  }, []);

  function saveAll() {
    localStorage.setItem("dashboard_integracoes", JSON.stringify(values));
    setSaved(true);
    toast.success("Configurações salvas!");
    setTimeout(() => setSaved(false), 2000);
  }

  function exportEnvLocal() {
    const lines = CONFIG_GROUPS.flatMap((g) =>
      [`\n# ${g.title}`, ...g.fields.map((f) => `${f.key}=${values[f.key] || ""}`)]
    ).join("\n");
    navigator.clipboard.writeText(lines.trim());
    toast.success("Copiado para clipboard! Cole no .env.local");
  }

  function exportJson() {
    const json = JSON.stringify(values, null, 2);
    navigator.clipboard.writeText(json);
    toast.success("JSON copiado!");
  }

  function importJson() {
    const input = prompt("Cole o JSON de configuração:");
    if (!input) return;
    try {
      const parsed = JSON.parse(input);
      setValues(parsed);
      localStorage.setItem("dashboard_integracoes", JSON.stringify(parsed));
      toast.success("Configuração importada!");
    } catch {
      toast.error("JSON inválido");
    }
  }

  const toggleSecret = (key: string) => setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));

  // Health check detalhado
  const [healthApis, setHealthApis] = useState<{ name: string; status: string; message: string; response_ms: number; details?: Record<string, unknown> }[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthCheckedAt, setHealthCheckedAt] = useState("");

  const testConnections = async () => {
    setHealthLoading(true);
    try {
      const r = await fetch("/api/health");
      const d = await r.json();
      setHealthApis(d.apis || []);
      setHealthCheckedAt(d.checked_at || "");
    } catch { toast.error("Erro ao verificar APIs"); }
    setHealthLoading(false);
  };

  const isFieldFilled = (key: string) => !!values[key]?.trim();

  const totalFields = CONFIG_GROUPS.reduce((s, g) => s + g.fields.length, 0);
  const filledFields = CONFIG_GROUPS.reduce((s, g) => s + g.fields.filter((f) => isFieldFilled(f.key)).length, 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Integrações e Chaves</h1>
          <p className="text-sm text-muted-foreground">
            Configure todas as APIs, chaves e IDs para replicar a plataforma em outra conta
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {filledFields}/{totalFields} preenchidos
        </Badge>
      </div>

      {/* Status de APIs */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Status das APIs</CardTitle>
            <Button size="sm" variant="outline" onClick={testConnections} disabled={healthLoading} className="text-xs">
              {healthLoading ? "Verificando..." : "Verificar Agora"}
            </Button>
          </div>
          {healthCheckedAt && <p className="text-[10px] text-muted-foreground">Verificado em {new Date(healthCheckedAt).toLocaleString("pt-BR")}</p>}
        </CardHeader>
        <CardContent className="space-y-2">
          {healthApis.length === 0 && !healthLoading && (
            <p className="text-xs text-muted-foreground text-center py-4">Clique em &quot;Verificar Agora&quot; para testar todas as APIs</p>
          )}
          {healthLoading && <div className="h-20 bg-muted animate-pulse rounded" />}
          {healthApis.map((api) => (
            <div key={api.name} className={`flex items-center justify-between p-2.5 rounded-lg border ${api.status === "ok" ? "border-green-500/20 bg-green-500/5" : api.status === "warning" ? "border-yellow-500/20 bg-yellow-500/5" : "border-red-500/20 bg-red-500/5"}`}>
              <div className="flex items-center gap-2">
                {api.status === "ok" ? <CheckCircle size={14} className="text-green-400" /> : <XCircle size={14} className="text-red-400" />}
                <div>
                  <p className="text-xs font-medium">{api.name}</p>
                  <p className="text-[10px] text-muted-foreground">{api.message}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-mono text-muted-foreground">{api.response_ms}ms</p>
                {api.details?.days_left !== undefined && (
                  <p className={`text-[10px] font-medium ${Number(api.details.days_left) < 7 ? "text-red-400" : Number(api.details.days_left) < 30 ? "text-yellow-400" : "text-green-400"}`}>
                    {Number(api.details.days_left) > 0 ? `Expira em ${String(api.details.days_left)}d` : "Expirado!"}
                  </p>
                )}
                {api.details?.token_expires ? (
                  <p className="text-[9px] text-muted-foreground">{new Date(String(api.details.token_expires)).toLocaleDateString("pt-BR")}</p>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={saveAll} size="sm">
          <Save size={14} className="mr-1" />Salvar Tudo
        </Button>
        <Button onClick={exportEnvLocal} variant="outline" size="sm">
          <Copy size={14} className="mr-1" />Copiar .env.local
        </Button>
        <Button onClick={exportJson} variant="outline" size="sm">
          <Copy size={14} className="mr-1" />Exportar JSON
        </Button>
        <Button onClick={importJson} variant="outline" size="sm">
          Importar JSON
        </Button>
      </div>

      {/* Groups */}
      {CONFIG_GROUPS.map((group) => {
        const filled = group.fields.filter((f) => isFieldFilled(f.key)).length;
        const total = group.fields.length;
        return (
          <Card key={group.title}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <span>{group.icon}</span> {group.title}
                  <Badge variant="outline" className={`text-xs ${filled === total ? "border-green-500 text-green-500" : "border-muted-foreground"}`}>
                    {filled}/{total}
                  </Badge>
                </CardTitle>
                {filled === total ? <CheckCircle size={16} className="text-green-500" /> : <XCircle size={16} className="text-muted-foreground" />}
              </div>
              <p className="text-xs text-muted-foreground">{group.description}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {group.fields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label className="text-xs font-medium">{field.label}</Label>
                  <div className="flex gap-2">
                    <Input
                      type={field.secret && !showSecrets[field.key] ? "password" : "text"}
                      value={values[field.key] || ""}
                      onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      className="font-mono text-xs"
                    />
                    {field.secret && (
                      <Button variant="ghost" size="sm" onClick={() => toggleSecret(field.key)}>
                        {showSecrets[field.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </Button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{field.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {/* Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📋 Guia de Implementação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p><strong>1.</strong> Crie um projeto no <strong>Supabase</strong> → copie URL + Anon Key + Service Role Key</p>
          <p><strong>2.</strong> Execute os SQLs no SQL Editor: <code>schema.sql</code>, <code>migration-v2.sql</code>, <code>migration-trafego-pago-v2.sql</code>, <code>migration-alertas-config.sql</code>, <code>migration-relatorio-config.sql</code>, <code>trigger-auto-leads-v2.sql</code>, <code>migration-leads-attribution-trigger.sql</code></p>
          <p><strong>3.</strong> Crie subconta no <strong>GHL</strong> com pipelines (Closer + SDR) → pegue API Key e Pipeline IDs</p>
          <p><strong>4.</strong> Importe workflows no <strong>n8n</strong>: <code>n8n-workflow-final-v2.json</code> (GHL→CRM), <code>n8n-workflow-meta-ads-sync-2h.json</code> (Meta Ads), <code>n8n-workflow-relatorio-semanal.json</code> (WhatsApp)</p>
          <p><strong>5.</strong> No GHL, crie webhook de Opportunity Created apontando para o webhook n8n</p>
          <p><strong>6.</strong> Crie App no <strong>Facebook Developers</strong> → gere token de longa duração → cole aqui</p>
          <p><strong>7.</strong> (Opcional) Configure <strong>Evolution API</strong> para envio de relatórios via WhatsApp</p>
          <p><strong>8.</strong> (Opcional) Gere chave da <strong>Anthropic</strong> para análise por IA dos closers</p>
          <p><strong>9.</strong> Crie conta no <strong>Asaas</strong> → Minha Conta → Integrações → API → gere a API Key. Use ambiente <code>sandbox</code> para testes. Configure o Webhook Token para receber notificações automáticas de pagamento</p>
          <p><strong>10.</strong> Execute a migration <code>migration-financeiro-modulo.sql</code> no SQL Editor do Supabase</p>
          <p><strong>11.</strong> Preencha todas as chaves nesta página → clique em <strong>&quot;Copiar .env.local&quot;</strong> → cole no arquivo <code>.env.local</code></p>
          <p><strong>12.</strong> Adicione as mesmas variáveis na Vercel (Settings → Environment Variables) e faça redeploy</p>
        </CardContent>
      </Card>
    </div>
  );
}
