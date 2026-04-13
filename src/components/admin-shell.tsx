"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Sidebar, menuItems } from "@/components/sidebar";
import { PageTabs } from "@/components/page-tabs";
import { PortalShell } from "@/components/portal-shell";

type Tab = { href: string; label: string };
const TAB_CONFIG: Record<string, Tab[]> = {};
const GROUP_BY_ID: Record<string, typeof menuItems[number]> = {};
for (const item of menuItems) {
  if (!item.children || item.children.length === 0) continue;
  const id = item.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
  TAB_CONFIG[id] = item.children.map((c) => ({ href: c.href, label: c.label }));
  GROUP_BY_ID[id] = item;
}

function pathMatches(pathname: string, patterns: string[]): boolean {
  return patterns.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?"));
}

function getTabGroup(pathname: string): string | null {
  if (pathname.startsWith("/dashboard/team")) {
    for (const [id, item] of Object.entries(GROUP_BY_ID)) {
      if (item.label.toLowerCase().includes("time")) return id;
    }
  }
  for (const [id, item] of Object.entries(GROUP_BY_ID)) {
    if (pathMatches(pathname, item.paths)) return id;
  }
  for (const [id, tabs] of Object.entries(TAB_CONFIG)) {
    if (tabs.some((t) => pathname === t.href || pathname.startsWith(t.href + "/"))) return id;
  }
  return null;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPortal = pathname.startsWith("/portal");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const check = () => setSidebarCollapsed(localStorage.getItem("sidebar_collapsed") === "true");
    check();
    window.addEventListener("storage", check);
    const interval = setInterval(check, 500);
    return () => { window.removeEventListener("storage", check); clearInterval(interval); };
  }, []);

  if (pathname === "/tv") return <>{children}</>;
  if (isPortal) return <PortalShell>{children}</PortalShell>;

  const tabGroup = getTabGroup(pathname);
  const tabs = tabGroup ? TAB_CONFIG[tabGroup] : null;

  return (
    <>
      <Sidebar />
      <main className={`min-h-screen radial-gradient-bg p-5 md:p-8 pt-16 md:pt-8 transition-all duration-300 ${sidebarCollapsed ? "md:ml-14" : "md:ml-56"}`}>
        {tabs && <PageTabs tabs={tabs} />}
        {children}
      </main>
    </>
  );
}
