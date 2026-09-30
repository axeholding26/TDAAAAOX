// Actions d'administration de la plateforme — partagées par les routes
// app/api/admin/* (boutons de l'admin) et par AXIA admin, pour que les deux
// appliquent exactement les mêmes contrôles. Le contrôle du rôle (admin
// complet) reste à la charge de l'appelant.
import { prisma } from "@/lib/prisma";
import { crediterBonusWallet, getPlatformTenantId, initierRetrait } from "@/lib/wallet";

export class ErreurAdmin extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export const STATUTS_BOUTIQUE = ["active", "suspendu", "supprime"] as const;
export const PLANS = ["palier0", "palier1", "palier2"] as const;

async function boutiqueModifiable(id: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { statut: true, devise: true } });
  if (!tenant) throw new ErreurAdmin("Boutique introuvable", 404);
  if (tenant.statut === "systeme") throw new ErreurAdmin("Boutique système, non modifiable");
  return tenant;
}

export async function changerStatutBoutique(id: string, statut: string) {
  if (!STATUTS_BOUTIQUE.includes(statut as any)) throw new ErreurAdmin(`Statut invalide. Valeurs acceptées : ${STATUTS_BOUTIQUE.join(", ")}`);
  await boutiqueModifiable(id);
  await prisma.tenant.update({ where: { id }, data: { statut } });
  return { statut };
}

export async function changerPlanBoutique(id: string, plan: string, jours?: number) {
  if (!PLANS.includes(plan as any)) throw new ErreurAdmin(`Plan invalide. Valeurs acceptées : ${PLANS.join(", ")}`);
  await boutiqueModifiable(id);
  const planExpiresAt = plan === "palier0" ? null : new Date(Date.now() + (Number(jours) || 30) * 24 * 3600 * 1000);
  await prisma.tenant.update({ where: { id }, data: { planType: plan, planExpiresAt, planPendingRef: null } });
  return { plan, planExpiresAt };
}

export async function certifierBoutique(id: string, certifie: boolean) {
  const tenant = await prisma.tenant.update({ where: { id }, data: { certifie: !!certifie } }).catch(() => null);
  if (!tenant) throw new ErreurAdmin("Boutique introuvable", 404);
  return { certifie: tenant.certifie };
}

export async function recompenserBoutique(id: string, r: { montant?: number; raison?: string; emoji?: string; titre?: string }) {
  const tenant = await boutiqueModifiable(id);
  if (r.montant && Number(r.montant) > 0) {
    try {
      await crediterBonusWallet(id, Number(r.montant), tenant.devise, r.raison || "Récompense Axso");
    } catch (err: any) {
      throw new ErreurAdmin(err?.message ?? "Erreur bonus");
    }
  }
  if (r.titre?.trim()) {
    await prisma.badgeMarchand.create({
      data: { tenantId: id, type: `recompense_${Date.now()}`, titre: r.titre.trim(), description: r.raison || undefined, emoji: r.emoji || "🏆" },
    });
  }
}

export async function publierPostAxsocial(contenu: string, type?: string) {
  if (!contenu?.trim()) throw new ErreurAdmin("Contenu requis");
  return prisma.postSocial.create({
    data: { tenantId: await getPlatformTenantId(), type: type || "post", contenu: contenu.slice(0, 2000) },
  });
}

export async function supprimerPostAxsocial(id: string) {
  const post = await prisma.postSocial.findUnique({ where: { id } });
  if (!post || post.tenantId !== (await getPlatformTenantId())) throw new ErreurAdmin("Publication introuvable", 404);
  await prisma.postSocial.delete({ where: { id } });
}

export async function revoquerMembreAdmin(id: string, parUserId: string) {
  if (id === parUserId) throw new ErreurAdmin("Impossible de te révoquer toi-même");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== "admin_lecteur") throw new ErreurAdmin("Seuls les comptes en lecture seule peuvent être révoqués ici");
  await prisma.user.delete({ where: { id } });
}

export async function retirerWalletPlateforme(r: { montant: number; methode: string; destinataire: string; operateur?: string; notes?: string }) {
  if (!r.montant || r.montant <= 0) throw new ErreurAdmin("Montant invalide");
  if (!["mobile_money", "virement_bancaire"].includes(r.methode)) throw new ErreurAdmin("Méthode invalide");
  if (!r.destinataire?.trim()) throw new ErreurAdmin("Destinataire requis");
  try {
    return await initierRetrait({ tenantId: await getPlatformTenantId(), montant: Number(r.montant), devise: "XAF", methode: r.methode as any, destinataire: r.destinataire, operateur: r.operateur, notes: r.notes });
  } catch (err: any) {
    throw new ErreurAdmin(err?.message ?? "Erreur retrait");
  }
}

/** Réponse JSON d'erreur pour les routes admin. */
export function reponseErreur(err: unknown) {
  if (err instanceof ErreurAdmin) return Response.json({ error: err.message }, { status: err.status });
  throw err;
}
