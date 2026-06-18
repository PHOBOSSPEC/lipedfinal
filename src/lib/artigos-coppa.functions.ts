import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const coautorSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  sobrenome: z.string().trim().min(1).max(120),
  universidade: z.string().trim().min(1).max(150),
  municipio: z.string().trim().min(1).max(100),
  uf: z.string().trim().min(2).max(2),
});

const submissaoSchema = z.object({
  titulo: z.string().trim().min(3).max(300),
  resumo: z.string().trim().max(60000).optional().default(""),
  tipo_label: z.string().trim().min(1).max(80).optional().default("Outros"),
  autor_nome: z.string().trim().min(1).max(120),
  autor_sobrenome: z.string().trim().min(1).max(120),
  autor_email: z.string().trim().email().max(255),
  autor_telefone: z.string().trim().max(30).optional().default(""),
  autor_universidade: z.string().trim().min(1).max(150),
  autor_municipio: z.string().trim().min(1).max(100),
  autor_uf: z.string().trim().min(2).max(2),
  coautores: z.array(coautorSchema).max(15).default([]),
  arquivo_url: z.string().trim().max(2000).optional().default(""),
  arquivo_nome: z.string().trim().max(255).optional().default(""),
});

const CABECALHO = [
  "Data/Hora", "Tipo", "Título", "Autor", "E-mail", "Telefone",
  "Autor - Universidade", "Autor - Município", "Autor - UF",
  "Coautores (Nome, Inst, Cidade/UF)", "Conteúdo", "Arquivo URL", "Arquivo nome", "ID",
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

    // SUPABASE REMOVIDO DAQUI COMPLETAMENTE

    // Gerando dados locais já que não vêm mais do banco de dados
    const geradoId = crypto.randomUUID();
    const dataHoraAtual = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    try {
      const sheetsApi = await getSheets();
      const sheetName = sheetNameFor(data.tipo_label);
      
      await ensureSheet(sheetsApi, spreadsheetId, sheetName);
      
      const coautoresStr = data.coautores
        .map((c) => `${c.nome} ${c.sobrenome} (${c.universidade} - ${c.municipio}/${c.uf.toUpperCase()})`)
        .join("; ");

      const row = [
        dataHoraAtual,
        data.tipo_label, 
        data.titulo,
        `${data.autor_nome} ${data.autor_sobrenome}`,
        data.autor_email, 
        data.autor_telefone || "",
        data.autor_universidade, 
        data.autor_municipio,    
        data.autor_uf.toUpperCase(), 
        coautoresStr, 
        data.resumo || "",
        data.arquivo_url || "", 
        data.arquivo_nome || "", 
        geradoId,
      ];
      
      await sheetsApi.spreadsheets.values.append({
        spreadsheetId, 
        range: `${sheetName}!A1`,
        valueInputOption: "USER_ENTERED", 
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] },
      });

    } catch (googleError: any) {
      console.error("Erro Google Sheets:", googleError?.response?.data || googleError.message);
      throw new Error(`Falha ao salvar na Planilha: ${googleError.message}`);
    }

    return { ok: true, id: geradoId, aba: data.tipo_label };
  });
