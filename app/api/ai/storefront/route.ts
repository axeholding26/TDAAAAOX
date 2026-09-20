// AXIA côté acheteur — agent IA sur la vitrine du marchand
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAgent, type AgentTool, type ToolExecutor } from "@/lib/agent-runner";
import { z } from "zod";

export const maxDuration = 60;

const schema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })),
  slug: z.string(),
  stream: z.boolean().optional(),
});

const BUYER_SYSTEM_PROMPT = `Tu es AXIA, l'assistante IA de cette boutique. Tu aides les acheteurs (pas les marchands) à :
- Trouver des produits adaptés à leur besoin
- Vérifier la disponibilité et les prix
- Obtenir des informations sur les délais de livraison
- Suivre leurs commandes
- Poser des questions sur les produits

Tu es sympathique, directe et utile. Tu ne révèles pas d'informations internes (marges, coûts fournisseur, etc.).
Tu réponds en français par défaut. Tu tutoies l'acheteur de façon chaleureuse.
Tu ne fais jamais de démarche commerciale agressive. Si l'acheteur cherche quelque chose que la boutique n'a pas, tu le dis honnêtement.`;

const OUTILS_ACHETEUR: AgentTool[] = [
  {
    name: "chercher_produits",
    description: "Cherche des produits dans la boutique par mot-clé ou catégorie",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Mot-clé ou description du produit recherché" },
        categorie: { type: "string", description: "Catégorie de produit (optionnel)" },
      },
      required: ["query"],
    },
  },
  {
    name: "info_boutique",
    description: "Obtenir les informations sur la boutique (délais, paiement, contact)",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "statut_commande_acheteur",
    description: "Vérifier le statut d'une commande par numéro ou email",
    parameters: {
      type: "object",
      properties: {
        email: { type: "string", description: "Email de l'acheteur" },
        numero: { type: "string", description: "Numéro de commande" },
      },
      required: [],
    },
  },
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, slug } = schema.parse(body);

    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, nomBoutique: true, devise: true, pays: true, whatsapp: true, parametresLivraison: true },
    });
    if (!tenant) return NextResponse.json({ reponse: "Boutique introuvable." });

    const systemPrompt = `${BUYER_SYSTEM_PROMPT}

─── BOUTIQUE ────────────────────────────────
Nom : ${tenant.nomBoutique}
Pays : ${tenant.pays}
Devise : ${tenant.devise}
Contact WhatsApp : ${tenant.whatsapp}`;

    const executeOutil: ToolExecutor = async (name, args, _tid) => {
      if (name === "chercher_produits") {
        const produits = await prisma.produit.findMany({
          where: {
            tenantId: tenant.id,
            actif: true,
            OR: [
              { nom: { contains: args.query, mode: "insensitive" } },
              { description: { contains: args.query, mode: "insensitive" } },
              { categorie: { contains: args.query, mode: "insensitive" } },
              { tags: { has: args.query } },
            ],
          },
          select: { nom: true, prix: true, prixCompare: true, stock: true, categorie: true, images: true, slug: true },
          take: 5,
        });
        if (!produits.length) return { succes: true, resultat: "Aucun produit trouvé pour cette recherche." };
        return {
          succes: true,
          resultat: produits.map((p) =>
            `• ${p.nom} — ${p.prix.toLocaleString()} ${tenant.devise}${p.prixCompare ? ` (était ${p.prixCompare.toLocaleString()})` : ""} — Stock : ${p.stock > 0 ? `${p.stock} dispo` : "épuisé"}`
          ).join("\n"),
        };
      }

      if (name === "info_boutique") {
        return {
          succes: true,
          resultat: `Boutique : ${tenant.nomBoutique}\nDevise : ${tenant.devise}\nContact WhatsApp : ${tenant.whatsapp}\nPays : ${tenant.pays}`,
        };
      }

      if (name === "statut_commande_acheteur") {
        const where: any = { tenantId: tenant.id };
        if (args.email) where.clientEmail = args.email;
        if (args.numero) where.numero = args.numero;
        const commandes = await prisma.commande.findMany({ where, take: 3, orderBy: { createdAt: "desc" } });
        if (!commandes.length) return { succes: true, resultat: "Aucune commande trouvée." };
        return {
          succes: true,
          resultat: commandes.map((c) =>
            `Commande ${c.numero} — Statut : ${c.statut} — Livraison : ${c.livraisonStatut} — ${c.montantTotal.toLocaleString()} ${c.devise}`
          ).join("\n"),
        };
      }

      return { succes: false, resultat: "Outil inconnu." };
    };

    const result = await runAgent(systemPrompt, messages, OUTILS_ACHETEUR, tenant.id, executeOutil, 4);
    return NextResponse.json({ reponse: result.reponse });
  } catch (err: any) {
    console.error("[axia-storefront]", err?.message);
    return NextResponse.json({ reponse: "Désolée, je rencontre une difficulté technique. Réessaie dans un instant." });
  }
}
