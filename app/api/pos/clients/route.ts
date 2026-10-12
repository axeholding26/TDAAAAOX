// Clients de la caisse.
// GET  /api/pos/clients?q=&limite= — droits : vendre, gerer_clients, gerer_credit ou gerer_fidelite.
//   q = téléphone, nom, e-mail, code client, ou contenu du QR de la carte client
//   (« AXSO-CLIENT:<code> »). Sans q : les clients les plus récents.
//   Réponse : { clients: ResumeClient[] }.
// POST /api/pos/clients — création rapide. Droits : vendre ou gerer_clients.
//   Corps : { nom, telephone, email?, cle? }. Réponse 201 : { ok, client }.
//   Un téléphone ou un e-mail déjà connu rend 409 « client_existant » avec le
//   client dans `details.client` : la caisse le sélectionne au lieu de le recréer.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { routePos } from "@/lib/pos/acces";
import { exigerUnDroit } from "@/lib/pos/droits";
import { ErreurPos } from "@/lib/pos/erreurs";
import { journaliserAudit } from "@/lib/pos/audit";
import { lireReglagesPos } from "@/lib/pos/flags";
import { derniersAchats } from "@/lib/pos/promotions/segments";
import { HORS_CLIENT_FICTIF, PREFIXE_QR, SELECTION_CLIENT, nouveauCodeClient, resumeClient } from "./_clients";

export const GET = routePos(async (ctx, req) => {
  exigerUnDroit(ctx, "vendre", "gerer_clients", "gerer_credit", "gerer_fidelite");
  const url = new URL(req.url);
  const brut = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  const q = brut.toUpperCase().startsWith(PREFIXE_QR) ? brut.slice(PREFIXE_QR.length).trim() : brut;
  const chiffres = q.replace(/\D/g, "");
  const limite = Math.min(Math.max(Number(url.searchParams.get("limite")) || 20, 1), 50);

  const clients = await prisma.client.findMany({
    where: {
      tenantId: ctx.tenantId,
      AND: [
        HORS_CLIENT_FICTIF,
        q ? {
          OR: [
            { codeClient: q.toUpperCase() },
            { nom: { contains: q, mode: "insensitive" } },
            { telephone: { contains: q } },
            { email: { contains: q, mode: "insensitive" } },
            // « 6 99 12 34 56 » saisi avec des espaces retrouve « 699123456 ».
            ...(chiffres.length >= 4 && chiffres !== q ? [{ telephone: { contains: chiffres } }] : []),
          ],
        } : {},
      ],
    },
    select: SELECTION_CLIENT,
    orderBy: q ? [{ totalCommandes: "desc" }, { nom: "asc" }] : [{ createdAt: "desc" }],
    take: limite,
  });
  const achats = await derniersAchats(prisma, ctx.tenantId, clients.map((c) => c.id));
  return { clients: clients.map((c) => resumeClient(c, achats.get(c.id) ?? null)) };
});

const schemaCreation = z.object({
  nom: z.string().trim().min(2, "Indiquez le nom du client.").max(80),
  telephone: z.string().trim().min(6, "Indiquez un numéro de téléphone valide.").max(30).regex(/^[+\d][\d\s().-]*$/, "Indiquez un numéro de téléphone valide."),
  email: z.string().trim().toLowerCase().email().max(120).nullish().or(z.literal("")),
});

export const POST = routePos(async (ctx, req) => {
  exigerUnDroit(ctx, "vendre", "gerer_clients");
  const d = schemaCreation.parse(await req.json());
  const email = d.email || null;
  const { reglages } = await lireReglagesPos(ctx.tenantId);

  const client = await prisma.$transaction(async (tx) => {
    // Sous le verrou de la boutique : ni code client en double, ni deux fiches pour le même téléphone.
    const codeClient = await nouveauCodeClient(tx, ctx.tenantId);
    const existant = await tx.client.findFirst({
      where: { tenantId: ctx.tenantId, OR: [{ telephone: d.telephone }, ...(email ? [{ email }] : [])] },
      select: SELECTION_CLIENT,
    });
    if (existant) {
      throw new ErreurPos("client_existant", 409, `Ce ${existant.telephone === d.telephone ? "numéro" : "e-mail"} est déjà celui de ${existant.nom}. Sélectionnez ce client.`, { client: resumeClient(existant, null) });
    }
    const cree = await tx.client.create({
      data: {
        tenantId: ctx.tenantId, nom: d.nom, telephone: d.telephone, email, codeClient,
        creditPlafond: reglages.credit.actif ? reglages.credit.plafondDefaut : 0,
      },
      select: SELECTION_CLIENT,
    });
    await journaliserAudit(tx, ctx, { action: "client.cree", entite: "Client", entiteId: cree.id, apres: { nom: cree.nom, telephone: cree.telephone, codeClient, creditPlafond: cree.creditPlafond } });
    return cree;
  });
  return NextResponse.json({ ok: true, client: resumeClient(client, null) }, { status: 201 });
});
