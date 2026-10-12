// Une demande de devis : envoi réel à chaque fournisseur, saisie des réponses,
// comparaison automatique. Aucun faux envoi : « envoyé par e-mail » n'est
// enregistré que si le service e-mail a accepté le message ; sinon le marchand
// copie le texte (WhatsApp, messagerie de la plateforme) et le déclare envoyé.
import { NextResponse } from "next/server";
import { z } from "zod";
import { schemaDevise } from "@/lib/sourcing/cout-rendu";
import { prisma } from "@/lib/prisma";
import { emailReel, envoyerDemandeDevis } from "@/lib/email";
import { accesSourcing, erreur, reponseErreur } from "@/lib/sourcing/acces";
import { extraireReponseDevis, IaIndisponible } from "@/lib/sourcing/fournisseurs/ia";
import { chargerDevis, comparerReponses, recalculer } from "@/lib/sourcing/fournisseurs/service";
import { lirePaliers } from "@/lib/sourcing/fournisseurs/cout";

type Ctx = { params: Promise<{ id: string }> };

const vide = (v: unknown) => (v === "" ? null : v);
const txt = z.preprocess(vide, z.string().trim().max(500).nullable().optional());
const champs = z.object({
  prixUnitaire: z.preprocess(vide, z.coerce.number().positive().nullable().optional()),
  devise: z.preprocess(vide, schemaDevise.nullable().optional()),
  moq: z.preprocess(vide, z.coerce.number().int().positive().nullable().optional()),
  delaiJours: z.preprocess(vide, z.coerce.number().int().positive().max(730).nullable().optional()),
  packaging: txt, personnalisation: txt, expedition: txt, conditionsPaiement: txt,
});
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("envoyer"), fournisseurId: z.string(), canal: z.enum(["email", "manuel"]) }),
  // Réponse collée (texteBrut : l'IA en extrait les champs) ou champs saisis / corrigés à la main.
  z.object({ action: z.literal("reponse"), fournisseurId: z.string(), texteBrut: z.string().trim().max(12000).optional(), champs: champs.optional() }),
  z.object({ action: z.literal("retenir"), fournisseurId: z.string() }),
  z.object({ action: z.literal("clore") }),
]);

export async function GET(_req: Request, { params }: Ctx) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  const [demande] = await chargerDevis(acces.tenantId, (await params).id);
  if (!demande) return erreur("Demande de devis introuvable", 404);
  return NextResponse.json({ demande, comparaison: await comparerReponses(acces.tenantId, demande) });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  try {
    const d = schema.parse(await req.json());
    const [demande] = await chargerDevis(acces.tenantId, (await params).id);
    if (!demande) return erreur("Demande de devis introuvable", 404);
    if (d.action === "clore") {
      await prisma.demandeDevis.update({ where: { id: demande.id }, data: { statut: "clos" } });
      return NextResponse.json({ ok: true });
    }
    const ligne = demande.reponses.find((r) => r.fournisseurId === d.fournisseurId);
    if (!ligne) return erreur("Ce fournisseur n'est pas destinataire de la demande", 404);

    if (d.action === "envoyer") {
      if (d.canal === "email") {
        if (!emailReel(ligne.fournisseur.email)) return erreur("Ce fournisseur n'a pas d'adresse e-mail : copiez le texte et envoyez-le vous-même.", 400);
        const tenant = await prisma.tenant.findUnique({ where: { id: acces.tenantId }, select: { nomBoutique: true, email: true } });
        const parti = await envoyerDemandeDevis({ emailFournisseur: ligne.fournisseur.email, emailMarchand: tenant!.email, boutique: tenant!.nomBoutique, reference: demande.reference, texte: demande.contenu });
        if (!parti) {
          await prisma.reponseDevis.update({ where: { id: ligne.id }, data: { statutEnvoi: "echec" } });
          return erreur("L'e-mail n'a pas pu être envoyé. Copiez le texte et envoyez-le vous-même.", 502);
        }
      }
      await prisma.$transaction([
        prisma.reponseDevis.update({ where: { id: ligne.id }, data: { statutEnvoi: d.canal === "email" ? "envoye_email" : "copie_manuelle", envoyeLe: new Date() } }),
        prisma.demandeDevis.update({ where: { id: demande.id }, data: { statut: "envoye" } }),
      ]);
      return NextResponse.json({ ok: true });
    }

    if (d.action === "reponse") {
      let extraits = d.champs;
      let avertissement: string | undefined;
      if (!extraits && d.texteBrut) {
        try { extraits = await extraireReponseDevis(d.texteBrut); }
        catch (e) { if (!(e instanceof IaIndisponible)) throw e; avertissement = "Réponse enregistrée, mais l'extraction automatique est indisponible : saisissez les champs à la main."; }
        // Prix lu sans devise reconnue : la comparaison prendrait la devise de la demande. Le marchand doit la confirmer.
        if (extraits?.prixUnitaire && !extraits.devise) avertissement = "Prix lu, mais la devise n'a pas été reconnue : vérifiez-la avant de comparer les réponses.";
      }
      await prisma.reponseDevis.update({
        where: { id: ligne.id },
        data: { ...(d.texteBrut ? { texteBrut: d.texteBrut } : {}), ...extraits, recuLe: ligne.recuLe ?? new Date(), extraitPar: d.champs ? "manuel" : extraits ? "ia" : ligne.extraitPar },
      });
      return NextResponse.json({ ok: true, avertissement });
    }

    // « retenir » : la réponse devient une offre du fournisseur (prix déclaré, source « devis »).
    if (!ligne.prixUnitaire) return erreur("Cette réponse n'a pas de prix.", 400);
    const offre = { prixUnitaire: ligne.prixUnitaire, devise: ligne.devise || demande.devise, moq: ligne.moq, delaiProduction: ligne.delaiJours, source: "devis", derniereVerificationAt: ligne.recuLe ?? new Date() };
    const existante = await prisma.produitFournisseur.findFirst({ where: { tenantId: acces.tenantId, fournisseurId: ligne.fournisseurId, OR: [{ nomProduit: demande.nomProduit }, ...(demande.produitId ? [{ produitId: demande.produitId }] : [])] }, select: { id: true, paliers: true, devise: true } });
    // Le devis remplace le prix catalogue jusqu'à la quantité demandée : on ne garde que les paliers
    // supérieurs encore plus avantageux, sinon l'ancien palier masquerait le prix négocié.
    const paliers = existante && existante.devise === offre.devise ? lirePaliers(existante.paliers).filter((x) => x.quantiteMin > demande.quantite && x.prix < offre.prixUnitaire) : [];
    if (existante) await prisma.produitFournisseur.update({ where: { id: existante.id }, data: { ...offre, paliers: paliers as object[] } });
    else await prisma.produitFournisseur.create({ data: { ...offre, tenantId: acces.tenantId, fournisseurId: ligne.fournisseurId, produitId: demande.produitId, nomProduit: demande.nomProduit } });
    await recalculer(acces.tenantId, ligne.fournisseurId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  const { count } = await prisma.demandeDevis.deleteMany({ where: { id: (await params).id, tenantId: acces.tenantId } });
  return count ? NextResponse.json({ ok: true }) : erreur("Demande de devis introuvable", 404);
}
