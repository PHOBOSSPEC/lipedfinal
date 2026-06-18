// Helper server-only para enviar e-mail via conector Gmail (planilhasite01@gmail.com)
const GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function b64url(s: string) {
  // utf8-safe base64url
  const b64 = Buffer.from(s, "utf-8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildRaw({ to, from, subject, html }: { to: string; from: string; subject: string; html: string }) {
  const subjectEnc = `=?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`;
  const msg = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subjectEnc}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    html,
  ].join("\r\n");
  return b64url(msg);
}

export async function sendGmail(opts: { to: string; subject: string; html: string; from?: string }) {
  const lovable = process.env.LOVABLE_API_KEY;
  const gmail = process.env.GOOGLE_MAIL_API_KEY;
  if (!lovable) throw new Error("LOVABLE_API_KEY ausente");
  if (!gmail) throw new Error("Gmail não conectado (GOOGLE_MAIL_API_KEY ausente)");

  const raw = buildRaw({
    to: opts.to,
    from: opts.from ?? "LIPED <planilhasite01@gmail.com>",
    subject: opts.subject,
    html: opts.html,
  });

  const res = await fetch(`${GATEWAY}/users/me/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovable}`,
      "X-Connection-Api-Key": gmail,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Falha ao enviar e-mail (HTTP ${res.status}): ${txt}`);
  }
  return await res.json();
}
