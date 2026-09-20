// Agent Marketing — campagnes email, posts sociaux, codes promo + connecteurs MCP
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { runAgent, type AgentTool, type ToolExecutor } from "@/lib/agent-runner";
import { executerOutilMcp } from "@/lib/mcp/executor";
import { z } from "zod";

const schema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })),
});

const PROMPT = `Tu es l'Agent Marketing d'Axso — NOVA, experte en marketing digital pour l'e-commerce africain.

Tu as accès à des CONNECTEURS MCP qui te permettent d'agir directement sur les plateformes :
- meta_poster_facebook / meta_poster_instagram → publier MAINTENANT sur Facebook/Instagram
- meta_planifier_post → programmer une publication future
- meta_creer_campagne_ads → créer une campagne Meta Ads avec ciblage africain
- whatsapp_envoyer_message → envoyer un WhatsApp individuel
- whatsapp_diffusion → diffuser à tous les clients (ou un segment)
- gmail_envoyer / gmail_campagne → envoyer depuis Gmail
- sms_envoyer / sms_campagne → SMS via Africa's Talking

Tes capacités locales :
- Analyser la boutique pour créer du contenu 100% pertinent
- Générer des emails HTML professionnels
- Créer des codes promo stratégiques
- Générer des posts optimisés par réseau social

RÈGLE IMPORTANTE : Quand l'utilisateur dit "poste sur Instagram", "envoie sur WhatsApp", "programme pour demain" → utilise les outils MCP directement. Ne demande pas confirmation pour les actions simples.

Workflow recommandé :
1. lire_contexte_boutique pour les vrais produits/prix
2. Créer le contenu
3. Publier/planifier via les outils MCP connecteurs

Style : chaleureux, africain premium, emojis, appels à l'action percutants.`;

const OUTILS: AgentTool[] = [
  {
    name: "lire_contexte_boutique",
    description: "Lit les infos boutique, top produits et stats récentes pour créer du contenu pertinent",
    parameters: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "envoyer_campagne_email",
    description: "Envoie une campagne email HTML à tous les clients de la boutique (max 50)",
    parameters: {
      type: "object" as const,
      properties: {
        sujet: { type: "string", description: "Ligne de sujet de l'email" },
        html: { type: "string", description: "Corps de l'email en HTML complet avec styles inline" },
      },
      required: ["sujet", "html"],
    },
  },
  {
    name: "creer_code_promo",
    description: "Crée un code promotionnel actif dans la boutique",
    parameters: {
      type: "object" as const,
      properties: {
        code: { type: "string", description: "Code promo (ex: SOLDES30, BIENVENUE10)" },
        type: { type: "string", enum: ["pourcentage", "montant_fixe"], description: "Type de réduction" },
        valeur: { type: "number", description: "Valeur (30 pour 30%, ou montant fixe)" },
        minCommande: { type: "number", description: "Montant minimum de commande requis" },
        maxUtilisations: { type: "number", description: "Nombre max d'utilisations" },
      },
      required: ["code", "type", "valeur"],
    },
  },
  {
    name: "generer_post_social",
    description: "Génère un post prêt à copier-coller pour les réseaux sociaux",
    parameters: {
      type: "object" as const,
      properties: {
        plateforme: { type: "string", enum: ["instagram", "facebook", "tiktok", "whatsapp"], description: "Réseau social cible" },
        theme: { type: "string", description: "Thème : promotion, nouveau_produit, temoignage, evenement, storytelling" },
        produitNom: { type: "string", description: "Nom du produit à mettre en avant (optionnel)" },
      },
      required: ["plateforme", "theme"],
    },
  },
  {
    name: "lister_codes_promo",
    description: "Liste les codes promo actifs de la boutique",
    parameters: { type: "object" as const, properties: {}, required: [] },
  },
  // ── Connecteurs MCP ────────────────────────────────────────────────────────
  {
    name: "meta_poster_facebook",
    description: "Publie un post MAINTENANT sur la page Facebook de la boutique",
    parameters: {
      type: "object" as const,
      properties: {
        message: { type: "string" },
        imageUrl: { type: "string", description: "URL image (optionnel)" },
        lienUrl: { type: "string", description: "Lien à inclure (optionnel)" },
      },
      required: ["message"],
    },
  },
  {
    name: "meta_poster_instagram",
    description: "Publie une photo MAINTENANT sur Instagram (image obligatoire)",
    parameters: {
      type: "object" as const,
      properties: {
        caption: { type: "string", description: "Légende + hashtags" },
        imageUrl: { type: "string", description: "URL de l'image" },
      },
      required: ["caption", "imageUrl"],
    },
  },
  {
    name: "meta_planifier_post",
    description: "Programme un post Facebook ou Instagram pour une date future",
    parameters: {
      type: "object" as const,
      properties: {
        plateforme: { type: "string", enum: ["facebook", "instagram"] },
        contenu: { type: "string" },
        imageUrl: { type: "string" },
        planifieLe: { type: "string", description: "ISO 8601 : 2026-06-15T18:00:00" },
      },
      required: ["plateforme", "contenu", "planifieLe"],
    },
  },
  {
    name: "meta_creer_campagne_ads",
    description: "Crée une campagne Meta Ads avec budget et ciblage africain",
    parameters: {
      type: "object" as const,
      properties: {
        nom: { type: "string" },
        objectif: { type: "string", enum: ["OUTCOME_TRAFFIC", "OUTCOME_SALES", "OUTCOME_LEADS", "OUTCOME_AWARENESS"] },
        budget_jour: { type: "number" },
        pays: { type: "array", items: { type: "string" } },
        url_destination: { type: "string" },
      },
      required: ["nom", "objectif", "budget_jour"],
    },
  },
  {
    name: "whatsapp_envoyer_message",
    description: "Envoie un message WhatsApp à un numéro de téléphone",
    parameters: {
      type: "object" as const,
      properties: {
        telephone: { type: "string" },
        message: { type: "string" },
      },
      required: ["telephone", "message"],
    },
  },
  {
    name: "whatsapp_diffusion",
    description: "Diffuse un message WhatsApp à tous les clients ou un segment",
    parameters: {
      type: "object" as const,
      properties: {
        message: { type: "string" },
        segment: { type: "string", enum: ["tous", "vip", "inactifs", "nouveaux"] },
        code_promo: { type: "string" },
      },
      required: ["message"],
    },
  },
  {
    name: "sms_campagne",
    description: "Envoie un SMS en masse via Africa's Talking",
    parameters: {
      type: "object" as const,
      properties: {
        message: { type: "string" },
        segment: { type: "string", enum: ["tous", "vip", "inactifs"] },
      },
      required: ["message", "segment"],
    },
  },
];

