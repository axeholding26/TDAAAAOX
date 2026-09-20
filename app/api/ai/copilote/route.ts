import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;
import { OUTILS_COPILOTE } from "@/lib/ai-agent";
import { type ToolDefinition } from "@/lib/llm-client";
import { runAgent } from "@/lib/agent-runner";
import { slugify } from "@/lib/utils";
import { selectionnerGabaritLibrairie, provisionerThemeInitial } from "@/lib/axso-design-library";
import { z } from "zod";

const schema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })),
});

const PROMPT_COPILOTE = `Tu es AXIA, le copilote IA d'Axso — la plateforme e-commerce mondiale alimentée par l'IA.
Tu es un assistant business ultra-compétent qui aide les entrepreneurs du monde entier à créer, gérer et scaler leur boutique en ligne.
Tu prends des actions directes sur la boutique du marchand via tes outils.

Contexte Axso :
- Axso est une plateforme e-commerce mondiale (Europe, Afrique, Amérique, Asie, Moyen-Orient, etc.)
- Produits physiques, digitaux et dropshipping international supportés
- Paiement en ligne (commission 6% ajoutée au prix payé par le client, jamais déduite du vendeur)
- Paiement à la livraison + WhatsApp pour les produits physiques/drop (abonnement SaaS)
- Sources d'approvisionnement dropshipping : AliExpress, Amazon, fournisseurs locaux selon le pays

Règles importantes :
- Pour les actions simples (ajouter produit, créer promo, changer thème) : agis directement sans demander confirmation
- Pour les actions critiques (suppression, modifications majeures) : demande confirmation avant d'agir
- Sois proactif : propose des actions pertinentes selon le contexte
- Adapte tes recommandations au marché et à la devise du marchand
- Ton style : chaleureux, direct, efficace. Utilise des emojis modérément.
- Après chaque action réussie, explique ce qui a été fait et propose la prochaine étape logique

Quand tu appelles un outil, explique toujours ce que tu vas faire AVANT de l'appeler.`;

// Convertit les outils du copilote en format ToolDefinition universel
const OUTILS_UNIVERSELS: ToolDefinition[] = OUTILS_COPILOTE.map((t) => ({
  name: t.name,
  description: t.description ?? "",
  parameters: t.input_schema,
}));

async function executerOutil(
  nomOutil: string,
  input: Record<string, any>,
  tenantId: string
): Promise<{ succes: boolean; resultat: string }> {
  try {
    switch (nomOutil) {
      case "ajouter_produit": {
        const slug = slugify(input.nom) || `produit-${Date.now()}`;
        await prisma.produit.create({
          data: {
            tenantId,
            nom: input.nom,
            slug,
            description: input.description || "",
            prix: input.prix,
            stock: input.stock ?? 10,
            categorie: input.categorie,
            actif: true,
          },
        });
        return { succes: true, resultat: `Produit "${input.nom}" ajouté à ${input.prix} — stock: ${input.stock ?? 10}` };
      }

      case "creer_code_promo": {
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) return { succes: false, resultat: "Boutique introuvable" };
        await prisma.codePromo.create({
          data: {
            tenantId,
            code: input.code.toUpperCase(),
            type: input.type,
            valeur: input.valeur,
            minCommande: input.minCommande || null,
            actif: true,
          },
        });
        return { succes: true, resultat: `Code promo "${input.code.toUpperCase()}" créé — ${input.type === "pourcentage" ? `${input.valeur}%` : `${input.valeur} de réduction`}` };
      }

      case "modifier_theme": {
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) return { succes: false, resultat: "Boutique introuvable" };
        const entree = selectionnerGabaritLibrairie(input.categorie || tenant.categorie);
        const theme = await provisionerThemeInitial({
          tenantId,
          categorie: input.categorie || tenant.categorie,
          slug: tenant.slug,
          nomBoutique: tenant.nomBoutique,
          devise: tenant.devise,
          commissionRate: tenant.commissionRate ?? 0.06,
          fichier: entree.fichier,
        });
        await prisma.tenant.update({ where: { id: tenantId }, data: { themeId: theme.id } });
        return { succes: true, resultat: `Design "${entree.nom}" activé, vos produits y sont déjà branchés` };
      }

      case "lire_statistiques": {
        const jours = input.periode === "7j" ? 7 : input.periode === "30j" ? 30 : 90;
        const depuis = new Date();
        depuis.setDate(depuis.getDate() - jours);

        const [commandes, produits, clients] = await Promise.all([
          prisma.commande.findMany({
            where: { tenantId, createdAt: { gte: depuis } },
            select: { montantTotal: true, statut: true, devise: true },
          }),
          prisma.produit.count({ where: { tenantId, actif: true } }),
          prisma.client.count({ where: { tenantId } }),
        ]);

        const totalVentes = commandes.reduce((s, c) => s + c.montantTotal, 0);
        const commandesConfirmees = commandes.filter((c) => c.statut === "confirmee" || c.statut === "livree").length;
        const devise = commandes[0]?.devise || "XOF";

        return {
          succes: true,
          resultat: `📊 Stats ${input.periode} : ${commandes.length} commandes, ${commandesConfirmees} confirmées, ${totalVentes.toLocaleString()} ${devise} de CA, ${produits} produits actifs, ${clients} clients`,
        };
      }

      default:
        return { succes: false, resultat: `Outil inconnu: ${nomOutil}` };
    }
  } catch (err: any) {
    return { succes: false, resultat: `Erreur: ${err.message}` };
  }
}


export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) return NextResponse.json({ message: "Boutique introuvable" }, { status: 404 });

    const body = await request.json();
    const { messages } = schema.parse(body);

    // Utilise runAgent : moteur Gemini (function calling + synthèse en streaming)
    const { reponse, actions } = await runAgent(
      PROMPT_COPILOTE,
      messages,
      OUTILS_UNIVERSELS,
      tenantId,
      executerOutil,
      5
    );

    return NextResponse.json({ reponse, actions });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: "Format invalide" }, { status: 400 });
    }
    console.error("[API/AI/COPILOTE]", err);
    return NextResponse.json({ message: "Erreur IA" }, { status: 500 });
  }
}
