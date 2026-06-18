import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HeartPulse, BookOpen, Users, Award, ArrowRight, Star, CalendarClock } from "lucide-react";
import { useSetting, DEFAULT_HOME, type HomeSettings } from "@/hooks/use-site-settings";



export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Início — Liga de Pediatria Unioeste" },
      { name: "description", content: "Conheça a missão, os membros e as atividades da Liga Acadêmica de Pediatria da Unioeste." },
      { property: "og:title", content: "Liga de Pediatria Unioeste" },
      { property: "og:description", content: "Educação, pesquisa e extensão em pediatria." },
    ],
  }),
  component: HomePage,
});

type Membro = {
  id: string; nome: string; cargo: string; iniciais: string;
  foto_url: string | null; destaque: boolean; ordem: number;
};

function HomePage() {
  const [membros, setMembros] = useState<Membro[]>([]);
  const { value: home } = useSetting<HomeSettings>("home", DEFAULT_HOME);

  useEffect(() => {
    supabase.from("membros").select("*")
      .order("destaque", { ascending: false })
      .order("ordem", { ascending: true })
      .then(({ data }: any) => setMembros((data as Membro[]) ?? []));
  }, []);

  const preceptor = membros.find((m) => m.destaque) ?? null;
  const diretoria = membros.filter((m) => !m.destaque);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        <div className="container mx-auto px-4 py-20 md:py-28 text-primary-foreground">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur">
              <HeartPulse className="h-3.5 w-3.5" /> Cuidando do futuro da pediatria
            </span>
            <h1 className="mt-5 text-4xl md:text-6xl font-bold tracking-tight drop-shadow">
              Liga Acadêmica de Pediatria Unioeste Campus Cascavel
            </h1>
            <p className="mt-5 text-lg md:text-xl text-primary-foreground/95">
              Promovendo educação, pesquisa e assistência humanizada à saúde da criança e do
              adolescente desde a graduação.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-accent text-accent-foreground hover:opacity-90">
                <Link to="/coppa">Inscreva-se no III COPPA <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link to="/eventos">Ver eventos</Link>
              </Button>
            </div>
          </div>
        </div>

      </section>

      {/* Próximo evento (editável no admin) */}
      {home.proximo_evento_ativo && (
        <section className="container mx-auto px-4 pt-8 -mb-4">
          <div className="rounded-2xl border border-accent/30 bg-accent/10 px-5 py-4 flex items-start gap-3 max-w-3xl mx-auto">
            <CalendarClock className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                {home.proximo_evento_titulo}
              </p>
              <p className="text-sm text-foreground mt-0.5 whitespace-pre-line">{home.proximo_evento_texto}</p>
              {home.proximo_evento_data && (
                <p className="text-xs text-muted-foreground mt-1">{home.proximo_evento_data}</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Mission */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: BookOpen, title: "Ensino", desc: "Estudo dirigido, discussões clínicas e mentoria com pediatras." },
            { icon: Users, title: "Extensão", desc: "Ações comunitárias, palestras em escolas e atendimento solidário." },
            { icon: Award, title: "Pesquisa", desc: "Produção científica, apresentações e publicações em congressos." },
          ].map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="border-border" style={{ boxShadow: "var(--shadow-card)" }}>
              <CardContent className="pt-6">
                <Icon className="h-8 w-8 text-primary" />
                <h3 className="mt-3 text-lg font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Mission text (editável no admin) */}
      <section className="bg-secondary/40 border-y border-border">
        <div className="container mx-auto px-4 py-14 max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-primary">{home.missao_titulo}</h2>
          <p className="mt-4 text-muted-foreground leading-relaxed whitespace-pre-line">
            {home.missao_texto}
          </p>
        </div>
      </section>

      {/* Membros */}
      {(preceptor || diretoria.length > 0) && (
        <section className="container mx-auto px-4 py-16">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold text-primary">Membros</h2>
            <p className="text-muted-foreground mt-1">Conheça nossa preceptoria e diretoria.</p>
          </div>

          {preceptor && (
            <div className="mb-12 flex justify-center">
              <Card
                className="border-2 border-accent max-w-md w-full"
                style={{ boxShadow: "var(--shadow-card)", background: "var(--gradient-hero)" }}
              >
                <CardContent className="pt-8 pb-6 text-center text-primary-foreground">
                  <div className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur mb-4">
                    <Star className="h-3.5 w-3.5" /> Preceptor da Liga
                  </div>
                  {preceptor.foto_url ? (
                    <img src={preceptor.foto_url} alt={preceptor.nome}
                      className="mx-auto h-28 w-28 rounded-full object-cover border-4 border-white/30" />
                  ) : (
                    <div className="mx-auto h-28 w-28 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-bold border-4 border-white/30">
                      {preceptor.iniciais}
                    </div>
                  )}
                  <h3 className="mt-4 text-xl font-bold">{preceptor.nome}</h3>
                  <p className="text-sm text-primary-foreground/90 mt-1">{preceptor.cargo}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {diretoria.length > 0 && (
            <>
              <h3 className="text-xl font-semibold text-primary text-center mb-6">Diretoria e ligantes</h3>
              <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {diretoria.map((m) => (
                  <Card key={m.id} className="border-border hover:-translate-y-0.5 transition-transform" style={{ boxShadow: "var(--shadow-card)" }}>
                    <CardContent className="pt-6 text-center">
                      {m.foto_url ? (
                        <img src={m.foto_url} alt={m.nome} className="mx-auto h-16 w-16 rounded-full object-cover" />
                      ) : (
                        <div className="mx-auto h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold">
                          {m.iniciais}
                        </div>
                      )}
                      <h3 className="mt-3 font-semibold text-foreground text-sm">{m.nome}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{m.cargo}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
