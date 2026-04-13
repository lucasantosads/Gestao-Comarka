"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";

interface Notification {
  id: string; tipo: string; titulo: string; mensagem: string; lida: boolean; created_at: string;
}

const TIPO_ICONS: Record<string, string> = {
  lead_atribuido: "👤", contrato_fechado: "✅", meta_atingida: "🎯",
  mensagem_admin: "📩", pagamento_aprovado: "💰", lembrete: "⏰", sistema: "🔔",
};

export function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const load = () => {
    fetch("/api/notifications?limit=5")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setUnread(data.unread_count || 0);
          setNotifications(data.notifications || []);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const markRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mark_all: true }),
    });
    load();
  };

  const timeAgo = (date: string) => {
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (mins < 1) return "agora";
    if (mins < 60) return `${mins}min`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h`;
    return `${Math.floor(mins / 1440)}d`;
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-1.5 hover:bg-muted rounded-lg transition-colors">
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-72 bg-card border rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <span className="text-xs font-medium">Notificacoes</span>
              {unread > 0 && (
                <button onClick={markAllRead} className="text-[10px] text-blue-400 hover:underline">Marcar todas como lidas</button>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto">
              {notifications.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhuma notificacao</p>
              )}
              {notifications.map((n) => (
                <button key={n.id} onClick={() => { if (!n.lida) markRead(n.id); }}
                  className={`w-full text-left px-3 py-2 border-b last:border-0 hover:bg-muted/30 transition-colors ${!n.lida ? "bg-blue-500/5" : ""}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-sm shrink-0">{TIPO_ICONS[n.tipo] || "🔔"}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs truncate ${!n.lida ? "font-medium" : "text-muted-foreground"}`}>{n.titulo}</p>
                      {n.mensagem && <p className="text-[10px] text-muted-foreground truncate">{n.mensagem}</p>}
                    </div>
                    <span className="text-[9px] text-muted-foreground shrink-0">{timeAgo(n.created_at)}</span>
                  </div>
                </button>
              ))}
            </div>
            <Link href="/portal/notificacoes" onClick={() => setOpen(false)}
              className="block text-center text-[10px] text-blue-400 py-2 border-t hover:bg-muted/20">
              Ver todas
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
