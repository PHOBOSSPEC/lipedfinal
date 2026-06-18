import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/db";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Upload, Calendar as CalIcon, FileText, Users, CheckCircle2, RotateCcw, Search, UserCog, Trash2, Star, Settings, Inbox, Plus, Pencil, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useSetting, DEFAULT_COPPA, DEFAULT_ARTIGOS, DEFAULT_HOME, type CoppaSettings, type ArtigosCoppaSettings, type HomeSettings } from "@/hooks/use-site-settings";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Painel administrativo — Liga de Pediatria" }] }),
  component: AdminPage,
});

type Inscricao = {
  id: string; nome_completo: string; cpf: string; email: string;
  categoria: string; created_at: string; pago: boolean;
  telefone: string | null; liga_parceira_nome: string | null;
  comprovante_url: string | null; crm: string | null;
  pagamento_comprovante_url: string | null;
};

type Membro = {
  id: string; nome: string; cargo: string; iniciais: string;
  foto_url: string | null; destaque: boolean; ordem: number;
};

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) return null;
  if (!isAdmin) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-primary">Acesso negado</h1>
        <p className="text-muted-foreground mt-2">
          Sua conta ({user.email}) não é administradora. Apenas o dono do site pode acessar este painel.
        </p>
        <Button className="mt-6" onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/login" }))}>
          Sair
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-primary">Painel administrativo</h1>
          <p className="text-sm text-muted-foreground">Logado como {user.email}</p>
        </div>
        <Button variant="outline" onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/" }))}>
          Sair
        </Button>
      </div>

      <Tabs defaultValue="inscricoes">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="inscricoes"><Users className="mr-2 h-4 w-4" /> Inscrições</TabsTrigger>
          <TabsTrigger value="home"><Star className="mr-2 h-4 w-4" /> Início</TabsTrigger>
          <TabsTrigger value="config"><Settings className="mr-2 h-4 w-4" /> COPPA</TabsTrigger>
          <TabsTrigger value="evento"><CalIcon className="mr-2 h-4 w-4" /> Eventos</TabsTrigger>
          <TabsTrigger value="submissoes"><Inbox className="mr-2 h-4 w-4" /> Submissões</TabsTrigger>
          <TabsTrigger value="membros"><UserCog className="mr-2 h-4 w-4" /> Membros</TabsTrigger>
          <TabsTrigger value="artigo"><FileText className="mr-2 h-4 w-4" /> Artigo</TabsTrigger>
        </TabsList>

        <TabsContent value="inscricoes" className="mt-6"><InscricoesTab /></TabsContent>
        <TabsContent value="home" className="mt-6"><HomeTab /></TabsContent>
        <TabsContent value="config" className="mt-6"><ConfigCoppaTab /></TabsContent>
        <TabsContent value="evento" className="mt-6"><EventosTab /></TabsContent>
        <TabsContent value="submissoes" className="mt-6"><SubmissoesTab /></TabsContent>
        <TabsContent value="membros" className="mt-6"><MembrosTab /></TabsContent>
        <TabsContent value="artigo" className="mt-6"><ArtigoForm /></TabsContent>
      </Tabs>
    </div>
  );
}

