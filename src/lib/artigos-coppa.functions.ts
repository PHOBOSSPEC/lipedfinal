import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const coautorSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  sobrenome: z.string().trim().min(1).max(120),
});

const submissaoSchema = z.object({
  titulo: z.string().trim().min(3).max(300),
  resumo: z.string().trim().max(60000).optional().default(""),
  tipo_label: z.string().trim().min(1).max(80).optional().default("Outros"),
  autor_nome: z.string().trim().min(1).max(120),
  autor_sobrenome: z.string().trim().min(1).max(120),
  autor_email: z.string().trim().email().max(255),
  autor_telefone: z.string().trim().max(30).optional().default(""),
  coautores: z.array(coautorSchema).max(15).default([]),
  arquivo_url: z.string().trim().max(2000).optional().default(""),
  arquivo_nome: z.string().trim().max(255).optional().default(""),
});

const CABECALHO = [
  "Data/Hora", "Tipo", "Título", "Autor", "E-mail", "Telefone",
  "Coautores", "Conteúdo", "Arquivo URL", "Arquivo nome", "ID",
];

function sheetNameFor(label: string) {
  return label.replace(/[\\/?*\[\]:]/g, " ").trim().slice(0, 80) || "Outros";
}

async function getSheets() {
  const { google } = await import("googleapis");
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON ausente");
  
  const creds = JSON.parse(json);
  const auth = new google.auth.JWT({
    email: creds.client_email,
    // ESSA LINHA É O QUE RESOLVE O ERRO 403 NO SERVIDOR:
    key: creds.private_key.replace(/\\n/g, '\n'), 
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  
  return google.sheets({ version: "v4", auth });
}

async function ensureSheet(sheets: any, spreadsheetId: string, name: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
  const exists = meta.data.sheets?.some((s: any) => s.properties.title === name);
  
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: name } } }] },
    });
    await sheets.spreadsheets.values.append({
      spreadsheetId, range: `${name}!A1`,
      valueInputOption: "USER_ENTERED", 
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [CABECALHO] },
    });
  }
}

export const enviarArtigoCoppa = createServerFn({ method: "POST" })
  .validator((input) => submissaoSchema.parse(input))
  .handler(async ({ data }) => {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID ausente");

    // 1) Salva no banco de dados (Supabase)
    const mod = await import("@/integrations/supabase/client.server");
    const supabaseAdmin: any = mod.supabaseAdmin;
    
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("submissoes_artigos_coppa")
      .insert({
        titulo: data.titulo, 
        resumo: data.resumo || null,
        autor_nome: data.autor_nome, 
        autor_sobrenome: data.autor_sobrenome,
        autor_email: data.autor_email, 
        autor_telefone: data.autor_telefone || null,
        coautores: data.coautores,
        arquivo_url: data.arquivo_url || null, 
        arquivo_nome: data.arquivo_nome || null,
      })
      .select("id, created_at").single();

    if (insertErr) throw new Error(`Falha ao salvar no Supabase: ${insertErr.message}`);

    try {
      // 2) Escreve na planilha do Google (Versão Completa)
      const sheetsApi = await getSheets();
      const sheetName = sheetNameFor(data.tipo_label);
      
      await ensureSheet(sheetsApi, spreadsheetId, sheetName);
      
      const coautoresStr = data.coautores.map((c) => `${c.nome} ${c.sobrenome}`).join("; ");
      const row = [
        new Date(inserted!.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        data.tipo_label, 
        data.titulo,
        `${data.autor_nome} ${data.autor_sobrenome}`,
        data.autor_email, 
        data.autor_telefone || "",
        coautoresStr, 
        data.resumo || "",
        data.arquivo_url || "", 
        data.arquivo_nome || "", 
        inserted!.id,
      ];
      
      await sheetsApi.spreadsheets.values.append({
        spreadsheetId, 
        range: `${sheetName}!A1`,
        valueInputOption: "USER_ENTERED", 
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] },
      });

      // 3) Atualiza o banco
      await supabaseAdmin.from("submissoes_artigos_coppa")
        .update({ enviado_planilha: true }).eq("id", inserted!.id);

    } catch (googleError: any) {
      console.error("Erro Google Sheets:", googleError?.response?.data || googleError.message);
    }

    return { ok: true, id: inserted!.id, aba: data.tipo_label };
  });
