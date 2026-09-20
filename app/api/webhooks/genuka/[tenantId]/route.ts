// Webhook Genuka par boutique — chaque commerçant colle cette URL (avec son
// tenantId) dans les paramètres Webhooks de son propre compte Genuka. Le
// tenantId dans l'URL identifie la boutique de façon fiable (contrairement à
// une route globale, qui ne peut pas savoir de quel compte Genuka vient
// l'appel). La confirmation automatique de commande par mot-clé n'a lieu que
// si la signature est vérifiée, pour éviter qu'un tiers connaissant le
// tenantId ne confirme des commandes à distance en forgeant des messages.
//
// ⚠️ La forme exacte du payload "message.received" n'est pas garantie par la
// doc publique (seul un exemple de test minimal est documenté). Le payload
// brut est toujours journalisé dans MessageRecu.payload pour inspection.
// Docs : https://docs.genuka.com/merchant-api/12-inbox-messaging.md
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierSignatureGenukaWebhook } from "@/lib/genuka";
import { notifierClientWhatsApp } from "@/lib/whatsapp";
import { quotaCommandesAtteint } from "@/lib/abonnement";

const MOTS_CONFIRMATION = [
  "oui", "confirmer", "confirme", "ok", "1", "yes",
  "valider", "valide", "d'accord", "accord", "c'est bon", "cest bon",
];

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const rawBody = await req.text();

  const cfg = await prisma.connecteurConfig.findFirst({
    where: { tenantId, type: "whatsapp_genuka" },
    select: { config: true, statut: true },
  });
  if (!cfg || cfg.statut !== "actif") {
    return NextResponse.json({ error: "Boutique non connectée à Genuka" }, { status: 404 });
  }

  const webhookSecret = (cfg.config as any)?.webhookSecret as string | undefined;
  // Observé en prod : Genuka envoie la signature dans un header "signature",
  // pas "x-genuka-signature" comme documenté ailleurs.
  const sig = req.headers.get("signature") ?? req.headers.get("x-genuka-signature");
  const verifie = verifierSignatureGenukaWebhook(rawBody, sig, webhookSecret);

  // Le format de signature de Genuka n'est pas garanti par leur doc publique —
  // observé en prod : les signatures ne matchent pas le HMAC attendu. On ne
  // bloque donc plus l'affichage des messages sur un échec de vérification,
  // seule la confirmation auto de commande (action à effet de bord) reste
  // désactivée tant que la signature n'est pas vérifiée.
  if (webhookSecret && !verifie) {
    console.warn(`[webhook/genuka/${tenantId}] Signature non vérifiée (en-têtes: ${[...req.headers.keys()].join(", ")} · sig reçue: ${sig ?? "aucune"}) — message accepté sans confirmation auto`);
  }

  let body: any;
  try { body = JSON.parse(rawBody); }
  catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  if (body.event !== "message.received") {
    console.info(`[webhook/genuka/${tenantId}] Événement ignoré: "${body.event}" (attendu: message.received) — payload: ${rawBody.slice(0, 300)}`);
    return NextResponse.json({ received: true });
  }

  // Quota Palier 0 atteint : WhatsApp est verrouillé — on répond quand même
  // 200 (ne jamais casser l'intégration côté Genuka) mais sans rien traiter.
  if (await quotaCommandesAtteint(tenantId)) {
    return NextResponse.json({ received: true });
  }

  traiterMessage(tenantId, body, verifie).catch((err) => console.error(`[webhook/genuka/${tenantId}] Erreur traitement:`, err));

  return NextResponse.json({ received: true });
}

async function traiterMessage(tenantId: string, body: any, verifie: boolean) {
  const data = body.data ?? {};
  const message = data.message ?? {};
  const conversation = data.conversation ?? {};
  const contact = conversation.contact ?? data.contact ?? {};

  const de: string | undefined = contact.phone ?? contact.wa_id ?? data.from;
  const corps: string = message.content?.body ?? message.text?.body ?? message.body ?? "";
  const messageId: string | undefined = message.id ?? data.message_id;
  const nom: string | undefined = contact.name;

  if (!de || !corps) {
    console.warn(`[webhook/genuka/${tenantId}] Payload message.received sans téléphone/texte reconnu :`, JSON.stringify(body).slice(0, 500));
    return;
  }

  if (messageId) {
    const existant = await prisma.messageRecu.findFirst({ where: { tenantId, waMessageId: messageId } });
    if (existant) return; // déjà traité (idempotence)
  }

  const telephoneRecherche = de.replace(/\D/g, "").slice(-8);
  const commandeLiee = await prisma.commande.findFirst({
    where: { tenantId, clientTelephone: { contains: telephoneRecherche } },
    orderBy: { createdAt: "desc" },
    select: { id: true, numero: true, statut: true, trackingToken: true },
  }).catch(() => null);

  // Toujours journalisé, même sans commande liée — un client peut écrire
  // avant toute commande, le commerçant doit quand même voir le message.
  await prisma.messageRecu.create({
    data: {
      tenantId, source: "whatsapp", de, nom, corps,
      waMessageId: messageId ?? null,
      commandeId: commandeLiee?.id ?? null,
      payload: body,
    },
  }).catch(() => {});

  if (!verifie) return; // pas de secret configuré/valide → pas d'action côté commande
  if (!commandeLiee || commandeLiee.statut !== "en_attente") return;
  const texte = corps.toLowerCase().trim();
  const estConfirmation = MOTS_CONFIRMATION.some(
    (m) => texte === m || texte.startsWith(m + " ") || texte.endsWith(" " + m)
  );
  if (!estConfirmation) return;

  await prisma.commande.update({ where: { id: commandeLiee.id }, data: { statut: "confirmee" } });

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { nomBoutique: true, slug: true },
  });
  if (tenant) {
    await notifierClientWhatsApp({
      telephone: de,
      statut: "confirmee",
      numero: commandeLiee.numero,
      boutique: tenant.nomBoutique,
      slug: tenant.slug,
      trackingToken: commandeLiee.trackingToken,
      tenantId,
    });
  }
}
