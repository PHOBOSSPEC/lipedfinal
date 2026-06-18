import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FileText, Loader2, Search } from "lucide-react";

export const Route = createFileRoute("/trabalhos")({
  head: () => ({
    meta: [
      { title: "Trabalhos Científicos — Liga de Pediatria Unioeste" },
      { name: "description", content: "Artigos científicos publicados pela Liga de Pediatria da Unioeste." },
    ],
  }),
  component: ArtigosPage,
});

type Artigo = { id: string; titulo: string; arquivo_url: string; created_at: string };

function ArtigosPage() {
  const [artigos, setArtigos] = useState<Artigo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    supabase
      .from("artigos")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }: any) => {
        setArtigos(data ?? []);
        setLoading(false);
      });
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return artigos;
    return artigos.filter((a) => a.titulo.toLowerCase().includes(q));
  }, [artigos, busca]);

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-primary">Artigos Científicos</h1>
        <p className="text-muted-foreground mt-2">
          Produção científica da Liga de Pediatria da Unioeste.
        </p>
      </div>

      <div className="relative mb-8 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar artigo pelo título..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtrados.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-muted-foreground">
            {artigos.length === 0 ? "Nenhum artigo publicado ainda." : "Nenhum artigo encontrado para esta busca."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtrados.map((a) => (
            <Card key={a.id} className="border-border" style={{ boxShadow: "var(--shadow-card)" }}>
              <CardContent className="pt-6 flex items-start gap-4">
                <div className="rounded-lg bg-secondary p-3 text-primary">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground line-clamp-2">{a.titulo}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Publicado em {new Date(a.created_at).toLocaleDateString("pt-BR")}
                  </p>
                  <a
                    href={a.arquivo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-3 text-sm font-medium text-primary hover:underline"
                  >
                    Abrir PDF →
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
