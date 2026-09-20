/**
 * Génère un themeConfig complet et optimisé à partir du profil business du marchand.
 * Chaque boutique créée démarre avec un setup premium calibré pour sa catégorie.
 */
import type { ThemeConfig, ProductPageSection, CustomSection, ThemeAboutPageConfig, ThemeContactPageConfig } from "./theme-config";

// ─── Détection de catégorie ───────────────────────────────────────────────────
export type CategoryType =
  | "fashion" | "beauty" | "food" | "tech" | "home" | "jewelry"
  | "kids"    | "health" | "sport" | "services" | "agriculture"
  | "artisan" | "books"  | "auto"  | "general";

export function detectCategory(cat: string): CategoryType {
  const c = cat.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  if (/mode|vetement|habit|fashion|lingerie|sac|chaussure|maroquinerie|pret.a.porter|textile|couture/.test(c)) return "fashion";
  if (/beaut|cosmet|soin|maquillage|parfum|coiffure|hair|skin|manucure|esthetique/.test(c)) return "beauty";
  if (/aliment|nourriture|epicerie|food|restaur|cuisine|boisson|snack|patisserie|boulang|epice|cafe|the/.test(c)) return "food";
  if (/electron|tech|informatique|telephone|high.tech|ordinateur|appareil|smartphone|tablette|accessoire.tel/.test(c)) return "tech";
  if (/maison|deco|ameublement|mobilier|salon|chambre|jardin|cuisine.equip|literie|tapis/.test(c)) return "home";
  if (/bijou|joaillerie|montre|bague|collier|bracelet|pendentif|or|argent|diamant/.test(c)) return "jewelry";
  if (/enfant|bebe|jouet|puericulture|scolaire|creche|naissance|maternite/.test(c)) return "kids";
  if (/sante|bien.?etre|pharmacie|medical|para.?pharmacie|vitamine|supplement|clinique|therapeutique/.test(c)) return "health";
  if (/sport|fitness|gym|musculation|running|yoga|natation|football|basket|tennis/.test(c)) return "sport";
  if (/service|coaching|formation|consulting|conseil|agence|prestation|freelance|digital/.test(c)) return "services";
  if (/agricultur|plante|jardin|semence|graine|ferme|bio|maraicher|elevage/.test(c)) return "agriculture";
  if (/artisan|fait.main|handmade|artisanat|poterie|broderie|vannerie|sculpture/.test(c)) return "artisan";
  if (/livre|libraire|culture|art|musique|photo|instrument|galerie/.test(c)) return "books";
  if (/auto|moto|voiture|vehicule|piece|garage|mecanique|pneumatique/.test(c)) return "auto";
  return "general";
}

