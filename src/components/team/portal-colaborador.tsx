"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { X, Download, BookOpen, Upload, Save, Pencil } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface Profile {
  notion_id: string;
  foto_url?: string | null;
  data_entrada?: string | null;
  chave_pix?: string | null;
  contrato_url?: string | null;
  cargo?: string | null;
  salario_base?: number | null;
  handbook_url?: string | null;
  bio?: string | null;
}

interface Permissions {
  canEdit: boolean;
  canEditAdminFields: boolean;
  isOwner: boolean;
}

export function PortalColaborador({
  notionId,
  nome,
  cargoFallback,
  onClose,
}: {
  notionId: string;
  nome: string;
  cargoFallback?: string;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [perms, setPerms] = useState<Permissions>({ canEdit: false, canEditAdminFields: false, isOwner: false });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  const load = async () => {
    const res = await fetch(`/api/team/profile/${notionId}`);
    const data = await res.json();
    if (!data.error) {
      setProfile(data.profile);
      setPerms(data.permissions);
      setDraft(data.profile);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [notionId]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const res = await fetch(`/api/team/profile/${notionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const data = await res.json();
    if (data.success) {
      toast.success("Perfil atualizado");
      setEditing(false);
      load();
    } else {
      toast.error(data.error || "Erro ao salvar");
    }
    setSaving(false);
  };

  const uploadFoto = async (file: File) => {
    setUploadingFoto(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("notion_id", notionId);
    fd.append("kind", "foto");
    const res = await fetch("/api/team/profile/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.success) {
      toast.success("Foto atualizada");
      setProfile((p) => (p ? { ...p, foto_url: data.url } : p));
      setDraft((p) => (p ? { ...p, foto_url: data.url } : p));
    } else {
      toast.error(data.error || "Erro no upload");
    }
    setUploadingFoto(false);
  };

  const uploadContrato = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("notion_id", notionId);
    fd.append("kind", "contrato");
    const res = await fetch("/api/team/profile/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.success) {
      toast.success("Contrato atualizado");
      setProfile((p) => (p ? { ...p, contrato_url: data.url } : p));
      setDraft((p) => (p ? { ...p, contrato_url: data.url } : p));
    } else {
      toast.error(data.error || "Erro no upload");
    }
  };

  if (!profile) return null;

  const cargo = profile.cargo || cargoFallback || "—";
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setDraft((p) => (p ? { ...p, [k]: v } : p));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-background border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b flex items-center justify-between sticky top-0 bg-background z-10">
          <h2 className="text-sm font-semibold">Meu Portal</h2>
          <div className="flex items-center gap-2">
            {perms.canEdit && !editing && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil size={12} className="mr-1" /> Editar
              </Button>
            )}
            {editing && (
              <>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(profile); }}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={save} disabled={saving}>
                  <Save size={12} className="mr-1" /> {saving ? "..." : "Salvar"}
                </Button>
              </>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Header com foto */}
          <div className="flex items-start gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-muted overflow-hidden border flex items-center justify-center">
                {profile.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.foto_url} alt={nome} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl text-muted-foreground">{nome.charAt(0).toUpperCase()}</span>
                )}
              </div>
              {perms.canEdit && (
                <label className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1 cursor-pointer hover:opacity-90">
                  <Upload size={10} />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingFoto}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFoto(f); }}
                  />
                </label>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold">{nome}</h3>
              <p className="text-xs text-muted-foreground">{cargo}</p>
              {profile.data_entrada && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Na empresa desde {new Date(profile.data_entrada + "T12:00:00").toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">Bio</label>
            {editing && perms.canEdit ? (
              <textarea
                value={draft?.bio || ""}
                onChange={(e) => set("bio", e.target.value)}
                className="w-full mt-1 text-xs bg-transparent border rounded px-2 py-1.5 min-h-[60px]"
                placeholder="Descrição livre..."
              />
            ) : (
              <p className="text-xs mt-1 whitespace-pre-wrap">{profile.bio || <span className="text-muted-foreground">—</span>}</p>
            )}
          </div>

          {/* Chave Pix */}
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">Chave Pix</label>
            {editing && perms.canEdit ? (
              <Input
                value={draft?.chave_pix || ""}
                onChange={(e) => set("chave_pix", e.target.value)}
                className="text-xs mt-1"
                placeholder="CPF, e-mail, telefone ou chave aleatória"
              />
            ) : (
              <p className="text-xs mt-1 font-mono">{profile.chave_pix || <span className="text-muted-foreground font-sans">—</span>}</p>
            )}
          </div>

          {/* Campos só admin */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Data de entrada</label>
              {editing && perms.canEditAdminFields ? (
                <Input
                  type="date"
                  value={draft?.data_entrada || ""}
                  onChange={(e) => set("data_entrada", e.target.value)}
                  className="text-xs mt-1"
                />
              ) : (
                <p className="text-xs mt-1">
                  {profile.data_entrada ? new Date(profile.data_entrada + "T12:00:00").toLocaleDateString("pt-BR") : <span className="text-muted-foreground">—</span>}
                </p>
              )}
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Cargo</label>
              {editing && perms.canEditAdminFields ? (
                <Input value={draft?.cargo || ""} onChange={(e) => set("cargo", e.target.value)} className="text-xs mt-1" />
              ) : (
                <p className="text-xs mt-1">{cargo}</p>
              )}
            </div>
            {perms.canEditAdminFields && (
              <div>
                <label className="text-[10px] uppercase text-muted-foreground">Salário base</label>
                {editing ? (
                  <Input
                    type="number"
                    value={draft?.salario_base ?? ""}
                    onChange={(e) => set("salario_base", e.target.value === "" ? null : Number(e.target.value))}
                    className="text-xs mt-1 font-mono"
                  />
                ) : (
                  <p className="text-xs mt-1 font-mono">
                    {profile.salario_base != null ? formatCurrency(Number(profile.salario_base)) : <span className="text-muted-foreground font-sans">—</span>}
                  </p>
                )}
              </div>
            )}
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Handbook</label>
              {editing && perms.canEditAdminFields ? (
                <Input
                  value={draft?.handbook_url || ""}
                  onChange={(e) => set("handbook_url", e.target.value)}
                  placeholder="https://..."
                  className="text-xs mt-1"
                />
              ) : (
                <p className="text-xs mt-1 truncate">
                  {profile.handbook_url ? <a href={profile.handbook_url} target="_blank" rel="noreferrer" className="hover:underline text-primary">link</a> : <span className="text-muted-foreground">—</span>}
                </p>
              )}
            </div>
          </div>

          {/* Ações: contrato e handbook */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button
              size="sm"
              variant="outline"
              disabled={!profile.contrato_url}
              onClick={() => profile.contrato_url && window.open(profile.contrato_url, "_blank", "noopener,noreferrer")}
            >
              <Download size={12} className="mr-1" /> Baixar Contrato
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!profile.handbook_url}
              onClick={() => profile.handbook_url && window.open(profile.handbook_url, "_blank", "noopener,noreferrer")}
            >
              <BookOpen size={12} className="mr-1" /> Ver Handbook
            </Button>
            {perms.canEditAdminFields && (
              <label className="inline-flex items-center gap-1 text-xs border rounded-md px-3 py-1.5 cursor-pointer hover:bg-muted/20">
                <Upload size={12} /> Substituir contrato
                <input
                  type="file"
                  className="hidden"
                  accept="application/pdf,image/*"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadContrato(f); }}
                />
              </label>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
