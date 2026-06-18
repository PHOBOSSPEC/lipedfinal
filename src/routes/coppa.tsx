import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, MapPin, Sparkles, CreditCard, Loader2, CheckCircle2, Copy, FileText } from "lucide-react";
import { toast } from "sonner";
import { useSetting, DEFAULT_COPPA, type CoppaSettings } from "@/hooks/use-site-settings";
import { enviarEmailInscricaoCoppa } from "@/lib/notificacoes.functions";

// --- FUNÇÕES DE AUXÍLIO E VALIDAÇÃO ---

const validarCPF = (cpf: string) => {
  const cleanCPF = cpf.replace(/\D/g, "");

  if (cleanCPF.length !== 11 || /^(\d)\1+$/.test(cleanCPF)) return false;

  let soma = 0;
  let resto;

  for (let i = 1; i <= 9; i++) soma += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cleanCPF.substring(9, 10))) return false;

  soma = 0;
  for (let i = 1; i <= 10; i++) soma += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cleanCPF.substring(10, 11))) return false;

  return true;
};

const cpfMask = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

const telMask = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
};

type Categoria = "LIPED" | "LigaParceira" | "Academico" | "Medico";

const LABELS: Record<Categoria, string> = {
  LIPED: "Membro da LIPED",
  LigaParceira: "Liga Parceira",
  Academico: "Acadêmico",
  Medico: "Médico",
};

const baseSchema = z.object({
  nome_completo: z.string().trim().min(3, "Informe seu nome completo").max(150),
  cpf: z
    .string()
    .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "Formato de CPF inválido")
    .refine((val) => validarCPF(val), { message: "CPF inválido ou inexistente" }),
  email: z.string().trim().email("E-mail inválido").max(255),
  telefone: z.string().trim().min(14, "Telefone inválido").max(20),
});

export const Route = createFileRoute("/coppa")({
  head: () => ({
    meta: [
      { title: "COPPA — Congresso de Pediatria da Unioeste" },
      { name: "description", content: "Inscrições para o COPPA, o Congresso de Pediatria da Unioeste." },
      { property: "og:title", content: "COPPA — Congresso de Pediatria" },
      { property: "og:description", content: "Inscreva-se no maior congresso de pediatria do oeste do Paraná." },
    ],
  }),
  component: CoppaPage,
});

