"use client";

import { useEffect, useState } from "react";

const CATEGORIAS = [
  "cronometro","aula","implementacao","nps","orcamento","feedback_cliente",
  "roteiro","reuniao_cliente","organizacao","penalizacao_atraso","penalizacao_aula",
  "penalizacao_desorganizacao","penalizacao_erro_grave","penalizacao_erro_leve","penalizacao_grupo",
];

export default function AdminPage() {
  const [tab, setTab] = useState<"lancar" | "roteiros" | "feedbacks" | "config" | "historico">("lancar");

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Admin Comarka Pro</h1>
      <div className="flex gap-2 border-b border-neutral-800">
        {(["lancar", "roteiros", "feedbacks", "config", "historico"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 capitalize ${tab === t ? "border-b-2 border-green-500 text-white" : "text-neutral-400"}`}>
            {t === "lancar" ? "Lançar pontos" : t}
          </button>
        ))}
      </div>

      {tab === "lancar" && <LancarForm />}
      {tab === "roteiros" && <AprovarLista endpoint="roteiros" />}
      {tab === "feedbacks" && <AprovarLista endpoint="feedbacks" />}
      {tab === "config" && <ConfigForm />}
      {tab === "historico" && <HistoricoManual />}
    </div>
  );
}

function LancarForm() {
  const [form, setForm] = useState({ colaborador_id: "", categoria: "aula", pontos: "", descricao: "", mes_referencia: "", cliente_id: "" });
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    const payload: any = { ...form };
    if (payload.pontos) payload.pontos = Number(payload.pontos); else delete payload.pontos;
    if (!payload.mes_referencia) payload.mes_referencia = new Date().toISOString().slice(0, 7) + "-01";
    const r = await fetch("/api/comarka-pro/lancamentos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    setMsg(r.ok ? "Lançado com sucesso" : "Erro: " + (await r.text()));
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-3 max-w-2xl">
      <Input label="Colaborador ID" value={form.colaborador_id} onChange={(v) => setForm({ ...form, colaborador_id: v })} />
      <div>
        <div className="text-xs uppercase text-neutral-500 mb-1">Categoria</div>
        <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="w-full p-2 bg-neutral-800 rounded">
          {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <Input label="Pontos (opcional, usa default da categoria)" value={form.pontos} onChange={(v) => setForm({ ...form, pontos: v })} type="number" />
      <Input label="Descrição" value={form.descricao} onChange={(v) => setForm({ ...form, descricao: v })} />
      <Input label="Mês referência (YYYY-MM-DD)" value={form.mes_referencia} onChange={(v) => setForm({ ...form, mes_referencia: v })} />
      <Input label="Cliente ID (opcional)" value={form.cliente_id} onChange={(v) => setForm({ ...form, cliente_id: v })} />
      <button onClick={submit} className="px-4 py-2 bg-green-600 rounded">Lançar</button>
      {msg && <div className="text-sm text-neutral-400">{msg}</div>}
    </div>
  );
}

function AprovarLista({ endpoint }: { endpoint: "roteiros" | "feedbacks" }) {
  const [itens, setItens] = useState<any[]>([]);

  async function carregar() {
    const r = await fetch(`/api/comarka-pro/${endpoint}?pendentes=1`, { credentials: "include" }).catch(() => null);
    if (r?.ok) setItens(await r.json());
  }
  useEffect(() => { carregar(); }, []);

  async function act(id: string, status: "aprovado" | "reprovado", obs?: string) {
    await fetch(`/api/comarka-pro/${endpoint}/${id}/aprovar`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status, observacao_aprovador: obs }),
    });
    carregar();
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
      <h2 className="text-lg font-semibold mb-3">Aprovar {endpoint} pendentes</h2>
      {itens.length === 0 && <div className="text-neutral-500 text-sm">Nenhum item pendente (ou endpoint GET ainda não implementado).</div>}
      <ul className="space-y-3">
        {itens.map((i) => (
          <li key={i.id} className="border border-neutral-800 rounded p-3">
            <div className="font-medium">{i.titulo || i.descricao}</div>
            <div className="text-xs text-neutral-500">{i.colaborador_id} · {i.mes_referencia}</div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => act(i.id, "aprovado")} className="px-3 py-1 bg-green-600 rounded text-sm">Aprovar</button>
              <button onClick={() => act(i.id, "reprovado")} className="px-3 py-1 bg-red-600 rounded text-sm">Reprovar</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConfigForm() {
  const [cfg, setCfg] = useState<any>({});

  useEffect(() => {
    fetch("/api/comarka-pro/config", { credentials: "include" })
      .then((r) => r.json())
      .then(setCfg);
  }, []);

  async function salvar() {
    await fetch("/api/comarka-pro/config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(cfg),
    });
  }

  const campos = [
    "premio_mensal_1","premio_mensal_2","premio_mensal_3",
    "premio_trimestral_1","premio_trimestral_2","premio_trimestral_3",
    "premio_semestral_1","premio_semestral_2","premio_semestral_3",
    "premio_anual_1","premio_anual_2","premio_anual_3",
    "multiplicador_sequencia","meses_sequencia_necessarios",
  ];

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-3 max-w-2xl">
      {campos.map((c) => (
        <Input key={c} label={c} value={String(cfg[c] ?? "")} onChange={(v) => setCfg({ ...cfg, [c]: v })} type="number" />
      ))}
      <button onClick={salvar} className="px-4 py-2 bg-green-600 rounded">Salvar configuração</button>
    </div>
  );
}

function HistoricoManual() {
  const [itens, setItens] = useState<any[]>([]);
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7) + "-01");

  useEffect(() => {
    fetch(`/api/comarka-pro/lancamentos?origem=manual&mes=${mes}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then(setItens);
  }, [mes]);

  async function remover(id: string) {
    if (!confirm("Confirmar remoção deste lançamento?")) return;
    await fetch(`/api/comarka-pro/lancamentos/${id}`, { method: "DELETE", credentials: "include" });
    setItens((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-xs uppercase text-neutral-500">Mês</label>
        <input type="month" value={mes.slice(0, 7)} onChange={(e) => setMes(e.target.value + "-01")}
          className="p-2 bg-neutral-800 rounded text-sm" />
      </div>
      <ul className="divide-y divide-neutral-800">
        {itens.map((l) => (
          <li key={l.id} className="py-3 flex items-center justify-between">
            <div>
              <div className="font-medium">{l.descricao || l.categoria}</div>
              <div className="text-xs text-neutral-500">
                {l.categoria} · colaborador {l.colaborador_id.slice(0, 8)}… · {new Date(l.criado_em).toLocaleDateString("pt-BR")}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-2 py-1 rounded text-sm font-semibold ${l.pontos >= 0 ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"}`}>
                {l.pontos >= 0 ? "+" : ""}{l.pontos}
              </span>
              <button onClick={() => remover(l.id)} className="text-xs text-red-400 hover:text-red-300">Remover</button>
            </div>
          </li>
        ))}
        {itens.length === 0 && <li className="py-3 text-neutral-500 text-sm">Nenhum lançamento manual neste mês.</li>}
      </ul>
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-neutral-500 mb-1">{label}</div>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full p-2 bg-neutral-800 rounded" />
    </div>
  );
}
