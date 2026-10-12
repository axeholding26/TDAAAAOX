// Vérification d'un fournisseur — réservée aux admins AXSO (rôle « admin »).
// C'est le SEUL endroit où un niveau « vérifié » peut être écrit : identité,
// entreprise, informations fabricant, document ou audit. Chaque décision est
// tracée (qui, quand, quelle source) ; la source est obligatoire.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";
import { notifierMarchand } from "@/lib/notifications-marchand";
import { erreur, reponseErreur } from "@/lib/sourcing/acces";
import { recalculer } from "@/lib/sourcing/fournisseurs/service";
import { CHAMPS_VERIFIABLES, LIBELLES_CONFIANCE, NIVEAUX_CONFIANCE } from "@/lib/sourcing/fournisseurs/types";

const base = { source: z.string().trim().min(5, "Indiquez la source de la vérification").max(300), note: z.string().trim().max(1000).optional() };
const schema = z.discriminatedUnion("cible", [
  z.object({ cible: z.literal("champ"), champ: z.enum(Object.keys(CHAMPS_VERIFIABLES) as [string, ...string[]]), niveau: z.enum(NIVEAUX_CONFIANCE), ...base }),
  z.object({ cible: z.literal("document"), documentId: z.string(), niveau: z.enum([...NIVEAUX_CONFIANCE, "rejete"]), ...base }),
  z.object({ cible: z.literal("audit"), auditId: z.string(), niveau: z.enum(NIVEAUX_CONFIANCE), ...base }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!estAdminComplet(admin)) return erreur("Réservé aux administrateurs AXSO", 403);
  const { id } = await params;
  try {
    const d = schema.parse(await req.json());
    const fournisseur = await prisma.fournisseur.findUnique({ where: { id }, select: { id: true, tenantId: true, nom: true } });
    if (!fournisseur) return erreur("Fournisseur introuvable", 404);
    const source = `Admin AXSO — ${d.source}`;
    const trace = { tenantId: fournisseur.tenantId, fournisseurId: id, niveau: d.niveau, source, verifieParId: admin!.userId, note: d.note };
    let objet: string;

    if (d.cible === "champ") {
      await prisma.verificationFournisseur.create({ data: { ...trace, champ: d.champ } });
      objet = CHAMPS_VERIFIABLES[d.champ];
    } else if (d.cible === "document") {
      const { count } = await prisma.documentFournisseur.updateMany({
        where: { id: d.documentId, fournisseurId: id },
        data: { statutVerification: d.niveau, sourceVerification: source, verifieParId: admin!.userId, verifieLe: new Date() },
      });
      if (!count) return erreur("Document introuvable", 404);
      await prisma.verificationFournisseur.create({ data: { ...trace, niveau: d.niveau === "rejete" ? "inconnu" : d.niveau, champ: `document:${d.documentId}`, note: d.niveau === "rejete" ? `Rejeté. ${d.note ?? ""}`.trim() : d.note } });
      objet = "Document";
    } else {
      const { count } = await prisma.auditFournisseur.updateMany({ where: { id: d.auditId, fournisseurId: id }, data: { confiance: d.niveau, sourceVerification: source } });
      if (!count) return erreur("Audit introuvable", 404);
      await prisma.verificationFournisseur.create({ data: { ...trace, champ: `audit:${d.auditId}` } });
      objet = "Audit";
    }

    await recalculer(fournisseur.tenantId, id);
    await notifierMarchand({
      tenantId: fournisseur.tenantId, type: "fournisseur_verification", titre: `${fournisseur.nom} — vérification AXSO`,
      message: `${objet} : ${d.niveau === "rejete" ? "rejeté" : LIBELLES_CONFIANCE[d.niveau].toLowerCase()} (${d.source}).`,
      lien: `/dashboard/sourcing/fournisseurs/${id}`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return reponseErreur(e);
  }
}
