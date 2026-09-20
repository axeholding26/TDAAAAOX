// Client IA — Axso tourne exclusivement sur Google Gemini (SDK officiel @google/genai)
import { completionAuto, type ChatMessage } from "./llm-client";
import { FONTS } from "./theme-fonts";
import { BLOCK_CATALOG } from "./block-catalog";

const SYSTEME_PROMPT = `Tu es l'assistant IA d'Axso, la plateforme e-commerce premium de l'Afrique.
Tu parles français, avec un ton chaleureux et encourageant, comme un vrai conseiller business africain.
Tu aides les marchands africains à vendre mieux en ligne.
Tu connais les marchés africains, les habitudes d'achat, les prix locaux.
Sois concis, pratique et positif. Utilise des emojis occasionnellement pour rendre les réponses plus vivantes.`;

async function completion(messages: ChatMessage[], maxTokens = 500): Promise<string> {
  const result = await completionAuto(messages, maxTokens);
  return result.text;
}

// Générer une description produit IA
export async function genererDescriptionProduit(
  nom: string,
  categorie: string,
  prix: number,
  devise: string
): Promise<string> {
  return completion(
    [
      { role: "system", content: SYSTEME_PROMPT },
      {
        role: "user",
        content: `Écris une description produit accrocheuse et professionnelle pour :
Nom: ${nom}
Catégorie: ${categorie}
Prix: ${prix} ${devise}

La description doit faire 2-3 phrases, mettre en valeur les bénéfices, et donner envie d'acheter.`,
      },
    ],
    500
  );
}

// Générer les balises SEO pour un produit
export async function genererSEO(
  nomProduit: string,
  description: string,
  categorie: string
): Promise<{ metaTitle: string; metaDescription: string }> {
  try {
    const texte = await completion(
      [
        { role: "system", content: SYSTEME_PROMPT },
        {
          role: "user",
          content: `Génère les balises SEO pour ce produit :
Nom: ${nomProduit}
Description: ${description}
Catégorie: ${categorie}

Réponds en JSON avec : {"metaTitle": "...", "metaDescription": "..."}
Le metaTitle doit faire max 60 caractères. La metaDescription max 155 caractères.`,
        },
      ],
      300
    );
    const json = texte.match(/\{[\s\S]*\}/)?.[0];
    return JSON.parse(json || "{}");
  } catch {
    return {
      metaTitle: nomProduit,
      metaDescription: description.slice(0, 155),
    };
  }
}

// Suggérer un prix selon le marché africain
export async function suggererPrix(
  nom: string,
  categorie: string,
  pays: string
): Promise<string> {
  return completion(
    [
      { role: "system", content: SYSTEME_PROMPT },
      {
        role: "user",
        content: `Suggère une fourchette de prix réaliste pour ce produit sur le marché africain :
Produit: ${nom}
Catégorie: ${categorie}
Pays: ${pays}

Donne une réponse courte avec la fourchette de prix conseillée et un bref raisonnement.`,
      },
    ],
    300
  );
}

// Générer une FAQ produit
export async function genererFaqProduit(
  nom: string,
  description: string
): Promise<Array<{ question: string; reponse: string }>> {
  try {
    const texte = await completion(
      [
        { role: "system", content: SYSTEME_PROMPT },
        {
          role: "user",
          content: `Génère une FAQ de 4 questions pour ce produit :
Nom: ${nom}
Description: ${description || "Produit digital"}

Réponds uniquement en JSON : [{"question":"...","reponse":"..."},...]
Les questions doivent être pratiques (accès, remboursement, format, délai…).`,
        },
      ],
      600
    );
    const json = texte.match(/\[[\s\S]*\]/)?.[0];
    return JSON.parse(json || "[]");
  } catch {
    return [
      { question: "Comment accéder au contenu après achat ?", reponse: "Un lien de téléchargement vous sera envoyé par email immédiatement après confirmation de votre paiement." },
      { question: "Puis-je obtenir un remboursement ?", reponse: "Contactez notre support dans les 7 jours suivant l'achat si vous rencontrez un problème avec votre commande." },
    ];
  }
}