// ─── Sections page produit par catégorie ──────────────────────────────────────
function buildProductSections(type: CategoryType): ProductPageSection[] {
  const gallery   = (style = "vertical-thumbs"): ProductPageSection =>
    ({ id: "gallery",     type: "gallery",     actif: true, config: { style, zoom: true, sticky: true } });
  const info      = (): ProductPageSection =>
    ({ id: "info",        type: "info",        actif: true, config: { breadcrumbs: true, badges: true, stock: true } });
  const variants  = (): ProductPageSection => ({ id: "variants",  type: "variants",  actif: true, config: {} });
  const quantity  = (): ProductPageSection => ({ id: "quantity",  type: "quantity",  actif: true, config: {} });
  const trust     = (): ProductPageSection => ({ id: "trust",     type: "trust",     actif: true, config: {} });
  const desc      = (): ProductPageSection => ({ id: "description",type:"description",actif: true, config: { ai: true } });
  const reviews   = (): ProductPageSection => ({ id: "reviews",   type: "reviews",   actif: true, config: {} });
  const similar   = (titre = "Vous aimerez aussi"): ProductPageSection =>
    ({ id: "similar",     type: "similar",     actif: true, config: { count: 4, titre } });

  const custom = (id: string, type: string, config: Record<string, any>): ProductPageSection =>
    ({ id, type: type as any, actif: true, config });

  switch (type) {
    case "fashion": return [
      gallery("vertical-thumbs"), info(), variants(), quantity(), trust(),
      custom("sizeguide", "sizeguide", { titre: "Guide des tailles", headers: ["Taille","Tour de poitrine","Tour de taille","Tour de hanches"], rows: [{ cells: ["XS","80-84 cm","60-64 cm","86-90 cm"] },{ cells: ["S","84-88 cm","64-68 cm","90-94 cm"] },{ cells: ["M","88-92 cm","68-72 cm","94-98 cm"] },{ cells: ["L","92-96 cm","72-76 cm","98-102 cm"] },{ cells: ["XL","96-102 cm","76-82 cm","102-108 cm"] }] }),
      custom("features_fashion", "features", { titre: "Pourquoi choisir cette pièce ?", items: [{ icone: "✦", titre: "Qualité premium", texte: "Matières soigneusement sélectionnées pour un confort optimal." },{ icone: "🚀", titre: "Livraison express", texte: "Expédition sous 24h, suivi en temps réel." },{ icone: "↩️", titre: "Retour facile", texte: "Échange ou remboursement sous 14 jours sans condition." }] }),
      desc(), reviews(),
      custom("faq_fashion", "faq", { titre: "Questions fréquentes", items: [{ question: "Comment entretenir cet article ?", reponse: "Lavage en machine délicat à 30°C. Éviter l'essorage. Séchage à plat recommandé." },{ question: "Le guide des tailles est-il fiable ?", reponse: "Nos tailles correspondent aux standards européens. En cas de doute entre deux tailles, prenez la plus grande." },{ question: "Quel délai pour un échange ?", reponse: "Renvoyez-nous l'article sous 14 jours, nous procédons à l'échange ou au remboursement sous 48h." }] }),
      custom("social", "social", {}),
      similar("Ces pièces vous correspondent"),
    ];

    case "beauty": return [
      gallery("vertical-thumbs"), info(), variants(), quantity(), trust(),
      custom("ingredients_beauty", "ingredients", { titre: "Composition & ingrédients", texte: "Formule sans parabènes, sans sulfates, testée dermatologiquement.", items: [{ nom: "Eau florale de rose", desc: "Hydrate et apaise les peaux sensibles." },{ nom: "Aloe Vera bio", desc: "Propriétés régénérantes et anti-inflammatoires." },{ nom: "Huile de jojoba", desc: "Nourrit sans occlure les pores." }] }),
      custom("howto_beauty", "howto", { titre: "Comment l'utiliser ?", steps: [{ num: "01", titre: "Nettoyer", texte: "Appliquez sur peau propre et légèrement humide." },{ num: "02", titre: "Appliquer", texte: "Massez en mouvements circulaires jusqu'à absorption complète." },{ num: "03", titre: "Répéter", texte: "Utilisez matin et soir pour des résultats optimaux en 4 semaines." }] }),
      custom("features_beauty", "features", { titre: "Nos engagements beauté", items: [{ icone: "🌿", titre: "100% naturel", texte: "Formule vegan et cruelty-free, certifiée." },{ icone: "🔬", titre: "Testé dermatologiquement", texte: "Convient aux peaux sensibles et réactives." },{ icone: "✨", titre: "Résultats visibles", texte: "Efficacité prouvée en 4 semaines d'utilisation régulière." }] }),
      desc(), reviews(),
      custom("faq_beauty", "faq", { titre: "Questions fréquentes", items: [{ question: "Convient-il aux peaux sensibles ?", reponse: "Oui, notre formule est hypoallergénique et testée dermatologiquement, convient aux peaux les plus sensibles." },{ question: "Quelle est la date de péremption ?", reponse: "30 mois après fabrication. Une fois ouvert, utilisez de préférence dans les 12 mois." },{ question: "Le produit est-il vegan ?", reponse: "Oui, tous nos produits sont 100% vegan et non testés sur les animaux." }] }),
      similar("Des produits qui complètent votre routine"),
    ];

    case "food": return [
      gallery("vertical-thumbs"), info(), variants(), quantity(), trust(),
      custom("ingredients_food", "ingredients", { titre: "Composition & valeurs nutritives", texte: "Ingrédients naturels, sans conservateurs artificiels, cultivés localement.", items: [{ nom: "Protéines", desc: "Source essentielle pour votre énergie quotidienne." },{ nom: "Vitamines A, C, E", desc: "Antioxydants naturels pour votre vitalité." },{ nom: "Sans additifs", desc: "Aucun colorant ni conservateur artificiel." }] }),
      custom("howto_food", "howto", { titre: "Comment préparer ?", steps: [{ num: "01", titre: "Préparer", texte: "Sortez le produit du réfrigérateur 15 minutes avant consommation." },{ num: "02", titre: "Préparer", texte: "Suivez nos instructions de préparation pour le meilleur résultat." },{ num: "03", titre: "Savourer", texte: "Consommez immédiatement après préparation pour conserver toutes les saveurs." }] }),
      custom("guarantee_food", "guarantee", { titre: "Nos garanties fraîcheur", items: [{ icone: "❄️", titre: "Chaîne du froid", texte: "Produits conservés à température contrôlée de la production à la livraison." },{ icone: "🌿", titre: "100% naturel", texte: "Aucun conservateur artificiel, issu de l'agriculture locale." },{ icone: "✅", titre: "Contrôle qualité", texte: "Chaque lot est contrôlé avant expédition." }] }),
      desc(), reviews(),
      custom("faq_food", "faq", { titre: "Questions fréquentes", items: [{ question: "Comment conserver ce produit ?", reponse: "Conservez dans un endroit frais et sec, à l'abri de la lumière directe. Réfrigérez après ouverture." },{ question: "Quelle est la date de consommation ?", reponse: "La date limite est indiquée sur l'emballage. Pour les produits frais, consommez dans les 3 jours." },{ question: "Les produits sont-ils certifiés bio ?", reponse: "Nos produits proviennent de producteurs locaux respectant les pratiques d'agriculture durable." }] }),
      similar("Ces produits vont ensemble"),
    ];

    case "tech": return [
      gallery("vertical-thumbs"), info(), variants(), quantity(), trust(),
      custom("specs_tech", "specs", { titre: "Caractéristiques techniques", rows: [{ cle: "Processeur", valeur: "Voir description" },{ cle: "Mémoire", valeur: "Voir description" },{ cle: "Stockage", valeur: "Voir description" },{ cle: "Connectivité", valeur: "WiFi, Bluetooth 5.0" },{ cle: "Garantie", valeur: "12 mois constructeur" },{ cle: "Poids", valeur: "Voir description" }] }),
      custom("features_tech", "features", { titre: "Pourquoi choisir ce produit ?", items: [{ icone: "✅", titre: "Produit authentique", texte: "100% original avec certificat d'authenticité et numéro de série vérifiable." },{ icone: "🛡️", titre: "Garantie 12 mois", texte: "SAV réactif sous 48h, pièces de rechange disponibles." },{ icone: "📦", titre: "Livraison sécurisée", texte: "Emballage renforcé, assurance transport incluse." }] }),
      custom("comparison_tech", "comparison", { titre: "Pourquoi nous ?", headers: ["Critère","Notre boutique","Marché classique"], rows: [{ cells: ["Authenticité","✓ Garantie","Non certifié"] },{ cells: ["Garantie","✓ 12 mois","0-3 mois"] },{ cells: ["SAV","✓ Sous 48h","Variable"] },{ cells: ["Prix","Meilleur prix","Prix marché"] }] }),
      desc(), reviews(),
      custom("faq_tech", "faq", { titre: "Questions fréquentes", items: [{ question: "Le produit est-il compatible avec mon pays ?", reponse: "Oui, nos produits sont compatibles avec les normes locales (prise 220V, fréquences réseau adaptées)." },{ question: "Comment fonctionne la garantie ?", reponse: "En cas de défaut, contactez-nous sous 48h. Réparation ou remplacement sans frais sous garantie." },{ question: "Livrez-vous en dehors de la capitale ?", reponse: "Oui, nous livrons dans tout le pays via nos partenaires logistiques. Délai : 2 à 5 jours ouvrés." }] }),
      custom("guarantee_tech", "guarantee", { titre: "Acheter en toute confiance", items: [{ icone: "🔒", titre: "Paiement sécurisé", texte: "Orange Money, Wave, carte bancaire — transactions cryptées SSL." },{ icone: "🛡️", titre: "Garantie 12 mois", texte: "Couverte pièces & main-d'œuvre, SAV réactif." },{ icone: "📦", titre: "Retour 30 jours", texte: "Produit défectueux ? Retour ou échange sans frais." }] }),
      similar("Ces produits vous intéresseront aussi"),
    ];

    case "home": return [
      gallery("vertical-thumbs"), info(), variants(), quantity(), trust(),
      custom("specs_home", "specs", { titre: "Dimensions & matières", rows: [{ cle: "Dimensions", valeur: "Voir description" },{ cle: "Matière principale", valeur: "Voir description" },{ cle: "Couleurs disponibles", valeur: "Voir variantes" },{ cle: "Assemblage", valeur: "Facile — notice incluse" },{ cle: "Poids", valeur: "Voir description" }] }),
      custom("features_home", "features", { titre: "Ce qui rend ce produit unique", items: [{ icone: "🏠", titre: "Design contemporain", texte: "Esthétique moderne qui s'intègre dans tous les intérieurs." },{ icone: "💪", titre: "Durabilité", texte: "Matériaux de qualité pour une longévité exceptionnelle." },{ icone: "📦", titre: "Livraison soignée", texte: "Emballage renforcé pour une livraison en parfait état." }] }),
      desc(), reviews(),
      custom("faq_home", "faq", { titre: "Questions fréquentes", items: [{ question: "Le produit est-il facile à assembler ?", reponse: "Oui, une notice illustrée est incluse. Le montage prend en moyenne 20-30 minutes." },{ question: "Puis-je personnaliser la couleur ?", reponse: "Plusieurs coloris sont disponibles selon le modèle. Consultez les variantes disponibles." },{ question: "Quelle garantie est offerte ?", reponse: "12 mois sur les défauts de fabrication. SAV disponible par WhatsApp." }] }),
      similar("Ces articles complètent votre décoration"),
    ];

    case "jewelry": return [
      gallery("vertical-thumbs"), info(), variants(), quantity(), trust(),
      custom("sizeguide_jewelry", "sizeguide", { titre: "Guide des tailles", headers: ["Taille (mm)", "Tour de doigt (cm)", "Pointure EU"], rows: [{ cells: ["46 mm", "4,6 cm", "46"] },{ cells: ["48 mm", "4,8 cm", "48"] },{ cells: ["50 mm", "5,0 cm", "50"] },{ cells: ["52 mm", "5,2 cm", "52"] },{ cells: ["54 mm", "5,4 cm", "54"] },{ cells: ["56 mm", "5,6 cm", "56"] }] }),
      custom("features_jewelry", "features", { titre: "L'excellence de nos créations", items: [{ icone: "💎", titre: "Matières précieuses", texte: "Or 18 carats, argent 925, pierres naturelles certifiées." },{ icone: "✦", titre: "Fait à la main", texte: "Chaque pièce est travaillée artisanalement par nos maîtres joailliers." },{ icone: "📜", titre: "Certificat d'authenticité", texte: "Chaque bijou est livré avec son certificat de garantie." }] }),
      custom("guarantee_jewelry", "guarantee", { titre: "Notre promesse", items: [{ icone: "💎", titre: "Authenticité certifiée", texte: "Chaque pièce vient avec un certificat d'authenticité des matériaux." },{ icone: "🎁", titre: "Écrin offert", texte: "Livraison dans un écrin luxueux, prêt à offrir." },{ icone: "✨", titre: "Entretien garanti", texte: "Nettoyage et entretien gratuit pendant 1 an." }] }),
      desc(), reviews(),
      custom("faq_jewelry", "faq", { titre: "Questions fréquentes", items: [{ question: "Comment entretenir mes bijoux ?", reponse: "Nettoyez avec un chiffon doux. Évitez le contact avec les produits chimiques, la mer et la piscine. Rangez séparément." },{ question: "Les pierres sont-elles naturelles ?", reponse: "Oui, toutes nos pierres sont naturelles et certifiées. Le certificat d'authenticité est inclus." },{ question: "Puis-je faire graver un bijou ?", reponse: "Oui, la gravure personnalisée est disponible sur demande. Délai supplémentaire de 3 à 5 jours." }] }),
      similar("Ces bijoux vous séduiront aussi"),
    ];

    case "kids": return [
      gallery("vertical-thumbs"), info(), variants(), quantity(), trust(),
      custom("features_kids", "features", { titre: "Conçu pour la sécurité de vos enfants", items: [{ icone: "🛡️", titre: "Certifié CE", texte: "Conformité aux normes européennes de sécurité enfant." },{ icone: "🌿", titre: "Matériaux non toxiques", texte: "Sans BPA, sans phtalates, testés en laboratoire." },{ icone: "👶", titre: "Adapté à l'âge", texte: "Recommandations d'âge strictement respectées." }] }),
      custom("specs_kids", "specs", { titre: "Informations produit", rows: [{ cle: "Âge recommandé", valeur: "Voir description" },{ cle: "Matière", valeur: "Voir description" },{ cle: "Certification", valeur: "CE / EN71" },{ cle: "Lavable", valeur: "Voir description" },{ cle: "Origine", valeur: "Voir description" }] }),
      desc(), reviews(),
      custom("faq_kids", "faq", { titre: "Questions fréquentes", items: [{ question: "Le produit est-il sécurisé pour les très jeunes enfants ?", reponse: "Oui, notre produit est certifié CE et respecte les normes EN71. Toujours surveiller les enfants de moins de 3 ans." },{ question: "Comment nettoyer ce produit ?", reponse: "Consultez l'étiquette pour les instructions d'entretien spécifiques. La plupart de nos produits sont lavables en machine." },{ question: "Puis-je personnaliser avec un prénom ?", reponse: "La personnalisation est disponible sur certains articles. Contactez-nous avant commande." }] }),
      similar("D'autres coups de cœur pour vos enfants"),
    ];

    case "health": return [
      gallery("vertical-thumbs"), info(), variants(), quantity(), trust(),
      custom("ingredients_health", "ingredients", { titre: "Composition & principes actifs", texte: "Formule scientifiquement éprouvée, sans additifs nocifs.", items: [{ nom: "Principe actif principal", desc: "Dosage optimisé pour une efficacité maximale." },{ nom: "Excipients naturels", desc: "Sans colorants ni conservateurs artificiels." },{ nom: "Certifié ISO", desc: "Fabriqué selon les bonnes pratiques pharmaceutiques." }] }),
      custom("howto_health", "howto", { titre: "Posologie & mode d'emploi", steps: [{ num: "01", titre: "Dosage", texte: "Respectez le dosage recommandé indiqué sur l'emballage ou prescrit par votre médecin." },{ num: "02", titre: "Moment de prise", texte: "De préférence le matin avec un grand verre d'eau, avant ou après le repas selon le produit." },{ num: "03", titre: "Durée", texte: "Cure recommandée : 4 à 8 semaines. Renouvelable après avis médical." }] }),
      custom("features_health", "features", { titre: "Pourquoi ce produit ?", items: [{ icone: "🔬", titre: "Formule cliniquement testée", texte: "Efficacité prouvée par des études cliniques indépendantes." },{ icone: "🌿", titre: "100% naturel", texte: "Ingrédients d'origine naturelle, sans OGM." },{ icone: "🏥", titre: "Recommandé par les pros", texte: "Approuvé par des professionnels de santé." }] }),
      desc(), reviews(),
      custom("faq_health", "faq", { titre: "Questions fréquentes", items: [{ question: "Ce produit a-t-il des contre-indications ?", reponse: "Consultez votre médecin si vous êtes enceinte, allaitante, ou sous traitement médical. Lisez la notice complète." },{ question: "Combien de temps avant de voir des résultats ?", reponse: "Les premiers effets sont généralement visibles après 2 à 4 semaines d'utilisation régulière." },{ question: "Puis-je l'associer à d'autres produits ?", reponse: "Consultez un professionnel de santé avant d'associer plusieurs compléments alimentaires." }] }),
      custom("guarantee_health", "guarantee", { titre: "Nos garanties qualité", items: [{ icone: "🏆", titre: "Qualité certifiée", texte: "Fabriqué selon les normes de qualité pharmaceutiques les plus strictes." },{ icone: "🌿", titre: "Naturel & sûr", texte: "Formule naturelle, testée et approuvée par des experts en nutrition." },{ icone: "↩️", titre: "Satisfait ou remboursé", texte: "30 jours pour tester. Remboursement intégral si non satisfait." }] }),
      similar("Ces produits complètent votre bien-être"),
    ];

    case "sport": return [
      gallery("vertical-thumbs"), info(), variants(), quantity(), trust(),
      custom("specs_sport", "specs", { titre: "Caractéristiques techniques", rows: [{ cle: "Matière", valeur: "Voir description" },{ cle: "Taille", valeur: "Voir variantes" },{ cle: "Poids", valeur: "Voir description" },{ cle: "Norme", valeur: "Conforme aux standards sportifs" },{ cle: "Utilisation", valeur: "Intérieur / Extérieur" }] }),
      custom("sizeguide_sport", "sizeguide", { titre: "Guide des tailles sportswear", headers: ["Taille","Tour de poitrine","Tour de taille","Longueur"], rows: [{ cells: ["XS/36","80-84 cm","60-64 cm","Voir produit"] },{ cells: ["S/38","84-88 cm","64-68 cm","Voir produit"] },{ cells: ["M/40","88-92 cm","68-72 cm","Voir produit"] },{ cells: ["L/42","92-96 cm","72-76 cm","Voir produit"] },{ cells: ["XL/44","96-100 cm","76-80 cm","Voir produit"] }] }),
      custom("features_sport", "features", { titre: "Conçu pour la performance", items: [{ icone: "⚡", titre: "Performance maximale", texte: "Matériaux techniques pour une liberté de mouvement totale." },{ icone: "💧", titre: "Respirant & évacuant", texte: "Technologie moisture-wicking pour rester au sec pendant l'effort." },{ icone: "💪", titre: "Durabilité renforcée", texte: "Coutures renforcées pour résister aux entraînements les plus intenses." }] }),
      desc(), reviews(),
      custom("faq_sport", "faq", { titre: "Questions fréquentes", items: [{ question: "Comment choisir ma taille ?", reponse: "Consultez notre guide des tailles. Pour les équipements, prenez votre mesure habituelle. En cas de doute, choisissez la taille supérieure." },{ question: "Comment entretenir cet équipement ?", reponse: "Lavage machine à 30°C. Pas de sèche-linge. Séchage à l'air libre pour conserver les propriétés techniques." },{ question: "Convient-il à tous les niveaux ?", reponse: "Ce produit convient aussi bien aux débutants qu'aux sportifs confirmés, avec des caractéristiques adaptées à toutes les pratiques." }] }),
      similar("Ces équipements améliorent votre performance"),
    ];

    case "agriculture": return [
      gallery("vertical-thumbs"), info(), variants(), quantity(), trust(),
      custom("ingredients_agri", "ingredients", { titre: "Origine & composition", texte: "Produits 100% naturels, cultivés sans pesticides chimiques.", items: [{ nom: "Origine", desc: "Cultivé localement, circuit court." },{ nom: "Culture", desc: "Pratiques agricoles durables et responsables." },{ nom: "Certification", desc: "Conforme aux standards de qualité alimentaire." }] }),
      custom("specs_agri", "specs", { titre: "Informations produit", rows: [{ cle: "Origine", valeur: "Local / National" },{ cle: "Type de culture", valeur: "Voir description" },{ cle: "Conservation", valeur: "Voir description" },{ cle: "Conditionnement", valeur: "Voir description" },{ cle: "Saisonnalité", valeur: "Voir description" }] }),
      custom("features_agri", "features", { titre: "Nos engagements", items: [{ icone: "🌱", titre: "Agriculture locale", texte: "Soutien direct aux producteurs locaux, circuits courts garantis." },{ icone: "🌿", titre: "Sans pesticides", texte: "Culture naturelle, respect de l'environnement et des consommateurs." },{ icone: "📦", titre: "Livraison fraîche", texte: "Emballage adapté pour conserver toute la fraîcheur à la livraison." }] }),
      desc(), reviews(),
      custom("faq_agri", "faq", { titre: "Questions fréquentes", items: [{ question: "Quelle est la fraîcheur des produits ?", reponse: "Nos produits sont récoltés et expédiés dans les 24 à 48h. Fraîcheur garantie à la livraison." },{ question: "Puis-je commander en grande quantité ?", reponse: "Oui, nous gérons les commandes en gros pour restaurateurs et revendeurs. Contactez-nous pour un devis." },{ question: "Les produits sont-ils certifiés ?", reponse: "Nos producteurs respectent les bonnes pratiques agricoles. Certificats disponibles sur demande." }] }),
      similar("Ces produits vont avec vos achats"),
    ];

    case "services": return [
      info(), quantity(), trust(),
      custom("features_services", "features", { titre: "Ce qui est inclus dans votre forfait", items: [{ icone: "✅", titre: "Prestation complète", texte: "Service clé en main de A à Z, aucun frais caché." },{ icone: "⚡", titre: "Démarrage rapide", texte: "Lancement de votre projet sous 48h après commande." },{ icone: "🤝", titre: "Accompagnement dédié", texte: "Un expert à votre disposition tout au long de la mission." }] }),
      custom("howto_services", "howto", { titre: "Comment ça marche ?", steps: [{ num: "01", titre: "Commande", texte: "Passez votre commande en ligne et choisissez vos options." },{ num: "02", titre: "Brief", texte: "Nous vous contactons sous 24h pour définir vos besoins précis." },{ num: "03", titre: "Livraison", texte: "Réception de votre prestation dans les délais convenus avec satisfaction garantie." }] }),
      custom("testimonials_services", "testimonials", { titre: "Ils nous font confiance", items: [{ nom: "Kofi M.", note: 5, texte: "Service exceptionnel, rendu dans les délais et qualité irréprochable. Je recommande vivement !" },{ nom: "Aminata D.", note: 5, texte: "Équipe professionnelle et réactive. Mon projet a été transformé au-delà de mes attentes." }] }),
      desc(), reviews(),
      custom("faq_services", "faq", { titre: "Questions fréquentes", items: [{ question: "Quel est le délai d'exécution ?", reponse: "Le délai varie selon la prestation. Il est précisé dans la description. Nous respectons toujours les délais convenus." },{ question: "Que se passe-t-il si je ne suis pas satisfait ?", reponse: "Nous offrons des révisions illimitées jusqu'à votre satisfaction complète. Remboursement si non livré." },{ question: "Comment s'effectue le paiement ?", reponse: "Paiement sécurisé par Orange Money, Wave ou virement bancaire. Acompte de 50% à la commande." }] }),
      custom("guarantee_services", "guarantee", { titre: "Notre engagement qualité", items: [{ icone: "✅", titre: "Satisfaction garantie", texte: "Révisions illimitées jusqu'à votre validation complète." },{ icone: "⏱️", titre: "Respect des délais", texte: "Ponctualité absolue — pénalité en cas de retard de notre fait." },{ icone: "🔒", titre: "Confidentialité", texte: "Vos données et projets restent strictement confidentiels." }] }),
      custom("social_services", "social", {}),
    ];

    case "artisan": return [
      gallery("vertical-thumbs"), info(), variants(), quantity(), trust(),
      custom("features_artisan", "features", { titre: "L'excellence artisanale", items: [{ icone: "🤲", titre: "Fait à la main", texte: "Chaque pièce est façonnée entièrement à la main par nos artisans." },{ icone: "🌍", titre: "Savoir-faire local", texte: "Techniques transmises de génération en génération." },{ icone: "♻️", titre: "Matériaux durables", texte: "Matières premières locales, respectueuses de l'environnement." }] }),
      custom("howto_artisan", "howto", { titre: "Le processus de création", steps: [{ num: "01", titre: "Sélection", texte: "Choix rigoureux des matières premières locales de qualité supérieure." },{ num: "02", titre: "Façonnage", texte: "Travail minutieux à la main selon les techniques artisanales traditionnelles." },{ num: "03", titre: "Finitions", texte: "Contrôle qualité et finitions soignées avant expédition." }] }),
      custom("guarantee_artisan", "guarantee", { titre: "Notre promesse artisanale", items: [{ icone: "✦", titre: "Pièce unique", texte: "Chaque création est unique, légèrement différente des autres — c'est sa richesse." },{ icone: "📜", titre: "Certificat d'artisan", texte: "Livré avec le certificat du créateur et l'histoire de la pièce." },{ icone: "♻️", titre: "Éco-responsable", texte: "Processus de fabrication respectueux de l'environnement." }] }),
      desc(), reviews(),
      custom("faq_artisan", "faq", { titre: "Questions fréquentes", items: [{ question: "Les pièces sont-elles toutes identiques ?", reponse: "Chaque pièce étant faite à la main, il peut y avoir de légères variations. C'est ce qui rend chaque pièce unique et précieuse." },{ question: "Puis-je commander une pièce personnalisée ?", reponse: "Oui, nous acceptons les commandes sur mesure. Délai de 2 à 4 semaines selon la complexité." },{ question: "Comment entretenir ma pièce artisanale ?", reponse: "Instructions d'entretien incluses dans chaque colis selon la matière utilisée." }] }),
      similar("D'autres créations artisanales"),
    ];

    default: return [
      gallery("vertical-thumbs"), info(), variants(), quantity(), trust(),
      custom("features_default", "features", { titre: "Pourquoi nous choisir ?", items: [{ icone: "✅", titre: "Qualité garantie", texte: "Sélection rigoureuse de produits vérifiés et testés." },{ icone: "🚀", titre: "Livraison rapide", texte: "Expédition sous 24h, suivi en temps réel." },{ icone: "🤝", titre: "Service client 7j/7", texte: "Notre équipe répond à toutes vos questions rapidement." }] }),
      desc(), reviews(),
      custom("faq_default", "faq", { titre: "Questions fréquentes", items: [{ question: "Quels sont vos délais de livraison ?", reponse: "Livraison sous 24 à 48h pour les commandes passées avant 14h. Suivi disponible par WhatsApp." },{ question: "Comment retourner un produit ?", reponse: "Retour sous 14 jours. Contactez-nous par WhatsApp pour initier le retour, remboursement sous 48h." },{ question: "Quels modes de paiement acceptez-vous ?", reponse: "Orange Money, Wave, Moov Money, paiement à la livraison disponible." }] }),
      similar("Ces produits vous plairont aussi"),
    ];
  }
}

