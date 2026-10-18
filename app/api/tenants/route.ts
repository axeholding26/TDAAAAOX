// API Route — Réglages de la boutique active (l'inscription passe par /api/ai/onboarding)
import { deviseDuPays } from "@/lib/ai-agent";
import { convertirDeviseBoutique } from "@/lib/changement-devise";
import { tauxDuJour } from "@/lib/taux-change";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { oublierRappelsBrouillon } from "@/lib/tenant";
import { declarerSousDomaine } from "@/lib/domaines";
import { mergeThemeConfig, appliquerNouveauTheme } from "@/lib/theme-config";
import { resolveThemeConfigAsync } from "@/lib/theme-config-server";
import { FORMAT_PIXEL } from "@/lib/pixels";
import { requireNiveau } from "@/lib/permissions-server";
import type { ModuleKey } from "@/lib/permissions";

// Champs fournis par le Theme du design (lib/axso-design-library.ts), jamais édités dans le Constructeur.
const CHAMPS_DU_DESIGN = [
  "builderHtml", "builderCss", "builderHtmlProduits", "builderHtmlProduit", "builderHtmlPanierChrome",
  "builderHtmlCheckoutChrome", "builderHtmlConfirmationChrome", "axsoDesignSelecteurVisuelPdp",
  "axsoDesignCssVarMapping", "axsoDesignPolices",
];

const CHAMPS_BOUTIQUE = new Set(["themeId", "themeConfig", "statut"]);

export async function PATCH(request: Request) {
  try {
    const { auth } = await import("@/lib/auth");
    const { revalidatePath } = await import("next/cache");
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    // Constructeur et thèmes (design, publication) : module boutique ; tout le reste : paramètres.
    const modules = new Set<ModuleKey>(Object.keys(body ?? {}).map((k) => (CHAMPS_BOUTIQUE.has(k) ? "boutique" : "parametres")));
    if (!modules.size) modules.add("parametres");
    for (const m of modules) {
      const refus = await requireNiveau(session, m, "ecriture");
      if (refus) return NextResponse.json({ error: refus.error }, { status: refus.status });
    }
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
    // Domaine personnalisé : uniquement via /api/domaine (validation, unicité, ajout au projet Vercel).
    // Un seul pixel par plateforme : refuse une liste ou un ID mal formé.
    for (const [cle, format] of Object.entries(FORMAT_PIXEL)) {
      const v = champs[cle];
      if (typeof v === "string" && v.trim() && !format.test(v.trim())) {
        return NextResponse.json({ error: `Identifiant ${cle} invalide : un seul pixel par plateforme.` }, { status: 400 });
      }
    }
    // Pays changé → devise alignée d'office (vitrine, dashboard et AXIA lisent tenant.devise).
    if (champs.pays) champs.devise = deviseDuPays(champs.pays, champs.devise ?? body.devise ?? "XOF");

    const actuel = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { statut: true, themeId: true, themeConfig: true, devise: true },
    });

    // Le marchand ne peut basculer sa boutique qu'entre "active" et "pause" —
    // jamais écraser un statut administratif (ex: suspendu par Axso). Une
    // boutique "brouillon" (pas encore publiée) ne peut passer à "active"
    // que si elle remplit les critères minimum — voir lib/boutique-completion.ts.
    if ((body.statut === "active" || body.statut === "pause") && actuel) {
      if (actuel.statut === "brouillon" && body.statut === "active") {
        const { evaluerPublication } = await import("@/lib/boutique-completion");
        const evaluation = await evaluerPublication(tenantId);
        if (!evaluation.prete) {
          return NextResponse.json(
            {
              error: "Boutique incomplète — impossible de publier",
              manquants: evaluation.criteres.filter(c => !c.ok).map(c => c.label),
            },
            { status: 400 }
          );
        }
        champs.statut = "active";
      } else if (actuel.statut === "active" || actuel.statut === "pause") {
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

    // Le Constructeur envoie la config RÉSOLUE (design + réglages) : sans ce
    // tri, tout le HTML/CSS du design était recopié dans la config de la
    // boutique à chaque sauvegarde (≈15 Ko dupliqués, qui masquaient ensuite le
    // design réel). On ne garde que ce qui appartient à la boutique — et on ne
    // retire une copie que si le thème actif la fournit bien (jamais de perte
    // de design, ex. boutique dont le thème a disparu).
    if (champs.themeConfig && typeof champs.themeConfig === "object" && actuel?.themeId) {
      const theme = await prisma.theme.findFirst({ where: { id: champs.themeId ?? actuel.themeId, tenantId }, select: { config: true } });
      const cfgTheme = (theme?.config as Record<string, unknown> | null) ?? {};
      const propre = { ...champs.themeConfig };
      for (const cle of CHAMPS_DU_DESIGN) if (cle in cfgTheme) delete propre[cle];
      champs.themeConfig = propre;
    }

    // Devise changée (pays changé) : tous les montants de la boutique sont convertis
    // dans la MÊME transaction — tout ou rien (voir lib/changement-devise.ts).
    const changeDevise = typeof champs.devise === "string" && actuel?.devise && champs.devise !== actuel.devise;
    const taux = changeDevise ? await tauxDuJour() : null; // hors transaction : aucun appel réseau pendant qu'elle est ouverte
    const tenant = changeDevise
      ? await prisma.$transaction(async (tx) => {
          await convertirDeviseBoutique(tx, tenantId, actuel!.devise, champs.devise, taux!);
          return tx.tenant.update({ where: { id: tenantId }, data: champs });
        }, { timeout: 30000 })
      : await prisma.tenant.update({ where: { id: tenantId }, data: champs });
    if (actuel?.statut === "brouillon" && champs.statut === "active") {
      await oublierRappelsBrouillon(tenantId);
      await declarerSousDomaine(tenant.slug);
    }

    // Invalider le cache de toutes les pages storefront de cette boutique
    revalidatePath(`/${tenant.slug}`, "layout");

    return NextResponse.json({ success: true, tenant });
  } catch (err) {
    console.error("[API/TENANTS] Erreur PATCH:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