function InscricoesTab() {
  const [items, setItems] = useState<Inscricao[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const load = () => {
    setLoading(true);
    supabase.from("inscricoes_coppa").select("*").order("created_at", { ascending: false })
      .then(({ data, error }: any) => {
        if (error) toast.error("Erro ao carregar inscrições");
        setItems((data as Inscricao[]) ?? []);
        setLoading(false);
      });
  };

  useEffect(() => { load(); }, []);

  const togglePago = async (id: string, novoStatus: boolean) => {
    setUpdatingId(id);
    const { error } = await supabase.from("inscricoes_coppa").update({ pago: novoStatus }).eq("id", id);
    setUpdatingId(null);
    if (error) return toast.error("Erro ao atualizar pagamento");
    toast.success(novoStatus ? "Pagamento confirmado!" : "Marcado como não pago");
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, pago: novoStatus } : i)));
  };

  const removerInscricao = async (i: Inscricao) => {
    if (!confirm(`Remover a inscrição de ${i.nome_completo}? Esta ação não pode ser desfeita.`)) return;
    setUpdatingId(i.id);
    const { error } = await supabase.from("inscricoes_coppa").delete().eq("id", i.id);
    setUpdatingId(null);
    if (error) return toast.error("Erro ao remover inscrição");
    toast.success("Inscrição removida");
    setItems((prev) => prev.filter((x) => x.id !== i.id));
  };

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      i.nome_completo.toLowerCase().includes(q) ||
      i.cpf.toLowerCase().includes(q) ||
      i.email.toLowerCase().includes(q)
    );
  }, [items, busca]);

  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />;

  const naoPagos = filtrados.filter((i) => !i.pago);
  const pagos = filtrados.filter((i) => i.pago);

  const renderTable = (lista: Inscricao[], tipo: "pago" | "nao_pago") => {
    if (lista.length === 0) {
      return <p className="text-center text-muted-foreground py-8">Nenhuma inscrição nesta lista.</p>;
    }
    return (
      <Card><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left">
            <tr>
              <th className="p-3">Nome</th><th className="p-3">CPF</th>
              <th className="p-3">Contato</th><th className="p-3">Categoria</th>
              <th className="p-3">Detalhes</th>
              <th className="p-3">Data</th><th className="p-3">Ação</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((i) => (
              <tr key={i.id} className="border-t border-border align-top">
                <td className="p-3 font-medium">{i.nome_completo}</td>
                <td className="p-3">{i.cpf}</td>
                <td className="p-3">
                  <div>{i.email}</div>
                  {i.telefone && <div className="text-xs text-muted-foreground">{i.telefone}</div>}
                </td>
                <td className="p-3">{i.categoria}</td>
                <td className="p-3 text-xs">
                  {i.liga_parceira_nome && <div><span className="text-muted-foreground">Liga:</span> {i.liga_parceira_nome}</div>}
                  {i.crm && <div><span className="text-muted-foreground">CRM:</span> {i.crm}</div>}
                  {i.comprovante_url && (
                    <button
                      type="button"
                      className="text-accent underline block font-medium"
                      onClick={async () => {
                        const path = i.comprovante_url!.includes("/comprovantes/")
                          ? i.comprovante_url!.split("/comprovantes/")[1]
                          : i.comprovante_url!;
                        const { data, error } = await supabase.storage
                          .from("comprovantes")
                          .createSignedUrl(path, 60);
                        if (error || !data) return toast.error("Não foi possível abrir o comprovante");
                        window.open(data.signedUrl, "_blank");
                      }}
                    >Ver matrícula</button>
                  )}
                  {i.pagamento_comprovante_url && (
                    <button
                      type="button"
                      className="text-accent underline block font-medium"
                      onClick={async () => {
                        const { data, error } = await supabase.storage
                          .from("comprovantes")
                          .createSignedUrl(i.pagamento_comprovante_url!, 60);
                        if (error || !data) return toast.error("Não foi possível abrir o comprovante");
                        window.open(data.signedUrl, "_blank");
                      }}
                    >Ver comprovante PIX</button>
                  )}
                  {!i.liga_parceira_nome && !i.crm && !i.comprovante_url && !i.pagamento_comprovante_url && <span className="text-muted-foreground">—</span>}
                </td>
                <td className="p-3 text-muted-foreground">{new Date(i.created_at).toLocaleDateString("pt-BR")}</td>
                <td className="p-3">
                  <div className="flex gap-2 flex-wrap">
                    {tipo === "nao_pago" ? (
                      <Button size="sm" disabled={updatingId === i.id} onClick={() => togglePago(i.id, true)}>
                        {updatingId === i.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="mr-1 h-4 w-4" /> Confirmar pagamento</>}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled={updatingId === i.id} onClick={() => togglePago(i.id, false)}>
                        {updatingId === i.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RotateCcw className="mr-1 h-4 w-4" /> Marcar como não pago</>}
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" disabled={updatingId === i.id} onClick={() => removerInscricao(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, CPF ou e-mail..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>
      <Tabs defaultValue="nao_pagos">
        <TabsList>
          <TabsTrigger value="nao_pagos">Não pagos ({naoPagos.length})</TabsTrigger>
          <TabsTrigger value="pagos">Pagos ({pagos.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="nao_pagos" className="mt-4">{renderTable(naoPagos, "nao_pago")}</TabsContent>
        <TabsContent value="pagos" className="mt-4">{renderTable(pagos, "pago")}</TabsContent>
      </Tabs>
    </div>
  );
}

function MembrosTab() {
  const [items, setItems] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [iniciais, setIniciais] = useState("");
  const [ordem, setOrdem] = useState("0");
  const [destaque, setDestaque] = useState(false);
  const [foto, setFoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const hasPreceptor = useMemo(() => items.some((m) => m.destaque), [items]);

  const load = () => {
    setLoading(true);
    supabase.from("membros").select("*").order("destaque", { ascending: false }).order("ordem", { ascending: true })
      .then(({ data }: any) => {
        setItems((data as Membro[]) ?? []);
        setLoading(false);
      });
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !cargo.trim() || !iniciais.trim()) return toast.error("Preencha nome, cargo e iniciais.");
    if (destaque && hasPreceptor) return toast.error("Já existe um preceptor em destaque. Remova-o antes de definir outro.");
    setSubmitting(true);
    try {
      let foto_url: string | null = null;
      if (foto) {
        const path = `${Date.now()}-${foto.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("membros").upload(path, foto);
        if (upErr) throw upErr;
        foto_url = supabase.storage.from("membros").getPublicUrl(path).data.publicUrl;
      }
      if (destaque) {
        await supabase.from("membros").update({ destaque: false }).eq("destaque", true);
      }
      const { error } = await supabase.from("membros").insert({
        nome: nome.trim(), cargo: cargo.trim(), iniciais: iniciais.trim().toUpperCase().slice(0, 3),
        foto_url, destaque, ordem: Number(ordem) || 0,
      });
      if (error) throw error;
      toast.success("Membro adicionado!");
      setNome(""); setCargo(""); setIniciais(""); setOrdem("0"); setDestaque(false); setFoto(null);
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao adicionar membro");
    } finally { setSubmitting(false); }
  };

  const toggleDestaque = async (m: Membro) => {
    if (!m.destaque && hasPreceptor) {
      return toast.error("Já existe um preceptor em destaque. Remova-o antes de definir outro.");
    }
    setBusyId(m.id);
    if (!m.destaque) {
      await supabase.from("membros").update({ destaque: false }).eq("destaque", true);
    }
    const { error } = await supabase.from("membros").update({ destaque: !m.destaque }).eq("id", m.id);
    setBusyId(null);
    if (error) return toast.error("Erro ao atualizar destaque");
    toast.success(!m.destaque ? "Marcado como preceptor (destaque)" : "Destaque removido");
    load();
  };

  const remover = async (m: Membro) => {
    if (!confirm(`Remover ${m.nome}?`)) return;
    setBusyId(m.id);
    const { error } = await supabase.from("membros").delete().eq("id", m.id);
    setBusyId(null);
    if (error) return toast.error("Erro ao remover");
    toast.success("Membro removido");
    setItems((prev) => prev.filter((i) => i.id !== m.id));
  };

  return (
    <div className="space-y-6">
      <Card><CardContent className="pt-6">
        <h3 className="font-semibold mb-4">Adicionar membro</h3>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="mnome">Nome completo</Label>
            <Input id="mnome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mcargo">Cargo</Label>
            <Input id="mcargo" value={cargo} onChange={(e) => setCargo(e.target.value)} maxLength={80} placeholder="Ex.: Preceptor / Diretor Científico" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="minic">Iniciais (até 3)</Label>
            <Input id="minic" value={iniciais} onChange={(e) => setIniciais(e.target.value)} maxLength={3} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mordem">Ordem de exibição</Label>
            <Input id="mordem" type="number" value={ordem} onChange={(e) => setOrdem(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="mfoto">Foto (opcional)</Label>
            <Input id="mfoto" type="file" accept="image/*" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <Checkbox id="mdest" checked={destaque} onCheckedChange={(v) => setDestaque(!!v)} disabled={hasPreceptor} />
            <Label htmlFor="mdest" className={`cursor-pointer ${hasPreceptor ? "text-muted-foreground" : ""}`}>
              Destaque (preceptor — apenas um membro)
            </Label>
          </div>
          {hasPreceptor && (
            <p className="text-xs text-muted-foreground md:col-span-2">
              Já existe um preceptor em destaque. Para definir um novo, remova o atual primeiro.
            </p>
          )}
          <div className="md:col-span-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar membro"}
            </Button>
          </div>
        </form>
      </CardContent></Card>

      <div>
        <h3 className="font-semibold mb-3">Membros cadastrados ({items.length})</h3>
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
        ) : items.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum membro cadastrado ainda.</p>
        ) : (
          <Card><CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left">
                <tr>
                  <th className="p-3">Nome</th><th className="p-3">Cargo</th>
                  <th className="p-3">Ordem</th><th className="p-3">Destaque</th><th className="p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="p-3 font-medium flex items-center gap-2">
                      {m.foto_url ? (
                        <img src={m.foto_url} alt={m.nome} className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <span className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">{m.iniciais}</span>
                      )}
                      {m.nome}
                    </td>
                    <td className="p-3">{m.cargo}</td>
                    <td className="p-3">{m.ordem}</td>
                    <td className="p-3">{m.destaque ? <span className="inline-flex items-center gap-1 text-accent-foreground bg-accent rounded px-2 py-0.5 text-xs"><Star className="h-3 w-3" /> Preceptor</span> : "—"}</td>
                    <td className="p-3 flex gap-2">
                      <Button size="sm" variant="outline" disabled={busyId === m.id || (!m.destaque && hasPreceptor)} onClick={() => toggleDestaque(m)}>
                        <Star className="mr-1 h-4 w-4" /> {m.destaque ? "Remover" : "Destacar"}
                      </Button>
                      <Button size="sm" variant="destructive" disabled={busyId === m.id} onClick={() => remover(m)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}

function ArtigoForm() {
  const [titulo, setTitulo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !file) return toast.error("Preencha o título e selecione um PDF.");
    if (file.type !== "application/pdf") return toast.error("Apenas PDF é aceito.");
    setSubmitting(true);
    try {
      const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("artigos").upload(path, file);
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("artigos").getPublicUrl(path);
      const { error } = await supabase.from("artigos").insert({ titulo: titulo.trim(), arquivo_url: pub.publicUrl });
      if (error) throw error;
      toast.success("Artigo publicado!");
      setTitulo(""); setFile(null);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao publicar");
    } finally { setSubmitting(false); }
  };

  return (
    <Card><CardContent className="pt-6">
      <form onSubmit={submit} className="space-y-4 max-w-xl">
        <div className="space-y-2">
          <Label htmlFor="titulo">Título</Label>
          <Input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pdf">Arquivo PDF</Label>
          <Input id="pdf" type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="mr-2 h-4 w-4" /> Publicar artigo</>}
        </Button>
      </form>
    </CardContent></Card>
  );
}

type Evento = {
  id: string; titulo: string; descricao: string; data_evento: string;
  local: string; imagem_url: string | null;
  preco: number; inscricoes_abertas: boolean;
  pix_chave: string | null; pix_titular: string | null;
};

type InscricaoEvento = {
  id: string; evento_id: string; nome_completo: string; email: string;
  telefone: string; cpf: string | null; pagamento_comprovante_url: string | null;
  pago: boolean; created_at: string;
};

function emptyEvento() {
  return {
    titulo: "", descricao: "", data: "", local: "",
    preco: "0", pix_chave: "", pix_titular: "", inscricoes_abertas: true,
  };
}

function EventosTab() {
  const [items, setItems] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyEvento());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imagem, setImagem] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [openInscritos, setOpenInscritos] = useState<string | null>(null);
  const [inscritos, setInscritos] = useState<InscricaoEvento[]>([]);

  const load = () => {
    setLoading(true);
    supabase.from("eventos").select("*").order("data_evento", { ascending: false })
      .then(({ data }: any) => {
        setItems((data as Evento[]) ?? []);
        setLoading(false);
      });
  };
  useEffect(() => { load(); }, []);

  const startEdit = (e: Evento) => {
    setEditingId(e.id);
    setForm({
      titulo: e.titulo, descricao: e.descricao,
      data: new Date(e.data_evento).toISOString().slice(0, 16),
      local: e.local, preco: String(e.preco ?? 0),
      pix_chave: e.pix_chave ?? "", pix_titular: e.pix_titular ?? "",
      inscricoes_abertas: e.inscricoes_abertas,
    });
    setImagem(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => { setEditingId(null); setForm(emptyEvento()); setImagem(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo || !form.descricao || !form.data || !form.local) {
      return toast.error("Preencha título, descrição, data e local.");
    }
    setSubmitting(true);
    try {
      let imagem_url: string | null | undefined = undefined;
      if (imagem) {
        const path = `${Date.now()}-${imagem.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("eventos").upload(path, imagem);
        if (upErr) throw upErr;
        imagem_url = supabase.storage.from("eventos").getPublicUrl(path).data.publicUrl;
      }
      const payload: any = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        data_evento: new Date(form.data).toISOString(),
        local: form.local.trim(),
        preco: Number(form.preco) || 0,
        pix_chave: form.pix_chave.trim() || null,
        pix_titular: form.pix_titular.trim() || null,
        inscricoes_abertas: form.inscricoes_abertas,
      };
      if (imagem_url !== undefined) payload.imagem_url = imagem_url;

      if (editingId) {
        const { error } = await supabase.from("eventos").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Evento atualizado!");
      } else {
        const { error } = await supabase.from("eventos").insert(payload);
        if (error) throw error;
        toast.success("Evento publicado!");
      }
      cancelEdit();
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar evento");
    } finally { setSubmitting(false); }
  };

  const remover = async (e: Evento) => {
    if (!confirm(`Remover "${e.titulo}"? Todas as inscrições serão apagadas.`)) return;
    const { error } = await supabase.from("eventos").delete().eq("id", e.id);
    if (error) return toast.error("Erro ao remover");
    toast.success("Evento removido");
    load();
  };

  const verInscritos = async (eventoId: string) => {
    if (openInscritos === eventoId) { setOpenInscritos(null); return; }
    setOpenInscritos(eventoId);
    const { data } = await supabase.from("inscricoes_eventos").select("*")
      .eq("evento_id", eventoId).order("created_at", { ascending: false });
    setInscritos((data as InscricaoEvento[]) ?? []);
  };

  const togglePagoEvento = async (id: string, novo: boolean) => {
    const { error } = await supabase.from("inscricoes_eventos").update({ pago: novo }).eq("id", id);
    if (error) return toast.error("Erro ao atualizar");
    setInscritos((prev) => prev.map((i) => (i.id === id ? { ...i, pago: novo } : i)));
  };

  const removerInscritoEvento = async (i: InscricaoEvento) => {
    if (!confirm(`Remover a inscrição de ${i.nome_completo}? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("inscricoes_eventos").delete().eq("id", i.id);
    if (error) return toast.error("Erro ao remover inscrição");
    toast.success("Inscrição removida");
    setInscritos((prev) => prev.filter((x) => x.id !== i.id));
  };

  return (
    <div className="space-y-6">
      <Card><CardContent className="pt-6">
        <h3 className="font-semibold mb-4">{editingId ? "Editar evento" : "Criar mini-evento"}</h3>
        <form onSubmit={submit} className="space-y-4 max-w-2xl">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} maxLength={200} required />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea rows={4} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} required />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Data e hora</Label>
              <Input type="datetime-local" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Local</Label>
              <Input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} placeholder="Ex.: Auditório / Online" required />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Preço (R$)</Label>
              <Input type="number" min="0" step="0.01" value={form.preco}
                onChange={(e) => setForm({ ...form, preco: e.target.value })} />
              <p className="text-xs text-muted-foreground">0 = gratuito</p>
            </div>
            <div className="space-y-2">
              <Label>Chave PIX (se pago)</Label>
              <Input value={form.pix_chave} onChange={(e) => setForm({ ...form, pix_chave: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Titular do PIX</Label>
              <Input value={form.pix_titular} onChange={(e) => setForm({ ...form, pix_titular: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.inscricoes_abertas}
              onCheckedChange={(v) => setForm({ ...form, inscricoes_abertas: v })} />
            <Label className="cursor-pointer">Inscrições abertas</Label>
          </div>
          <div className="space-y-2">
            <Label>Imagem {editingId ? "(deixe vazio para manter)" : "(opcional)"}</Label>
            <Input type="file" accept="image/*" onChange={(e) => setImagem(e.target.files?.[0] ?? null)} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> :
                editingId ? <><CheckCircle2 className="mr-2 h-4 w-4" /> Salvar alterações</>
                : <><Upload className="mr-2 h-4 w-4" /> Publicar evento</>}
            </Button>
            {editingId && <Button type="button" variant="outline" onClick={cancelEdit}>Cancelar</Button>}
          </div>
        </form>
      </CardContent></Card>

      <div>
        <h3 className="font-semibold mb-3">Eventos publicados ({items.length})</h3>
        {loading ? <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /> :
          items.length === 0 ? <p className="text-center text-muted-foreground py-8">Nenhum evento ainda.</p> :
          <div className="space-y-3">
            {items.map((e) => (
              <Card key={e.id}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <p className="font-semibold">{e.titulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(e.data_evento).toLocaleString("pt-BR")} · {e.local}
                      </p>
                      <p className="text-xs mt-1">
                        {e.preco > 0 ? <span className="text-primary font-semibold">R$ {Number(e.preco).toFixed(2)}</span> : <span className="text-muted-foreground">Gratuito</span>}
                        {" · "}{e.inscricoes_abertas ? <span className="text-accent-foreground">Inscrições abertas</span> : <span className="text-muted-foreground">Fechadas</span>}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => verInscritos(e.id)}>
                        <Users className="mr-1 h-4 w-4" /> Inscritos
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => startEdit(e)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => remover(e)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {openInscritos === e.id && (
                    <div className="mt-4 border-t border-border pt-3">
                      {inscritos.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">Nenhuma inscrição neste evento.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-secondary text-left"><tr>
                              <th className="p-2">Nome</th><th className="p-2">Contato</th>
                              <th className="p-2">CPF</th><th className="p-2">PIX</th>
                              <th className="p-2">Status</th><th className="p-2"></th>
                            </tr></thead>
                            <tbody>
                              {inscritos.map((i) => (
                                <tr key={i.id} className="border-t border-border">
                                  <td className="p-2 font-medium">{i.nome_completo}</td>
                                  <td className="p-2">{i.email}<br /><span className="text-muted-foreground">{i.telefone}</span></td>
                                  <td className="p-2">{i.cpf ?? "—"}</td>
                                  <td className="p-2">
                                    {i.pagamento_comprovante_url ? (
                                      <button className="text-accent underline" onClick={async () => {
                                        const { data } = await supabase.storage.from("comprovantes")
                                          .createSignedUrl(i.pagamento_comprovante_url!, 60);
                                        if (data) window.open(data.signedUrl, "_blank");
                                      }}>Ver</button>
                                    ) : "—"}
                                  </td>
                                  <td className="p-2">{i.pago ? <span className="text-accent-foreground">Pago</span> : "Pendente"}</td>
                                  <td className="p-2">
                                    <div className="flex gap-1">
                                      <Button size="sm" variant={i.pago ? "outline" : "default"}
                                        onClick={() => togglePagoEvento(i.id, !i.pago)}>
                                        {i.pago ? <RotateCcw className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                                      </Button>
                                      <Button size="sm" variant="destructive" onClick={() => removerInscritoEvento(i)}>
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        }
      </div>
    </div>
  );
}

function ConfigCoppaTab() {
  const { value: coppa, loading: lc, setValue: setCoppa } = useSetting<CoppaSettings>("coppa", DEFAULT_COPPA);
  const { value: artigos, loading: la, setValue: setArtigos } = useSetting<ArtigosCoppaSettings>("artigos_coppa", DEFAULT_ARTIGOS);
  const [saving, setSaving] = useState(false);

  const save = async (key: string, value: any) => {
    setSaving(true);
    const { error } = await supabase.from("site_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Configuração salva!");
  };

  if (lc || la) return <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />;

  const updateHighlight = (i: number, key: "titulo" | "descricao", v: string) => {
    setCoppa({ ...coppa, highlights: coppa.highlights.map((h, idx) => idx === i ? { ...h, [key]: v } : h) });
  };
  const addHighlight = () => setCoppa({ ...coppa, highlights: [...coppa.highlights, { titulo: "", descricao: "" }] });
  const removeHighlight = (i: number) => setCoppa({ ...coppa, highlights: coppa.highlights.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-6">
      <Card><CardContent className="pt-6 space-y-4">
        <h3 className="font-semibold text-primary">Página COPPA</h3>

        <div className="flex items-center gap-3 rounded-lg border border-border p-3">
          <Switch checked={coppa.inscricoes_abertas}
            onCheckedChange={(v) => setCoppa({ ...coppa, inscricoes_abertas: v })} />
          <div className="flex-1">
            <Label className="cursor-pointer">Inscrições abertas</Label>
            <p className="text-xs text-muted-foreground">Quando desligado, o formulário fica oculto.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-border p-3">
          <Switch checked={artigos.submissoes_abertas}
            onCheckedChange={(v) => setArtigos({ ...artigos, submissoes_abertas: v })} />
          <div className="flex-1">
            <Label className="cursor-pointer">Submissões de artigos abertas</Label>
            <p className="text-xs text-muted-foreground">Geralmente fecha junto com as inscrições.</p>
          </div>
          <Button type="button" size="sm" variant="outline"
            onClick={() => { setCoppa({ ...coppa, inscricoes_abertas: false }); setArtigos({ ...artigos, submissoes_abertas: false }); }}>
            Fechar ambos
          </Button>
        </div>

        <div className="space-y-2">
          <Label>Mensagem quando fechado</Label>
          <Textarea rows={2} value={coppa.inscricoes_fechadas_msg}
            onChange={(e) => setCoppa({ ...coppa, inscricoes_fechadas_msg: e.target.value })} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={coppa.titulo} onChange={(e) => setCoppa({ ...coppa, titulo: e.target.value })} />
            <p className="text-xs text-muted-foreground">Ex.: "COPPA 2027"</p>
          </div>
          <div className="space-y-2">
            <Label>Subtítulo</Label>
            <Input value={coppa.subtitulo} onChange={(e) => setCoppa({ ...coppa, subtitulo: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Período (texto)</Label>
            <Input value={coppa.periodo_texto} onChange={(e) => setCoppa({ ...coppa, periodo_texto: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Local</Label>
            <Input value={coppa.local} onChange={(e) => setCoppa({ ...coppa, local: e.target.value })} />
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Preços por categoria (R$)</Label>
          <div className="grid gap-3 md:grid-cols-4">
            {(["LIPED", "LigaParceira", "Academico", "Medico"] as const).map((k) => (
              <div key={k} className="space-y-1">
                <Label className="text-xs">{k}</Label>
                <Input type="number" min="0" step="1" value={coppa.precos[k]}
                  onChange={(e) => setCoppa({ ...coppa, precos: { ...coppa.precos, [k]: Number(e.target.value) || 0 } })} />
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Chave PIX</Label>
            <Input value={coppa.pix_chave} onChange={(e) => setCoppa({ ...coppa, pix_chave: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Titular do PIX</Label>
            <Input value={coppa.pix_titular} onChange={(e) => setCoppa({ ...coppa, pix_titular: e.target.value })} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Destaques (cards "+30 Palestrantes" etc.)</Label>
            <Button type="button" size="sm" variant="outline" onClick={addHighlight}>
              <Plus className="mr-1 h-4 w-4" /> Adicionar
            </Button>
          </div>
          <div className="space-y-2">
            {coppa.highlights.map((h, i) => (
              <div key={i} className="grid grid-cols-[1fr,2fr,auto] gap-2 items-center">
                <Input placeholder="Título" value={h.titulo} onChange={(e) => updateHighlight(i, "titulo", e.target.value)} />
                <Input placeholder="Descrição" value={h.descricao} onChange={(e) => updateHighlight(i, "descricao", e.target.value)} />
                <Button type="button" size="icon" variant="ghost" onClick={() => removeHighlight(i)}>
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <Button onClick={() => save("coppa", coppa)} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar configurações do COPPA"}
        </Button>
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-4">
        <h3 className="font-semibold text-primary">Submissão de artigos</h3>
        <div className="flex items-center gap-3 rounded-lg border border-border p-3">
          <Switch checked={artigos.submissoes_abertas}
            onCheckedChange={(v) => setArtigos({ ...artigos, submissoes_abertas: v })} />
          <Label className="cursor-pointer">Submissões abertas</Label>
        </div>
        <div className="space-y-2">
          <Label>Título da página</Label>
          <Input value={artigos.titulo} onChange={(e) => setArtigos({ ...artigos, titulo: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Descrição</Label>
          <Textarea rows={3} value={artigos.descricao}
            onChange={(e) => setArtigos({ ...artigos, descricao: e.target.value })} />
        </div>
        <Button onClick={() => save("artigos_coppa", artigos)} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar configurações de artigos"}
        </Button>
      </CardContent></Card>
    </div>
  );
}

function HomeTab() {
  const { value: home, loading, setValue: setHome } = useSetting<HomeSettings>("home", DEFAULT_HOME);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("site_settings")
      .upsert({ key: "home", value: home, updated_at: new Date().toISOString() }, { onConflict: "key" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Página inicial atualizada!");
  };

  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />;

  return (
    <div className="space-y-6">
      <Card><CardContent className="pt-6 space-y-4">
        <h3 className="font-semibold text-primary">Texto principal da página inicial</h3>
        <div className="space-y-2">
          <Label>Título da seção "Nossa Missão"</Label>
          <Input value={home.missao_titulo}
            onChange={(e) => setHome({ ...home, missao_titulo: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Texto da missão</Label>
          <Textarea rows={5} value={home.missao_texto}
            onChange={(e) => setHome({ ...home, missao_texto: e.target.value })} />
          <p className="text-xs text-muted-foreground">Quebras de linha são preservadas.</p>
        </div>
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-4">
        <h3 className="font-semibold text-primary">Aviso de próximo evento</h3>
        <div className="flex items-center gap-3 rounded-lg border border-border p-3">
          <Switch checked={home.proximo_evento_ativo}
            onCheckedChange={(v) => setHome({ ...home, proximo_evento_ativo: v })} />
          <div className="flex-1">
            <Label className="cursor-pointer">Exibir aviso na página inicial</Label>
            <p className="text-xs text-muted-foreground">Caixinha que aparece logo abaixo do banner.</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Título curto</Label>
          <Input value={home.proximo_evento_titulo}
            onChange={(e) => setHome({ ...home, proximo_evento_titulo: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Texto</Label>
          <Textarea rows={2} value={home.proximo_evento_texto}
            onChange={(e) => setHome({ ...home, proximo_evento_texto: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Data / detalhe (opcional)</Label>
          <Input placeholder="Ex.: 20 de Junho, 19h" value={home.proximo_evento_data}
            onChange={(e) => setHome({ ...home, proximo_evento_data: e.target.value })} />
        </div>
      </CardContent></Card>

      <Button onClick={save} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar página inicial"}
      </Button>
    </div>
  );
}

type Submissao = {
  id: string; titulo: string; resumo: string | null;
  autor_nome: string; autor_sobrenome: string; autor_email: string;
  autor_telefone: string | null; coautores: { nome: string; sobrenome: string }[];
  arquivo_url: string | null; arquivo_nome: string | null;
  enviado_planilha: boolean; created_at: string;
};

function SubmissoesTab() {
  const [items, setItems] = useState<Submissao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("submissoes_artigos_coppa").select("*").order("created_at", { ascending: false })
      .then(({ data }: any) => {
        setItems((data as unknown as Submissao[]) ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />;
  if (items.length === 0) return <p className="text-center text-muted-foreground py-8">Nenhuma submissão recebida.</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Todos os envios também aparecem na sua planilha do Google Sheets configurada.
      </p>
      {items.map((s) => (
        <Card key={s.id}><CardContent className="pt-5 space-y-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-semibold">{s.titulo}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(s.created_at).toLocaleString("pt-BR")} ·
                {s.enviado_planilha ? <span className="text-accent-foreground"> ✓ na planilha</span> : <span className="text-destructive"> falha no envio</span>}
              </p>
            </div>
            {s.arquivo_url && (
              <Button asChild size="sm" variant="outline">
                <a href={s.arquivo_url} target="_blank" rel="noreferrer">
                  <FileText className="mr-1 h-4 w-4" /> {s.arquivo_nome ?? "Arquivo"}
                </a>
              </Button>
            )}
          </div>
          <p className="text-sm">
            <span className="text-muted-foreground">Autor:</span> {s.autor_nome} {s.autor_sobrenome} — {s.autor_email}
            {s.autor_telefone && <> · {s.autor_telefone}</>}
          </p>
          {s.coautores.length > 0 && (
            <p className="text-sm"><span className="text-muted-foreground">Coautores:</span> {s.coautores.map((c) => `${c.nome} ${c.sobrenome}`).join("; ")}</p>
          )}
          {s.resumo && <p className="text-sm text-foreground/80 whitespace-pre-line border-l-2 border-border pl-3 mt-2">{s.resumo}</p>}
        </CardContent></Card>
      ))}
    </div>
  );
}