// Générer des avis clients de démonstration à la création d'une boutique —
// pour qu'une boutique neuve inspire confiance dès le premier jour plutôt
// que d'afficher une section "Avis" vide. Marqués verifie:false côté
// appelant (jamais affichés avec un badge "achat vérifié").
export async function genererAvisDemo(
  nomBoutique: string,
  categorie: string,
  produitsNoms: string[]
): Promise<Array<{ note: number; titre: string; commentaire: string; clientNom: string }>> {
  try {
    const texte = await completion(
      [
        { role: "system", content: SYSTEME_PROMPT },
        {
          role: "user",
          content: `Génère 7 avis clients réalistes et variés pour cette boutique africaine :
Boutique: ${nomBoutique}
Catégorie: ${categorie}
Quelques produits: ${produitsNoms.slice(0, 5).join(", ") || "produits variés"}

Avis positifs (note 4 ou 5 sur 5), tons et longueurs variés (certains courts, certains plus détaillés),
prénoms/noms africains variés et réalistes, français naturel (pas de tournures robotiques).

Réponds uniquement en JSON : [{"note":5,"titre":"...","commentaire":"...","clientNom":"..."},...]`,
        },
      ],
      900
    );
    const json = texte.match(/\[[\s\S]*\]/)?.[0];
    const avis = JSON.parse(json || "[]");
    return Array.isArray(avis) ? avis.slice(0, 8) : [];
  } catch {
    return [
      { note: 5, titre: "Très satisfaite", commentaire: "Commande reçue rapidement, produit conforme à la description. Je recommande !", clientNom: "Aminata D." },
      { note: 5, titre: "Excellent service", commentaire: "Livraison rapide et bon accueil. Je repasserai commande.", clientNom: "Kwame O." },
      { note: 4, titre: "Bonne expérience", commentaire: "Produit de qualité, un peu de retard à la livraison mais rien de grave.", clientNom: "Fatou S." },
    ];
  }
}

// ─── Import de template — extraction de style (jamais d'exécution du fichier) ──
// Analyse un fichier HTML envoyé par le marchand pour en extraire l'identité
// visuelle (couleurs, polices, ambiance). Le fichier lui-même n'est jamais
// rendu ni exécuté — seul ce résumé JSON sert à peupler les métadonnées
// couleurs/polices du thème importé (voir app/api/themes/importer/route.ts).
export interface AnalyseTemplateImporte {
  couleurs: { fond?: string; accent?: string; texte?: string; surface?: string };
  polices: { titre?: string; corps?: string };
  ambiance: string[];
  rayonAngles: "anguleux" | "arrondi";
  styleBouton: "filled" | "outlined" | "pill";
}

const FALLBACK_ANALYSE: AnalyseTemplateImporte = {
  couleurs: {},
  polices: {},
  ambiance: ["moderne"],
  rayonAngles: "anguleux",
  styleBouton: "filled",
};

export interface StructureTemplateImporte {
  selecteurConteneurProduits: string | null;
  selecteurCarteProduit: string | null;
}

// Identifie UNIQUEMENT les deux sélecteurs CSS nécessaires pour brancher les
// vrais produits sur la grille du template envoyé (voir
// lib/theme-import-clone.ts) — jamais de reproduction de HTML par l'IA
// (peu fiable pour du HTML exact), juste deux sélecteurs courts et simples
// à vérifier/valider mécaniquement (querySelector doit les retrouver).
export async function identifierStructureTemplate(html: string): Promise<StructureTemplateImporte> {
  try {
    const texte = await completion(
      [
        { role: "system", content: SYSTEME_PROMPT },
        {
          role: "user",
          content: `Voici le HTML d'une boutique en ligne. Identifie UNIQUEMENT deux sélecteurs CSS simples (classe ou balise) :
1. Le conteneur qui entoure la grille des cartes produit (ex: la div avec la classe de la grille).
2. La carte produit individuelle répétée à l'intérieur (ex: la classe de chaque carte).

Réponds uniquement en JSON strict :
{"selecteurConteneurProduits":".ma-grille","selecteurCarteProduit":".ma-carte"}

Si tu ne trouves pas de grille de produits clairement répétée, réponds {"selecteurConteneurProduits":null,"selecteurCarteProduit":null}.
Les sélecteurs doivent être courts (une seule classe ou balise), jamais un chemin complexe.

Fichier :
\`\`\`html
${html.slice(0, 60000)}
\`\`\``,
        },
      ],
      200
    );
    const json = texte.match(/\{[\s\S]*\}/)?.[0];
    const parsed = JSON.parse(json || "{}");
    return {
      selecteurConteneurProduits: typeof parsed.selecteurConteneurProduits === "string" ? parsed.selecteurConteneurProduits : null,
      selecteurCarteProduit: typeof parsed.selecteurCarteProduit === "string" ? parsed.selecteurCarteProduit : null,
    };
  } catch {
    return { selecteurConteneurProduits: null, selecteurCarteProduit: null };
  }
}

