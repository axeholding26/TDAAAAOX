import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { quotaCommandesAtteint } from "@/lib/abonnement";

// PATCH — le marchand confirme avoir reçu le cash COD remis par un livreur.
// Le livreur ne peut jamais s'auto-marquer remis (lecture seule côté livreur).
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const role = (session.user as any)?.role;
  const tenantId = (session.user as any)?.tenantId;
  const userId = (session.user as any)?.id;
  if (role !== "owner" && role !== "editeur") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  if (await quotaCommandesAtteint(tenantId)) {
    return NextResponse.json({ error: "Quota de commandes du Palier 0 atteint ce mois-ci — passez à un palier supérieur pour continuer à gérer vos commandes.", code: "quota_atteint" }, { status: 403 });
  }

  const { commandeIds } = await req.json();
  if (!Array.isArray(commandeIds) || commandeIds.length === 0) {
    return NextResponse.json({ error: "commandeIds requis" }, { status: 400 });
  }

  const { count } = await prisma.commande.updateMany({
    where: {
      id: { in: commandeIds },
      tenantId,
      methodePaiement: { in: ["whatsapp_cod", "direct_cod"] },
      statut: "livree",
      codRemis: false,
    },
    data: {
      codRemis: true,
      codRemisAt: new Date(),
      codRemisParId: userId,
    },
  });

  return NextResponse.json({ ok: true, count });
}
