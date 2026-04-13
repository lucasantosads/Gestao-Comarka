"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, Settings, Menu, X,
  Briefcase, Wallet, Megaphone, Target,
  ChevronDown, ChevronRight,
  BarChart3, Shield, CalendarDays, FileText,
  Eye, Zap, Brain, TrendingUp,
  UserCheck, UserCog, CheckSquare,
  DollarSign, Receipt, PenLine, FileBarChart, PiggyBank, CreditCard,
  MonitorPlay, Search, Video, Layers, Radio, BarChart2, AlertCircle, Lightbulb, Palette, Clock,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { SistemaAlertas } from "@/components/sistema/SistemaAlertas";
import Image from "next/image";

interface SubItem { href: string; label: string; icon: React.ElementType; paths: string[] }
interface MenuItem {
  href: string; label: string; icon: React.ElementType;
  paths: string[];
  children?: SubItem[];
}

export const menuItems: MenuItem[] = [
  {
    href: "/dashboard", label: "Dashboard", icon: LayoutDashboard,
    paths: ["/dashboard", "/hoje", "/relatorio"],
    children: [
      { href: "/dashboard", label: "Visão Geral", icon: Eye, paths: ["/dashboard"] },
      { href: "/hoje", label: "Hoje", icon: CalendarDays, paths: ["/hoje"] },
      { href: "/relatorio", label: "Relatório", icon: FileText, paths: ["/relatorio"] },
      { href: "/dashboard/clientes", label: "Clientes", icon: Users, paths: ["/dashboard/clientes"] },
      { href: "/dashboard/clientes/performance", label: "Performance", icon: BarChart3, paths: ["/dashboard/clientes/performance"] },
      { href: "/dashboard/onboarding", label: "Onboarding", icon: Layers, paths: ["/dashboard/onboarding"] },
      { href: "/dashboard/tarefas", label: "Tarefas", icon: CheckSquare, paths: ["/dashboard/tarefas"] },
    ],
  },
  {
    href: "/crm", label: "Vendas", icon: Briefcase,
    paths: ["/crm", "/crm-integrado", "/analise", "/retencao", "/pipeline-churn", "/funil-tempo", "/analise-dias", "/historico", "/canais", "/churn", "/lancamento"],
    children: [
      { href: "/crm", label: "CRM Tabela", icon: Users, paths: ["/crm"] },
      { href: "/crm-integrado", label: "CRM Integrado", icon: Users, paths: ["/crm-integrado"] },
      { href: "/lancamento", label: "Lançamentos", icon: PenLine, paths: ["/lancamento"] },
      { href: "/analise", label: "Análise", icon: BarChart3, paths: ["/analise", "/funil-tempo", "/analise-dias", "/historico", "/canais"] },
      { href: "/retencao", label: "Churn", icon: Shield, paths: ["/retencao", "/churn", "/pipeline-churn", "/churn/pipeline"] },
    ],
  },
  {
    href: "/meu-portal", label: "Time & Equipe", icon: Users,
    paths: ["/meu-portal", "/equipe-geral", "/equipe", "/sdr", "/relatorio-sdr", "/closers", "/social-selling", "/closer", "/equipe-geral"],
    children: [
      { href: "/meu-portal", label: "Meu Portal", icon: UserCheck, paths: ["/meu-portal", "/closers", "/sdr", "/relatorio-sdr", "/social-selling", "/closer"] },
      { href: "/equipe-geral", label: "Equipe Geral", icon: Users, paths: ["/equipe-geral", "/equipe-geral"] },
      { href: "/equipe", label: "Gestão", icon: UserCog, paths: ["/equipe"] },
    ],
  },
  {
    href: "/trafego/visao-geral", label: "Tráfego Pago", icon: Megaphone,
    paths: ["/trafego"],
    children: [
      { href: "/trafego/visao-geral", label: "Visão Geral", icon: MonitorPlay, paths: ["/trafego/visao-geral"] },
      { href: "/trafego/campanhas", label: "Campanhas", icon: Layers, paths: ["/trafego/campanhas"] },
      { href: "/trafego/anuncios", label: "Anúncios", icon: Radio, paths: ["/trafego/anuncios"] },
      { href: "/trafego/conjuntos", label: "Conjuntos", icon: BarChart2, paths: ["/trafego/conjuntos"] },
      { href: "/trafego/publicos", label: "Públicos", icon: Users, paths: ["/trafego/publicos"] },
      { href: "/trafego/inteligencia", label: "Ad Intelligence", icon: Brain, paths: ["/trafego/inteligencia"] },
      { href: "/trafego/video", label: "Vídeos", icon: Video, paths: ["/trafego/video"] },
      { href: "/trafego/alertas", label: "Alertas", icon: AlertCircle, paths: ["/trafego/alertas"] },
      { href: "/trafego/criativos", label: "Criativos", icon: Palette, paths: ["/trafego/criativos"] },
      { href: "/trafego/performance-temporal", label: "Temporal", icon: Clock, paths: ["/trafego/performance-temporal"] },
      { href: "/trafego/relatorios", label: "Relatórios", icon: Search, paths: ["/trafego/relatorios", "/trafego/relatorio-auto"] },
    ],
  },
  {
    href: "/projecoes", label: "Projeções", icon: Target,
    paths: ["/projecoes"],
    children: [
      { href: "/projecoes", label: "Geral", icon: TrendingUp, paths: ["/projecoes"] },
      { href: "/projecoes/metas-closers", label: "Metas Closers", icon: Zap, paths: ["/projecoes/metas-closers"] },
    ],
  },
  {
    href: "/metas", label: "Financeiro", icon: Wallet,
    paths: ["/metas", "/recebimentos", "/contratos", "/dre", "/fluxo-caixa", "/custos-fixos", "/financeiro"],
    children: [
      { href: "/financeiro", label: "Painel Financeiro", icon: BarChart3, paths: ["/financeiro"] },
      { href: "/recebimentos", label: "Entradas", icon: DollarSign, paths: ["/recebimentos"] },
      { href: "/custos-fixos", label: "Custos Fixos", icon: PiggyBank, paths: ["/custos-fixos"] },
      { href: "/financeiro/custos", label: "Custos Agência", icon: CreditCard, paths: ["/financeiro/custos"] },
      { href: "/dre", label: "DRE", icon: FileBarChart, paths: ["/dre"] },
      { href: "/fluxo-caixa", label: "Fluxo de Caixa", icon: Receipt, paths: ["/fluxo-caixa"] },
      { href: "/metas", label: "Metas", icon: Target, paths: ["/metas"] },
      { href: "/contratos", label: "Contratos", icon: Lightbulb, paths: ["/contratos"] },
    ],
  },
  {
    href: "/time/comarka-pro", label: "Comarka Pro", icon: Target,
    paths: ["/time/comarka-pro"],
    children: [
      { href: "/time/comarka-pro", label: "Meus Pontos", icon: Eye, paths: ["/time/comarka-pro"] },
      { href: "/time/comarka-pro/ranking", label: "Ranking", icon: BarChart3, paths: ["/time/comarka-pro/ranking"] },
      { href: "/time/comarka-pro/admin", label: "Admin", icon: Shield, paths: ["/time/comarka-pro/admin"] },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("sidebar_collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of menuItems) {
      if (item.children && item.paths.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?"))) {
        initial[item.label] = true;
      }
    }
    return initial;
  });

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar_collapsed", String(next));
  };

  const isActive = (item: { paths: string[] }) =>
    item.paths.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?"));

  const isChildActive = (item: MenuItem) =>
    item.children?.some((c) => isActive(c)) || false;

  const handleParentClick = (item: MenuItem) => {
    const isExpanded = expandedMenus[item.label] ?? false;
    if (!isExpanded) {
      setExpandedMenus((p) => ({ ...p, [item.label]: true }));
      router.push(item.children![0].href);
      setOpen(false);
    } else {
      setExpandedMenus((p) => ({ ...p, [item.label]: false }));
    }
  };

  return (
    <>
      <button onClick={() => setOpen(!open)} className="fixed top-4 left-4 z-50 md:hidden bg-card/80 backdrop-blur-xl border border-white/[0.06] rounded-xl p-2.5 shadow-lg">
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden" onClick={() => setOpen(false)} />}
      <aside className={cn(
        "fixed top-0 left-0 z-40 h-full transition-all md:translate-x-0 flex flex-col",
        "dark:backdrop-blur-2xl dark:bg-card/70 dark:border-r dark:border-white/[0.06]",
        "bg-card border-r border-border shadow-sm",
        collapsed ? "w-14" : "w-56",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* ── Header ── */}
        <div className={cn("p-4 flex items-center border-b dark:border-white/[0.06] border-border", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && <div className="flex items-center gap-2.5">
            <Image src="/images/logo-comarka.png" alt="Comarka" width={28} height={28} className="rounded-md" />
            <div>
              <h1 className="text-sm font-bold tracking-tight">Comarka Ads</h1>
              <p className="text-[10px] text-muted-foreground/70">Controle Comercial</p>
            </div>
          </div>}
          {collapsed && <Image src="/images/logo-comarka.png" alt="Comarka" width={24} height={24} className="rounded" />}
          {!collapsed && <div className="flex items-center gap-1"><ThemeToggle /></div>}
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {menuItems.map((item) => {
            const active = isActive(item) || isChildActive(item);
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedMenus[item.label] ?? false;

            if (hasChildren && !collapsed) {
              return (
                <div key={item.label}>
                  <button
                    onClick={() => handleParentClick(item)}
                    className={cn(
                      "flex items-center w-full rounded-lg text-sm font-medium transition-all duration-200 gap-3 px-3 py-2.5",
                      active
                        ? "bg-primary/10 dark:bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-accent/10 dark:hover:bg-white/[0.04] hover:text-foreground"
                    )}
                  >
                    <item.icon size={18} className="shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {isExpanded && (
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l border-primary/20 dark:border-primary/20 pl-2">
                      {item.children!.map((child) => {
                        const childActive = isActive(child);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center gap-2 rounded-md text-xs font-medium transition-all duration-200 px-2 py-1.5",
                              childActive
                                ? "bg-primary/10 dark:bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-accent/10 dark:hover:bg-white/[0.04] hover:text-foreground"
                            )}
                          >
                            <child.icon size={14} className="shrink-0" />
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-all duration-200",
                  collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                  active
                    ? "bg-primary/10 dark:bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent/10 dark:hover:bg-white/[0.04] hover:text-foreground"
                )}
              >
                <item.icon size={18} className="shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>

        {/* ── Footer ── */}
        <div className="p-3 border-t dark:border-white/[0.06] border-border space-y-1">
          <Link
            href="/config"
            onClick={() => setOpen(false)}
            title={collapsed ? "Configurações" : undefined}
            className={cn(
              "flex items-center rounded-lg text-xs transition-all duration-200",
              collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
              pathname.startsWith("/config") || pathname === "/calculadora"
                ? "bg-accent/10 dark:bg-white/[0.06] text-foreground"
                : "text-muted-foreground hover:bg-accent/10 dark:hover:bg-white/[0.04] hover:text-foreground"
            )}
          >
            <Settings size={14} className="shrink-0" />
            {!collapsed && "Configurações"}
          </Link>
          <button
            onClick={toggleCollapse}
            className="hidden md:flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-[10px] text-muted-foreground hover:bg-accent/10 dark:hover:bg-white/[0.04] hover:text-foreground transition-all duration-200 justify-center"
          >
            {collapsed ? "→" : "← Recolher"}
          </button>
        </div>
      </aside>
      <SistemaAlertas />
    </>
  );
}
