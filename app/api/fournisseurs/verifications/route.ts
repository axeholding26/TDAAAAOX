// File de vérification des admins AXSO, toutes boutiques confondues.
// - par défaut : ce qui attend un contrôle (document ou audit « déclaré » avec
//   une pièce, vérification d'identité / d'entreprise / de fabricant retirée
//   après une modification du marchand) ;
// - `?tous=1` ou `?q=nom` : n'importe quel fournisseur, pour vérifier son
//   identité ou son entreprise, corriger ou retirer une vérification donnée.
// Lecture ouverte aux admins lecteurs ; l'écriture (/[id]/verifier) exige un
// admin complet : `peutEcrire` le dit à l'écran.
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";
import { erreur } from "@/lib/sourcing/acces";
import { CHAMPS_VERIFIABLES } from "@/lib/sourcing/fournisseurs/types";

const CHAMPS = Object.keys(CHAMPS_VERIFIABLES);

export async function GET(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return erreur("Réservé aux administrateurs AXSO", 403);
  const params = new URL(req.url).searchParams;
  const q = params.get("q")?.trim().slice(0, 100);
  const tous = !!q || params.get("tous") === "1";
  const where: Prisma.FournisseurWhereInput = tous
    ? (q ? { nom: { contains: q, mode: "insensitive" } } : {})
    : {
        actif: true,
        OR: [
          { documents: { some: { statutVerification: "declare_fournisseur", url: { not: null } } } },
          { audits: { some: { confiance: "declare_fournisseur", rapportUrl: { not: null } } } },
          { verifications: { some: { champ: { in: CHAMPS }, niveau: "declare_fournisseur" } } },
        ],
      };
  const trouves = await prisma.fournisseur.findMany({
    where,
    select: {
      id: true, tenantId: true, nom: true, pays: true, actif: true, typeEntreprise: true, url: true, email: true, telephone: true,
      adresseUsine: true, numeroLicence: true, anneeCreation: true, nbEmployes: true, capaciteProduction: true,
      documents: { orderBy: { createdAt: "desc" } },
      audits: { orderBy: { createdAt: "desc" } },
      verifications: { where: { champ: { in: CHAMPS } }, orderBy: { createdAt: "desc" } },
    },
    orderBy: { updatedAt: "desc" }, take: 100,
  });
  // Une vérification retirée ne reste en file que tant qu'elle est la dernière ligne de son champ.
  const fournisseurs = tous ? trouves : trouves.filter((f) =>
    f.documents.some((d) => d.statutVerification === "declare_fournisseur" && d.url)
    || f.audits.some((a) => a.confiance === "declare_fournisseur" && a.rapportUrl)
    || CHAMPS.some((c) => f.verifications.find((v) => v.champ === c)?.niveau === "declare_fournisseur"));
  const boutiques = await prisma.tenant.findMany({ where: { id: { in: [...new Set(fournisseurs.map((f) => f.tenantId))] } }, select: { id: true, nomBoutique: true } });
  const nom = new Map(boutiques.map((b) => [b.id, b.nomBoutique]));
  return NextResponse.json({ peutEcrire: estAdminComplet(admin), fournisseurs: fournisseurs.map((f) => ({ ...f, boutique: nom.get(f.tenantId) ?? "" })) });
}
