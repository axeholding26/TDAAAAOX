// Assistants IA de Supplier Intelligence (voir lib/sourcing/fournisseurs/ia.ts
// pour ce que l'IA a le droit de faire) :
// - extraire : lit un texte collé et propose une fiche à valider — rien n'est enregistré ;
// - negocier : objectifs calculés sur l'offre, puis message au fournisseur ;
// - agent : AXSO Sourcing Agent, qui ne cherche que dans la base de la boutique.
import { NextResponse } from "next/server";
import { z } from "zod";
import { aiLimiter, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { accesSourcing, erreur, reponseErreur } from "@/lib/sourcing/acces";
import { agentSourcing, extraireFiche, objectifsNegociation, redigerNegociation } from "@/lib/sourcing/fournisseurs/ia";
import { rechercher } from "@/lib/sourcing/fournisseurs/service";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("extraire"), texte: z.string().trim().min(20, "Collez le texte du fournisseur").max(20000) }),
  z.object({ action: z.literal("agent"), demande: z.string().trim().min(10, "Décrivez ce que vous cherchez").max(2000) }),
  z.object({
    action: z.literal("negocier"), ref: z.string().max(80), quantite: z.coerce.number().int().positive().max(10_000_000),
    langue: z.enum(["anglais", "français", "chinois"]).default("anglais"),
    // Absents : l'API propose des objectifs. Présents (ajustés par le marchand) : elle rédige le message.
    objectifs: z.object({
      prixCible: z.coerce.number().positive(), moqCible: z.coerce.number().int().positive().nullable().optional(),
      conditionsPaiement: z.string().max(300), packaging: z.string().max(300).optional(), personnalisation: z.string().max(300).optional(),
      delaiJours: z.coerce.number().int().positive().nullable().optional(), inspection: z.string().max(300),
    }).optional(),
  }),
]);

export async function POST(req: Request) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  const rl = aiLimiter.check(`${acces.tenantId}:${getClientIp(req)}`);
  if (!rl.success) return rateLimitResponse(rl.reset);
  try {
    const d = schema.parse(await req.json());
    if (d.action === "extraire") return NextResponse.json({ fiche: await extraireFiche(d.texte) });
    if (d.action === "agent") return NextResponse.json(await agentSourcing(acces.tenantId, d.demande));

    const { candidats: [candidat] } = await rechercher(acces.tenantId, { refs: [d.ref], quantite: d.quantite });
    if (!candidat?.offre) return erreur("Offre introuvable", 404);
    const { candidats: comparables } = await rechercher(acces.tenantId, candidat.offre.produitId ? { produitId: candidat.offre.produitId, quantite: d.quantite } : { q: candidat.offre.nomProduit, quantite: d.quantite });
    const proposes = objectifsNegociation(candidat, d.quantite, comparables);
    if (!proposes) return erreur("Cette offre n'a pas de prix à négocier.", 400);
    if (!d.objectifs) return NextResponse.json({ objectifs: proposes });
    const objectifs = { ...proposes, ...d.objectifs };
    return NextResponse.json({ objectifs, ...(await redigerNegociation(objectifs, candidat.fournisseur.nom, candidat.offre.nomProduit, d.langue)) });
  } catch (e) {
    return reponseErreur(e);
  }
}
