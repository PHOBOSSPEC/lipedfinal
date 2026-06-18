import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, FileText, Plus, Trash2, CheckCircle2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { enviarArtigoCoppa } from "@/lib/artigos-coppa.functions";
import { useSetting, DEFAULT_ARTIGOS, type ArtigosCoppaSettings } from "@/hooks/use-site-settings";

export const Route = createFileRoute("/enviar-artigo")({
  head: () => ({
    meta: [
      { title: "Enviar resumo — COPPA" },
      { name: "description", content: "Envie seu resumo científico para análise da comissão do COPPA." },
    ],
  }),
  component: EnviarArtigoPage,
});

// --- Tipos de resumo e campos -------------------------------------------------
const CAMPOS = {
  introducao: { label: "Introdução", rows: 5 },
  objetivo: { label: "Objetivo", rows: 3 },
  metodos: { label: "Métodos", rows: 5 },
  resultados: { label: "Resultados", rows: 5 },
  descricao_caso: { label: "Descrição do caso", rows: 6 },
  discussao: { label: "Discussão", rows: 5 },
  conclusao: { label: "Conclusão", rows: 4 },
  referencias: { label: "Referências bibliográficas", rows: 5 },
} as const;
type CampoKey = keyof typeof CAMPOS;

const TIPOS: Record<string, { label: string; campos: CampoKey[] }> = {
  relato_caso: {
    label: "Relato de caso",
    campos: ["introducao", "descricao_caso", "discussao", "conclusao", "referencias"],
  },
  trabalho_original: {
    label: "Trabalho original (pesquisa)",
    campos: ["introducao", "objetivo", "metodos", "resultados", "conclusao", "referencias"],
  },
  revisao_sistematica: {
    label: "Revisão sistemática",
    campos: ["introducao", "objetivo", "metodos", "resultados", "conclusao", "referencias"],
  },
  estudo_epidemiologico: {
    label: "Estudo epidemiológico",
    campos: ["introducao", "objetivo", "metodos", "resultados", "conclusao", "referencias"],
  },
};

const TITULO_MAX = 250;
const CORPO_MAX_PALAVRAS = 300; 
const MAX_COAUTORES = 9; 

const CAMPOS_FORA_DO_CORPO: CampoKey[] = ["referencias"];
const contarPalavras = (s: string) =>
  s.trim() ? s.trim().split(/\s+/).filter(Boolean).length : 0;

// Schema atualizado refletindo as novas obrigatoriedades
const schemaBase = z.object({
  titulo: z.string().trim().min(3, "Título muito curto").max(TITULO_MAX, `Título deve ter no máximo ${TITULO_MAX} caracteres`),
  palavras_chave: z.string().trim().min(2, "Informe as palavras-chave").max(500),
  autor_nome: z.string().trim().min(1, "Informe o nome").max(120),
  autor_sobrenome: z.string().trim().min(1, "Informe o sobrenome").max(120),
  autor_email: z.string().trim().email("E-mail inválido").max(255),
  autor_telefone: z.string().trim().max(30).optional(),
  autor_universidade: z.string().trim().min(1, "Informe a sua universidade").max(150),
  autor_municipio: z.string().trim().min(1, "Informe o seu município").max(100),
  autor_uf: z.string().trim().min(2, "UF inválida").max(2),
});

type Coautor = { 
  nome: string; 
  sobrenome: string; 
  universidade: string; 
  municipio: string; 
  uf: string; 
};

