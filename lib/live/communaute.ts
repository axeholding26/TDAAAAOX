// Communauté d'un produit (formation, bootcamp, événement) : qui parle, avec quel rôle.
// - formateur : session marchande de la boutique (droit « produits » pour un membre d'équipe) ;
// - apprenant / mentor : jeton personnel d'accès (InscriptionLive ou AccesFormation), achat payé.
// Tout autre visiteur : null → aucun droit (lib/live/regles.ts → peutCommunaute).
import { NextResponse } from "next/server";
import { prisma } from "../prisma";
import { auth } from "../auth";
import { requireNiveau } from "../permissions-server";
import { PAIEMENT } from "../commandes";
import { chargerInscription } from "./service";
import type { RoleCommunaute } from "./regles";

export type Membre = { role: RoleCommunaute; cle: string; nom: string; tenantId: string; inscriptionId?: string };

/** Session marchande propriétaire du produit (et droit « produits » en écriture si `ecriture`). */
export async function formateurDuProduit(produitId: string, ecriture = false): Promise<Membre | null> {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId as string | undefined;
  if (!tenantId) return null;
  const produit = await prisma.produit.findFirst({ where: { id: produitId, tenantId }, select: { id: true } });
  if (!produit) return null;
  if (await requireNiveau(session, "produits", ecriture ? "ecriture" : "lecture")) return null;
  return { role: "formateur", cle: "formateur", nom: (session?.user as any)?.name || "Formateur", tenantId };
}

/** Membre par jeton personnel, pour CE produit uniquement. */
export async function membreParJeton(produitId: string, token: string | null | undefined): Promise<Membre | null> {
  if (!token || token.length > 128) return null;
  const i = await chargerInscription(token);
  if (i) {
    const pid = i.evenement?.produitId ?? i.bootcamp?.produitId;
    return pid === produitId ? { role: i.role === "mentor" ? "mentor" : "apprenant", cle: i.email, nom: i.nom, tenantId: i.tenantId, inscriptionId: i.id } : null;
  }
  const a = await prisma.accesFormation.findUnique({ where: { token }, select: { produitId: true, commandeId: true, clientEmail: true, revoqueAt: true, produit: { select: { tenantId: true } } } });
  if (!a || a.produitId !== produitId || a.revoqueAt || !a.clientEmail.trim()) return null;
  const c = await prisma.commande.findUnique({ where: { id: a.commandeId }, select: { paiementStatut: true, statut: true, clientNom: true } });
  if (c?.paiementStatut !== PAIEMENT.PAYE || c.statut === "annulee") return null;
  return { role: "apprenant", cle: a.clientEmail.trim().toLowerCase(), nom: c.clientNom || "Apprenant", tenantId: a.produit.tenantId };
}

/** Formateur si la session le permet, sinon membre par jeton ; refus 403 identique sinon. */
export async function membreOuRefus(produitId: string, token: string | null | undefined, ecriture: boolean): Promise<Membre | NextResponse> {
  const m = (token ? await membreParJeton(produitId, token) : null) ?? (await formateurDuProduit(produitId, ecriture));
  return m ?? NextResponse.json({ error: "Réservé aux inscrits de ce programme" }, { status: 403 });
}

export async function espaceDuProduit(produitId: string, tenantId: string) {
  return prisma.espaceCommunaute.upsert({ where: { produitId }, create: { produitId, tenantId }, update: {} });
}