// Généralisation d'identifierStructureTemplate pour les autres pages
// clonées/habillées (vague A du clonage multi-pages) : fiche produit,
// panier, commande, confirmation — un seul sélecteur à chaque fois, jamais
// de reproduction de HTML. `description` cadre en une phrase ce qu'il faut
// retrouver (ex: "la zone qui affiche le produit unique, image+nom+prix+
// bouton d'achat", "le formulaire de commande avec les champs livraison").
export async function identifierZoneUnique(html: string, description: string): Promise<string | null> {
  try {
    const texte = await completion(
      [
        { role: "system", content: SYSTEME_PROMPT },
        {
          role: "user",
          content: `Voici le HTML d'une page de boutique en ligne. Identifie UN SEUL sélecteur CSS simple (classe ou balise, jamais un chemin complexe) pour cette zone : ${description}

Réponds uniquement en JSON strict : {"selecteur":".ma-zone"}
Si tu ne trouves pas cette zone clairement, réponds {"selecteur":null}.

Fichier :
\`\`\`html
${html.slice(0, 60000)}
\`\`\``,
        },
      ],
      150
    );
    const json = texte.match(/\{[\s\S]*\}/)?.[0];
    const parsed = JSON.parse(json || "{}");
    return typeof parsed.selecteur === "string" ? parsed.selecteur : null;
  } catch {
    return null;
  }
}

// ─── Bibliothèque AXSO Design (Templates/*.html) ──────────────────────────────
// Ces fichiers suivent une convention figée (mêmes ids fonctionnels partout :
// #plpGrid/#homeGrid vides, remplis en JS jamais exécuté — voir
// lib/theme-import-clone.ts::extraireVuesLibrairie) — un seul point reste
// bespoke par design : la carte produit visuelle, générée par une fonction
// JS (`cardHTML` ou équivalent) jamais exécutée. Appelé UNE FOIS par fichier
// (pas par boutique) lors de la construction du manifeste de la
// bibliothèque — jamais à l'exécution normale.
export interface GabaritsLibrairie {
  carteTemplate: string | null; // HTML statique tokenisé {{ID}}/{{NOM}}/{{PRIX}}/{{IMAGE}}/{{LIEN}}
  selecteurVisuelPdp: string | null; // conteneur du visuel principal dans #view-produit
}

