import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getPlatformTenantId, getOrCreateWallet, getWalletResume } from "@/lib/wallet";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const platformTenantId = await getPlatformTenantId();
  // Tant qu'aucune commission/abonnement n'a encore été crédité, aucune ligne
  // Wallet n'existe pour la plateforme — on la crée pour que la réponse soit
  // toujours un wallet à 0, jamais null.
  await getOrCreateWallet(platformTenantId);
  const wallet = await getWalletResume(platformTenantId);

  return NextResponse.json({ wallet });
}
