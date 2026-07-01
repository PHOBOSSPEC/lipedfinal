import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, MapPin, Loader2, Ticket, CheckCircle2, Copy, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/eventos")({
  head: () => ({
    meta: [
      { title: "Eventos — Liga de Pediatria Unioeste" },
      { name: "description", content: "Acompanhe os eventos, atividades e encontros realizados pela Liga de Pediatria da Unioeste." },
    ],
  }),
  component: EventosPage,
});

type Evento = {
  id: string; titulo: string; descricao: string;
  data_evento: string; local: string; imagem_url: string | null;
  preco: number; inscricoes_abertas: boolean;
};

const telMask = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
};

const cpfMask = (v: string) => v.replace(/\D/g, "").slice(0, 11)
  .replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");

const schema = z.object({
  nome_completo: z.string().trim().min(3, "Informe seu nome").max(150),
  email: z.string().trim().email("E-mail inválido").max(255),
  telefone: z.string().trim().min(14, "Telefone inválido").max(20),
  cpf: z.string().trim().min(14, "CPF inválido").max(14),
});

function EventosPage() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("eventos").select("id,titulo,descricao,data_evento,local,imagem_url,preco,inscricoes_abertas").order("data_evento", { ascending: false })
      .then(({ data }: any) => {
        setEventos((data as Evento[]) ?? []);
        loading && setLoading(false);
      });
  }, []);

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-primary">Eventos da Liga</h1>
        <p className="text-muted-foreground mt-2">
          Acompanhe as ações, palestras e mini-eventos da LIPED.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : eventos.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-muted-foreground">
            Nenhum evento publicado ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {eventos.map((e) => (
            <Card key={e.id} className="overflow-hidden border-border flex flex-col" style={{ boxShadow: "var(--shadow-card)" }}>
              {e.imagem_url && <img src={e.imagem_url} alt={e.titulo} className="h-48 w-full object-cover" loading="lazy" />}
              <CardContent className="pt-5 flex flex-col flex-1">
                <h2 className="text-lg font-semibold text-foreground">{e.titulo}</h2>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />
                    {new Date(e.data_evento).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })}
                  </p>
                  <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {e.local}</p>
                </div>
                <p className="mt-3 text-sm text-foreground/80 whitespace-pre-line flex-1">{e.descricao}</p>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-primary">
                    {e.preco > 0 ? `R$ ${Number(e.preco).toFixed(2)}` : "Gratuito"}
                  </span>
                  {e.inscricoes_abertas ? (
                    <Button size="sm" onClick={() => setOpenId(openId === e.id ? null : e.id)}>
                      {openId === e.id ? <><X className="mr-1 h-4 w-4" /> Fechar</> : <><Ticket className="mr-1 h-4 w-4" /> Inscrever-se</>}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Inscrições fechadas</span>
                  )}
                </div>
                {openId === e.id && <InscricaoEvento evento={e} onClose={() => setOpenId(null)} />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function InscricaoEvento({ evento, onClose }: { evento: Evento; onClose: () => void }) {
  const [form, setForm] = useState({ nome_completo: "", email: "", telefone: "", cpf: "" });
  const [submitting, setSubmitting] = useState(false);
  const [inscricao, setInscricao] = useState<{ id: string; upload_token: string; pix_chave: string | null; pix_titular: string | null } | null>(null);
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [success, setSuccess] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSubmitting(true);
    try {
      const { data, error } = await (supabase as any).rpc("criar_inscricao_evento", {
        _evento_id: evento.id,
        _nome: parsed.data.nome_completo,
        _email: parsed.data.email,
        _telefone: parsed.data.telefone,
        _cpf: parsed.data.cpf,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("Erro ao registrar inscrição");
      if (evento.preco > 0) {
        setInscricao({ id: row.id, upload_token: row.upload_token, pix_chave: row.pix_chave, pix_titular: row.pix_titular });
      } else {
        setSuccess(true);
        toast.success("Inscrição confirmada!");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao inscrever");
    } finally { setSubmitting(false); }
  };

  const confirmarPagamento = async () => {
    if (!inscricao) return;
    setConfirmando(true);
    try {
      if (comprovante) {
        // 1. Bloqueio de arquivos virtuais do Google Drive (Tamanho 0)
        if (comprovante.size === 0) {
          throw new Error("Arquivo via Google Drive não suportado. Envie um arquivo salvo diretamente do seu celular ou computador.");
        }

        // 2. Bloqueio de arquivos gigantescos (Aumentado para 10MB)
        const maxInBytes = 10 * 1024 * 1024; 
        if (comprovante.size > maxInBytes) {
          throw new Error("O comprovante é muito grande! Envie uma foto ou PDF de no máximo 10MB.");
        }

        const path = `evento-pag/${inscricao.id}-${Date.now()}-${comprovante.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("comprovantes").upload(path, comprovante);
        if (upErr) throw upErr;
        
        const { error: rpcErr } = await (supabase as any).rpc("attach_payment_proof_evento", {
          _id: inscricao.id, _token: inscricao.upload_token, _url: path,
        });
        if (rpcErr) throw rpcErr;
      }
      setSuccess(true);
      toast.success("Pagamento informado! Aguarde confirmação.");
    } catch (err: any) {
      // Captura o erro clássico de interrupção abrupta da requisição web (CORS, AdBlock ou timeout)
      if (err instanceof TypeError && err.message.includes("fetch")) {
        toast.error("Erro de conexão com o servidor! Verifique se algum AdBlock está bloqueando a rede ou tente diminuir o arquivo.");
      } else {
        toast.error(err.message ?? "Erro ao enviar comprovante.");
      }
    } finally { setConfirmando(false); }
  };

  if (success) {
    return (
      <div className="mt-4 border-t border-border pt-4 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-accent" />
        <p className="mt-2 text-sm font-semibold text-primary">Inscrição registrada!</p>
        <p className="text-xs text-muted-foreground mt-1">Aguarde a confirmação por e-mail.</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={onClose}>Fechar</Button>
      </div>
    );
  }

  if (inscricao && evento.preco > 0) {
    return (
      <div className="mt-4 border-t border-border pt-4 space-y-3 text-sm">
        <p className="font-semibold">Pague R$ {Number(evento.preco).toFixed(2)} via PIX</p>
        {inscricao.pix_chave ? (
          <div className="rounded border border-border p-3 text-xs space-y-1">
            <div><span className="text-muted-foreground">Chave:</span> <span className="font-mono">{inscricao.pix_chave}</span></div>
            {inscricao.pix_titular && <div><span className="text-muted-foreground">Titular:</span> {inscricao.pix_titular}</div>}
            <Button type="button" size="sm" variant="outline" className="mt-2"
              onClick={() => { navigator.clipboard.writeText(inscricao.pix_chave!); toast.success("Chave copiada!"); }}>
              <Copy className="mr-1 h-3 w-3" /> Copiar
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">A organização entrará em contato com os dados de pagamento.</p>
        )}
        <div className="space-y-1">
          <Label className="text-xs">Comprovante PIX (opcional, não envie pelo Drive)</Label>
          <Input type="file" accept="image/*,application/pdf" required
            onChange={(e) => setComprovante(e.target.files?.[0] ?? null)} />
        </div>
        <Button size="sm" disabled={confirmando} onClick={confirmarPagamento} className="w-full">
          {confirmando ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="mr-1 h-4 w-4" /> Confirmar pagamento</>}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 border-t border-border pt-4 space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Nome completo</Label>
        <Input value={form.nome_completo} onChange={(e) => setForm({ ...form, nome_completo: e.target.value })} required />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">E-mail</Label>
        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Telefone</Label>
        <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: telMask(e.target.value) })}
          placeholder="(45) 99999-9999" required />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">CPF</Label>
        <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: cpfMask(e.target.value) })}
          placeholder="000.000.000-00" required />
      </div>
      <Button type="submit" size="sm" disabled={submitting} className="w-full">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> :
          evento.preco > 0 ? <><Ticket className="mr-1 h-4 w-4" /> Inscrever — R$ {Number(evento.preco).toFixed(2)}</>
          : <><Ticket className="mr-1 h-4 w-4" /> Confirmar inscrição</>}
      </Button>
    </form>
  );
}
