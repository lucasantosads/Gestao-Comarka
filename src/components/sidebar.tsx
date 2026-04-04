"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Settings, Menu, X,
  Briefcase, Wallet, Megaphone, Target,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, paths: ["/dashboard", "/hoje", "/relatorio"] },
  { href: "/crm", label: "Vendas", icon: Briefcase, paths: ["/crm", "/funil-tempo", "/analise-dias", "/historico", "/canais"] },
  { href: "/sdr", label: "Time", icon: Users, paths: ["/sdr", "/relatorio-sdr", "/closers", "/social-selling", "/closer"] },
  { href: "/trafego/visao-geral", label: "Tráfego Pago", icon: Megaphone, paths: ["/trafego"] },
  { href: "/projecoes", label: "Projeções", icon: Target, paths: ["/projecoes"] },
  { href: "/metas", label: "Financeiro", icon: Wallet, paths: ["/metas", "/recebimentos", "/lancamento", "/contratos"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (item: typeof menuItems[0]) =>
    item.paths.some((p) => pathname === p || pathname.startsWith(p + "/"));

  return (
    <>
      <button onClick={() => setOpen(!open)} className="fixed top-4 left-4 z-50 md:hidden bg-card border rounded-lg p-2">
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setOpen(false)} />}
      <aside className={cn("fixed top-0 left-0 z-40 h-full w-56 bg-card border-r transition-transform md:translate-x-0 flex flex-col", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="p-4 flex items-center justify-between border-b">
          <div>
            <h1 className="text-sm font-bold">Comarka Ads</h1>
            <p className="text-[10px] text-muted-foreground">Controle Comercial</p>
          </div>
          <ThemeToggle />
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {menuItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t">
          <Link
            href="/config"
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors",
              pathname.startsWith("/config") || pathname === "/calculadora"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Settings size={14} />
            Configurações
          </Link>
        </div>
      </aside>
    </>
  );
}