export async function extraireGabaritsLibrairie(html: string): Promise<GabaritsLibrairie> {
  try {
    const texte = await completion(
      [
        { role: "system", content: SYSTEME_PROMPT },
        {
          role: "user",
          content: `Voici le code d'une page de boutique en ligne (HTML + CSS + JavaScript). La grille de produits (#plpGrid ou #homeGrid) est vide dans le HTML : elle est normalement remplie par une fonction JavaScript qui génère une carte produit par un template de chaîne (ex: une fonction "cardHTML" ou similaire qui retourne un \`...\` avec des \${...}). Ce script ne sera JAMAIS exécuté.

Tâche 1 — Retrouve cette fonction et convertis son template en HTML STATIQUE, en remplaçant chaque donnée produit par EXACTEMENT un de ces jetons (aucun autre) :
- {{ID}} → l'identifiant du produit
- {{NOM}} → le nom du produit
- {{PRIX}} → le prix déjà formaté à afficher
- {{IMAGE}} → l'URL de la photo produit
- {{LIEN}} → l'URL de la fiche produit
Simplifie toute logique conditionnelle (ex: prix barré, liste de souhaits) pour ne garder que l'affichage simple prix/nom. Si la carte n'a pas de \`<img>\` mais un visuel décoratif (SVG, dégradé de fond...), REMPLACE ce visuel par \`<img src="{{IMAGE}}" alt="{{NOM}}" style="width:100%;height:100%;object-fit:cover;">\` à la même place. Retire tout gestionnaire d'événement (onclick...) du HTML retourné. Le résultat doit être UN seul élément racine.

Tâche 2 — Dans la zone #view-produit (fiche produit), identifie le sélecteur CSS (classe ou id, court) du conteneur qui affiche le visuel PRINCIPAL du produit (photo, ou zone décorative équivalente) — celui qu'il faudrait remplacer par une vraie photo produit.

Réponds UNIQUEMENT en JSON strict : {"carteTemplate":"<a class=\"...\">...</a>","selecteurVisuelPdp":"#pdpFrame"}
Si tu ne trouves pas la fonction de carte ou le visuel PDP, mets la valeur correspondante à null.

Fichier :
\`\`\`html
${html.slice(0, 60000)}
\`\`\``,
        },
      ],
      4000
    );
    const json = texte.match(/\{[\s\S]*\}/)?.[0];
    const parsed = JSON.parse(json || "{}");
    return {
      carteTemplate: typeof parsed.carteTemplate === "string" ? parsed.carteTemplate : null,
      selecteurVisuelPdp: typeof parsed.selecteurVisuelPdp === "string" ? parsed.selecteurVisuelPdp : null,
    };
  } catch {
    return { carteTemplate: null, selecteurVisuelPdp: null };
  }
}

export async function analyserTemplateImporte(html: string): Promise<AnalyseTemplateImporte> {
  const fontIds = FONTS.map((f) => f.v).join(", ");
  try {
    const texte = await completion(
      [
        { role: "system", content: SYSTEME_PROMPT },
        {
          role: "user",
          content: `Voici le code HTML/CSS d'un site que le marchand souhaite utiliser comme inspiration visuelle pour sa boutique AXSO. Analyse UNIQUEMENT son style (couleurs, polices, ambiance) — n'exécute ni ne reproduis son code, ne cite aucun texte du site.

Réponds uniquement en JSON strict avec cette forme exacte :
{
  "couleurs": {"fond":"#RRGGBB","accent":"#RRGGBB","texte":"#RRGGBB","surface":"#RRGGBB"},
  "polices": {"titre":"<un id parmi: ${fontIds}>","corps":"<un id parmi: ${fontIds}>"},
  "ambiance": ["adjectif1","adjectif2"],
  "rayonAngles": "anguleux" ou "arrondi",
  "styleBouton": "filled" ou "outlined" ou "pill"
}

Règles :
- Les couleurs doivent être des hex à 6 chiffres tirés réellement des variables CSS du fichier (:root, --bg, --ink, --accent, etc.) — n'invente pas de couleurs si tu n'en trouves pas.
- "polices" doit être choisi STRICTEMENT dans la liste donnée, jamais un nom de police libre.

Fichier à analyser :
\`\`\`html
${html.slice(0, 60000)}
\`\`\``,
        },
      ],
      700
    );
    const json = texte.match(/\{[\s\S]*\}/)?.[0];
    const parsed = JSON.parse(json || "{}");
    return {
      couleurs: typeof parsed.couleurs === "object" && parsed.couleurs ? parsed.couleurs : {},
      polices: typeof parsed.polices === "object" && parsed.polices ? parsed.polices : {},
      ambiance: Array.isArray(parsed.ambiance) ? parsed.ambiance.slice(0, 6) : FALLBACK_ANALYSE.ambiance,
      rayonAngles: parsed.rayonAngles === "arrondi" ? "arrondi" : "anguleux",
      styleBouton: ["filled", "outlined", "pill"].includes(parsed.styleBouton) ? parsed.styleBouton : "filled",
    };
  } catch {
    return FALLBACK_ANALYSE;
  }
}