// ─── Détection de langue ──────────────────────────────────────────────────────
type Langue = "fr" | "en";

function detectLangue(pays?: string): Langue {
  if (!pays) return "fr";
  const p = pays.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  if (/nigeria|ghana|kenya|uganda|tanzania|zambia|zimbabwe|botswana|namibia|south.?africa|gambia|sierra.?leone|liberia|ethiopia|malawi|rwanda|angola|cameroon/.test(p)) return "en";
  return "fr";
}

// ─── Traductions UI ───────────────────────────────────────────────────────────
const TR: Record<Langue, {
  confiance: { icone: string; titre: string; texte: string }[];
  newsletterTitre: (nom: string) => string;
  newsletterTexte: string;
  newsletterPlaceholder: string;
  newsletterCta: string;
  vedettes: string; collections: string; promo: string;
  faq: string; avis: string;
}> = {
  fr: {
    confiance: [
      { icone: "📦", titre: "Livraison rapide",  texte: "Expédiée sous 24-48h" },
      { icone: "🔒", titre: "Paiement sécurisé", texte: "Orange Money, Wave, carte" },
      { icone: "↩️", titre: "Retours faciles",   texte: "Sous 14 jours" },
      { icone: "💬", titre: "Support 7j/7",       texte: "Réponse en moins d'1h" },
    ],
    newsletterTitre: (nom) => `Rejoignez ${nom}`,
    newsletterTexte: "Recevez nos offres exclusives et nouveautés en avant-première",
    newsletterPlaceholder: "votre@email.com",
    newsletterCta: "Je m'abonne",
    vedettes: "Nos meilleures ventes", collections: "Explorer par catégorie",
    promo: "Offres du moment", faq: "Questions fréquentes",
    avis: "Ce que disent nos clients",
  },
  en: {
    confiance: [
      { icone: "📦", titre: "Fast Delivery",    texte: "Shipped within 24-48h" },
      { icone: "🔒", titre: "Secure Payment",   texte: "Mobile Money, card — 100% secure" },
      { icone: "↩️", titre: "Easy Returns",     texte: "Within 14 days" },
      { icone: "💬", titre: "24/7 Support",     texte: "Response within 1 hour" },
    ],
    newsletterTitre: (nom) => `Join ${nom}`,
    newsletterTexte: "Get our exclusive deals and new arrivals first",
    newsletterPlaceholder: "your@email.com",
    newsletterCta: "Subscribe",
    vedettes: "Best Sellers", collections: "Shop by Category",
    promo: "Current Deals", faq: "Frequently Asked Questions",
    avis: "What Our Customers Say",
  },
};

