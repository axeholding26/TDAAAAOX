import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { LogistiqueHubClient } from "@/components/dashboard/logistique/LogistiqueHubClient";

export default async function LogistiqueHub({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await auth();
  if (!session) redirect("/connexion");
  const tenantId = (session.user as any)?.tenantId;
  const { tab } = await searchParams;

  const [enCours, livreursActifs, retoursOuverts, echecs, codEnAttente, facturesEnAttente] = await Promise.all([
    prisma.commande.count({ where: { tenantId, statut: { in: ["confirmee", "en_preparation", "expediee"] } } }),
    prisma.livreur.count({ where: { tenantId, actif: true, disponible: true } }),
    prisma.retourRMA.count({ where: { tenantId, statut: { in: ["ouvert", "en_cours"] } } }),
    prisma.commande.count({ where: { tenantId, livraisonStatut: "tentative_echouee" } }),
    prisma.commande.count({ where: { tenantId, methodePaiement: { in: ["whatsapp_cod", "direct_cod"] }, statut: "livree", codRemis: false } }),
    prisma.facture.count({ where: { tenantId, statut: "emise" } }),
  ]);

  return (
    <LogistiqueHubClient
      initialTab={tab}
      stats={{ enCours, livreursActifs, retoursOuverts, echecs, codEnAttente, facturesEnAttente }}
    />
  );
}
