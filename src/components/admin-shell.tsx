"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { PageTabs } from "@/components/page-tabs";

const TAB_CONFIG: Record<string, { href: string; label: string }[]> = {
  dashboard: [
    { href: "/dashboard", label: "Visão Geral" },
    { href: "/hoje", label: "Hoje" },
    { href: "/relatorio", label: "Relatório Mensal" },
  ],
  vendas: [
    { href: "/crm", label: "CRM" },
    { href: "/funil-tempo", label: "Funil" },
    { href: "/analise-dias", label: "Análise por Dias" },
    { href: "/historico", label: "Histórico" },
    { href: "/canais", label: "Canais" },
  ],
  time: [
    { href: "/sdr", label: "SDR" },
    { href: "/closers", label: "Closers" },
    { href: "/social-selling", label: "Social Selling" },
  ],
  trafego: [
    { href: "/trafego/visao-geral", label: "Visão Geral" },
    { href: "/trafego/estrutura", label: "Estrutura" },
    { href: "/trafego/frequencia", label: "Frequência" },
    { href: "/trafego/video", label: "Vídeo" },
    { href: "/trafego/alertas", label: "Alertas" },
  ],
  financeiro: [
    { href: "/metas", label: "Metas e Bônus" },
    { href: "/recebimentos", label: "Recebimentos" },
    { href: "/lancamento", label: "Lançamento Diário" },
    { href: "/contratos", label: "Contratos" },
  ],
  config: [
    { href: "/config", label: "Configurações" },
    { href: "/config/integracoes", label: "Integrações" },
    { href: "/trafego/relatorio-auto", label: "Relatório Automático" },
    { href: "/calculadora", label: "Calculadora" },
  ],
};

function getTabGroup(pathname: string): string | null {
  for (const [group, tabs] of Object.entries(TAB_CONFIG)) {
    if (tabs.some((t) => pathname === t.href || pathname.startsWith(t.href + "/"))) {
      return group;
    }
  }
  if (pathname.startsWith("/closer/") || pathname.startsWith("/dashboard/closers/")) return "time";
  // Rotas de tráfego que foram unificadas
  if (["/trafego/anuncios", "/trafego/campanhas", "/trafego/conjuntos", "/trafego/relatorios", "/trafego/funil-cliente"].some((p) => pathname.startsWith(p))) return "trafego";
  return null;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPortal = pathname.startsWith("/portal");

  if (isPortal) {
    return <>{children}</>;
  }

  const tabGroup = getTabGroup(pathname);
  const tabs = tabGroup ? TAB_CONFIG[tabGroup] : null;

  return (
    <>
      <Sidebar />
      <main className="md:ml-56 min-h-screen p-4 md:p-8 pt-16 md:pt-8">
        {tabs && <PageTabs tabs={tabs} />}
        {children}
      </main>
    </>
  );
}
