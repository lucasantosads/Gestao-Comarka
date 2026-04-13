"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Settings, Bell, Plug, AlertTriangle, HelpCircle, Shield, Activity, Server } from "lucide-react";

const TABS = [
  { href: "/config", label: "Geral", icon: Settings, exact: true },
  { href: "/config/sistema", label: "Sistema", icon: Server },
  { href: "/config/data-health", label: "Data Health", icon: Activity },
  { href: "/config/alertas", label: "Alertas", icon: Bell },
  { href: "/config/integracoes", label: "Integrações", icon: Plug },
  { href: "/config/permissoes", label: "Permissões", icon: Shield },
  { href: "/config/erros", label: "Erros", icon: AlertTriangle },
  { href: "/config/faq", label: "FAQ", icon: HelpCircle },
];

export default function ConfigLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b overflow-x-auto pb-0.5">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(tab.href + "/");
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap -mb-px",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted",
              )}
            >
              <Icon size={13} />
              {tab.label}
            </Link>
          );
        })}
      </div>
      <div>{children}</div>
    </div>
  );
}
