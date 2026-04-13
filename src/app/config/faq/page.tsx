"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, ChevronDown, ChevronRight, Send, Loader2, Bot, User, X } from "lucide-react";

interface FaqSection {
  id: string;
  title: string;
  level: number;
  content: string;
  children: FaqSection[];
}

function parseFaq(md: string): FaqSection[] {
  const lines = md.split("\n");
  const root: FaqSection[] = [];
  const stack: { level: number; section: FaqSection }[] = [];
  let currentContent: string[] = [];
  let currentSection: FaqSection | null = null;

  const flush = () => {
    if (currentSection) {
      currentSection.content = currentContent.join("\n").trim();
    }
    currentContent = [];
  };

  for (const line of lines) {
    const match = line.match(/^(#{1,4})\s+(.+)/);
    if (match) {
      flush();
      const level = match[1].length;
      const title = match[2].replace(/\*\*/g, "");
      const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const section: FaqSection = { id, title, level, content: "", children: [] };
      currentSection = section;

      // Find parent
      while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop();
      if (stack.length > 0) {
        stack[stack.length - 1].section.children.push(section);
      } else {
        root.push(section);
      }
      stack.push({ level, section });
    } else {
      currentContent.push(line);
    }
  }
  flush();
  return root;
}

function renderContent(content: string) {
  if (!content) return null;
  const html = content
    .replace(/```[\s\S]*?```/g, (m) => `<pre class="bg-muted rounded-lg p-3 text-xs font-mono overflow-x-auto my-2">${m.replace(/```\w*\n?/g, "").trim()}</pre>`)
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split("|").filter(Boolean).map((c) => c.trim());
      if (cells.every((c) => /^[-:]+$/.test(c))) return "";
      return `<tr>${cells.map((c) => `<td class="border px-2 py-1 text-xs">${c}</td>`).join("")}</tr>`;
    })
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-[11px] font-mono">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="text-sm ml-4 list-disc mb-0.5">$1</li>')
    .replace(/^---$/gm, '<hr class="my-3 border-border/50">')
    .replace(/\n\n/g, "<br/>");

  const hasTable = html.includes("<tr>");
  const wrapped = hasTable ? `<table class="w-full border-collapse my-2">${html}</table>` : html;

  return <div dangerouslySetInnerHTML={{ __html: wrapped }} className="text-sm leading-relaxed text-muted-foreground" />;
}

function NavItem({ section, active, onClick, depth = 0 }: { section: FaqSection; active: string; onClick: (id: string) => void; depth?: number }) {
  const [open, setOpen] = useState(depth === 0);
  const hasKids = section.children.length > 0;
  const isActive = active === section.id;

  return (
    <div>
      <button
        onClick={() => { onClick(section.id); if (hasKids) setOpen(!open); }}
        className={`w-full text-left flex items-center gap-1 py-1 text-xs transition-colors hover:text-foreground ${isActive ? "text-primary font-medium" : "text-muted-foreground"}`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {hasKids && (open ? <ChevronDown size={10} className="shrink-0" /> : <ChevronRight size={10} className="shrink-0" />)}
        <span className="truncate">{section.title.replace(/^\d+\.\d*\s*/, "")}</span>
      </button>
      {open && hasKids && section.children.map((c) => (
        <NavItem key={c.id} section={c} active={active} onClick={onClick} depth={depth + 1} />
      ))}
    </div>
  );
}

function SectionBlock({ section, expanded, onToggle, searchQuery }: { section: FaqSection; expanded: Set<string>; onToggle: (id: string) => void; searchQuery: string }) {
  const isOpen = expanded.has(section.id) || searchQuery.length > 0;
  const hasContent = section.content.length > 10;
  const matchesSearch = searchQuery.length > 0 && (
    section.title.toLowerCase().includes(searchQuery) ||
    section.content.toLowerCase().includes(searchQuery)
  );

  if (searchQuery.length > 0 && !matchesSearch && !section.children.some((c) => c.title.toLowerCase().includes(searchQuery) || c.content.toLowerCase().includes(searchQuery))) {
    return null;
  }

  return (
    <div id={section.id} className="scroll-mt-20">
      <button onClick={() => onToggle(section.id)} className="w-full text-left flex items-center gap-2 py-2 group">
        {section.children.length > 0 || hasContent ? (
          isOpen ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />
        ) : <span className="w-3.5" />}
        <span className={`font-medium ${section.level === 1 ? "text-lg" : section.level === 2 ? "text-base" : "text-sm"} group-hover:text-primary transition-colors`}>
          {section.title}
        </span>
      </button>
      {isOpen && (
        <div className="ml-6 mb-4">
          {hasContent && renderContent(section.content)}
          {section.children.map((c) => (
            <SectionBlock key={c.id} section={c} expanded={expanded} onToggle={onToggle} searchQuery={searchQuery} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FaqPage() {
  const [rawContent, setRawContent] = useState("");
  const [sections, setSections] = useState<FaqSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeNav, setActiveNav] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [showTip, setShowTip] = useState(true);
  useEffect(() => { const t = setTimeout(() => setShowTip(false), 6000); return () => clearTimeout(t); }, []);

  useEffect(() => {
    fetch("/api/faq")
      .then((r) => r.text())
      .then((t) => {
        setRawContent(t);
        const parsed = parseFaq(t);
        setSections(parsed);
        // Expand top level by default
        const initial = new Set<string>();
        parsed.forEach((s) => initial.add(s.id));
        setExpanded(initial);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const navigateTo = (id: string) => {
    setActiveNav(id);
    // Expand the section
    setExpanded((prev) => { const next = new Set(Array.from(prev)); next.add(id); return next; });
    // Scroll
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const question = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", text: question }]);
    setChatLoading(true);

    try {
      const res = await fetch("/api/projections/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectionData: `CONTEXTO: O usuario esta perguntando sobre o FAQ da dashboard.\n\nFAQ COMPLETO:\n${rawContent}\n\nPERGUNTA DO USUARIO:\n${question}`,
          provider: "anthropic-haiku",
        }),
      });
      const data = await res.json();
      setChatMessages((prev) => [...prev, { role: "assistant", text: data.analysis || data.error || "Nao consegui responder." }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", text: "Erro ao processar. Tente novamente." }]);
    }
    setChatLoading(false);
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  const searchLower = search.toLowerCase();

  return (
    <div className="flex gap-6 max-w-6xl mx-auto relative">
      {/* Sidebar nav */}
      <aside className="hidden lg:block w-56 shrink-0 sticky top-20 self-start max-h-[80vh] overflow-y-auto">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Navegacao</p>
        {sections.map((s) => (
          <NavItem key={s.id} section={s} active={activeNav} onClick={navigateTo} />
        ))}
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Search */}
        <div className="sticky top-0 z-10 bg-background pb-3 pt-1">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar no FAQ..."
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-transparent border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Sections */}
        <Card>
          <CardContent className="pt-4 pb-6 px-6">
            {sections.map((s) => (
              <SectionBlock key={s.id} section={s} expanded={expanded} onToggle={toggleExpand} searchQuery={searchLower} />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Chat FAB + tooltip */}
      <div className="fixed bottom-6 right-6 z-50 flex items-end gap-2">
        {showTip && !chatOpen && (
          <div className="relative bg-card border rounded-lg shadow-lg px-3 py-2 text-xs max-w-[180px]">
            <p className="font-medium">Tem duvidas?</p>
            <p className="text-muted-foreground">Pergunte aqui como funciona qualquer coisa da dashboard</p>
            <div className="absolute -right-1.5 bottom-4 w-3 h-3 bg-card border-r border-b rotate-[-45deg]" />
          </div>
        )}
        <button
          onClick={() => { setChatOpen(!chatOpen); setShowTip(false); }}
          className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors"
        >
          {chatOpen ? <X size={20} /> : <Bot size={20} />}
        </button>
      </div>

      {/* Chat panel */}
      {chatOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-96 h-[500px] bg-card border rounded-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <Bot size={16} className="text-primary" />
            <span className="text-sm font-medium">Assistente do FAQ</span>
            <Badge variant="outline" className="text-[9px] ml-auto">Claude Haiku</Badge>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center py-8">
                <Bot size={32} className="mx-auto mb-2 text-muted-foreground opacity-30" />
                <p className="text-sm text-muted-foreground">Pergunte qualquer coisa sobre a dashboard</p>
                <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
                  {["Como funciona o CPL?", "O que e ROAS?", "Como adicionar closer?"].map((q) => (
                    <button key={q} onClick={() => { setChatInput(q); }} className="text-[10px] px-2 py-1 border rounded-full hover:bg-muted transition-colors">{q}</button>
                  ))}
                </div>
              </div>
            )}
            {chatMessages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
                {m.role === "assistant" && <Bot size={14} className="text-primary shrink-0 mt-1" />}
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <p className="whitespace-pre-wrap">{m.text}</p>
                </div>
                {m.role === "user" && <User size={14} className="text-muted-foreground shrink-0 mt-1" />}
              </div>
            ))}
            {chatLoading && (
              <div className="flex gap-2">
                <Bot size={14} className="text-primary shrink-0 mt-1" />
                <div className="bg-muted rounded-lg px-3 py-2">
                  <Loader2 size={14} className="animate-spin" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t p-3">
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
                placeholder="Digite sua pergunta..."
                className="flex-1 text-sm bg-transparent border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button size="sm" onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>
                <Send size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
