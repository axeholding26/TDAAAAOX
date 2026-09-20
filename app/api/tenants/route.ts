// API Route — Création de tenant (inscription boutique)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";
import { generateStoreConfig } from "@/lib/generate-store-config";
import { genererAvisDemo } from "@/lib/gemini";
import { mergeThemeConfig, appliquerNouveauTheme } from "@/lib/theme-config";
import { resolveThemeConfigAsync } from "@/lib/theme-config-server";
import { MANIFESTE_LIBRAIRIE, provisionerThemeInitial } from "@/lib/axso-design-library";

const schemaCreation = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  nomBoutique: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  categorie: z.string(),
  pays: z.string(),
  whatsapp: z.string().min(8),
  devise: z.string().default("XOF"),
  themeId: z.string().default("terre-et-or"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = schemaCreation.parse(body);

    // Vérifier si l'email ou slug existe déjà
    const [emailExiste, slugExiste] = await Promise.all([
      prisma.user.findUnique({ where: { email: data.email } }),
      prisma.tenant.findUnique({ where: { slug: data.slug } }),
    ]);

    if (emailExiste) {
      return NextResponse.json(
        { message: "Cet email est déjà utilisé" },
        { status: 400 }
      );
    }

    if (slugExiste) {
      return NextResponse.json(
        { message: `L'URL "${data.slug}" est déjà prise. Essayez un autre nom.` },
        { status: 400 }
      );
    }

    // Générer la config structurelle (sections/page produit/à propos/contact)
    // en fonction de la catégorie du business — le design visuel lui-même
    // (accueil/boutique/fiche produit) est désormais provisionné après coup
    // depuis la bibliothèque AXSO Design (voir plus bas), pas choisi ici.
    const { themeConfig } = generateStoreConfig({
      categorie: data.categorie,
      nomBoutique: data.nomBoutique,
      pays: data.pays,
      devise: data.devise,
    });

    // Créer le tenant et l'utilisateur en transaction
    const { tenant, user } = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug: data.slug,
          nomBoutique: data.nomBoutique,
          categorie: data.categorie,
          pays: data.pays,
          devise: data.devise,
          whatsapp: data.whatsapp,
          email: data.email,
          themeConfig: themeConfig as any,
          commissionRate: 0.06,
          statut: "active",
          planType: "gratuit",
        },
      });

      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          password: await hash(data.password, 10),
          tenantId: tenant.id,
          role: "owner",
        },
      });

      return { tenant, user };
    });

    // Provisionne un design de la bibliothèque AXSO Design d'après la
    // catégorie (aucun produit encore créé à ce stade sur ce chemin
    // d'inscription simple — la grille accueil/boutique reste vide jusqu'au
    // premier produit ajouté, comme le ferait un thème classique fraîchement
    // créé). `data.themeId`, s'il correspond à un design précis de la
    // bibliothèque, le force. Non bloquant : en cas d'échec, la boutique
    // reste sur le socle par défaut ("terre-et-or").
    try {
      const fichierForce = MANIFESTE_LIBRAIRIE.some((e) => e.fichier === data.themeId) ? data.themeId : undefined;
      const theme = await provisionerThemeInitial({
        tenantId: tenant.id,
        categorie: data.categorie,
        slug: tenant.slug,
        nomBoutique: tenant.nomBoutique,
        devise: tenant.devise,
        fichier: fichierForce,
      });
      await prisma.tenant.update({ where: { id: tenant.id }, data: { themeId: theme.id } });
    } catch (err) {
      console.warn("[API/TENANTS] Provisionnement bibliothèque échoué (non bloquant):", err);
    }

    // Avis clients IA de démonstration — pour qu'une boutique neuve inspire
    // confiance dès le premier jour. Ne bloque jamais la création du tenant :
    // toute erreur (Gemini, DB) est avalée et journalisée. Sans produit créé
    // à l'inscription simple, un Avis n'a pas de produitId valide — on saute.
    try {
      const produits = await prisma.produit.findMany({
        where: { tenantId: tenant.id },
        select: { id: true, nom: true },
      });
      if (produits.length > 0) {
        const avisGeneres = await genererAvisDemo(
          data.nomBoutique,
          data.categorie,
          produits.map((p) => p.nom)
        );
        for (let i = 0; i < avisGeneres.length; i++) {
          const a = avisGeneres[i];
          const client = await prisma.client.create({
            data: {
              tenantId: tenant.id,
              nom: a.clientNom,
              email: `demo+${tenant.id}-${i}@axso-avis.local`,
            },
          });
          const produit = produits[i % produits.length];
          await prisma.avis.create({
            data: {
              tenantId: tenant.id,
              produitId: produit.id,
              clientId: client.id,
              note: a.note,
              titre: a.titre,
              commentaire: a.commentaire,
              verifie: false,
              approuve: true,
            },
          });
        }
      }
    } catch (err) {
      console.warn("[API/TENANTS] Génération avis démo échouée (non bloquant):", err);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Boutique créée avec succès !",
        slug: tenant.slug,
        tenantId: tenant.id,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Données invalides", erreurs: err.issues },
        { status: 400 }
      );
    }

    console.error("[API/TENANTS] Erreur création:", err);
    return NextResponse.json(
      { message: "Erreur serveur — veuillez réessayer" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { auth } = await import("@/lib/auth");
    const { revalidatePath } = await import("next/cache");
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });

    const body = await request.json();
    const champs: Record<string, any> = {};
    const autorises = [
      "themeId", "logoUrl", "bannerUrl", "description", "metaTitle", "metaDescription",
      "whatsapp", "nomBoutique", "telephone", "adresse", "email", "categorie", "pays", "devise",
      "socialLinks", "parametresLivraison", "parametresPaiement", "themeConfig",
      "parametresCommande", "metaPixelId", "tiktokPixelId", "snapPixelId", "gtmId", "trackingScripts",
    ];
    for (const key of autorises) {
      if (body[key] !== undefined) champs[key] = body[key];
    }
    if (body.domainePropre !== undefined) champs.customDomain = body.domainePropre || null;

    const actuel = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { statut: true, themeId: true, themeConfig: true },
    });

    // Le marchand ne peut basculer sa boutique qu'entre "active" et "pause" —
    // jamais écraser un statut administratif (ex: suspendu par Axso).
    if ((body.statut === "active" || body.statut === "pause") && actuel) {
      if (actuel.statut === "active" || actuel.statut === "pause") {
        champs.statut = body.statut;
      }
    }

    // Changement de thème : le texte déjà écrit par le marchand (titres,
    // accroches, badges de confiance, blocs personnalisés, page À propos/
    // Contact, customCss...) ne doit jamais être remplacé par le texte par
    // défaut du nouveau thème — seule l'identité visuelle change. Un
    // éventuel `themeConfig` fourni en même temps (ex: variante Clair/Sombre/
    // Concentré) s'applique par-dessus ce résultat.
    if (body.themeId !== undefined && actuel && body.themeId !== actuel.themeId) {
      const ancienConfig = await resolveThemeConfigAsync(actuel.themeId, tenantId, (actuel.themeConfig as any) || {});
      const nouveauBase = await resolveThemeConfigAsync(body.themeId, tenantId, {});
      let fusion = appliquerNouveauTheme(ancienConfig, nouveauBase);
      if (body.themeConfig && typeof body.themeConfig === "object") {
        fusion = mergeThemeConfig(fusion, body.themeConfig);
      }
      champs.themeConfig = fusion;
    }

    const tenant = await prisma.tenant.update({ where: { id: tenantId }, data: champs });

    // Invalider le cache de toutes les pages storefront de cette boutique
    revalidatePath(`/${tenant.slug}`, "layout");

    return NextResponse.json({ success: true, tenant });
  } catch (err) {
    console.error("[API/TENANTS] Erreur PATCH:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        slug: true,
        nomBoutique: true,
        pays: true,
        statut: true,
        createdAt: true,
        _count: { select: { produits: true, commandes: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ tenants });
  } catch (err) {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