// ─── Hero content bilingue par catégorie ──────────────────────────────────────
const HERO_EN: Partial<Record<CategoryType, (nom: string) => { titre: string; sousTitre: string; ctaTexte: string; annonce: string }>> = {
  fashion:  (nom) => ({ titre: `${nom} — Your Style, Your Identity`, sousTitre: "Carefully curated pieces to reveal your unique personality", ctaTexte: "Shop the Collection", annonce: `✦ Free delivery over 50$ ✦ -10% on your first order with WELCOME ✦ 14-day returns` }),
  beauty:   (nom) => ({ titre: `${nom} — Natural Beauty Revealed`, sousTitre: "Premium skincare crafted to celebrate your authentic beauty, naturally", ctaTexte: "Shop My Skincare", annonce: `✨ Free shipping over 30$ ✨ 100% natural formulas ✨ Satisfied or refunded` }),
  food:     (nom) => ({ titre: `${nom} — Authentic Flavours`, sousTitre: "Fresh products sourced from local farmers, delivered straight to you", ctaTexte: "Order Now", annonce: `🌿 Fresh products delivered in 24h ✦ 100% natural, no preservatives ✦ Order before 12pm for same-day delivery` }),
  tech:     (nom) => ({ titre: `${nom} — Innovation Within Reach`, sousTitre: "The best tech products at the best price, with authenticity guarantee and reactive support", ctaTexte: "Browse Catalogue", annonce: `🔒 100% genuine products ✦ 12-month warranty ✦ Express 24h delivery ✦ Responsive support` }),
  jewelry:  (nom) => ({ titre: `${nom} — Wear Your Story`, sousTitre: "Handcrafted jewellery that celebrates your heritage and elegance", ctaTexte: "Discover Collections", annonce: `✦ Free gift wrapping ✦ Authenticity certificate ✦ 30-day returns` }),
  home:     (nom) => ({ titre: `${nom} — Your Interior, Your Signature`, sousTitre: "Furniture and decor carefully selected to create your ideal living space", ctaTexte: "Explore the Store", annonce: `🏠 Home delivery ✦ Assembly included on selection ✦ 30-day satisfaction guarantee` }),
  health:   (nom) => ({ titre: `${nom} — Your Wellbeing First`, sousTitre: "Quality health and wellness products selected by experts for your daily routine", ctaTexte: "Shop Wellness", annonce: `✦ Authentic certified products ✦ Expert advice included ✦ Fast delivery` }),
  services: (nom) => ({ titre: `${nom} — Expertise That Makes the Difference`, sousTitre: "Professional services delivered on time, every time, with results guaranteed", ctaTexte: "View Our Services", annonce: `⚡ Results guaranteed ✦ Secure payment ✦ Start within 48h ✦ Unlimited revisions` }),
  general:  (nom) => ({ titre: `${nom} — Quality, Simply`, sousTitre: "Carefully selected products to satisfy you with every order and unbeatable service", ctaTexte: "Shop Now", annonce: `✦ Fast delivery 24-48h ✦ Secure payment ✦ Satisfaction guaranteed ✦ 7/7 support` }),
};

