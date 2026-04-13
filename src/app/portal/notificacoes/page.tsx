"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, CheckCheck } from "lucide-react";

interface Notification {
  id: string; tipo: string; titulo: string; mensagem: string; lida: boolean; created_at: string; link?: string;
}

const TIPO_ICONS: Record<string, string> = {
  lead_atribuido: "👤", contrato_fechado: "✅", meta_atingida: "🎯",
  mensagem_admin: "📩", pagamento_aprovado: "💰", lembrete: "⏰", sistema: "🔔",
};
const TIPO_LABELS: Record<string, string> = {
  lead_atribuido: "Lead", contrato_fechado: "Contrato", meta_atingida: "Meta",
  mensagem_admin: "Admin", pagamento_aprovado: "Pagamento", lembrete: "Lembrete", sistema: "Sistema",
};

export default function NotificacoesPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"todas" | "nao_lidas">("todas");

  const load = () => {
    setLoading(true);
    const params = filter === "nao_lidas" ? "?unread=true&limit=100" : "?limit=100";
    fetch(`/api/notifications${params}`)
      .then((r) => r.json())
      .then((data) => setNotifications(data.notifications || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const markRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mark_all: true }),
    });
    load();
  };

  const unreadCount = notifications.filter((n) => !n.lida).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Notificacoes</h1>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-lg p-0.5">
            <button onClick={() => setFilter("todas")} className={`px-2.5 py-1 text-[10px] font-medium rounded-md ${filter === "todas" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>Todas</button>
            <button onClick={() => setFilter("nao_lidas")} className={`px-2.5 py-1 text-[10px] font-medium rounded-md ${filter === "nao_lidas" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>Nao lidas</button>
          </div>
          {unreadCount > 0 && (
            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={markAllRead}>
              <CheckCheck size={12} className="mr-1" />Marcar todas
            </Button>
          )}
        </div>
      </div>

      {loading && <div className="h-32 flex items-center justify-center text-muted-foreground">Carregando...</div>}

      {!loading && notifications.length === 0 && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <Bell size={32} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">{filter === "nao_lidas" ? "Nenhuma notificacao nao lida" : "Nenhuma notificacao"}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-1">
        {notifications.map((n) => (
          <div key={n.id} className={`flex items-start gap-3 p-3 border rounded-lg transition-colors ${!n.lida ? "bg-blue-500/5 border-blue-500/20" : "hover:bg-muted/20"}`}>
            <span className="text-lg shrink-0 mt-0.5">{TIPO_ICONS[n.tipo] || "🔔"}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-sm ${!n.lida ? "font-medium" : ""}`}>{n.titulo}</p>
                <Badge className="text-[8px] bg-muted">{TIPO_LABELS[n.tipo] || n.tipo}</Badge>
              </div>
              {n.mensagem && <p className="text-xs text-muted-foreground">{n.mensagem}</p>}
              <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
            </div>
            {!n.lida && (
              <button onClick={() => markRead(n.id)} className="shrink-0 p-1 text-muted-foreground hover:text-foreground" title="Marcar como lida">
                <Check size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