// Chat général avec l'assistant IA
export async function chatAvecIA(
  messages: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  return completion(
    [{ role: "system", content: SYSTEME_PROMPT }, ...messages],
    1000
  );
}

// ─── Agent AXIA du constructeur libre ──────────────────────────────────────
// Traduit une demande en français libre ("mets le titre en plus grand et
// centré", "ajoute une section avec nos avantages") en une liste d'actions
// structurées (voir lib/agent-actions.ts) appliquées à l'arbre du
// constructeur — jamais de génération de JSX/HTML libre : l'agent ne
// connaît que le catalogue de blocs existants (lib/block-catalog.ts) et les
// 8 opérations de lib/block-tree.ts, exactement comme un marchand qui
// utiliserait la souris.
export interface ReponseAgentConstructeur {
  actions: any[]; // validé/typé ensuite par lib/agent-actions.ts::validerActions
  resume: string;
}

function resumerArbrePourPrompt(tree: any[]): string {
  // Retire les configs volumineuses (listes d'items/images longues) pour
  // garder le prompt court — l'agent a besoin des id/type/imbrication pour
  // cibler ses actions, rarement du contenu détaillé de chaque bloc.
  const alleger = (n: any): any => ({
    id: n.id,
    type: n.type,
    ...(n.actif === false ? { actif: false } : {}),
    ...(n.config ? { config: JSON.stringify(n.config).slice(0, 300) } : {}),
    ...(n.style ? { style: n.style } : {}),
    ...(n.children?.length ? { children: n.children.map(alleger) } : {}),
  });
  return JSON.stringify((tree || []).map(alleger));
}