// ─── Sections homepage par catégorie ──────────────────────────────────────────
function buildHomeSections(type: CategoryType, nom: string, langue: Langue = "fr"): {
  sections: any;
  sectionOrder: string[];
  customSections: any[];
} {
  const nomCourt = nom.split(/[\s-]/)[0]; // premier mot du nom de boutique
  const t = TR[langue];
  const heroEn = HERO_EN[type]?.(nomCourt);

  const base = {
    confiance: {
      actif: true,
      layout: "icons" as const,
      items: t.confiance,
    },
    newsletter: (titre: string, texte: string, style: "centered" | "split" | "banner" = "centered") => ({
      actif: true,
      titre:       langue === "en" ? t.newsletterTitre(nomCourt) : titre,
      texte:       langue === "en" ? t.newsletterTexte            : texte,
      placeholder: t.newsletterPlaceholder,
      ctaTexte:    t.newsletterCta,
      style,
    }),
  };

  const fashionSections = {
    annonce: { actif: true, texte: heroEn?.annonce ?? `✦ Livraison gratuite dès 25 000 XOF ✦ -10% sur votre 1ère commande avec BIENVENUE ✦ Retour 14 jours`, couleurFond: "#111111", couleurTexte: "#F5A623" },
    hero: { actif: true, style: "fullscreen" as const, titre: heroEn?.titre ?? `${nomCourt} — Votre style, votre identité`, sousTitre: heroEn?.sousTitre ?? "Des pièces soigneusement sélectionnées pour révéler votre personnalité unique", ctaTexte: heroEn?.ctaTexte ?? "Découvrir la collection", ctaLien: "produits", overlay: 55, hauteur: "100vh" as const, textPosition: "center" as const, showSecondCta: true, secondCtaTexte: langue === "en" ? "View Collections" : "Voir les collections", secondCtaLien: "collections" },
    confiance: { ...base.confiance },
    vedettes: { actif: true, titre: langue === "en" ? `✦ ${t.vedettes}` : "✦ Nos Best-Sellers", nombre: 8, triPar: "ventes" as const, colonnes: 4, layout: "grid" as const, showRatings: true, showSoldCount: true },
    collections: { actif: true, titre: langue === "en" ? "Explore Collections" : "Explorer nos collections", layout: "masonry" as const },
    about: { actif: true, titre: `L'histoire de ${nomCourt}`, texte: "Née d'une passion pour la mode authentique, notre boutique propose une sélection de pièces uniques qui allient élégance et accessibilité. Chaque article est choisi avec soin pour vous offrir le meilleur.", layout: "image-right" as const, stats: [{ valeur: "500+", label: "Pièces disponibles" }, { valeur: "1000+", label: "Clientes satisfaites" }, { valeur: "4.9★", label: "Note moyenne" }] },
    promo: { actif: true, titre: "Nouvelle collection", texte: "Découvrez nos dernières arrivées avant tout le monde — pièces exclusives en quantité limitée", ctaTexte: "Voir les nouveautés", style: "gradient" as const },
    faq: { actif: true, titre: "Questions fréquentes", layout: "accordion" as const, items: [{ question: "Puis-je retourner un article ?", reponse: "Oui, vous disposez de 14 jours après réception pour retourner votre commande. Article dans son état d'origine." }, { question: "Quels modes de paiement ?", reponse: "Orange Money, Wave, Moov Money, paiement à la livraison disponible." }, { question: "Comment connaître ma taille ?", reponse: "Consultez notre guide des tailles disponible sur chaque fiche produit. En cas de doute, contactez-nous." }] },
    avis: { actif: true, titre: t.avis, layout: "carousel" as const, showPhotos: true },
    newsletter: base.newsletter("Rejoignez le club privé", "Accédez en avant-première aux nouvelles collections, ventes privées et offres exclusives", "split"),
  };

  const beautySections = {
    annonce: { actif: true, texte: heroEn?.annonce ?? `✨ Livraison offerte dès 15 000 XOF ✨ Formules 100% naturelles ✨ Satisfaite ou remboursée`, couleurFond: "#7c3aed", couleurTexte: "#ffffff" },
    hero: { actif: true, style: "split" as const, titre: heroEn?.titre ?? `${nomCourt} — La beauté naturelle révélée`, sousTitre: heroEn?.sousTitre ?? "Des soins premium formulés pour sublimer votre beauté authentique, naturellement", ctaTexte: heroEn?.ctaTexte ?? "Découvrir mes soins", ctaLien: "produits", overlay: 40, hauteur: "80vh" as const, textPosition: "left" as const, showSecondCta: true, secondCtaTexte: langue === "en" ? "Beauty Routine" : "Routine beauté", secondCtaLien: "collections" },
    confiance: { actif: true, layout: "icons" as const, items: langue === "en"
      ? [{ icone: "🌿", titre: "100% Natural", texte: "Vegan formulas, paraben-free" },{ icone: "🔬", titre: "Derm. tested", texte: "Validated by dermatologists" },{ icone: "🚀", titre: "24h Delivery", texte: "Shipped fast" },{ icone: "↩️", titre: "Satisfied or refunded", texte: "30 days to try" }]
      : [{ icone: "🌿", titre: "100% naturel", texte: "Formules vegan, sans parabènes" },{ icone: "🔬", titre: "Testé dermo", texte: "Validé par des dermatologues" },{ icone: "🚀", titre: "Livraison 24h", texte: "Expédiée rapidement" },{ icone: "↩️", titre: "Satisfaite ou remboursée", texte: "30 jours pour essayer" }] },
    vedettes: { actif: true, titre: langue === "en" ? `✨ ${t.vedettes}` : "✨ Nos soins best-sellers", nombre: 8, triPar: "ventes" as const, colonnes: 4, layout: "grid" as const, showRatings: true },
    collections: { actif: true, titre: langue === "en" ? "Your Beauty Routine" : "Votre routine beauté", layout: "grid" as const },
    about: { actif: true, titre: `L'ADN de ${nomCourt}`, texte: "Nous croyons que chaque peau est unique. C'est pourquoi nous formulons des soins naturels adaptés à la diversité des peaux africaines. Efficacité prouvée, ingrédients sourcés localement.", layout: "image-left" as const, stats: [{ valeur: "97%", label: "Satisfaites" }, { valeur: "50+", label: "Soins disponibles" }, { valeur: "0", label: "Produits nocifs" }] },
    promo: { actif: true, titre: "Votre routine offerte", texte: "Achetez 2 soins, obtenez le 3ème à -50% — composez votre routine idéale", ctaTexte: "Profiter de l'offre", style: "gradient" as const },
    faq: { actif: true, titre: "Vos questions beauté", layout: "accordion" as const, items: [{ question: "Ces soins conviennent-ils aux peaux sensibles ?", reponse: "Oui, toutes nos formules sont hypoallergéniques et testées dermatologiquement pour les peaux les plus sensibles." }, { question: "Quand verrai-je les résultats ?", reponse: "La plupart de nos clientes observent des résultats visibles après 2 à 4 semaines d'utilisation régulière." }, { question: "Les produits sont-ils vegan et cruelty-free ?", reponse: "Absolument, tous nos produits sont 100% vegan et non testés sur les animaux." }] },
    avis: { actif: true, titre: langue === "en" ? "They Love Their Skincare" : "Elles adorent leurs soins", layout: "masonry" as const, showPhotos: true },
    newsletter: base.newsletter("Votre routine beauté offerte", "Inscrivez-vous et recevez notre guide de routine beauté personnalisée + -15% sur votre 1ère commande", "split"),
  };

  const foodSections = {
    annonce: { actif: true, texte: heroEn?.annonce ?? `🌿 Produits frais livrés sous 24h ✦ 100% naturels, sans conservateurs ✦ Commandez avant 12h pour livraison le jour même`, couleurFond: "#c2622d", couleurTexte: "#ffffff" },
    hero: { actif: true, style: "split" as const, titre: heroEn?.titre ?? `${nomCourt} — La saveur authentique`, sousTitre: heroEn?.sousTitre ?? "Des produits frais sélectionnés auprès de producteurs locaux, livrés directement chez vous", ctaTexte: heroEn?.ctaTexte ?? "Commander maintenant", ctaLien: "produits", overlay: 35, hauteur: "70vh" as const, textPosition: "left" as const },
    confiance: { actif: true, layout: "icons" as const, items: langue === "en"
      ? [{ icone: "🌿", titre: "100% Natural", texte: "No artificial preservatives" },{ icone: "🏡", titre: "Local Farmers", texte: "Short supply chain, freshness guaranteed" },{ icone: "❄️", titre: "Cold Chain", texte: "Temperature-controlled delivery" },{ icone: "📦", titre: "24h Delivery", texte: "Shipped within 24h" }]
      : [{ icone: "🌿", titre: "100% naturel", texte: "Sans conservateurs artificiels" },{ icone: "🏡", titre: "Producteurs locaux", texte: "Circuit court, frais garanti" },{ icone: "❄️", titre: "Chaîne du froid", texte: "Livraison température contrôlée" },{ icone: "📦", titre: "Livraison 24h", texte: "Expédiée sous 24h" }] },
    vedettes: { actif: true, titre: langue === "en" ? `🌟 ${t.vedettes}` : "🌟 Nos incontournables", nombre: 8, triPar: "ventes" as const, colonnes: 4, layout: "grid" as const, showRatings: true },
    collections: { actif: true, titre: t.collections, layout: "grid" as const },
    about: { actif: true, titre: `L'histoire de ${nomCourt}`, texte: "Depuis notre création, nous travaillons directement avec les meilleurs producteurs locaux pour vous apporter des produits frais, naturels et de qualité supérieure. Notre engagement : la traçabilité totale de vos aliments.", layout: "image-right" as const, stats: [{ valeur: "50+", label: "Producteurs partenaires" }, { valeur: "200+", label: "Produits disponibles" }, { valeur: "4.8★", label: "Satisfaction client" }] },
    promo: { actif: true, titre: "Panier saveurs", texte: "Composez votre panier de produits frais — livraison offerte dès 20 000 XOF", ctaTexte: "Composer mon panier", style: "split" as const },
    faq: { actif: true, titre: "Questions fréquentes", layout: "accordion" as const, items: [{ question: "Les produits sont-ils vraiment frais ?", reponse: "Oui, nos produits sont récoltés ou préparés dans les 24h avant expédition. Fraîcheur garantie à la livraison." }, { question: "Puis-je commander en gros ?", reponse: "Oui, nous gérons les commandes en gros pour les professionnels. Contactez-nous pour un devis personnalisé." }, { question: "Quel est votre zone de livraison ?", reponse: "Nous livrons dans la capitale et les principales villes. Consultez notre page de livraison pour plus de détails." }] },
    avis: { actif: true, titre: langue === "en" ? "They Love Our Products" : "Ils adorent nos produits", layout: "cards" as const },
    newsletter: base.newsletter("Offre découverte", "Inscrivez-vous et bénéficiez de -10% sur votre première commande + nos recettes hebdomadaires"),
  };

  const techSections = {
    annonce: { actif: true, texte: heroEn?.annonce ?? `🔒 Produits 100% authentiques ✦ Garantie 12 mois ✦ Livraison express 24h ✦ SAV réactif`, couleurFond: "#00b4d8", couleurTexte: "#ffffff" },
    hero: { actif: true, style: "centered" as const, titre: heroEn?.titre ?? `${nomCourt} — L'innovation à votre portée`, sousTitre: heroEn?.sousTitre ?? "Les meilleurs produits tech au meilleur prix, avec garantie d'authenticité et SAV réactif", ctaTexte: heroEn?.ctaTexte ?? "Explorer le catalogue", ctaLien: "produits", overlay: 60, hauteur: "80vh" as const, textPosition: "center" as const, showSecondCta: true, secondCtaTexte: langue === "en" ? "Our Guarantees" : "Nos garanties", secondCtaLien: "collections" },
    confiance: { actif: true, layout: "icons" as const, items: langue === "en"
      ? [{ icone: "✅", titre: "100% Genuine", texte: "Authenticity certificate guaranteed" },{ icone: "🛡️", titre: "12-Month Warranty", texte: "Professional support included" },{ icone: "🚀", titre: "24h Delivery", texte: "Secure packaging" },{ icone: "🔄", titre: "30-Day Returns", texte: "Guaranteed refund" }]
      : [{ icone: "✅", titre: "100% authentique", texte: "Certification d'authenticité garantie" },{ icone: "🛡️", titre: "Garantie 12 mois", texte: "SAV professionnel inclus" },{ icone: "🚀", titre: "Livraison 24h", texte: "Emballage sécurisé" },{ icone: "🔄", titre: "Retour 30 jours", texte: "Remboursement garanti" }] },
    vedettes: { actif: true, titre: langue === "en" ? `🏆 ${t.vedettes}` : "🏆 Les meilleures ventes", nombre: 8, triPar: "ventes" as const, colonnes: 4, layout: "grid" as const, showRatings: true, showSoldCount: true },
    collections: { actif: true, titre: langue === "en" ? "By Category" : "Par catégorie", layout: "grid" as const },
    about: { actif: true, titre: `Pourquoi ${nomCourt} ?`, texte: "Spécialiste de la tech depuis plusieurs années, nous sélectionnons rigoureusement chaque produit pour vous garantir authenticité, qualité et performance. Chaque achat est couvert par notre garantie et notre SAV réactif.", layout: "image-right" as const, stats: [{ valeur: "5000+", label: "Clients satisfaits" }, { valeur: "1000+", label: "Produits en stock" }, { valeur: "12 mois", label: "Garantie incluse" }] },
    promo: { actif: true, titre: "Offre reconditionnés premium", texte: "Économisez jusqu'à 40% avec nos produits reconditionnés certifiés — qualité garantie", ctaTexte: "Voir les offres", style: "gradient" as const },
    faq: { actif: true, titre: "Questions fréquentes", layout: "accordion" as const, items: [{ question: "Les produits sont-ils garantis authentiques ?", reponse: "Oui, tous nos produits sont authentiques avec numéro de série vérifiable. Certificat d'authenticité inclus." }, { question: "La garantie est-elle valable localement ?", reponse: "Oui, notre SAV prend en charge toutes les réparations sous garantie localement, sans avoir à exporter le produit." }, { question: "Acceptez-vous les paiements en plusieurs fois ?", reponse: "Oui, nous proposons un paiement en 2 à 3 fois sans frais pour les achats supérieurs à 100 000 XOF." }] },
    avis: { actif: true, titre: langue === "en" ? "They Trust Us" : "Ils nous font confiance", layout: "cards" as const },
    newsletter: base.newsletter("Alertes bons plans tech", "Recevez en premier nos offres exclusives, nouveautés et promotions flash — désabonnement possible à tout moment", "banner"),
  };

  const homeSections = {
    annonce: { actif: true, texte: heroEn?.annonce ?? `🏠 Livraison à domicile ✦ Montage offert sur sélection ✦ Satisfaction garantie 30 jours`, couleurFond: "#4ade80", couleurTexte: "#071a0b" },
    hero: { actif: true, style: "split" as const, titre: heroEn?.titre ?? `${nomCourt} — Votre intérieur, votre signature`, sousTitre: heroEn?.sousTitre ?? "Des meubles et décorations soigneusement sélectionnés pour créer votre espace de vie idéal", ctaTexte: heroEn?.ctaTexte ?? "Explorer la boutique", ctaLien: "produits", overlay: 35, hauteur: "80vh" as const, textPosition: "left" as const },
    confiance: { ...base.confiance },
    vedettes: { actif: true, titre: "✨ Nos best-sellers déco", nombre: 8, triPar: "ventes" as const, colonnes: 4, layout: "grid" as const },
    collections: { actif: true, titre: "Par pièce de vie", layout: "grid" as const },
    about: { actif: true, titre: `L'univers ${nomCourt}`, texte: "Convaincus que votre intérieur doit refléter votre personnalité, nous sélectionnons des pièces alliant design contemporain et matières durables. Chaque produit est testé avant d'intégrer notre catalogue.", layout: "image-right" as const },
    promo: { actif: true, titre: "Rénovation printemps", texte: "Jusqu'à -30% sur une sélection de meubles et décorations — offre limitée", ctaTexte: "Profiter des offres", style: "gradient" as const },
    faq: { actif: true, titre: "Questions fréquentes", layout: "accordion" as const, items: [{ question: "Le montage est-il inclus ?", reponse: "Le montage est offert sur une sélection de meubles dans certaines villes. Disponibilité précisée sur la fiche produit." }, { question: "Livrez-vous les grands meubles ?", reponse: "Oui, nous disposons d'une flotte adaptée au transport de meubles. Livraison planifiée selon vos disponibilités." }, { question: "Puis-je voir les produits avant achat ?", reponse: "Oui, notre showroom est ouvert du lundi au samedi. Contactez-nous pour prendre rendez-vous." }] },
    avis: { actif: true, titre: "Ils ont transformé leur intérieur", layout: "cards" as const },
    newsletter: base.newsletter("Inspirations déco", "Abonnez-vous pour recevoir nos conseils déco, idées d'aménagement et offres exclusives"),
  };

  const servicesSections = {
    annonce: { actif: true, texte: heroEn?.annonce ?? `⚡ Résultats garantis ✦ Paiement sécurisé ✦ Démarrage sous 48h ✦ Révisions illimitées`, couleurFond: "#7c3aed", couleurTexte: "#ffffff" },
    hero: { actif: true, style: "centered" as const, titre: heroEn?.titre ?? `${nomCourt} — L'expertise qui fait la différence`, sousTitre: heroEn?.sousTitre ?? "Des prestations professionnelles calibrées pour dépasser vos attentes, livrées dans les délais", ctaTexte: heroEn?.ctaTexte ?? "Voir nos prestations", ctaLien: "produits", overlay: 50, hauteur: "80vh" as const, textPosition: "center" as const, showSecondCta: true, secondCtaTexte: langue === "en" ? "Contact Us" : "Nous contacter", secondCtaLien: "contact" },
    confiance: { actif: true, layout: "icons" as const, items: [{ icone: "✅", titre: "Résultat garanti", texte: "Révisions jusqu'à satisfaction" },{ icone: "⚡", titre: "Démarrage 48h", texte: "Rapidité & réactivité" },{ icone: "🔒", titre: "Confidentialité", texte: "Vos données protégées" },{ icone: "🏆", titre: "Expertise certifiée", texte: "Professionnels qualifiés" }] },
    vedettes: { actif: true, titre: "Nos prestations phares", nombre: 6, triPar: "ventes" as const, colonnes: 3, layout: "grid" as const },
    collections: { actif: true, titre: "Nos domaines d'expertise", layout: "cards" as const },
    about: { actif: true, titre: `Qui sommes-nous ?`, texte: `${nomCourt} est une agence de professionnels qualifiés dédiés à votre succès. Notre approche : comprendre vos enjeux, proposer des solutions adaptées, livrer des résultats mesurables. Chaque mission est unique.`, layout: "image-right" as const, stats: [{ valeur: "200+", label: "Missions réalisées" }, { valeur: "98%", label: "Clients satisfaits" }, { valeur: "48h", label: "Délai de démarrage" }] },
    promo: { actif: true, titre: "Offre de lancement", texte: "-20% sur votre première prestation — profitez de nos tarifs préférentiels exclusifs", ctaTexte: "Saisir l'offre", style: "gradient" as const },
    faq: { actif: true, titre: "Questions fréquentes", layout: "accordion" as const, items: [{ question: "Comment démarrer une mission avec vous ?", reponse: "Commandez en ligne, nous vous contactons sous 24h pour un brief détaillé et le lancement de la mission sous 48h." }, { question: "Que se passe-t-il si le résultat ne me convient pas ?", reponse: "Nous offrons des révisions illimitées jusqu'à votre satisfaction complète. Si non livré, remboursement total." }, { question: "Travaillez-vous avec des entreprises de toute taille ?", reponse: "Oui, nous accompagnons aussi bien les entrepreneurs individuels que les grandes entreprises." }] },
    avis: { actif: true, titre: "Ce que disent nos clients", layout: "carousel" as const },
    newsletter: base.newsletter("Conseils business gratuits", "Recevez chaque semaine nos meilleures stratégies et conseils pour développer votre activité", "banner"),
  };

  // Mapping type → sections + order + customSections
  const configs: Record<CategoryType, { sections: any; sectionOrder: string[]; customSections: any[] }> = {
    fashion: {
      sections: fashionSections,
      sectionOrder: ["annonce","hero","confiance","vedettes","collections","promo","avis","about","faq","newsletter"],
      customSections: [
        { id: "stats_fashion", type: "stats", actif: true, label: "Nos chiffres", ordre: 5, config: { items: [{ valeur: "10 000+", label: "Clientes satisfaites" },{ valeur: "500+", label: "Pièces disponibles" },{ valeur: "4.9★", label: "Note moyenne" },{ valeur: "48h", label: "Livraison express" }] } },
      ],
    },
    beauty: {
      sections: beautySections,
      sectionOrder: ["annonce","hero","confiance","vedettes","about","promo","avis","faq","newsletter"],
      customSections: [
        { id: "stats_beauty", type: "stats", actif: true, label: "Nos résultats", ordre: 4, config: { items: [{ valeur: "4500+", label: "Clientes satisfaites" },{ valeur: "97%", label: "Recommandent" },{ valeur: "50+", label: "Soins naturels" },{ valeur: "4 sem.", label: "Résultats visibles" }] } },
      ],
    },
    food: {
      sections: foodSections,
      sectionOrder: ["annonce","hero","confiance","vedettes","collections","about","promo","avis","faq","newsletter"],
      customSections: [
        { id: "brands_food", type: "brands", actif: true, label: "Nos producteurs", ordre: 7, config: { titre: "Nos producteurs partenaires", logos: [] } },
      ],
    },
    tech: {
      sections: techSections,
      sectionOrder: ["annonce","hero","confiance","vedettes","collections","about","faq","promo","avis","newsletter"],
      customSections: [
        { id: "stats_tech", type: "stats", actif: true, label: "En chiffres", ordre: 5, config: { items: [{ valeur: "5000+", label: "Clients satisfaits" },{ valeur: "100%", label: "Authentique" },{ valeur: "12 mois", label: "Garantie" },{ valeur: "48h", label: "SAV réactif" }] } },
      ],
    },
    home: {
      sections: homeSections,
      sectionOrder: ["annonce","hero","confiance","collections","vedettes","promo","avis","about","faq","newsletter"],
      customSections: [],
    },
    jewelry: {
      sections: { ...fashionSections, annonce: { actif: true, texte: `💎 Bijoux authentiques ✦ Livraison sécurisée sous 24h ✦ Écrin offert ✦ Certificat d'authenticité`, couleurFond: "#1a0e00", couleurTexte: "#f5a623" }, hero: { actif: true, style: "fullscreen" as const, titre: `${nomCourt} — Chaque bijou raconte une histoire`, sousTitre: "Des créations d'exception façonnées par des maîtres joailliers, pour vos moments précieux", ctaTexte: "Découvrir les collections", ctaLien: "produits", overlay: 50, hauteur: "100vh" as const, textPosition: "center" as const } },
      sectionOrder: ["annonce","hero","confiance","vedettes","collections","about","promo","avis","newsletter"],
      customSections: [],
    },
    kids: {
      sections: { ...fashionSections, annonce: { actif: true, texte: `👶 Produits certifiés CE ✦ Matériaux non toxiques ✦ Livraison sécurisée ✦ Retour 14 jours`, couleurFond: "#f59e0b", couleurTexte: "#ffffff" } },
      sectionOrder: ["annonce","hero","confiance","vedettes","collections","about","promo","avis","faq","newsletter"],
      customSections: [],
    },
    health: {
      sections: { ...beautySections, annonce: { actif: true, texte: `🌿 Formules naturelles certifiées ✦ Testées cliniquement ✦ Satisfait ou remboursé 30 jours`, couleurFond: "#15803d", couleurTexte: "#ffffff" } },
      sectionOrder: ["annonce","hero","confiance","vedettes","about","promo","avis","faq","newsletter"],
      customSections: [],
    },
    sport: {
      sections: { ...techSections, annonce: { actif: true, texte: `⚡ Équipements pro ✦ Livraison express 24h ✦ Guide des tailles offert ✦ Retour 30 jours`, couleurFond: "#0a0a0a", couleurTexte: "#F5A623" } },
      sectionOrder: ["annonce","hero","confiance","vedettes","collections","promo","avis","about","newsletter"],
      customSections: [
        { id: "stats_sport", type: "stats", actif: true, label: "Nos athlètes", ordre: 5, config: { items: [{ valeur: "3000+", label: "Athlètes équipés" },{ valeur: "200+", label: "Références sport" },{ valeur: "4.8★", label: "Satisfaction" },{ valeur: "24h", label: "Livraison express" }] } },
      ],
    },
    services: {
      sections: servicesSections,
      sectionOrder: ["annonce","hero","about","confiance","vedettes","promo","avis","faq","newsletter"],
      customSections: [
        { id: "cta_services", type: "cta-band", actif: true, label: "Appel à l'action", ordre: 8, config: { titre: "Prêt à démarrer votre projet ?", texte: "Contactez-nous aujourd'hui — réponse sous 2h garantie", ctaTexte: "Démarrer maintenant", style: "gradient" } },
      ],
    },
    agriculture: {
      sections: foodSections,
      sectionOrder: ["annonce","hero","confiance","vedettes","about","collections","promo","avis","faq","newsletter"],
      customSections: [],
    },
    artisan: {
      sections: { ...fashionSections, hero: { actif: true, style: "magazine" as const, titre: `${nomCourt} — L'artisanat comme art de vivre`, sousTitre: "Des créations uniques façonnées à la main selon des savoir-faire traditionnels transmis de génération en génération", ctaTexte: "Découvrir les créations", ctaLien: "produits", overlay: 45, hauteur: "80vh" as const, textPosition: "left" as const } },
      sectionOrder: ["annonce","hero","confiance","vedettes","about","collections","promo","avis","newsletter"],
      customSections: [],
    },
    books: {
      sections: { ...fashionSections, annonce: { actif: true, texte: `📚 Livraison offerte dès 10 000 XOF ✦ Catalogue de 5000+ titres ✦ Livres neufs garantis`, couleurFond: "#c2622d", couleurTexte: "#ffffff" } },
      sectionOrder: ["annonce","hero","confiance","vedettes","collections","about","avis","newsletter"],
      customSections: [],
    },
    auto: {
      sections: { ...techSections, annonce: { actif: true, texte: `🔧 Pièces authentiques garanties ✦ Compatibilité vérifiée ✦ Livraison express ✦ SAV expert`, couleurFond: "#010d1f", couleurTexte: "#00b4d8" } },
      sectionOrder: ["annonce","hero","confiance","vedettes","collections","promo","faq","avis","newsletter"],
      customSections: [],
    },
    general: {
      sections: {
        annonce: { actif: true, texte: heroEn?.annonce ?? `✦ Livraison rapide 24-48h ✦ Paiement sécurisé ✦ Satisfaction garantie ✦ Support 7j/7`, couleurFond: "#c2622d", couleurTexte: "#ffffff" },
        hero: { actif: true, style: "split" as const, titre: heroEn?.titre ?? `${nomCourt} — La qualité, simplement`, sousTitre: heroEn?.sousTitre ?? "Des produits soigneusement sélectionnés pour vous satisfaire à chaque commande, avec un service client irréprochable", ctaTexte: heroEn?.ctaTexte ?? "Découvrir nos produits", ctaLien: "produits", overlay: 35, hauteur: "80vh" as const, textPosition: "left" as const },
        confiance: { ...base.confiance },
        vedettes: { actif: true, titre: t.vedettes, nombre: 8, triPar: "ventes" as const, colonnes: 4, layout: "grid" as const, showRatings: true },
        collections: { actif: true, titre: t.collections, layout: "grid" as const },
        about: { actif: true, titre: langue === "en" ? `About ${nomCourt}` : `À propos de ${nomCourt}`, texte: langue === "en" ? "Founded with the ambition to offer you the best value for money, our store rigorously selects every product to guarantee your satisfaction. Customer service available 7 days a week." : "Fondée avec l'ambition de vous offrir le meilleur rapport qualité-prix, notre boutique sélectionne rigoureusement chaque produit pour garantir votre satisfaction. Service client disponible 7j/7.", layout: "image-right" as const, stats: [{ valeur: "1000+", label: langue === "en" ? "Happy Customers" : "Clients satisfaits" }, { valeur: "500+", label: langue === "en" ? "Products Available" : "Produits disponibles" }, { valeur: "4.8★", label: langue === "en" ? "Average Rating" : "Note moyenne" }] },
        promo: { actif: true, titre: t.promo, texte: langue === "en" ? "Discover our exclusive promotions, available for a limited time" : "Découvrez nos promotions exclusives, disponibles pour une durée limitée", ctaTexte: langue === "en" ? "View Deals" : "Voir les offres", style: "gradient" as const },
        faq: { actif: true, titre: t.faq, layout: "accordion" as const, items: langue === "en"
          ? [{ question: "What are your delivery times?", reponse: "Delivery within 24 to 48h for orders placed before 2pm. WhatsApp tracking." }, { question: "Which payment methods do you accept?", reponse: "Mobile Money, bank card, cash on delivery available. 100% secure transactions." }, { question: "How do I return an item?", reponse: "Return within 14 days. Contact us on WhatsApp, refund within 48h." }]
          : [{ question: "Quels sont vos délais de livraison ?", reponse: "Livraison sous 24 à 48h pour les commandes passées avant 14h. Suivi par WhatsApp." }, { question: "Quels modes de paiement acceptez-vous ?", reponse: "Orange Money, Wave, Moov Money, paiement à la livraison. Transactions 100% sécurisées." }, { question: "Comment retourner un article ?", reponse: "Retour sous 14 jours. Contactez-nous par WhatsApp, remboursement sous 48h." }] },
        avis: { actif: true, titre: t.avis, layout: "cards" as const },
        newsletter: base.newsletter("Offres exclusives", "Inscrivez-vous et recevez en avant-première nos meilleures offres et nouveautés"),
      },
      sectionOrder: ["annonce","hero","confiance","vedettes","collections","about","promo","avis","faq","newsletter"],
      customSections: [],
    },
  };

  return configs[type] || configs.general;
}

