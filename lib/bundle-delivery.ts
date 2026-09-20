// Livraison groupée d'un bundle après paiement confirmé
// Génère les tokens de téléchargement pour les fichiers et attribue les clés licence
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

const EXPIRE_DEFAULT_JOURS = 365;

function expireAt(jours = EXPIRE_DEFAULT_JOURS) {
  return new Date(Date.now() + jours * 86_400_000);
}

export async function livrerBundle(commandeId: string, bundleProduitId: string) {
  const [bundle, commande] = await Promise.all([
    prisma.bundleProduit.findUnique({
      where: { produitId: bundleProduitId },
      include: {
        elements: {
          include: {
            produitInclus: {
              include: {
                produitFichier: { include: { fichiers: { orderBy: { ordre: "asc" } } } },
                licenceProduit: true,
                formation: true,
              },
            },
          },
        },
      },
    }),
    prisma.commande.findUnique({ where: { id: commandeId }, select: { clientEmail: true } }),
  ]);

  if (!bundle) throw new Error("Bundle introuvable");

  const resultats: Array<{ produitId: string; type: string; data: any }> = [];

  for (const el of bundle.elements) {
    const p = el.produitInclus;

    if (p.type === "fichier" && p.produitFichier) {
      // Créer un token par fichier individuel
      const tokens: string[] = [];
      for (const _f of p.produitFichier.fichiers) {
        const token = randomUUID();
        await prisma.telechargement.create({
          data: { token, produitId: p.id, commandeId, expireAt: expireAt(), telecharge: false },
        });
        tokens.push(token);
      }
      resultats.push({ produitId: p.id, type: "fichier", data: { tokens } });

    } else if (p.type === "digital" && p.fichierUrl) {
      // Produit digital legacy (un seul fichier)
      const token = randomUUID();
      await prisma.telechargement.create({
        data: { token, produitId: p.id, commandeId, expireAt: expireAt(), telecharge: false },
      });
      resultats.push({ produitId: p.id, type: "digital", data: { token } });

    } else if (p.type === "licence" && p.licenceProduit) {
      // Attribuer la prochaine clé disponible
      const cle = await prisma.cleLicence.findFirst({
        where: { licenceProduitId: p.licenceProduit.id, statut: "disponible" },
        orderBy: { createdAt: "asc" },
      });
      if (cle) {
        const expiry = p.licenceProduit.dureeJours ? expireAt(p.licenceProduit.dureeJours) : null;
        await prisma.cleLicence.update({
          where: { id: cle.id },
          data: { statut: "vendue", commandeId, acheteurEmail: commande?.clientEmail, expireAt: expiry },
        });
        resultats.push({ produitId: p.id, type: "licence", data: { cle: cle.cle, expireAt: expiry } });
      } else {
        resultats.push({ produitId: p.id, type: "licence", data: { error: "Aucune clé disponible" } });
      }

    } else if (p.type === "formation" && p.formation) {
      const token = randomUUID();
      await prisma.accesFormation.create({
        data: { produitId: p.id, commandeId, token, clientEmail: commande?.clientEmail ?? "" },
      });
      resultats.push({ produitId: p.id, type: "formation", data: { token } });
    }
  }

  return resultats;
}
