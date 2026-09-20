import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getWalletResume } from "@/lib/wallet";

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

    return NextResponse.json({ wallet: wallet ?? WALLET_VIDE });
  } catch (err: any) {
    // Tables Wallet pas encore migrées → retourner wallet vide
    // Lancer : npx prisma migrate dev --name add_wallet_system
    console.warn("[wallet] Migration Prisma requise ou erreur DB:", err?.message ?? err);
    return NextResponse.json({ wallet: WALLET_VIDE });
  }
}
