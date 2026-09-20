export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { resolveThemeConfigAsync } from "@/lib/theme-config-server";
import { verifierPaiementNotchPay, hasNotchPay } from "@/lib/notchpay";
import { confirmerPaiementCommande } from "@/lib/paiement-commande";
import { TYPES_LIVRAISON_DIGITALE } from "@/lib/affiliation";
import { ConfirmationDigitaleContent } from "@/components/storefront/ConfirmationDigitaleContent";
import { ImportedLiteralConfirmationShell } from "@/components/storefront/templates/ImportedLiteralConfirmationShell";

interface Props {
  params: Promise<{ slug: string; orderId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

// Filet de sécurité : si le webhook NotchPay n'est pas encore arrivé au moment
// où le client revient de la page de paiement hébergée, on vérifie directement
// et on confirme la commande (confirmerPaiementCommande est idempotent).
async function verifierEtConfirmerNotchPay(commandeId: string, paiementReference: string | null) {
  if (!hasNotchPay() || !paiementReference) return;
  try {
    // paiementReference = référence NotchPay ("trx.xxx") stockée à l'initialisation —
    // GET /payments/{reference} n'accepte que leur propre référence, pas la nôtre.
    const { transaction } = await verifierPaiementNotchPay(paiementReference);
    if (transaction?.status === "complete") {
      await confirmerPaiementCommande(commandeId, paiementReference);
    }
  } catch {
    // Le webhook reste la source de vérité — on affiche l'état actuel de la commande
  }
}

export default async function ConfirmationPage({ params, searchParams }: Props) {
  const { slug, orderId } = await params;
  await searchParams;

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant || tenant.statut !== "active") notFound();

  const commandeAvant = await prisma.commande.findUnique({ where: { id: orderId }, select: { paiementStatut: true, methodePaiement: true, paiementReference: true } });
  if (commandeAvant?.paiementStatut === "pending" && commandeAvant.methodePaiement === "notchpay") {
    await verifierEtConfirmerNotchPay(orderId, commandeAvant.paiementReference);
  }

  const commande = await prisma.commande.findUnique({
    where: { id: orderId },
    include: {
      lignes: {
        include: {
          produit: { select: { id: true, type: true, fichierUrl: true, fichierNom: true } },
        },
      },
    },
  });
  if (!commande || commande.tenantId !== tenant.id) notFound();

  const themeConfig = await resolveThemeConfigAsync(tenant.themeId, tenant.id, (tenant.themeConfig as Record<string, any>) || {});
  const theme = themeConfig.colors;

  const paye = commande.paiementStatut === "completed";
  const echoue = commande.paiementStatut === "failed";
  const isCOD = commande.methodePaiement === "whatsapp_cod" || commande.methodePaiement === "direct_cod";
  const isDigital = commande.lignes.some(l => l.produit?.type && TYPES_LIVRAISON_DIGITALE.has(l.produit.type));

  const lignesDigitales = commande.lignes.filter(l => l.produit?.type === "digital" && l.produit?.fichierUrl);

  // Résout aussi les produits inclus dans les bundles achetés — leurs livraisons
  // (tokens/clés/accès) sont créées contre leur propre id, pas celui du bundle.
  const ligneProduitIds = commande.lignes.map(l => l.produit?.id).filter((id): id is string => !!id);
  const bundlesAchetes = ligneProduitIds.length
    ? await prisma.bundleProduit.findMany({
        where: { produitId: { in: ligneProduitIds } },
        include: { elements: { include: { produitInclus: { select: { id: true, nom: true } } } } },
      })
    : [];
  const produitsInclusBundle = bundlesAchetes.flatMap(b => b.elements.map(e => e.produitInclus));
  const tousProduitIds = [...new Set([...ligneProduitIds, ...produitsInclusBundle.map(p => p.id)])];
  const nomProduit = new Map<string, string>([
    ...commande.lignes.filter(l => l.produit).map(l => [l.produit!.id, l.nom] as const),
    ...produitsInclusBundle.map(p => [p.id, p.nom] as const),
  ]);

  const [telechargements, accesFormations, clesLicence] = tousProduitIds.length
    ? await Promise.all([
        prisma.telechargement.findMany({
          where: { commandeId: orderId, produitId: { in: tousProduitIds } },
          include: { produit: { include: { produitFichier: { include: { fichiers: { orderBy: { ordre: "asc" } } } } } } },
        }),
        prisma.accesFormation.findMany({ where: { commandeId: orderId, produitId: { in: tousProduitIds } } }),
        prisma.cleLicence.findMany({
          where: { commandeId: orderId, licenceProduit: { produitId: { in: tousProduitIds } } },
          include: { licenceProduit: { select: { produitId: true } } },
        }),
      ])
    : [[], [], []] as const;

  // commande.montantTotal est déjà majoré de la commission côté client (prix vendeur
  // × (1 + taux)) — le marchand reçoit son prix intégral, extrait par division.
  const montantMarchand = commande.montantTotal / (1 + (tenant.commissionRate || 0.06));
  const montantCommission = commande.montantTotal - montantMarchand;

  const contenuConfirmation = (
    <ConfirmationDigitaleContent
      theme={theme}
      slug={slug}
      devise={tenant.devise}
      commissionRate={tenant.commissionRate || 0.06}
      commande={commande}
      paye={paye}
      echoue={echoue}
      isCOD={isCOD}
      isDigital={isDigital}
      lignesDigitales={lignesDigitales}
      telechargements={telechargements}
      accesFormations={accesFormations}
      clesLicence={clesLicence}
      nomProduit={nomProduit}
      montantMarchand={montantMarchand}
      montantCommission={montantCommission}
    />
  );

  if (themeConfig.builderHtmlConfirmationChrome) {
    return <ImportedLiteralConfirmationShell cfg={themeConfig}>{contenuConfirmation}</ImportedLiteralConfirmationShell>;
  }

  return (
    <div style={{ backgroundColor: theme.fond, color: theme.texte, minHeight: "100vh" }}>
      {contenuConfirmation}

      <footer className="border-t py-8 text-center text-sm opacity-40 mt-8" style={{ borderColor: `${theme.accent}20` }}>
        <p>{tenant.nomBoutique} · Propulsé par <span style={{ color: theme.accent }}>Axso</span></p>
      </footer>
    </div>
  );
}
