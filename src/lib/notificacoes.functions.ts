import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inscricaoSchema = z.object({
  email: z.string().trim().email().max(255),
  nome: z.string().trim().min(1).max(200),
  categoria: z.string().trim().min(1).max(120),
  valor: z.number().nonnegative().optional(),
});

export const enviarEmailInscricaoCoppa = createServerFn({ method: "POST" })
  .inputValidator((i) => inscricaoSchema.parse(i))
  .handler(async ({ data }) => {
    const { sendGmail } = await import("./email.server");
    const valorTxt = typeof data.valor === "number"
      ? `<p><strong>Valor:</strong> R$ ${data.valor.toFixed(2)}</p>` : "";
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1a2540">
        <h2 style="color:#1a2540">Inscrição confirmada — III COPPA</h2>
        <p>Olá <strong>${escapeHtml(data.nome)}</strong>,</p>
        <p>Recebemos sua inscrição no COPPA e o comprovante de pagamento. Sua inscrição está em análise e você receberá novidades pelo e-mail informado.</p>
        <p><strong>Categoria:</strong> ${escapeHtml(data.categoria)}</p>
        ${valorTxt}
        <hr/>
        <p style="color:#666;font-size:12px">Este é um e-mail automático da LIPED.</p>
      </div>`;
    await sendGmail({
      to: data.email,
      subject: "Inscrição confirmada — III COPPA",
      html,
    });
    return { ok: true };
  });

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
