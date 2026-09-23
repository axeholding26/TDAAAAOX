import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getWalletResume } from "@/lib/wallet";
import { prisma } from "@/lib/prisma";
import { boutiquesDuCompte } from "@/lib/tenant";

const WALLET_VIDE = {
  solde: 0, totalRecu: 0, totalRetire: 0, totalCommission: 0,
  soldeSequestre: 0, retraitsEnAttente: 0,
  devise: "XAF", transactions: [], retraits: [],
};

export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) return NextResponse.json({ wallet: WALLET_VIDE });

    const wallet = await getWalletResume(tenantId);

    // Soldes de toutes les boutiques POSSÉDÉES (jamais celles où l'on n'est
    // que membre d'équipe). Chaque boutique garde son wallet et sa devise :
    // un retrait se fait boutique par boutique.
    const { proprietaire } = await boutiquesDuCompte((session.user as any).id);
    const tenants = proprietaire.length > 1
      ? await prisma.tenant.findMany({
          where: { id: { in: proprietaire } },
          orderBy: { createdAt: "asc" },
          select: { id: true, nomBoutique: true, devise: true, wallet: { select: { solde: true, devise: true } } },
        })
      : [];
    const boutiques = tenants.map(t => ({
      id: t.id, nomBoutique: t.nomBoutique, active: t.id === tenantId,
      solde: t.wallet?.solde ?? 0, devise: t.wallet?.devise ?? t.devise,
    }));

    return NextResponse.json({ wallet: wallet ?? WALLET_VIDE, boutiques });
  } catch (err: any) {
    // Tables Wallet pas encore migrées → retourner wallet vide
    // Lancer : npx prisma migrate dev --name add_wallet_system
    console.warn("[wallet] Migration Prisma requise ou erreur DB:", err?.message ?? err);
    return NextResponse.json({ wallet: WALLET_VIDE });
  }
}