export async function agentConstructeurLibre(params: {
  instruction: string;
  tree: any[];
  boutique: { nom: string; categorie: string; couleurs?: { accent?: string; fond?: string; texte?: string } };
}): Promise<ReponseAgentConstructeur> {
  const catalogue = BLOCK_CATALOG.map((e) => `- "${e.type}" (${e.categorie === "structure" ? "structurel" : "widget"}) : ${e.champs}`).join("\n");

  const prompt = `Tu es AXIA, l'agent IA intégré au constructeur libre d'Axso. Le marchand te décrit en français ce qu'il veut changer sur sa page, et tu traduis sa demande en une liste d'actions structurées — tu ne génères JAMAIS de HTML/CSS/JS libre, uniquement des actions parmi celles listées ci-dessous, portant sur les types de blocs du catalogue.

BOUTIQUE : ${params.boutique.nom} (${params.boutique.categorie})${params.boutique.couleurs ? ` — couleurs actuelles : accent ${params.boutique.couleurs.accent}, fond ${params.boutique.couleurs.fond}, texte ${params.boutique.couleurs.texte}` : ""}

RÈGLE D'IMBRICATION (stricte) : section → ligne (row) → colonne (column) → widget. Une colonne peut aussi contenir une autre ligne (imbrication). Un widget ne va jamais directement dans une section ou une ligne.

CATALOGUE DES TYPES DE BLOCS (uniquement ceux-ci, aucun autre) :
${catalogue}

ARBRE ACTUEL DE LA PAGE (id/type/config résumé/style/enfants) :
${resumerArbrePourPrompt(params.tree)}

ACTIONS DISPONIBLES — réponds avec un tableau d'actions parmi EXACTEMENT ces formes :
1. {"op":"insert","parentId":"<id existant ou null pour la racine>","index":<position>,"node":{"type":"...","config":{...},"style":{...},"children":[...même forme récursive...]}}
   → Pour ajouter du contenu neuf. "node" peut décrire toute une sous-arborescence (ex: section avec une ligne à 2 colonnes) en une seule action, avec des enfants imbriqués — tu ne peux pas connaître les id générés donc ne construis JAMAIS plusieurs actions "insert" qui dépendent les unes des autres, mets tout dans un seul "node" avec "children".
2. {"op":"move","nodeId":"<id>","newParentId":"<id ou null>","newIndex":<position>} → déplacer/réordonner un bloc existant.
3. {"op":"remove","nodeId":"<id>"} → supprimer un bloc.
4. {"op":"duplicate","nodeId":"<id>"} → dupliquer un bloc.
5. {"op":"updateStyle","nodeId":"<id>","style":{"spacing":{"pt":"...","pb":"...","pl":"...","pr":"...","mt":"...","mb":"..."},"background":{"color":"#RRGGBB","image":"url","gradient":"linear-gradient(...)"},"typography":{"color":"#RRGGBB","taille":"...","poids":"...","align":"left"|"center"|"right"},"border":{"radius":"...","width":"...","color":"#RRGGBB"},"width":"...","customClass":"...","visibility":{"desktop":true|false,"tablet":true|false,"mobile":true|false}}} → changer l'apparence desktop du bloc (couleur de fond, padding, taille de texte, alignement, largeur de colonne...) ET/OU sa visibilité par appareil. Ne renvoie que les champs à changer.
6. {"op":"updateResponsiveStyle","nodeId":"<id>","breakpoint":"tablet"|"mobile","style":{"spacing":{...},"background":{...},"typography":{...},"border":{...},"width":"..."}} → changer UNIQUEMENT spacing/background/typography/border/width sur tablette ou mobile (le marchand a explicitement demandé "sur mobile"/"sur tablette", ex: "le titre plus petit sur mobile"). PAS de "visibility" ni "customClass" ici — pour masquer un bloc sur un appareil précis, utilise TOUJOURS updateStyle avec le champ "visibility" (action 5), jamais "customClass":"hidden" ni updateResponsiveStyle.
7. {"op":"updateConfig","nodeId":"<id>","config":{...champs du type concerné...}} → changer le CONTENU d'un widget (texte, titre, items, lien du bouton...). Ne renvoie que les champs à changer.
8. {"op":"toggleActif","nodeId":"<id>"} → afficher/masquer un bloc sur TOUS les appareils à la fois (équivalent à décocher "actif") — pour masquer sur un seul appareil (ex: "cache ce bloc sur mobile"), utilise plutôt updateStyle → visibility (action 5).

RÈGLES :
- Pour masquer un bloc sur un appareil précis ("masque X sur mobile/tablette/desktop"), utilise EXCLUSIVEMENT {"op":"updateStyle","nodeId":"...","style":{"visibility":{"mobile":false}}} (ou "tablet"/"desktop") — jamais "customClass", jamais updateResponsiveStyle.
- Cible toujours des "nodeId" qui existent réellement dans l'arbre actuel ci-dessus — jamais un id inventé.
- Pour "products", ne mets JAMAIS de faux produits dans "config" : les vrais produits de la boutique s'affichent automatiquement.
- Les couleurs sont des hex (#RRGGBB). Les espacements/tailles sont du CSS (ex "24px", "2rem", "50%").
- "ctaLien"/"lien" sont des chemins relatifs de la boutique (ex "produits", "a-propos", "contact"), jamais une URL complète.
- Si la demande est ambiguë ou déjà satisfaite, renvoie un tableau d'actions vide plutôt que d'inventer un changement non demandé.
- Reste dans la limite de ~15 actions par réponse.

Réponds UNIQUEMENT en JSON strict, cette forme exacte :
{"actions":[...],"resume":"une phrase courte en français expliquant ce que tu as fait, au passé, pour le marchand"}

DEMANDE DU MARCHAND : "${params.instruction}"`;

  try {
    const texte = await completion([{ role: "system", content: SYSTEME_PROMPT }, { role: "user", content: prompt }], 3000);
    const json = texte.match(/\{[\s\S]*\}/)?.[0];
    const parsed = JSON.parse(json || "{}");
    return {
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      resume: typeof parsed.resume === "string" ? parsed.resume : "C'est fait.",
    };
  } catch {
    return { actions: [], resume: "Désolé, je n'ai pas réussi à traiter cette demande — reformule ou essaie une action plus simple." };
  }
}