function EnviarArtigoPage() {
  const { value: settings, loading } = useSetting<ArtigosCoppaSettings>("artigos_coppa", DEFAULT_ARTIGOS);
  const enviar = useServerFn(enviarArtigoCoppa);
  const [tipo, setTipo] = useState<string>("");
  
  // Estado do formulário atualizado com os novos campos do autor
  const [form, setForm] = useState({
    titulo: "", palavras_chave: "",
    autor_nome: "", autor_sobrenome: "", autor_email: "", autor_telefone: "",
    autor_universidade: "", autor_municipio: "", autor_uf: "",
  });
  
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [coautores, setCoautores] = useState<Coautor[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const tipoCfg = tipo ? TIPOS[tipo] : null;

  const camposCorpo = tipoCfg ? tipoCfg.campos.filter((k) => !CAMPOS_FORA_DO_CORPO.includes(k)) : [];
  const palavrasCorpo = camposCorpo.reduce((acc, k) => acc + contarPalavras(campos[k] ?? ""), 0);

  // Inicialização atualizada para novos coautores
  const addCoautor = () => {
    if (coautores.length < MAX_COAUTORES) {
      setCoautores([...coautores, { nome: "", sobrenome: "", universidade: "", municipio: "", uf: "" }]);
    }
  };

  const updateCoautor = (i: number, key: keyof Coautor, v: string) =>
    setCoautores(coautores.map((c, idx) => (idx === i ? { ...c, [key]: v } : c)));
  const removeCoautor = (i: number) => setCoautores(coautores.filter((_, idx) => idx !== i));

  const resetCampos = (novoTipo: string) => {
    setTipo(novoTipo);
    setCampos({});
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipoCfg) return toast.error("Selecione o tipo de resumo");
    const parsed = schemaBase.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    for (const k of tipoCfg.campos) {
      const v = (campos[k] ?? "").trim();
      if (v.length < 3) return toast.error(`Preencha o campo: ${CAMPOS[k].label}`);
    }

    if (palavrasCorpo > CORPO_MAX_PALAVRAS) {
      return toast.error(`O corpo do resumo excede ${CORPO_MAX_PALAVRAS} palavras.`);
    }

    // Validação extra manual para garantir que se o coautor foi adicionado, os novos dados locais estão preenchidos
    for (let idx = 0; idx < coautores.length; idx++) {
      const c = coautores[idx];
      if (c.nome.trim() || c.sobrenome.trim()) {
        if (!c.universidade.trim() || !c.municipio.trim() || c.uf.trim().length !== 2) {
          return toast.error(`Preencha todos os dados de instituição/localização do Coautor #${idx + 1}`);
        }
      }
    }

    const coautoresFiltrados = coautores
      .map((c) => ({ 
        nome: c.nome.trim(), 
        sobrenome: c.sobrenome.trim(),
        universidade: c.universidade.trim(),
        municipio: c.municipio.trim(),
        uf: c.uf.trim().toUpperCase()
      }))
      .filter((c) => c.nome && c.sobrenome);

    const blocos: string[] = [`TIPO: ${tipoCfg.label}`, ""];
    for (const k of tipoCfg.campos) {
      blocos.push(CAMPOS[k].label.toUpperCase() + ":");
      blocos.push((campos[k] ?? "").trim());
      blocos.push("");
    }
    blocos.push("PALAVRAS-CHAVE:");
    blocos.push(parsed.data.palavras_chave);
    const resumoFormatado = blocos.join("\n");

    setSubmitting(true);
    try {
      await enviar({
        data: {
          titulo: parsed.data.titulo,
          tipo_label: tipoCfg.label,
          resumo: resumoFormatado,
          autor_nome: parsed.data.autor_nome,
          autor_sobrenome: parsed.data.autor_sobrenome,
          autor_email: parsed.data.autor_email,
          autor_telefone: parsed.data.autor_telefone || "",
          autor_universidade: parsed.data.autor_universidade,
          autor_municipio: parsed.data.autor_municipio,
          autor_uf: parsed.data.autor_uf,
          coautores: coautoresFiltrados,
          arquivo_url: "", 
          arquivo_nome: "", 
        },
      });
      setSuccess(true);
      toast.success("Resumo enviado!");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao enviar resumo");
    } finally { setSubmitting(false); }
  };

  if (loading) {
    return <div className="flex justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/coppa"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar ao COPPA</Link>
      </Button>

      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent-foreground">
          <FileText className="h-3.5 w-3.5" /> Submissão de resumos
        </div>
        <h1 className="mt-3 text-3xl font-bold text-primary">{settings.titulo}</h1>
        <p className="mt-2 text-muted-foreground">{settings.descricao}</p>
      </div>

      {!settings.submissoes_abertas ? (
        <Card><CardContent className="py-12 text-center">
          <h3 className="font-bold text-primary text-lg">Submissões fechadas</h3>
          <p className="text-muted-foreground mt-2">As submissões de resumos estão temporariamente fechadas.</p>
        </CardContent></Card>
      ) : success ? (
        <Card><CardContent className="py-12 text-center">
          <CheckCircle2 className="mx-auto h-16 w-16 text-accent" />
          <h3 className="mt-4 text-xl font-bold text-primary">Resumo enviado!</h3>
          <p className="text-muted-foreground mt-2">
            Recebemos sua submissão. A comissão do COPPA fará a análise e entrará em contato pelo e-mail informado.
          </p>
          <Button asChild className="mt-6"><Link to="/coppa">Voltar ao COPPA</Link></Button>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de resumo *</Label>
              <Select value={tipo} onValueChange={resetCampos}>
                <SelectTrigger id="tipo"><SelectValue placeholder="Selecione o tipo de resumo" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPOS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="titulo">Título do resumo *</Label>
              <Input id="titulo" value={form.titulo} maxLength={TITULO_MAX}
                onChange={(e) => setForm({ ...form, titulo: e.target.value.slice(0, TITULO_MAX) })} required />
              <p className={`text-xs text-right ${form.titulo.length >= TITULO_MAX ? "text-destructive" : "text-muted-foreground"}`}>
                {form.titulo.length}/{TITULO_MAX} caracteres
              </p>
            </div>

            {tipoCfg && (
              <div className="space-y-5 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="font-semibold text-primary">Conteúdo do Resumo — {tipoCfg.label}</h3>
                  <span className={`text-xs ${palavrasCorpo > CORPO_MAX_PALAVRAS ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                    Corpo: {palavrasCorpo}/{CORPO_MAX_PALAVRAS} palavras
                  </span>
                </div>
                {tipoCfg.campos.map((k) => {
                  const noCorpo = !CAMPOS_FORA_DO_CORPO.includes(k);
                  const palavras = contarPalavras(campos[k] ?? "");
                  return (
                    <div key={k} className="space-y-2">
                      <Label htmlFor={`c-${k}`}>{CAMPOS[k].label} *</Label>
                      <Textarea
                        id={`c-${k}`}
                        rows={CAMPOS[k].rows}
                        value={campos[k] ?? ""}
                        onChange={(e) => setCampos({ ...campos, [k]: e.target.value })}
                        required
                      />
                      {noCorpo && (
                        <p className="text-[11px] text-muted-foreground text-right">{palavras} palavras</p>
                      )}
                    </div>
                  );
                })}
                <div className="space-y-2">
                  <Label htmlFor="palavras_chave">Palavras-chave *</Label>
                  <Input id="palavras_chave" value={form.palavras_chave} maxLength={500}
                    placeholder="Separadas por vírgula"
                    onChange={(e) => setForm({ ...form, palavras_chave: e.target.value })} required />
                </div>
              </div>
            )}

            {/* SEÇÃO DO AUTOR PRINCIPAL - Atualizada com novas linhas de input */}
            <div className="rounded-lg border border-border p-4 space-y-4">
              <h3 className="font-semibold text-primary">Autor principal</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="anome">Nome *</Label>
                  <Input id="anome" value={form.autor_nome} maxLength={120}
                    onChange={(e) => setForm({ ...form, autor_nome: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asobre">Sobrenome *</Label>
                  <Input id="asobre" value={form.autor_sobrenome} maxLength={120}
                    onChange={(e) => setForm({ ...form, autor_sobrenome: e.target.value })} required />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="aemail">E-mail *</Label>
                  <Input id="aemail" type="email" value={form.autor_email} maxLength={255}
                    onChange={(e) => setForm({ ...form, autor_email: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="atel">Telefone</Label>
                  <Input id="atel" value={form.autor_telefone} maxLength={30}
                    onChange={(e) => setForm({ ...form, autor_telefone: e.target.value })} />
                </div>
              </div>
              
              {/* Novos campos adicionados para o Autor */}
              <div className="space-y-2">
                <Label htmlFor="auniversidade">Universidade / Instituição *</Label>
                <Input id="auniversidade" value={form.autor_universidade} maxLength={150} placeholder="Ex: USP, Unicamp, etc."
                  onChange={(e) => setForm({ ...form, autor_universidade: e.target.value })} required />
              </div>
              <div className="grid gap-4 grid-cols-3">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="amunicipio">Município *</Label>
                  <Input id="amunicipio" value={form.autor_municipio} maxLength={100}
                    onChange={(e) => setForm({ ...form, autor_municipio: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="auf">UF *</Label>
                  <Input id="auf" value={form.autor_uf} maxLength={2} placeholder="EX: SP"
                    onChange={(e) => setForm({ ...form, autor_uf: e.target.value.slice(0, 2) })} required />
                </div>
              </div>
            </div>

            {/* SEÇÃO DOS COAUTORES - Atualizada com novos campos dinâmicos */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-primary">Coautores ({coautores.length}/{MAX_COAUTORES})</h3>
                <Button type="button" size="sm" variant="outline" onClick={addCoautor} disabled={coautores.length >= MAX_COAUTORES}>
                  <Plus className="mr-1 h-4 w-4" /> Adicionar coautor
                </Button>
              </div>
              {coautores.map((c, i) => (
                <div key={i} className="space-y-3 p-3 bg-muted/30 rounded-md border border-dashed border-border relative">
                  <div className="absolute right-2 top-2">
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeCoautor(i)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <span className="text-xs font-semibold text-muted-foreground block mb-1">Coautor #{i + 1}</span>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Nome *</Label>
                      <Input value={c.nome} maxLength={120} onChange={(e) => updateCoautor(i, "nome", e.target.value)} required />
                    </div>
                    <div>
                      <Label className="text-xs">Sobrenome *</Label>
                      <Input value={c.sobrenome} maxLength={120} onChange={(e) => updateCoautor(i, "sobrenome", e.target.value)} required />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Universidade / Instituição *</Label>
                    <Input value={c.universidade} maxLength={150} onChange={(e) => updateCoautor(i, "universidade", e.target.value)} required />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Label className="text-xs">Município *</Label>
                      <Input value={c.municipio} maxLength={100} onChange={(e) => updateCoautor(i, "municipio", e.target.value)} required />
                    </div>
                    <div>
                      <Label className="text-xs">UF *</Label>
                      <Input value={c.uf} maxLength={2} placeholder="SP" onChange={(e) => updateCoautor(i, "uf", e.target.value.slice(0, 2))} required />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button type="submit" size="lg" disabled={submitting || !tipo} className="w-full">
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
                : <><FileText className="mr-2 h-4 w-4" /> Enviar resumo</>}
            </Button>
          </form>
        </CardContent></Card>
      )}
    </div>
  );
}
