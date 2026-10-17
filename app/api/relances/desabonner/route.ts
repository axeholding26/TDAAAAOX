// Lien en bas de chaque relance automatique (lib/relances.ts) : le client ne reçoit plus les
// relances de cette boutique. Lien signé : on ne peut désinscrire que soi-même.
import { prisma } from "@/lib/prisma";
import { signatureValide } from "@/lib/relances";

const page = (titre: string, texte: string, status = 200) => new Response(
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titre}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#FAFAFA;font-family:Poppins,system-ui,sans-serif;color:#111">
<div style="max-width:420px;margin:24px;padding:28px;background:#fff;border:1px solid #ECECEC;border-radius:16px;text-align:center">
<h1 style="font-size:18px;margin:0 0 8px">${titre}</h1><p style="font-size:14px;color:#555;line-height:1.5;margin:0">${texte}</p></div></body></html>`,
  { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
);

export async function GET(req: Request) {
  const u = new URL(req.url);
  const clientId = u.searchParams.get("c") ?? "", signature = u.searchParams.get("s") ?? "";
  if (!signatureValide(clientId, signature)) return page("Lien invalide", "Ce lien de désinscription n'est pas valide.", 400);
  const client = await prisma.client.update({ where: { id: clientId }, data: { relancesRefuseesLe: new Date() }, select: { tenant: { select: { nomBoutique: true } } } }).catch(() => null);
  if (!client) return page("Lien invalide", "Ce lien de désinscription n'est plus valide.", 404);
  const boutique = client.tenant.nomBoutique.replace(/[<>&"]/g, "");
  return page("C'est noté", `Vous ne recevrez plus les messages automatiques de ${boutique}. Vos commandes et leur suivi ne changent pas.`);
}