const executeOutil: ToolExecutor = async (nom, args, tenantId) => {
  try {
    switch (nom) {
      case "lire_contexte_boutique": {
        const [tenant, produits, nbCommandes, nbClients] = await Promise.all([
          prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { nomBoutique: true, categorie: true, pays: true, devise: true, description: true },
          }),
          prisma.produit.findMany({
            where: { tenantId, actif: true },
            orderBy: { ventes: "desc" },
            take: 6,
            select: { nom: true, prix: true, categorie: true, ventes: true, stock: true },
          }),
          prisma.commande.count({ where: { tenantId, statut: { in: ["confirmee", "livree"] } } }),
          prisma.client.count({ where: { tenantId } }),
        ]);
        return {
          succes: true,
          resultat: JSON.stringify({ boutique: tenant, top_produits: produits, commandes_confirmees: nbCommandes, nb_clients: nbClients }),
        };
      }

      case "envoyer_campagne_email": {
        const resendKey = process.env.RESEND_API_KEY;
        if (!resendKey) return { succes: false, resultat: "RESEND_API_KEY manquante — email non envoyé" };

        const [clients, tenant] = await Promise.all([
          prisma.client.findMany({ where: { tenantId }, select: { email: true, nom: true }, take: 50 }),
          prisma.tenant.findUnique({ where: { id: tenantId }, select: { nomBoutique: true } }),
        ]);
        if (!clients.length) return { succes: false, resultat: "Aucun client enregistré" };

        const resend = new Resend(resendKey);
        let envoyes = 0;
        for (const client of clients) {
          try {
            await resend.emails.send({
              from: `${tenant?.nomBoutique} <onboarding@resend.dev>`,
              to: client.email,
              subject: args.sujet,
              html: args.html.replace(/\{\{nom\}\}/g, client.nom),
            });
            envoyes++;
          } catch { /* continue */ }
        }
        return { succes: true, resultat: `✅ Campagne envoyée : ${envoyes}/${clients.length} emails` };
      }

      case "creer_code_promo": {
        const existing = await prisma.codePromo.findUnique({
          where: { tenantId_code: { tenantId, code: args.code.toUpperCase() } },
        });
        if (existing) return { succes: false, resultat: `Code "${args.code.toUpperCase()}" existe déjà` };

        await prisma.codePromo.create({
          data: {
            tenantId,
            code: args.code.toUpperCase(),
            type: args.type,
            valeur: args.valeur,
            minCommande: args.minCommande ?? null,
            maxUtilisations: args.maxUtilisations ?? null,
            actif: true,
          },
        });
        const label = args.type === "pourcentage" ? `${args.valeur}%` : `${args.valeur} de réduction`;
        return { succes: true, resultat: `✅ Code promo "${args.code.toUpperCase()}" créé — ${label}` };
      }

      case "generer_post_social": {
        let ctx = `Plateforme: ${args.plateforme}, Thème: ${args.theme}`;
        if (args.produitNom) {
          const p = await prisma.produit.findFirst({
            where: { tenantId, nom: { contains: args.produitNom, mode: "insensitive" } },
            select: { nom: true, prix: true, description: true },
          });
          if (p) ctx += `. Produit: ${p.nom} à ${p.prix}. Desc: ${(p.description ?? "").slice(0, 100)}`;
        }
        return { succes: true, resultat: `Contexte récupéré: ${ctx}. Génère le post dans ta réponse.` };
      }

      case "lister_codes_promo": {
        const codes = await prisma.codePromo.findMany({
          where: { tenantId, actif: true },
          select: { code: true, type: true, valeur: true, utilisations: true, maxUtilisations: true },
          take: 10,
        });
        return { succes: true, resultat: JSON.stringify(codes) };
      }

      default: {
        const MCP_PREFIXES = ["meta_", "whatsapp_", "gmail_", "sms_", "tiktok_", "higgsfield_"];
        if (MCP_PREFIXES.some(p => nom.startsWith(p))) {
          return executerOutilMcp(nom, args, tenantId);
        }
        return { succes: false, resultat: `Outil inconnu: ${nom}` };
      }
    }
  } catch (err: any) {
    return { succes: false, resultat: `Erreur: ${err.message}` };
  }
};

// Exporté pour l'exécution autonome (lib/agent-consumer.ts)
export { PROMPT, OUTILS, executeOutil };

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) return NextResponse.json({ message: "Boutique introuvable" }, { status: 404 });

    const { messages } = schema.parse(await request.json());
    const result = await runAgent(PROMPT, messages, OUTILS, tenantId, executeOutil);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ message: "Format invalide" }, { status: 400 });
    console.error("[AGENT/MARKETING]", err);
    return NextResponse.json({ message: "Erreur agent marketing" }, { status: 500 });
  }
}
