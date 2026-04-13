"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { BarChart3, Users, Wallet, User, LogOut, AlertTriangle, Check, ClipboardList } from "lucide-react";
import { NotificationBell } from "./notification-bell";

const CLOSER_TABS = [
  { href: "/portal/painel", label: "Painel", icon: BarChart3 },
  { href: "/portal/meus-leads", label: "Leads", icon: Users },
  { href: "/portal/tarefas", label: "Tarefas", icon: ClipboardList },
  { href: "/portal/salario", label: "Salario", icon: Wallet },
  { href: "/portal/equipe", label: "Equipe", icon: Users },
  { href: "/portal/meu-perfil", label: "Perfil", icon: User },
];

const SDR_TABS = [
  { href: "/portal/painel-sdr", label: "Painel", icon: BarChart3 },
  { href: "/portal/meus-leads-sdr", label: "Pipeline", icon: Users },
  { href: "/portal/tarefas", label: "Tarefas", icon: ClipboardList },
  { href: "/portal/salario", label: "Salario", icon: Wallet },
  { href: "/portal/equipe", label: "Equipe", icon: Users },
  { href: "/portal/meu-perfil", label: "Perfil", icon: User },
];

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const [lancouHoje, setLancouHoje] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user?.entityId || user.role === "admin") return;
    const dia = new Date().getDay();
    if (dia === 0 || dia === 6) { setLancouHoje(true); return; } // fim de semana
    const hoje = new Date().toISOString().split("T")[0];
    const tabela = user.role === "closer" ? "lancamentos_diarios" : "lancamentos_sdr";
    const campo = user.role === "closer" ? "closer_id" : "sdr_id";
    supabase.from(tabela).select("id").eq(campo, user.entityId).eq("data", hoje).single()
      .then(({ data }) => setLancouHoje(!!data));
  }, [user]);

  if (!user || pathname === "/portal") return <>{children}</>;

  const tabs = user.role === "sdr" ? SDR_TABS : CLOSER_TABS;

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold">Comarka Ads</p>
          <p className="text-[10px] text-muted-foreground">{user.nome} — {user.role === "closer" ? "Closer" : "SDR"}</p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button onClick={logout} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <LogOut size={14} />
            Sair
          </button>
        </div>
      </header>

      {/* Banner lançamento diário */}
      {lancouHoje === false && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="text-xs font-medium text-amber-400">Voce ainda nao fez seu lancamento de hoje. Preencha agora.</span>
          </div>
          <Link href={user.role === "sdr" ? "/portal/painel-sdr" : "/portal/painel"}
            className="text-xs font-medium bg-amber-500 text-black px-3 py-1 rounded-lg hover:bg-amber-400 transition-colors">
            Lancar agora
          </Link>
        </div>
      )}
      {lancouHoje === true && (
        <div className="px-4 py-1.5 border-b flex items-center gap-1.5">
          <Check size={12} className="text-green-400" />
          <span className="text-[10px] text-green-400">Lançamento do dia feito</span>
        </div>
      )}

      {/* Desktop tabs */}
      <nav className="hidden md:flex border-b px-4 gap-1 bg-background">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link key={tab.href} href={tab.href}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Content */}
      <main className="p-4 md:p-8 max-w-5xl mx-auto">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t flex">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link key={tab.href} href={tab.href}
              className={`flex-1 flex flex-col items-center py-2 text-[9px] transition-colors ${active ? "text-foreground" : "text-muted-foreground"}`}>
              <Icon size={18} className={active ? "text-foreground" : ""} />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
