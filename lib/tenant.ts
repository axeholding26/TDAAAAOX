// Résolution multi-tenant pour Axso
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { estRoleAdmin } from "@/lib/command-center/rbac";
import { cookies } from "next/headers";
import { COOKIE_APERCU, lireJetonApercu } from "@/lib/builder/apercu";

/**
 * Boutique publiée : les rappels « pas encore publiée » (notification de création,
 * constat AXIA) deviennent faux — on les retire. Appelé par chaque chemin de publication.
 */
export async function oublierRappelsBrouillon(tenantId: string) {
  await Promise.all([
    prisma.notificationMarchand.deleteMany({ where: { tenantId, type: "boutique_a_completer" } }),
    prisma.axiaProposition.updateMany({ where: { tenantId, type: "boutique_brouillon", statut: { in: ["nouveau", "vu"] } }, data: { statut: "execute" } }),
  ]);
}

/**
 * Ids des boutiques accessibles à un compte : celles qu'il possède
 * (ProprietaireBoutique) et celles où il est membre d'équipe actif.
 * La propriété ne se déduit JAMAIS de User.tenantId (boutique active, réécrite
 * par /api/boutiques/switch, aussi renseignée pour un membre invité) : seul
 * rattrapage, un compte ancien sans aucune boutique ni équipe, sur une boutique
 * qui n'a encore aucun propriétaire.
 */
export async function boutiquesDuCompte(userId: string): Promise<{ proprietaire: string[]; membre: string[] }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      tenantId: true, role: true,
      boutiques: { select: { tenantId: true } },
      membresEquipe: { select: { tenantId: true, statut: true } },
    },
  });
  if (!user) return { proprietaire: [], membre: [] };

  const proprietaire = user.boutiques.map(b => b.tenantId);
  if (user.tenantId && user.role === "owner" && !proprietaire.length && !user.membresEquipe.length
    && !(await prisma.proprietaireBoutique.findFirst({ where: { tenantId: user.tenantId }, select: { id: true } }))) {
    await prisma.proprietaireBoutique.create({ data: { userId, tenantId: user.tenantId, role: "owner" } });
    proprietaire.push(user.tenantId);
  }
  return { proprietaire, membre: user.membresEquipe.filter(m => m.statut === "actif").map(m => m.tenantId) };
}

/**
 * Une boutique non publiée est invisible du public (404). Pour son équipe
 * connectée, la page ne lève pas de 404 : le layout de la vitrine affiche à
 * la place un message l'invitant à publier (components/storefront/BoutiqueNonPubliee).
 */
export async function boutiqueVisible(tenant: { id: string; statut: string }): Promise<boolean> {
  if (tenant.statut === "active") return true;
  // Lien d'aperçu signé du Builder pour cette boutique (lib/builder/apercu.ts) : visible pour ce navigateur seulement.
  if (lireJetonApercu((await cookies()).get(COOKIE_APERCU)?.value) === tenant.id) return true;
  const session = await auth();
  const role = (session?.user as any)?.role;
  // Propriétaire (aperçu) ou admin AXSO (modération depuis /admin/boutiques).
  return (session?.user as any)?.tenantId === tenant.id || estRoleAdmin(role);
}
