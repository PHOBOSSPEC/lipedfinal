import { useEffect, useState } from "react";
import { supabase } from "@/lib/db";

export type CoppaSettings = {
  titulo: string;
  subtitulo: string;
  periodo_texto: string;
  local: string;
  inscricoes_abertas: boolean;
  inscricoes_fechadas_msg: string;
  pix_chave: string;
  pix_titular: string;
  precos: { LIPED: number; LigaParceira: number; Academico: number; Medico: number };
  highlights: { titulo: string; descricao: string }[];
};

export type ArtigosCoppaSettings = {
  submissoes_abertas: boolean;
  titulo: string;
  descricao: string;
};

export type HomeSettings = {
  missao_titulo: string;
  missao_texto: string;
  proximo_evento_ativo: boolean;
  proximo_evento_titulo: string;
  proximo_evento_texto: string;
  proximo_evento_data: string;
};

export const DEFAULT_COPPA: CoppaSettings = {
  titulo: "III COPPA",
  subtitulo: "Congresso de Pediatria da Unioeste",
  periodo_texto: "15 a 17 de Agosto · 2026",
  local: "Cascavel — PR",
  inscricoes_abertas: true,
  inscricoes_fechadas_msg: "As inscrições estão temporariamente fechadas.",
  pix_chave: "",
  pix_titular: "",
  precos: { LIPED: 40, LigaParceira: 80, Academico: 100, Medico: 120 },
  highlights: [],
};

export const DEFAULT_ARTIGOS: ArtigosCoppaSettings = {
  submissoes_abertas: true,
  titulo: "Envie seu artigo para o COPPA",
  descricao: "Envie seu trabalho científico para análise da comissão.",
};

export const DEFAULT_HOME: HomeSettings = {
  missao_titulo: "Nossa Missão",
  missao_texto:
    "Formar acadêmicos comprometidos com a saúde integral da criança e do adolescente, integrando ensino, pesquisa e extensão por meio de atividades teórico-práticas orientadas pelos preceitos éticos e científicos da Pediatria.",
  proximo_evento_ativo: false,
  proximo_evento_titulo: "Próximo evento",
  proximo_evento_texto: "Em breve novidades!",
  proximo_evento_data: "",
};

export function useSetting<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", key).maybeSingle()
      .then(({ data }: any) => {
        if (data?.value) setValue({ ...fallback, ...(data.value as object) } as T);
        setLoading(false);
      });
  }, [key]);
  return { value, loading, setValue };
}
