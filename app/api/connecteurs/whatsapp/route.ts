import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { quotaCommandesAtteint } from "@/lib/abonnement";

// GET — lire la config WhatsApp du tenant
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const config = await prisma.connecteurConfig.findFirst({
    where: { tenantId, type: "whatsapp" },
    select: { statut: true, config: true, updatedAt: true },
  });

  return NextResponse.json({ config: config ?? null });
}

// POST — sauvegarder / tester la config WhatsApp
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  if (await quotaCommandesAtteint(tenantId)) {
    return NextResponse.json({ error: "Quota de commandes du Palier 0 atteint ce mois-ci — passez à un palier supérieur pour connecter WhatsApp.", code: "quota_atteint" }, { status: 403 });
  }

  const { phone_number_id, access_token, numero_affiche } = await req.json();
  if (!phone_number_id || !access_token) {
    return NextResponse.json({ error: "phone_number_id et access_token requis" }, { status: 400 });
  }

  // Tester la connexion via l'API Meta
  const testRes = await fetch(
    `https://graph.facebook.com/v22.0/${phone_number_id}?fields=display_phone_number,verified_name,quality_rating,status`,
    { headers: { Authorization: `Bearer ${access_token}` } }
  );
  const testData = await testRes.json();

  if (!testRes.ok || testData.error) {
    return NextResponse.json({
      error: testData.error?.message ?? "Connexion échouée — vérifiez vos identifiants",
    }, { status: 400 });
  }

  // Sauvegarder la config
  await prisma.connecteurConfig.upsert({
    where: { tenantId_type: { tenantId, type: "whatsapp" } },
    create: {
      tenantId,
      type: "whatsapp",
      statut: "actif",
      accessToken: access_token,
      config: {
        phone_number_id,
        numero_affiche: testData.display_phone_number ?? numero_affiche,
        verified_name: testData.verified_name,
      },
    },
    update: {
      statut: "actif",
      accessToken: access_token,
      config: {
        phone_number_id,
        numero_affiche: testData.display_phone_number ?? numero_affiche,
        verified_name: testData.verified_name,
      },
    },
  });

  // Mettre à jour whatsapp sur le tenant aussi
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { whatsappNumero: testData.display_phone_number ?? numero_affiche },
  });

  return NextResponse.json({
    success: true,
    numero: testData.display_phone_number,
    nom: testData.verified_name,
  });
}

// DELETE — désactiver la connexion
export async function DELETE() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  await prisma.connecteurConfig.updateMany({
    where: { tenantId, type: "whatsapp" },
    data: { statut: "inactif", accessToken: null },
  });

  return NextResponse.json({ success: true });
}