// ─── Pages À propos & Contact par catégorie ───────────────────────────────────
// Contenu tenant en 2-3 blocs CustomSection réutilisant la même bibliothèque
// que la home (richtext/stats/features) — pour qu'une boutique neuve n'affiche
// jamais un "À propos" vide. Bespoke pour les catégories les plus fréquentes
// (fashion, food, tech, services), générique de bonne qualité pour le reste.
export function buildAboutContactPages(type: CategoryType, nom: string, langue: Langue = "fr"): {
  aboutPage: ThemeAboutPageConfig;
  contactPage: ThemeContactPageConfig;
} {
  const nomCourt = nom.split(/[\s-]/)[0];
  const en = langue === "en";

  const section = (
    id: string,
    sectionType: CustomSection["type"],
    label: string,
    ordre: number,
    config: Record<string, any>
  ): CustomSection => ({ id, type: sectionType, actif: true, label, ordre, config });

  const richtext = (id: string, ordre: number, titre: string, texte: string): CustomSection =>
    section(id, "richtext", en ? "Our Story" : "Notre histoire", ordre, { titre, texte });

  const stats = (id: string, ordre: number, items: Array<{ valeur: string; label: string }>): CustomSection =>
    section(id, "stats", en ? "Stats" : "Statistiques", ordre, { items });

  const features = (
    id: string,
    ordre: number,
    titre: string,
    items: Array<{ icone: string; titre: string; texte: string }>
  ): CustomSection => section(id, "features", en ? "Why us" : "Points forts", ordre, { titre, items });

  let aboutSections: CustomSection[];
  let contactIntro: string;

  switch (type) {
    case "fashion":
      aboutSections = [
        richtext(
          "about_histoire",
          1,
          en ? "Our Story" : "Notre histoire",
          en
            ? `${nomCourt} was born from a passion for fashion that tells a story. We hand-pick every piece so it stays with you well beyond a single season. Today, thousands of customers trust us to express their style.`
            : `${nomCourt} est né d'une passion pour la mode qui raconte une histoire. Nous sélectionnons chaque pièce avec exigence pour qu'elle vous accompagne bien au-delà d'une saison. Aujourd'hui, des milliers de clientes nous font confiance pour affirmer leur style.`
        ),
        stats("about_stats", 2, [
          { valeur: "10 000+", label: en ? "Happy customers" : "Clientes satisfaites" },
          { valeur: "500+", label: en ? "Available pieces" : "Pièces disponibles" },
          { valeur: "4.9★", label: en ? "Average rating" : "Note moyenne" },
          { valeur: "48h", label: en ? "Express delivery" : "Livraison express" },
        ]),
        features("about_features", 3, en ? "Why choose us" : "Pourquoi nous faire confiance", [
          { icone: "✦", titre: en ? "Premium quality" : "Qualité premium", texte: en ? "Materials carefully selected for lasting comfort." : "Des matières soigneusement sélectionnées pour un confort durable." },
          { icone: "🚀", titre: en ? "Fast delivery" : "Livraison rapide", texte: en ? "Shipped within 24h, tracked in real time." : "Expédiée sous 24h, suivi en temps réel." },
          { icone: "↩️", titre: en ? "Easy returns" : "Retours faciles", texte: en ? "Exchange or refund within 14 days." : "Échange ou remboursement sous 14 jours." },
        ]),
      ];
      contactIntro = en
        ? `A question about an order or a piece? The ${nomCourt} team is here to help you find your style.`
        : `Une question sur une commande ou une pièce ? L'équipe ${nomCourt} est là pour vous aider à trouver votre style.`;
      break;

    case "food":
      aboutSections = [
        richtext(
          "about_histoire",
          1,
          en ? "Our Story" : "Notre histoire",
          en
            ? `${nomCourt} works hand in hand with local producers to bring fresh, authentic products to your table. Every item is chosen for its quality and its origin. Our commitment: full traceability from farm to doorstep.`
            : `${nomCourt} travaille main dans la main avec des producteurs locaux pour vous apporter des produits frais et authentiques. Chaque article est choisi pour sa qualité et son origine. Notre engagement : une traçabilité totale, du producteur jusqu'à votre porte.`
        ),
        stats("about_stats", 2, [
          { valeur: "50+", label: en ? "Partner producers" : "Producteurs partenaires" },
          { valeur: "200+", label: en ? "Products available" : "Produits disponibles" },
          { valeur: "4.8★", label: en ? "Customer satisfaction" : "Satisfaction client" },
          { valeur: "24h", label: en ? "Freshly delivered" : "Livraison fraîcheur" },
        ]),
      ];
      contactIntro = en
        ? `A question about a product or a delivery? Write to us — the ${nomCourt} team replies quickly, every day.`
        : `Une question sur un produit ou une livraison ? Écrivez-nous — l'équipe ${nomCourt} répond vite, tous les jours.`;
      break;

    case "tech":
      aboutSections = [
        richtext(
          "about_histoire",
          1,
          en ? "Our Story" : "Notre histoire",
          en
            ? `${nomCourt} was founded to make quality tech accessible, with a guarantee of authenticity on every product. We rigorously test our catalogue and back it with responsive after-sales support. Your trust is our best warranty.`
            : `${nomCourt} a été fondée pour rendre la tech de qualité accessible, avec une garantie d'authenticité sur chaque produit. Nous testons rigoureusement notre catalogue et l'accompagnons d'un SAV réactif. Votre confiance est notre meilleure garantie.`
        ),
        stats("about_stats", 2, [
          { valeur: "5000+", label: en ? "Happy customers" : "Clients satisfaits" },
          { valeur: "100%", label: en ? "Genuine products" : "Produits authentiques" },
          { valeur: "12 mois", label: en ? "Warranty" : "Garantie" },
          { valeur: "48h", label: en ? "Responsive support" : "SAV réactif" },
        ]),
        features("about_features", 3, en ? "Buy with confidence" : "Acheter en toute confiance", [
          { icone: "✅", titre: en ? "Authenticity guaranteed" : "Authenticité garantie", texte: en ? "Verifiable serial number and certificate on every unit." : "Numéro de série vérifiable et certificat sur chaque appareil." },
          { icone: "🛡️", titre: en ? "12-month warranty" : "Garantie 12 mois", texte: en ? "Parts and labour covered, responsive support." : "Pièces et main-d'œuvre couvertes, SAV réactif." },
          { icone: "📦", titre: en ? "Secure shipping" : "Livraison sécurisée", texte: en ? "Reinforced packaging, insured transport." : "Emballage renforcé, transport assuré." },
        ]),
      ];
      contactIntro = en
        ? `A question about a spec sheet or the warranty? The ${nomCourt} support team answers fast.`
        : `Une question sur une fiche technique ou la garantie ? Le support ${nomCourt} vous répond rapidement.`;
      break;

    case "services":
      aboutSections = [
        richtext(
          "about_histoire",
          1,
          en ? "Who We Are" : "Qui sommes-nous",
          en
            ? `${nomCourt} is a team of qualified professionals dedicated to your success. Our approach: understand your challenges, propose the right solution, deliver measurable results. Every engagement is unique.`
            : `${nomCourt} est une équipe de professionnels qualifiés dédiés à votre réussite. Notre approche : comprendre vos enjeux, proposer la solution adaptée, livrer des résultats mesurables. Chaque mission est unique.`
        ),
        stats("about_stats", 2, [
          { valeur: "200+", label: en ? "Projects delivered" : "Missions réalisées" },
          { valeur: "98%", label: en ? "Happy clients" : "Clients satisfaits" },
          { valeur: "48h", label: en ? "Kickoff time" : "Délai de démarrage" },
        ]),
        features("about_features", 3, en ? "What you get" : "Ce que vous obtenez", [
          { icone: "✅", titre: en ? "End-to-end delivery" : "Prestation complète", texte: en ? "A turnkey service, no hidden fees." : "Un service clé en main, sans frais cachés." },
          { icone: "🤝", titre: en ? "Dedicated support" : "Accompagnement dédié", texte: en ? "One expert available throughout your project." : "Un expert à votre disposition tout au long de la mission." },
          { icone: "🔒", titre: en ? "Confidentiality" : "Confidentialité", texte: en ? "Your data and projects stay strictly confidential." : "Vos données et projets restent strictement confidentiels." },
        ]),
      ];
      contactIntro = en
        ? `A project in mind? Tell the ${nomCourt} team about it — we get back to you within 24h.`
        : `Un projet en tête ? Parlez-en à l'équipe ${nomCourt} — nous revenons vers vous sous 24h.`;
      break;

    default:
      aboutSections = [
        richtext(
          "about_histoire",
          1,
          en ? "Our Story" : "Notre histoire",
          en
            ? `${nomCourt} was founded with one ambition: offer you the best value for money on every product. We rigorously select our catalogue and stand behind it with attentive customer service. Thank you for being part of our story.`
            : `${nomCourt} a été fondée avec l'ambition de vous offrir le meilleur rapport qualité-prix sur chaque produit. Nous sélectionnons rigoureusement notre catalogue et l'accompagnons d'un service client attentif. Merci de faire partie de notre histoire.`
        ),
        stats("about_stats", 2, [
          { valeur: "1000+", label: en ? "Happy customers" : "Clients satisfaits" },
          { valeur: "500+", label: en ? "Products available" : "Produits disponibles" },
          { valeur: "4.8★", label: en ? "Average rating" : "Note moyenne" },
        ]),
      ];
      contactIntro = en
        ? `A question about an order or a product? The ${nomCourt} team replies quickly, every day.`
        : `Une question sur une commande ou un produit ? L'équipe ${nomCourt} vous répond rapidement, tous les jours.`;
      break;
  }

  return {
    aboutPage: { actif: true, sections: aboutSections },
    contactPage: { actif: true, intro: contactIntro, afficherFormulaire: true, sections: [] },
  };
}

// ─── Sélection de la mise en page produit par catégorie ──────────────────────
function selectProductLayout(type: CategoryType): "amazon" | "classic" | "minimal" | "fullwidth" {
  if (["fashion","beauty","jewelry","artisan"].includes(type)) return "amazon";
  if (["services"].includes(type)) return "minimal";
  return "amazon";
}

// ─── Générateur principal ─────────────────────────────────────────────────────
export function generateStoreConfig(opts: {
  categorie: string;
  nomBoutique: string;
  pays?: string;
  devise?: string;
}): { themeConfig: Record<string, any> } {
  const { categorie, nomBoutique, pays } = opts;
  const type   = detectCategory(categorie);
  const langue = detectLangue(pays);
  const { sections, sectionOrder, customSections } = buildHomeSections(type, nomBoutique, langue);
  const productSections = buildProductSections(type);
  const productLayout = selectProductLayout(type);
  const { aboutPage, contactPage } = buildAboutContactPages(type, nomBoutique, langue);

  const themeConfig: Record<string, any> = {
    sections,
    sectionOrder,
    customSections,
    productPage: {
      layout: productLayout,
      sections: productSections,
    },
    aboutPage,
    contactPage,
  };

  return { themeConfig };
}