function CoppaPage() {
  const { value: settings, loading: settingsLoading } = useSetting<CoppaSettings>("coppa", DEFAULT_COPPA);
  const [form, setForm] = useState({
    nome_completo: "", cpf: "", email: "", telefone: "",
    categoria: "" as "" | Categoria, liga_parceira_nome: "", crm: "",
  });
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [pagamento, setPagamento] = useState<{ inscricaoId: string; valor: number; uploadToken: string } | null>(null);
  const [pagComprovante, setPagComprovante] = useState<File | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const enviarEmailInscricao = useServerFn(enviarEmailInscricaoCoppa);

  const PRECOS = settings.precos;

  const resetForm = () => {
    setSuccess(false); setPagamento(null); setPagComprovante(null); setComprovante(null);
    setForm({ nome_completo: "", cpf: "", email: "", telefone: "", categoria: "", liga_parceira_nome: "", crm: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const baseParse = baseSchema.safeParse(form);
    if (!baseParse.success) return toast.error(baseParse.error.issues[0].message);
    
    if (!form.categoria) return toast.error("Selecione uma categoria");

    let liga_parceira_nome: string | null = null;
    let crm: string | null = null;
    let comprovante_url: string | null = null;

    const cat = form.categoria as Categoria;

    if (cat === "LigaParceira") {
      if (!form.liga_parceira_nome.trim()) return toast.error("Informe o nome da liga parceira");
      liga_parceira_nome = form.liga_parceira_nome.trim();
    }
    if (cat === "Medico") {
      if (!form.crm.trim()) return toast.error("Informe o CRM");
      crm = form.crm.trim();
    }
    if (cat === "Academico" && !comprovante) {
      return toast.error("Envie o comprovante de matrícula");
    }

    setSubmitting(true);
    try {
      if (cat === "Academico" && comprovante) {
        const path = `matricula/${Date.now()}-${comprovante.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("comprovantes").upload(path, comprovante);
        if (upErr) throw upErr;
        comprovante_url = path;
      }
      const { data: resData, error: resErr } = await supabase.from("inscricoes_coppa").insert({
        nome_completo: baseParse.data.nome_completo, cpf: baseParse.data.cpf,
        email: baseParse.data.email, telefone: baseParse.data.telefone,
        categoria: LABELS[cat], liga_parceira_nome, crm, comprovante_url,
      }).select("id, upload_token").single();
      
      if (resErr) throw resErr;
      
      setPagamento({ 
        inscricaoId: resData.id, 
        valor: PRECOS[cat], 
        uploadToken: (resData as any).upload_token 
      });
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao processar inscrição.");
    } finally { setSubmitting(false); }
  };

  const confirmarPagamento = async () => {
    if (!pagamento) return;
    setConfirmando(true);
    try {
      if (pagComprovante) {
        const path = `pagamento/${pagamento.inscricaoId}-${Date.now()}-${pagComprovante.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("comprovantes").upload(path, pagComprovante);
        if (upErr) throw upErr;
        const { error: rpcErr } = await (supabase as any).rpc("attach_payment_proof_coppa", {
          _id: pagamento.inscricaoId, _token: pagamento.uploadToken, _url: path,
        });
        if (rpcErr) throw rpcErr;
      }
      setSuccess(true);
      toast.success(pagComprovante ? "Comprovante enviado! Aguarde a confirmação." : "Pagamento informado!");
      
      try {
        await enviarEmailInscricao({
          data: {
            email: form.email,
            nome: form.nome_completo,
            categoria: LABELS[form.categoria as Categoria],
            valor: pagamento.valor,
          },
        });
      } catch (e) {
        console.error("Falha ao enviar e-mail de confirmação:", e);
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao enviar comprovante.");
    } finally { setConfirmando(false); }
  };

  const copyPix = async () => {
    try { await navigator.clipboard.writeText(settings.pix_chave); toast.success("Chave PIX copiada!"); }
    catch { toast.error("Não foi possível copiar"); }
  };

  if (settingsLoading) {
    return <div className="flex justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div>
      <section className="relative overflow-hidden text-accent-foreground" style={{ background: "var(--gradient-coppa)" }}>
        <div className="container mx-auto px-4 py-16 md:py-24">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> {settings.inscricoes_abertas ? "Inscrições abertas" : "Em breve"}
          </span>
          <h1 className="mt-4 text-5xl md:text-7xl font-extrabold tracking-tight">{settings.titulo}</h1>
          <p className="mt-3 text-xl md:text-2xl font-medium">{settings.subtitulo}</p>
          <div className="mt-6 flex flex-wrap gap-6 text-sm md:text-base">
            <span className="inline-flex items-center gap-2"><CalendarDays className="h-5 w-5" /> {settings.periodo_texto}</span>
            <span className="inline-flex items-center gap-2"><MapPin className="h-5 w-5" /> {settings.local}</span>
          </div>
        </div>
      </section>

      {settings.highlights.length > 0 && (
        <section className="container mx-auto px-4 py-12">
          <div className="grid gap-4 md:grid-cols-3">
            {settings.highlights.map((h, idx) => (
              <Card key={idx} style={{ boxShadow: "var(--shadow-card)" }}>
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-primary">{h.titulo}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{h.descricao}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Adicionado mt-12 md:mt-16 aqui para afastar os cartões para baixo */}
      <section className="container mx-auto px-4 pb-4 mt-12 md:mt-16">
        <div className="max-w-2xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.keys(LABELS) as Categoria[]).map((c) => (
            <Card key={c} className="text-center" style={{ boxShadow: "var(--shadow-card)" }}>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">{LABELS[c]}</p>
                <p className="text-xl font-bold text-primary mt-1">R$ {PRECOS[c]}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <Card className="border-accent/40 bg-accent/5">
            <CardContent className="pt-5 pb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-accent-foreground mt-1" />
                <div>
                  <p className="font-semibold text-primary">Submeta aqui seu resumo simples!</p>
                  <p className="text-xs text-muted-foreground">Envie seu trabalho científico para análise.</p>
                </div>
              </div>
              <Button asChild variant="outline"><Link to="/enviar-artigo">Enviar resumo</Link></Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-20 pt-4">
        <div className="max-w-2xl mx-auto">
          <Card className="border-border" style={{ boxShadow: "var(--shadow-card)" }}>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold text-primary">Inscrição {settings.titulo}</h2>

              {!settings.inscricoes_abertas ? (
                <div className="mt-8 text-center py-10">
                  <Sparkles className="mx-auto h-12 w-12 text-accent" />
                  <h3 className="mt-4 text-xl font-bold text-primary">Inscrições fechadas</h3>
                  <p className="text-muted-foreground mt-2">{settings.inscricoes_fechadas_msg}</p>
                </div>
              ) : success ? (
                <div className="mt-8 text-center py-8">
                  <CheckCircle2 className="mx-auto h-16 w-16 text-accent" />
                  <h3 className="mt-4 text-xl font-bold text-primary">Inscrição registrada!</h3>
                  <p className="text-muted-foreground mt-2">
                    A LIPED irá verificar seu pagamento e confirmar sua inscrição.
                  </p>
                  <Button variant="outline" className="mt-6" onClick={resetForm}>Nova inscrição</Button>
                </div>
              ) : pagamento ? (
                <div className="mt-6 space-y-5">
                  <div className="rounded-lg border border-border p-4 bg-secondary/40">
                    <p className="text-sm text-muted-foreground">Valor a pagar</p>
                    <p className="text-3xl font-bold text-primary">R$ {pagamento.valor.toFixed(2).replace(".", ",")}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Pague via PIX para a chave abaixo</Label>
                    <div className="rounded-lg border border-border p-4 space-y-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Chave PIX</p>
                        <p className="font-mono text-lg font-semibold">{settings.pix_chave}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Titular</p>
                        <p className="text-sm">{settings.pix_titular}</p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={copyPix}>
                        <Copy className="mr-2 h-4 w-4" /> Copiar chave PIX
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pagcomp">Comprovante do PIX (opcional)</Label>
                    <Input id="pagcomp" type="file" accept="image/*,application/pdf"
                      onChange={(e) => setPagComprovante(e.target.files?.[0] ?? null)} />
                  </div>
                  <Button type="button" size="lg" disabled={confirmando} onClick={confirmarPagamento}
                    className="w-full bg-accent text-accent-foreground hover:opacity-90">
                    {confirmando ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
                      : <><CheckCircle2 className="mr-2 h-4 w-4" /> Confirmar pagamento</>}
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome Completo</Label>
                    <Input id="nome" value={form.nome_completo}
                      onChange={(e) => setForm({ ...form, nome_completo: e.target.value })} required />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="cpf">CPF</Label>
                      <Input id="cpf" value={form.cpf}
                        onChange={(e) => setForm({ ...form, cpf: cpfMask(e.target.value) })}
                        placeholder="000.000.000-00" inputMode="numeric" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telefone">Telefone</Label>
                      <Input id="telefone" value={form.telefone}
                        onChange={(e) => setForm({ ...form, telefone: telMask(e.target.value) })}
                        placeholder="(45) 99999-9999" inputMode="tel" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={form.categoria}
                      onValueChange={(v) => setForm({ ...form, categoria: v as Categoria, liga_parceira_nome: "", crm: "" })}>
                      <SelectTrigger><SelectValue placeholder="Selecione sua categoria" /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(LABELS) as Categoria[]).map((c) => (
                          <SelectItem key={c} value={c}>{LABELS[c]} — R$ {PRECOS[c]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {form.categoria === "LigaParceira" && (
                    <div className="space-y-2">
                      <Label htmlFor="liga">Nome da liga parceira</Label>
                      <Input id="liga" value={form.liga_parceira_nome}
                        onChange={(e) => setForm({ ...form, liga_parceira_nome: e.target.value })}
                        maxLength={150} required />
                    </div>
                  )}
                  {form.categoria === "Academico" && (
                    <div className="space-y-2">
                      <Label htmlFor="comp">Comprovante de matrícula</Label>
                      <Input id="comp" type="file" accept="image/*,application/pdf"
                        onChange={(e) => setComprovante(e.target.files?.[0] ?? null)} required />
                    </div>
                  )}
                  {form.categoria === "Medico" && (
                    <div className="space-y-2">
                      <Label htmlFor="crm">CRM</Label>
                      <Input id="crm" value={form.crm}
                        onChange={(e) => setForm({ ...form, crm: e.target.value })}
                        placeholder="Ex.: CRM/PR 123456" maxLength={30} required />
                    </div>
                  )}
                  <Button type="submit" disabled={submitting} size="lg"
                    className="w-full bg-accent text-accent-foreground hover:opacity-90">
                    {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</>
                      : <><CreditCard className="mr-2 h-4 w-4" /> {form.categoria ? `Gerar Pagamento — R$ ${PRECOS[form.categoria as Categoria]}` : "Gerar Pagamento"}</>}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
